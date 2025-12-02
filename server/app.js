const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const { execSync } = require('child_process');
const { buildPostHtml } = require('./html-generator');

// config 로드
const configPath = path.join(__dirname, '../config.json');
const config = fs.readJsonSync(configPath);
const ENCODING = config.encoding || 'utf-8';

// blogRoot가 절대 경로인지 상대 경로인지 확인하여 처리
const BLOG_ROOT = path.isAbsolute(config.blogRoot)
    ? config.blogRoot
    : path.join(__dirname, '..', config.blogRoot);

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || config.server?.port || 3001;

// 포트 사용 중인 프로세스 kill
function killProcessOnPort(port) {
    try {
        if (process.platform === 'win32') {
            const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
            const lines = result.trim().split('\n');
            const pids = new Set();

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0') {
                    pids.add(pid);
                }
            }

            for (const pid of pids) {
                try {
                    execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8' });
                    console.log(`포트 ${port} 사용 중인 프로세스(PID: ${pid}) 종료됨`);
                } catch (e) {
                    // 이미 종료된 경우 무시
                }
            }
        } else {
            // Linux/macOS
            execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { encoding: 'utf-8' });
            console.log(`포트 ${port} 사용 중인 프로세스 종료됨`);
        }
    } catch (e) {
        // 포트를 사용하는 프로세스가 없는 경우
    }
}

killProcessOnPort(PORT);

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web-ui')));

// 블로그 루트 디렉토리 정적 파일 서빙
app.use('/blog', express.static(BLOG_ROOT));

// 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../web-ui/index.html'));
});

// API 라우트
app.get('/api/posts', async (req, res) => {
    try {
        const postsIndex = await fs.readJson(path.join(BLOG_ROOT, 'posts/index.json'), { encoding: ENCODING });
        res.json(postsIndex);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read posts index' });
    }
});

app.get('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const postsIndex = await fs.readJson(path.join(BLOG_ROOT, 'posts/index.json'), { encoding: ENCODING });
        const post = postsIndex.posts.find(p => p.id === id);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const content = await fs.readFile(path.join(BLOG_ROOT, post.path), ENCODING);
        res.json({ ...post, content });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read post content' });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        console.log('POST /api/posts 요청 받음');
        console.log('Request body:', req.body);
        
        const { category, id, title, content } = req.body;
        console.log('Extracted values:', { category, id, title, contentLength: content?.length });
        
        // 파일 저장
        const filePath = `posts/${category}/${id}.txt`;
        const fullPath = path.join(BLOG_ROOT, filePath);
        console.log('File path:', fullPath);
        
        await fs.ensureDir(path.dirname(fullPath));
        console.log('Directory created successfully');

        await fs.writeFile(fullPath, content, ENCODING);
        console.log('File written successfully');

        // HTML 파일 생성
        const htmlPath = fullPath.replace('.txt', '.html');
        const htmlContent = buildPostHtml(id, category, content);
        await fs.writeFile(htmlPath, htmlContent, ENCODING);
        console.log('HTML file generated:', htmlPath);

        // index.json 업데이트
        const indexPath = path.join(BLOG_ROOT, 'posts/index.json');
        console.log('Index path:', indexPath);

        const postsIndex = await fs.readJson(indexPath, { encoding: ENCODING });
        console.log('Index loaded successfully');
        
        const newPost = {
            id,
            path: filePath,
            category: category.charAt(0).toUpperCase() + category.slice(1)
        };
        console.log('New post object:', newPost);

        // 중복 체크: 기존 게시물이 있으면 업데이트, 없으면 추가
        const existingIndex = postsIndex.posts.findIndex(p => p.id === id);
        if (existingIndex !== -1) {
            postsIndex.posts[existingIndex] = newPost;
            console.log('Existing post updated');
        } else {
            postsIndex.posts.unshift(newPost);
            console.log('New post added');
        }
        await fs.writeJson(indexPath, postsIndex, { spaces: 2, encoding: ENCODING });
        console.log('Index updated successfully');
        
        res.json({ success: true, post: newPost });
    } catch (error) {
        console.error('POST /api/posts 에러:', error);
        res.status(500).json({ error: 'Failed to create post', details: error.message });
    }
});

// 게시물 삭제
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('DELETE /api/posts 요청 받음:', id);

        const indexPath = path.join(BLOG_ROOT, 'posts/index.json');
        const postsIndex = await fs.readJson(indexPath, { encoding: ENCODING });

        const postIndex = postsIndex.posts.findIndex(p => p.id === id);
        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = postsIndex.posts[postIndex];
        const fullPath = path.join(BLOG_ROOT, post.path);

        // 파일 삭제 (txt + html)
        if (await fs.pathExists(fullPath)) {
            await fs.remove(fullPath);
            console.log('File deleted:', fullPath);
        }
        const htmlPath = fullPath.replace('.txt', '.html');
        if (await fs.pathExists(htmlPath)) {
            await fs.remove(htmlPath);
            console.log('HTML file deleted:', htmlPath);
        }

        // index.json에서 제거
        postsIndex.posts.splice(postIndex, 1);
        await fs.writeJson(indexPath, postsIndex, { spaces: 2, encoding: ENCODING });
        console.log('Index updated - post removed');

        res.json({ success: true, message: `Post '${id}' deleted` });
    } catch (error) {
        console.error('DELETE /api/posts 에러:', error);
        res.status(500).json({ error: 'Failed to delete post', details: error.message });
    }
});

// 블로그 배포 API
app.post('/api/deploy', async (req, res) => {
    console.log('POST /api/deploy 요청 받음');

    try {
        const { exec } = require('child_process');

        // git add, commit, push 실행
        const commands = [
            'git add .',
            `git commit -m "Deploy: ${new Date().toISOString()}"`,
            'git push'
        ];

        const results = [];

        for (const cmd of commands) {
            const result = await new Promise((resolve, reject) => {
                exec(cmd, { cwd: BLOG_ROOT, encoding: 'utf-8' }, (error, stdout, stderr) => {
                    if (error) {
                        // git commit에서 nothing to commit은 에러가 아님
                        if (cmd.includes('git commit') && stderr.includes('nothing to commit')) {
                            resolve({ cmd, stdout: 'Nothing to commit', stderr: '' });
                        } else {
                            reject({ cmd, error: error.message, stderr });
                        }
                    } else {
                        resolve({ cmd, stdout, stderr });
                    }
                });
            });
            results.push(result);
            console.log(`${cmd}: ${result.stdout || result.stderr}`);
        }

        res.json({ success: true, message: '배포 완료', results });
    } catch (error) {
        console.error('배포 에러:', error);
        res.status(500).json({
            success: false,
            error: '배포 실패',
            details: error.error || error.message,
            command: error.cmd
        });
    }
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
    console.log('클라이언트 연결:', socket.id);

    // 파일 감시 시작
    const watcher = chokidar.watch([
        path.join(BLOG_ROOT, 'posts/**/*.txt'),
        path.join(BLOG_ROOT, 'posts/index.json')
    ]);

    watcher.on('change', (filePath) => {
        socket.emit('file-changed', {
            path: filePath,
            relativePath: path.relative(BLOG_ROOT, filePath)
        });
    });

    socket.on('disconnect', () => {
        console.log('클라이언트 연결 해제:', socket.id);
        watcher.close();
    });
});

server.listen(PORT, () => {
    console.log(`Blog Manager 서버 실행 중: http://localhost:${PORT}`);
    console.log(`블로그 루트: ${BLOG_ROOT}`);
});