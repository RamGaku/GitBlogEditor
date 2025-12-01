# GitBlogEditor 🚀

GitHub Pages 정적 블로그를 위한 통합 관리 도구입니다. 웹 UI와 CLI를 모두 지원하여 브라우저에서 바로 블로그를 편집하고 관리할 수 있습니다.

![GitBlogEditor](https://img.shields.io/badge/GitBlogEditor-Blog%20Management%20Tool-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-16%2B-brightgreen)

## ✨ 주요 기능

### 🌐 웹 UI
- **실시간 마크다운 에디터**: Monaco Editor 기반 VS Code 스타일 편집기
- **라이브 미리보기**: 타이핑과 동시에 실시간 HTML 렌더링
- **파일 감시**: 실시간 파일 변경 감지 및 자동 동기화
- **게시물 관리**: 기존 게시물 편집, 새 게시물 생성

### 💻 CLI 도구
- **게시물 관리**: 생성, 편집, 목록 조회
- **미리보기 서버**: 로컬 개발 서버 실행
- **자동 배포**: git add, commit, push 원클릭 실행
- **대화형 인터페이스**: 단계별 가이드

## 🚀 빠른 시작

### 설치
```bash
git clone https://github.com/RamGaku/GitBlogEditor.git
cd GitBlogEditor
npm install
```

### 웹 UI 실행
```bash
npm start
```
브라우저에서 `http://localhost:3001` 접속

### CLI 사용
```bash
# 게시물 목록
node cli/index.js list

# 새 게시물 생성
node cli/index.js new "제목"

# 게시물 편집
node cli/index.js edit <post-id>

# 블로그 배포
node cli/index.js deploy
```

## 📁 프로젝트 구조

```
GitBlogEditor/
├── cli/                    # CLI 명령어
│   └── index.js
├── server/                 # Express.js 서버
│   └── app.js
├── web-ui/                 # 웹 UI 파일
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── config.json             # 경로/인코딩 설정
├── package.json
└── README.md
```

## 🎯 사용법

### 1. 블로그 루트 설정
`config.json`에서 `blogRoot` 경로를 블로그 디렉토리로 수정하세요:

```json
{
  "blogRoot": "../your-blog-directory",
  "encoding": "utf-8",
  "server": { "port": 3001 }
}
```

### 2. 웹 UI에서 편집
1. 웹 UI 실행 후 사이드바에서 편집할 게시물 클릭
2. Monaco Editor에서 마크다운 편집
3. 미리보기 탭에서 실시간 확인
4. 저장 버튼으로 파일 저장
5. CLI로 git 명령어 실행하여 배포

### 3. CLI에서 관리
```bash
# 게시물 생성 (대화형)
node cli/index.js new

# 특정 카테고리 게시물만 조회
node cli/index.js list -c web

# 배포 (git add, commit, push)
node cli/index.js deploy "새 게시물 추가"
```

## 🛠️ 기술 스택

### Backend
- **Node.js** + **Express.js**: 웹 서버
- **Socket.io**: 실시간 양방향 통신
- **Commander.js**: CLI 프레임워크
- **fs-extra**: 파일 시스템 작업
- **Chokidar**: 파일 감시

### Frontend
- **Monaco Editor**: VS Code 기반 에디터
- **Marked.js**: 마크다운 파서
- **Socket.io Client**: 실시간 통신
- **Vanilla JavaScript**: 프레임워크 없는 순수 JS

## 📋 요구사항

- **Node.js**: 16.0.0 이상
- **Git**: 버전 관리를 위해 필요
- **GitHub Pages**: 블로그 배포 대상

## 🎨 특징

### 실시간 편집
- 파일 변경사항 즉시 반영
- 다중 클라이언트 지원

### 개발자 친화적
- VS Code 스타일 UI
- 문법 하이라이팅
- 자동완성 지원

### 안전한 배포
- 단계별 배포 과정
- 에러 핸들링

## 🔧 설정

### 블로그 루트 경로 설정
`config.json`에서 `blogRoot`를 블로그 디렉토리 경로로 수정하세요:

```json
{
  "blogRoot": "../your-blog-directory"
}
```

### 포트 변경
`config.json`에서 수정:
```json
{
  "server": { "port": 3002 }
}
```

## 🐛 문제 해결

### 게시물 목록이 비어있는 경우
- `posts/index.json` 파일 확인
- 블로그 루트 경로 확인 (`config.json`)

### 한글이 깨지는 경우
- `config.json`에서 `"encoding": "utf-8"` 확인

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

MIT License
