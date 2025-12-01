# GitBlogEditor (Blog-Manager)

GitHub Pages 블로그 관리를 위한 Node.js 기반 시스템.

## 작성 규칙

- 문서/코드에 꾸미는 말, 감성적 표현 사용 금지
- 간결하고 사실적인 설명만 작성

## ⚠️ 중요: 블로그 게시물 작성 시 반드시 API 사용

**ramgaku.github.io 게시물 생성/수정/삭제 시 파일을 직접 수정하지 말 것!**

반드시 GitBlogEditor API를 통해 작업:

```bash
# 서버 실행
npm start

# 게시물 생성
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -d '{"id":"post-id","category":"Web","content":"---\ntitle: 제목\n---\n본문"}'

# 게시물 수정
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -d '{"id":"existing-post-id","category":"Web","content":"수정된 내용"}'

# 게시물 삭제
curl -X DELETE http://localhost:3001/api/posts/post-id
```

API가 index.json과 index.html 사이드바를 자동으로 업데이트함.

## 구조

```
GitBlogEditor/
├── cli/           # CLI 도구 (blog-manager 명령어)
├── server/        # Express + Socket.io 백엔드
├── web-ui/        # 웹 인터페이스 (Monaco Editor)
└── config.json    # 경로/인코딩 설정
```

## 주요 기능

- **게시물 관리**: 생성, 수정, 삭제 (API & Web UI)
- **Monaco Editor**: 마크다운 편집기
- **실시간 미리보기**: marked.js 렌더링
- **파일 감시**: chokidar로 변경 감지

## 실행

```bash
npm start          # 서버 시작 (http://localhost:3001)
npm run cli        # CLI 모드
```

## API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/posts | 게시물 목록 |
| GET | /api/posts/:id | 게시물 조회 |
| POST | /api/posts | 생성/수정 |
| DELETE | /api/posts/:id | 삭제 |

## 설정 (config.json)

```json
{
  "blogRoot": "../ramgaku.github.io",
  "encoding": "utf-8",
  "server": { "port": 3001 }
}
```

## 관련 프로젝트

- **ramgaku.github.io**: 실제 배포되는 GitHub Pages 블로그

## 디버깅

- CDP (Chrome DevTools Protocol)로 브라우저 자동화 테스트
- `npm install chrome-remote-interface` 사용
