class BlogManager {
    constructor() {
        this.socket = io();
        this.editor = null;
        this.currentPost = null;
        this.posts = [];

        this.initializeApp();
    }

    async initializeApp() {
        await this.initializeMonacoEditor();
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

    // Socket.io 이벤트 처리
    initializeSocketEvents() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
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

        // 삭제 버튼
        document.getElementById('delete-post').addEventListener('click', () => {
            this.deleteCurrentPost();
        });

        // 새로고침 버튼
        document.getElementById('refresh-posts').addEventListener('click', () => {
            this.loadPosts();
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

        // 미리보기 탭 클릭 시 즉시 미리보기 업데이트
        if (tabName === 'preview' && this.editor) {
            this.updatePreview();
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
        if (!this.editor) return;

        const content = this.editor.getValue();
        const previewEl = document.getElementById('preview-content');

        if (!content || content.trim() === '') {
            previewEl.innerHTML = '<p class="preview-placeholder">에디터에 내용을 입력하면 미리보기가 여기에 표시됩니다.</p>';
            return;
        }

        const markdownContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');

        if (typeof marked === 'undefined') {
            previewEl.innerHTML = '<p style="color: red;">marked 라이브러리 로드 실패</p>';
            console.error('marked 라이브러리가 로드되지 않았습니다.');
            return;
        }

        try {
            const html = marked.parse(markdownContent);
            previewEl.innerHTML = html;
        } catch (e) {
            console.error('마크다운 파싱 오류:', e);
            previewEl.innerHTML = '<pre>' + markdownContent + '</pre>';
        }
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

    // 현재 게시물 삭제
    async deleteCurrentPost() {
        if (!this.currentPost) {
            alert('삭제할 게시물이 없습니다.');
            return;
        }

        if (!confirm(`"${this.currentPost.id}" 게시물을 삭제하시겠습니까?\n\n삭제 후 PUSH를 눌러야 GitHub Pages에 반영됩니다.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/posts/${this.currentPost.id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                this.updateFileStatus(`${this.currentPost.id} 삭제됨`);
                this.currentPost = null;
                this.editor.setValue('');
                document.getElementById('post-title').value = '';
                await this.loadPosts();
            } else {
                throw new Error(result.error || '삭제 실패');
            }
        } catch (error) {
            console.error('삭제 실패:', error);
            alert('삭제에 실패했습니다.\n' + error.message);
        }

        setTimeout(() => this.updateFileStatus(''), 3000);
    }

    // 블로그 배포
    async deployBlog() {
        if (!confirm('블로그를 GitHub에 배포하시겠습니까?')) {
            return;
        }

        this.updateFileStatus('배포 중...');

        try {
            const response = await fetch('/api/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success) {
                this.updateFileStatus('배포 완료!');
                alert('배포가 완료되었습니다.');
            } else {
                throw new Error(result.details || '배포 실패');
            }
        } catch (error) {
            console.error('배포 실패:', error);
            this.updateFileStatus('배포 실패');
            alert('배포에 실패했습니다.\n' + error.message);
        }

        setTimeout(() => this.updateFileStatus(''), 3000);
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
