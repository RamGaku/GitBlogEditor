const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const chokidar = require('chokidar');

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3001;
const BLOG_ROOT = path.join(__dirname, '../../');

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
        const postsIndex = await fs.readJson(path.join(BLOG_ROOT, 'posts/index.json'));
        res.json(postsIndex);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read posts index' });
    }
});

app.get('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const postsIndex = await fs.readJson(path.join(BLOG_ROOT, 'posts/index.json'));
        const post = postsIndex.posts.find(p => p.id === id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const content = await fs.readFile(path.join(BLOG_ROOT, post.path), 'utf-8');
        res.json({ ...post, content });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read post content' });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const { category, id, title, content } = req.body;
        
        // 파일 저장
        const filePath = `posts/${category}/${id}.txt`;
        const fullPath = path.join(BLOG_ROOT, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
        
        // index.json 업데이트
        const indexPath = path.join(BLOG_ROOT, 'posts/index.json');
        const postsIndex = await fs.readJson(indexPath);
        
        const newPost = {
            id,
            path: filePath,
            category: category.charAt(0).toUpperCase() + category.slice(1)
        };
        
        postsIndex.posts.unshift(newPost);
        await fs.writeJson(indexPath, postsIndex, { spaces: 2 });
        
        res.json({ success: true, post: newPost });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
    console.log('클라이언트 연결:', socket.id);
    
    let terminal = null;
    
    // 터미널 시작
    socket.on('start-terminal', () => {
        if (terminal) {
            terminal.kill();
        }
        
        terminal = spawn('cmd.exe', [], {
            cwd: BLOG_ROOT,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        terminal.stdout.on('data', (data) => {
            socket.emit('terminal-output', data.toString());
        });
        
        terminal.stderr.on('data', (data) => {
            socket.emit('terminal-output', data.toString());
        });
        
        terminal.on('close', (code) => {
            socket.emit('terminal-output', `\r\n프로세스 종료 (코드: ${code})\r\n`);
        });
        
        socket.emit('terminal-output', `Blog Manager Terminal\r\n현재 디렉토리: ${BLOG_ROOT}\r\n\r\n`);
    });
    
    // 터미널 명령어 입력
    socket.on('terminal-input', (data) => {
        if (terminal) {
            terminal.stdin.write(data);
        }
    });
    
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
        if (terminal) {
            terminal.kill();
        }
        watcher.close();
    });
});

server.listen(PORT, () => {
    console.log(`Blog Manager 서버 실행 중: http://localhost:${PORT}`);
    console.log(`블로그 루트: ${BLOG_ROOT}`);
});