class BlogManager {
    constructor() {
        this.socket = io();
        this.terminal = null;
        this.editor = null;
        this.currentPost = null;
        this.posts = [];
        
        this.initializeApp();
    }
    
    async initializeApp() {
        await this.initializeMonacoEditor();
        this.initializeTerminal();
        this.initializeSocketEvents();
        this.initializeUIEvents();
        await this.loadPosts();
        this.updateConnectionStatus(true);
    }
    
    // Monaco Editor 초기화
    async initializeMonacoEditor() {
        return new Promise((resolve) => {
            require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
            require(['vs/editor/editor.main'], () => {
                this.editor = monaco.editor.create(document.getElementById('editor'), {
                    value: '',
                    language: 'markdown',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 14,
                    fontFamily: 'Consolas, Monaco, monospace',
                    wordWrap: 'on',
                    minimap: { enabled: false }
                });
                
                // 실시간 미리보기 업데이트
                this.editor.onDidChangeModelContent(() => {
                    this.updatePreview();
                });
                
                resolve();
            });
        });
    }
    
    // xterm.js 터미널 초기화
    initializeTerminal() {
        this.terminal = new Terminal({
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, monospace',
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#00d2ff',
                selection: 'rgba(255, 255, 255, 0.3)'
            },
            cursorBlink: true,
            rows: 30,
            cols: 100
        });
        
        const terminalContainer = document.getElementById('terminal');
        this.terminal.open(terminalContainer);
        
        // 터미널 입력 처리
        this.terminal.onData((data) => {
            this.socket.emit('terminal-input', data);
        });
        
        // 터미널 시작
        this.socket.emit('start-terminal');
    }
    
    // Socket.io 이벤트 처리
    initializeSocketEvents() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('terminal-output', (data) => {
            this.terminal.write(data);
        });
        
        this.socket.on('file-changed', (fileInfo) => {
            this.updateFileStatus(fileInfo.relativePath);
            // 현재 편집 중인 파일이 변경되었으면 다시 로드
            if (this.currentPost && fileInfo.relativePath.includes(this.currentPost.id)) {
                this.loadPost(this.currentPost.id, false); // 알림 없이 다시 로드
            }
        });
    }
    
    // UI 이벤트 처리
    initializeUIEvents() {
        // 탭 전환
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });
        
        // 새 게시물 버튼
        document.getElementById('new-post').addEventListener('click', () => {
            this.showNewPostModal();
        });
        
        // 저장 버튼
        document.getElementById('save-post').addEventListener('click', () => {
            this.saveCurrentPost();
        });
        
        // 배포 버튼
        document.getElementById('deploy-blog').addEventListener('click', () => {
            this.deployBlog();
        });
        
        // 새로고침 버튼
        document.getElementById('refresh-posts').addEventListener('click', () => {
            this.loadPosts();
        });
        
        // 터미널 지우기
        document.getElementById('clear-terminal').addEventListener('click', () => {
            this.terminal.clear();
        });
        
        // 모달 이벤트
        this.initializeModalEvents();
    }
    
    // 모달 이벤트 처리
    initializeModalEvents() {
        const modal = document.getElementById('new-post-modal');
        const titleInput = document.getElementById('modal-title');
        const idInput = document.getElementById('modal-id');
        
        // 제목 입력 시 ID 자동 생성
        titleInput.addEventListener('input', () => {
            const id = this.generatePostId(titleInput.value);
            idInput.value = id;
        });
        
        // 모달 닫기
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideNewPostModal();
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.hideNewPostModal();
        });
        
        // 게시물 생성
        document.getElementById('modal-create').addEventListener('click', () => {
            this.createNewPost();
        });
    }
    
    // 탭 전환
    switchTab(tabName) {
        // 탭 버튼 업데이트
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 탭 내용 업데이트
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabName}`);
        });
        
        // 에디터 크기 조정
        if (tabName === 'editor' && this.editor) {
            setTimeout(() => this.editor.layout(), 100);
        }
    }
    
    // 게시물 목록 로드
    async loadPosts() {
        try {
            const response = await fetch('/api/posts');
            const data = await response.json();
            this.posts = data.posts;
            this.renderPostsList();
        } catch (error) {
            console.error('게시물 로드 실패:', error);
        }
    }
    
    // 게시물 목록 렌더링
    renderPostsList() {
        const container = document.getElementById('posts-list');
        container.innerHTML = '';
        
        this.posts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'post-item';
            item.innerHTML = `
                <div class="post-title">${post.id}</div>
                <div class="post-meta">${post.category}</div>
            `;
            
            item.addEventListener('click', () => {
                this.loadPost(post.id);
            });
            
            container.appendChild(item);
        });
    }
    
    // 게시물 로드
    async loadPost(postId, showNotification = true) {
        try {
            const response = await fetch(`/api/posts/${postId}`);
            const post = await response.json();
            
            this.currentPost = post;
            
            // 에디터에 내용 설정
            if (this.editor) {
                this.editor.setValue(post.content);
            }
            
            // 헤더 정보 설정
            const { title, category } = this.parseFrontMatter(post.content);
            document.getElementById('post-title').value = title || post.id;
            document.getElementById('post-category').value = category?.toLowerCase() || 'web';
            
            // 활성 게시물 표시
            document.querySelectorAll('.post-item').forEach(item => {
                item.classList.toggle('active', item.querySelector('.post-title').textContent === postId);
            });
            
            if (showNotification) {
                this.updateFileStatus(`${postId} 로드됨`);
            }
            
        } catch (error) {
            console.error('게시물 로드 실패:', error);
        }
    }
    
    // Front Matter 파싱
    parseFrontMatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return {};
        
        const frontMatter = match[1];
        const result = {};
        
        frontMatter.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                result[key.trim()] = valueParts.join(':').trim();
            }
        });
        
        return result;
    }
    
    // 미리보기 업데이트
    updatePreview() {
        const content = this.editor.getValue();
        const { content: bodyContent } = this.parseFrontMatter(content);
        const markdownContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        
        const html = marked(markdownContent);
        document.getElementById('preview-content').innerHTML = html;
    }
    
    // 현재 게시물 저장
    async saveCurrentPost() {
        if (!this.currentPost) {
            alert('저장할 게시물이 없습니다.');
            return;
        }
        
        const content = this.editor.getValue();
        const title = document.getElementById('post-title').value;
        const category = document.getElementById('post-category').value;
        
        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: this.currentPost.id,
                    category,
                    title,
                    content
                })
            });
            
            if (response.ok) {
                this.updateFileStatus('저장됨');
                setTimeout(() => this.updateFileStatus(''), 3000);
            } else {
                throw new Error('저장 실패');
            }
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장에 실패했습니다.');
        }
    }
    
    // 새 게시물 모달 표시
    showNewPostModal() {
        const modal = document.getElementById('new-post-modal');
        modal.classList.add('show');
        document.getElementById('modal-title').focus();
    }
    
    // 새 게시물 모달 숨김
    hideNewPostModal() {
        const modal = document.getElementById('new-post-modal');
        modal.classList.remove('show');
        
        // 입력 필드 초기화
        document.getElementById('modal-title').value = '';
        document.getElementById('modal-id').value = '';
        document.getElementById('modal-category').value = 'web';
    }
    
    // 게시물 ID 생성
    generatePostId(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9가-힣]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    // 새 게시물 생성
    async createNewPost() {
        const title = document.getElementById('modal-title').value;
        const category = document.getElementById('modal-category').value;
        const id = document.getElementById('modal-id').value;
        
        if (!title || !id) {
            alert('제목을 입력해주세요.');
            return;
        }
        
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
        
        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id,
                    category,
                    title,
                    content
                })
            });
            
            if (response.ok) {
                this.hideNewPostModal();
                await this.loadPosts();
                this.loadPost(id);
                this.updateFileStatus(`${id} 생성됨`);
            } else {
                throw new Error('생성 실패');
            }
        } catch (error) {
            console.error('게시물 생성 실패:', error);
            alert('게시물 생성에 실패했습니다.');
        }
    }
    
    // 블로그 배포
    deployBlog() {
        this.switchTab('terminal');
        this.terminal.write('\r\n배포를 시작합니다...\r\n');
        
        // Git 명령어 실행
        const commands = [
            'git add .',
            'git commit -m "Blog post updated via Blog Manager"',
            'git push origin main'
        ];
        
        commands.forEach((cmd, index) => {
            setTimeout(() => {
                this.socket.emit('terminal-input', cmd + '\r\n');
            }, index * 1000);
        });
    }
    
    // 연결 상태 업데이트
    updateConnectionStatus(connected) {
        const status = document.getElementById('connection-status');
        status.textContent = connected ? '🟢 연결됨' : '🔴 연결 끊김';
    }
    
    // 파일 상태 업데이트
    updateFileStatus(message) {
        const status = document.getElementById('file-status');
        status.textContent = message;
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new BlogManager();
});