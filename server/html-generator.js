/**
 * 게시물 HTML 생성 모듈
 */

// Markdown to HTML 변환
function markdownToHtml(md) {
    let html = md;

    // 코드 블록 추출 (```)
    const codeBlocks = [];
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        // 코드 블록 내용에서 앞뒤 줄바꿈 제거
        const trimmedCode = code.replace(/^\n+|\n+$/g, '');
        const escaped = trimmedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${escaped}</code></pre>`);
        return placeholder;
    });

    // 인라인 코드 추출 (단일 백틱)
    const inlineCodes = [];
    html = html.replace(/`([^`\n]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
        inlineCodes.push(`<code>${code}</code>`);
        return placeholder;
    });

    // 헤더
    html = html.replace(/^### (.+)$/gm, (match, title) => {
        const id = title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-');
        return `<h3 id="${id}">${title}</h3>`;
    });
    html = html.replace(/^## (.+)$/gm, (match, title) => {
        const id = title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-');
        return `<h2 id="${id}">${title}</h2>`;
    });
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 볼드, 이탤릭
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 링크
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // iframe
    html = html.replace(/<iframe([^>]*)><\/iframe>/g, '<div class="iframe-container"><iframe$1></iframe></div>');

    // 순서 없는 리스트
    html = html.replace(/^- (.+)$/gm, '<ul><li>$1</li></ul>');

    // 순서 있는 리스트
    html = html.replace(/^\d+\. (.+)$/gm, '<ol><li>$1</li></ol>');

    // 연속된 리스트 아이템 병합
    html = html.replace(/<\/ul>\n<ul>/g, '\n');
    html = html.replace(/<\/ol>\n<ol>/g, '\n');

    // 단락
    html = html.split('\n\n').map(para => {
        para = para.trim();
        if (!para) return '';
        if (para.startsWith('<')) return para;
        if (para.startsWith('__CODE_BLOCK_')) return para;
        return `<p>${para}</p>`;
    }).join('\n');

    html = html.replace(/<p>\s*<\/p>/g, '');

    // 코드 블록 복원
    codeBlocks.forEach((block, i) => {
        html = html.replace(`__CODE_BLOCK_${i}__`, block);
    });

    // 인라인 코드 복원
    inlineCodes.forEach((code, i) => {
        html = html.replace(`__INLINE_CODE_${i}__`, code);
    });

    return html;
}

// Front matter 파싱
function parseMarkdown(md) {
    const frontMatterMatch = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontMatterMatch) {
        return { meta: {}, content: md };
    }

    const frontMatter = frontMatterMatch[1];
    const content = frontMatterMatch[2];

    const meta = {};
    frontMatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            meta[key] = value;
        }
    });

    return { meta, content };
}

// 섹션 추출 (TOC용)
function extractSections(html) {
    const sections = [];
    const regex = /<h([23]) id="([^"]+)">([^<]+)<\/h[23]>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        sections.push({
            level: parseInt(match[1]),
            id: match[2],
            title: match[3]
        });
    }

    return sections;
}

// HTML 템플릿 생성
function generatePostHtml(post, category) {
    const sections = extractSections(post.htmlContent);
    const tocHtml = sections.map(s =>
        `<a href="#${s.id}" class="toc-h${s.level}" data-section="${s.id}">${s.title}</a>`
    ).join('\n                    ');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google-adsense-account" content="ca-pub-2234620038718524">

    <!-- SEO 메타 태그 -->
    <title>${post.title} - 람가의 개발로그</title>
    <meta name="description" content="${post.description || post.title}">
    <meta name="keywords" content="${post.tags || '프로그래밍, 웹개발, 개발블로그'}">
    <meta name="author" content="람가">

    <!-- Open Graph -->
    <meta property="og:title" content="${post.title}">
    <meta property="og:description" content="${post.description || post.title}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://ramgaku.github.io/posts/${category}/${post.id}.html">
    <meta property="og:site_name" content="람가의 개발로그">
    <meta property="og:locale" content="ko_KR">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${post.title}">
    <meta name="twitter:description" content="${post.description || post.title}">

    <!-- 검색엔진 -->
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://ramgaku.github.io/posts/${category}/${post.id}.html">

    <link rel="stylesheet" href="../../blog.css">

    <!-- 구조화된 데이터 -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": "${post.title}",
        "description": "${post.description || post.title}",
        "url": "https://ramgaku.github.io/posts/${category}/${post.id}.html",
        "datePublished": "${post.date || new Date().toISOString().split('T')[0]}",
        "author": {
            "@type": "Person",
            "name": "람가"
        },
        "publisher": {
            "@type": "Person",
            "name": "람가"
        }
    }
    </script>

    <!-- Google AdSense -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2234620038718524"
         crossorigin="anonymous"></script>
</head>
<body>
    <canvas id="snowCanvas"></canvas>
    <div class="blog-container">
        <!-- 좌측 사이드바 -->
        <nav class="sidebar">
            <div class="sidebar-header">
                <h1 class="blog-title"><a href="../../" style="color: inherit; text-decoration: none;">람가의 블로그</a></h1>
            </div>
            <div class="nav-menu">
                <div class="nav-category">
                    <div class="category-header">
                        <a href="../../" style="color: inherit; text-decoration: none;">
                            <span class="category-icon">🏠</span>
                            <span class="category-name">홈으로</span>
                        </a>
                    </div>
                </div>
            </div>
            <div class="sidebar-footer">
                <div class="visitor-counter">
                    <span class="visitor-label">Today</span>
                    <span class="visitor-count" id="visitor-today">-</span>
                    <span class="visitor-separator">|</span>
                    <span class="visitor-label">Total</span>
                    <span class="visitor-count" id="visitor-total">-</span>
                </div>
            </div>
        </nav>

        <!-- 중앙 컨텐츠 -->
        <main class="content">
            <div class="content-header">
                <h2 id="content-title">${post.title}</h2>
                <div class="post-meta-header">
                    <span class="post-date">${post.date || ''}</span>
                    <span class="post-category-tag">${category}</span>
                </div>
            </div>
            <div id="content-body" class="content-body">
                <div class="post-content">
                    ${post.htmlContent}
                </div>
                <div class="comments-section">
                    <h3 class="comments-title">댓글</h3>
                    <div class="giscus"></div>
                </div>
            </div>
        </main>

        <!-- 우측 TOC -->
        <aside class="toc">
            <div class="toc-upper">
                <div class="toc-header">
                    <h3>목차</h3>
                </div>
                <nav id="toc-nav" class="toc-nav">
                    ${tocHtml || '<p class="toc-empty">목차가 없습니다</p>'}
                </nav>
                <button id="snowToggle" class="snow-toggle" onclick="toggleSnow()">
                    <span class="snow-toggle-icon">❄</span>
                    <span class="snow-toggle-text">snow: on</span>
                </button>
            </div>
            <div class="toc-lower">
                <div class="ad-container" id="ad-container">
                    <ins class="adsbygoogle"
                         style="display:block"
                         data-ad-client="ca-pub-2234620038718524"
                         data-ad-slot="5521900934"
                         data-ad-format="auto"
                         data-full-width-responsive="true"></ins>
                    <script>
                         (adsbygoogle = window.adsbygoogle || []).push({});
                    </script>
                </div>
            </div>
        </aside>
    </div>

    <!-- Firebase SDK -->
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>

    <script src="../../snow.js"></script>
    <script src="../../js/visitor.js"></script>
    <script src="../../js/post-page.js"></script>

    <!-- Giscus -->
    <script src="https://giscus.app/client.js"
        data-repo="RamGaku/ramgaku.github.io"
        data-repo-id="R_kgDOQcvYMg"
        data-category="Announcements"
        data-category-id="DIC_kwDOQcvYMs4CzI0d"
        data-mapping="specific"
        data-term="${post.id}"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="dark_tritanopia"
        data-lang="ko"
        crossorigin="anonymous"
        async>
    </script>
</body>
</html>`;
}

// 게시물 콘텐츠로 HTML 생성
function buildPostHtml(id, category, content) {
    const { meta, content: mdContent } = parseMarkdown(content);
    const htmlContent = markdownToHtml(mdContent);

    const post = {
        id,
        title: meta.title || id,
        description: meta.description || '',
        date: meta.date || '',
        tags: meta.tags || '',
        htmlContent
    };

    return generatePostHtml(post, category);
}

module.exports = {
    buildPostHtml,
    parseMarkdown,
    markdownToHtml
};
