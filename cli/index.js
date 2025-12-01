#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

// config 로드
const configPath = path.join(__dirname, '../config.json');
const config = fs.readJsonSync(configPath);
const ENCODING = config.encoding || 'utf-8';

// blogRoot가 절대 경로인지 상대 경로인지 확인하여 처리
const BLOG_ROOT = path.isAbsolute(config.blogRoot)
    ? config.blogRoot
    : path.join(__dirname, '..', config.blogRoot);

const program = new Command();

program
    .name('blog')
    .description('GitHub Pages 블로그 관리 CLI')
    .version('1.0.0');

// 새 게시물 생성
program
    .command('new')
    .description('새 게시물 생성')
    .argument('[title]', '게시물 제목')
    .option('-c, --category <category>', '카테고리', 'web')
    .action(async (title, options) => {
        try {
            // 대화형으로 정보 수집
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'title',
                    message: '게시물 제목을 입력하세요:',
                    when: !title,
                    validate: input => input.trim() !== '' || '제목을 입력해주세요.'
                },
                {
                    type: 'list',
                    name: 'category',
                    message: '카테고리를 선택하세요:',
                    choices: ['web', 'playground', 'trouble'],
                    default: options.category
                }
            ]);
            
            const postTitle = title || answers.title;
            const category = answers.category || options.category;
            const id = generatePostId(postTitle);
            
            // 게시물 파일 생성
            await createPost(id, category, postTitle);
            
            console.log(`✅ 새 게시물이 생성되었습니다: ${id}`);
            console.log(`   파일: posts/${category}/${id}.txt`);
            
            // 에디터 열기 여부 확인
            const { openEditor } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'openEditor',
                    message: '에디터에서 편집하시겠습니까?',
                    default: true
                }
            ]);
            
            if (openEditor) {
                const filePath = path.join(BLOG_ROOT, `posts/${category}/${id}.txt`);
                openInEditor(filePath);
            }
            
        } catch (error) {
            console.error('❌ 게시물 생성 실패:', error.message);
            process.exit(1);
        }
    });

// 게시물 목록
program
    .command('list')
    .description('게시물 목록 표시')
    .option('-c, --category <category>', '특정 카테고리만 표시')
    .action(async (options) => {
        try {
            const posts = await loadPosts();
            
            const filteredPosts = options.category 
                ? posts.filter(p => p.category.toLowerCase() === options.category.toLowerCase())
                : posts;
            
            if (filteredPosts.length === 0) {
                console.log('📝 게시물이 없습니다.');
                return;
            }
            
            console.log('\n📝 게시물 목록:\n');
            
            filteredPosts.forEach((post, index) => {
                console.log(`${index + 1}. ${post.id}`);
                console.log(`   카테고리: ${post.category}`);
                console.log(`   경로: ${post.path}`);
                console.log('');
            });
            
        } catch (error) {
            console.error('❌ 게시물 목록 로드 실패:', error.message);
            process.exit(1);
        }
    });

// 미리보기 서버 실행
program
    .command('preview')
    .description('미리보기 서버 실행')
    .option('-p, --port <port>', '포트 번호', '3001')
    .action((options) => {
        console.log(`🚀 Blog Manager 서버를 시작합니다...`);
        console.log(`   포트: ${options.port}`);
        console.log(`   URL: http://localhost:${options.port}`);
        
        const serverPath = path.join(__dirname, '../server/app.js');
        const server = spawn('node', [serverPath], {
            env: { ...process.env, PORT: options.port },
            stdio: 'inherit'
        });
        
        server.on('close', (code) => {
            console.log(`서버가 종료되었습니다. (코드: ${code})`);
        });
        
        // Ctrl+C 처리
        process.on('SIGINT', () => {
            console.log('\n서버를 종료합니다...');
            server.kill();
            process.exit(0);
        });
    });

// 배포
program
    .command('deploy')
    .description('블로그 배포 (git push)')
    .argument('[message]', '커밋 메시지', 'Update blog posts')
    .option('--no-add', 'git add 건너뛰기')
    .option('--no-commit', 'git commit 건너뛰기')
    .option('--no-push', 'git push 건너뛰기')
    .action(async (message, options) => {
        try {
            console.log('🚀 블로그 배포를 시작합니다...\n');
            
            if (options.add !== false) {
                console.log('📁 파일 추가 중...');
                await runGitCommand(['add', '.']);
                console.log('✅ 파일 추가 완료');
            }
            
            if (options.commit !== false) {
                console.log('💾 커밋 생성 중...');
                await runGitCommand(['commit', '-m', message]);
                console.log('✅ 커밋 생성 완료');
            }
            
            if (options.push !== false) {
                console.log('📤 원격 저장소에 푸시 중...');
                await runGitCommand(['push', 'origin', 'main']);
                console.log('✅ 푸시 완료');
            }
            
            console.log('\n🎉 블로그 배포가 완료되었습니다!');
            console.log('   GitHub Pages에서 업데이트를 확인하세요.');
            
        } catch (error) {
            console.error('❌ 배포 실패:', error.message);
            process.exit(1);
        }
    });

// 편집
program
    .command('edit')
    .description('게시물 편집')
    .argument('<id>', '게시물 ID')
    .action(async (id) => {
        try {
            const posts = await loadPosts();
            const post = posts.find(p => p.id === id);
            
            if (!post) {
                console.error(`❌ 게시물을 찾을 수 없습니다: ${id}`);
                process.exit(1);
            }
            
            const filePath = path.join(BLOG_ROOT, post.path);
            console.log(`📝 편집 중: ${post.path}`);
            openInEditor(filePath);
            
        } catch (error) {
            console.error('❌ 편집 실패:', error.message);
            process.exit(1);
        }
    });

// 유틸리티 함수들

// 게시물 ID 생성
function generatePostId(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// 게시물 생성
async function createPost(id, category, title) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    
    const content = `---
title: ${title}
description: ${title}
date: ${date}
tags: []
---

# ${title}

여기에 내용을 작성하세요.
`;
    
    // 파일 생성
    const filePath = `posts/${category}/${id}.txt`;
    const fullPath = path.join(BLOG_ROOT, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, ENCODING);

    // index.json 업데이트
    const indexPath = path.join(BLOG_ROOT, 'posts/index.json');
    const postsIndex = await fs.readJson(indexPath, { encoding: ENCODING });
    
    const newPost = {
        id,
        path: filePath,
        category: category.charAt(0).toUpperCase() + category.slice(1)
    };
    
    // 중복 체크
    if (!postsIndex.posts.find(p => p.id === id)) {
        postsIndex.posts.unshift(newPost);
        await fs.writeJson(indexPath, postsIndex, { spaces: 2, encoding: ENCODING });
    }
}

// 게시물 목록 로드
async function loadPosts() {
    const indexPath = path.join(BLOG_ROOT, 'posts/index.json');
    const postsIndex = await fs.readJson(indexPath, { encoding: ENCODING });
    return postsIndex.posts;
}

// Git 명령어 실행
function runGitCommand(args) {
    return new Promise((resolve, reject) => {
        const git = spawn('git', args, {
            cwd: BLOG_ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        git.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        git.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        git.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(error || `Git 명령어 실행 실패 (코드: ${code})`));
            }
        });
    });
}

// 에디터에서 열기
function openInEditor(filePath) {
    const isWindows = process.platform === 'win32';
    const editor = process.env.EDITOR || (isWindows ? 'notepad' : 'nano');
    
    const child = spawn(editor, [filePath], {
        stdio: 'inherit',
        shell: true
    });
    
    child.on('error', (err) => {
        console.error('에디터 실행 실패:', err.message);
        console.log('수동으로 파일을 편집하세요:', filePath);
    });
}

// 프로그램 실행
program.parse();