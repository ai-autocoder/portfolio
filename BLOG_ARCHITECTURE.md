# Blog Technical Architecture (Simplified)

**Version:** 2.0
**Date:** 2025-10-22
**Project:** Minimal Portfolio Blog

---

## 1. OVERVIEW

This is a **simple, static blog** with:
- ✅ Markdown-based content
- ✅ Build-time HTML generation
- ✅ Professional styling matching portfolio
- ✅ Basic SEO optimization
- ❌ No JavaScript components
- ❌ No internationalization
- ❌ No interactive features (filtering, search, etc.)

---

## 2. FOLDER STRUCTURE

```
my-website/
├── content/
│   └── blog/                              # Markdown source files
│       ├── vscode-extension-journey.md
│       ├── react-performance.md
│       └── b2b-architecture.md
│
├── scripts/                                # Build-time generation
│   ├── generate-blog.js                   # Main build script
│   ├── templates/
│   │   ├── article.html                  # Handlebars template for articles
│   │   └── blog-index.html               # Handlebars template for index
│   └── utils/
│       ├── markdown-parser.js            # markdown-it configuration
│       └── seo-generator.js              # Meta tags generator
│
├── src/
│   ├── blog/                              # Generated HTML (gitignored)
│   │   ├── index.html                    # Generated blog index
│   │   ├── vscode-extension-journey.html
│   │   ├── react-performance.html
│   │   └── styles/
│   │       ├── blog.scss                 # Blog index styles
│   │       ├── article.scss              # Article page styles
│   │       └── markdown.scss             # Content typography
│   │
│   ├── index.html                         # Homepage (add Blog link)
│   ├── index.js                           # Homepage logic (existing)
│   └── styles/
│       ├── style.scss                    # Main stylesheet (import blog styles)
│       └── variables.scss                # Design tokens (existing)
│
├── dist/                                   # Parcel output
│   ├── blog/
│   │   ├── index.html
│   │   └── *.html
│   ├── sitemap.xml
│   └── ...
│
├── package.json                            # Add generate-blog script
└── .gitignore                             # Ignore src/blog/*.html
```

---

## 3. BUILD PIPELINE

### 3.1 Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  scripts/generate-blog.js                   │
│                                                             │
│  1. Scan content/blog/*.md files                          │
│  2. For each markdown file:                               │
│     ├─ Parse YAML frontmatter (gray-matter)               │
│     ├─ Validate required fields                           │
│     ├─ Extract slug from filename                         │
│     ├─ Convert markdown to HTML (markdown-it)             │
│     ├─ Apply syntax highlighting (highlight.js)           │
│     ├─ Generate SEO meta tags                             │
│     ├─ Render article template (Handlebars)               │
│     └─ Write to src/blog/{slug}.html                      │
│  3. Sort articles by date (newest first)                  │
│  4. Render blog index template with article list          │
│  5. Write to src/blog/index.html                          │
│  6. Generate sitemap.xml                                  │
│  7. Log: "✓ 3 articles processed"                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Dependencies

```json
{
  "devDependencies": {
    "markdown-it": "^14.0.0",
    "gray-matter": "^4.0.3",
    "highlight.js": "^11.9.0",
    "handlebars": "^4.7.8"
  }
}
```

### 3.3 Package.json Scripts

```json
{
  "scripts": {
    "generate-blog": "node scripts/generate-blog.js",
    "prebuild": "npm run generate-blog",
    "build": "parcel build src/index.html",
    "prestart": "npm run generate-blog",
    "start": "parcel src/index.html"
  }
}
```

---

## 4. MARKDOWN PARSER

**File:** `scripts/utils/markdown-parser.js`

```javascript
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

/**
 * Configure markdown-it with syntax highlighting
 */
export function createMarkdownParser() {
  return new MarkdownIt({
    html: false,           // Disable raw HTML for security
    xhtmlOut: true,        // XHTML-compliant output
    breaks: false,         // Don't convert \n to <br>
    linkify: true,         // Auto-convert URLs to links
    typographer: true,     // Smart quotes, dashes

    // Syntax highlighting
    highlight: function (code, language) {
      if (language && hljs.getLanguage(language)) {
        try {
          return hljs.highlight(code, {
            language: language,
            ignoreIllegals: true
          }).value;
        } catch (err) {
          console.warn(`Highlight failed for ${language}:`, err);
        }
      }
      return hljs.highlightAuto(code).value;
    }
  });
}

/**
 * Customize renderer for external links
 */
export function setupExternalLinks(md) {
  const defaultRender = md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    const hrefIndex = tokens[idx].attrIndex('href');
    if (hrefIndex >= 0) {
      const href = tokens[idx].attrs[hrefIndex][1];
      if (href.startsWith('http://') || href.startsWith('https://')) {
        tokens[idx].attrSet('target', '_blank');
        tokens[idx].attrSet('rel', 'noopener noreferrer');
      }
    }
    return defaultRender(tokens, idx, options, env, self);
  };
}

/**
 * Parse markdown to HTML
 */
export function parseMarkdown(content) {
  const md = createMarkdownParser();
  setupExternalLinks(md);
  return md.render(content);
}
```

---

## 5. FRONTMATTER VALIDATION

**File:** `scripts/utils/frontmatter-validator.js`

```javascript
import matter from 'gray-matter';

/**
 * Parse and validate frontmatter
 */
export function parseFrontmatter(fileContent, filePath) {
  const result = matter(fileContent);
  const data = result.data;

  // Required fields
  const required = ['title', 'date', 'excerpt', 'tags', 'readTime'];
  const missing = required.filter(field => !(field in data));

  if (missing.length > 0) {
    throw new Error(
      `${filePath}: Missing required fields: ${missing.join(', ')}`
    );
  }

  // Validate types
  if (typeof data.title !== 'string' || data.title.length === 0) {
    throw new Error(`${filePath}: title must be a non-empty string`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error(`${filePath}: date must be YYYY-MM-DD format`);
  }

  if (!Array.isArray(data.tags) || data.tags.length < 2 || data.tags.length > 6) {
    throw new Error(`${filePath}: tags must be array with 2-6 items`);
  }

  if (typeof data.readTime !== 'number' || data.readTime < 1) {
    throw new Error(`${filePath}: readTime must be a positive number`);
  }

  if (data.excerpt.length < 150 || data.excerpt.length > 160) {
    console.warn(`${filePath}: excerpt should be 150-160 chars (current: ${data.excerpt.length})`);
  }

  return {
    frontmatter: data,
    content: result.content
  };
}
```

---

## 6. SEO GENERATOR

**File:** `scripts/utils/seo-generator.js`

```javascript
/**
 * Generate SEO meta tags for article
 */
export function generateSeoTags(article, baseUrl = 'https://francescoanzalone.com') {
  const url = `${baseUrl}/blog/${article.slug}.html`;
  const imageUrl = article.image ? `${baseUrl}${article.image}` : `${baseUrl}/assets/og-default.jpg`;

  return {
    title: `${article.title} | Francesco Anzalone`,
    description: article.excerpt,
    canonical: url,

    // Open Graph
    ogTags: [
      { property: 'og:type', content: 'article' },
      { property: 'og:title', content: article.title },
      { property: 'og:description', content: article.excerpt },
      { property: 'og:url', content: url },
      { property: 'og:image', content: imageUrl },
      { property: 'article:published_time', content: article.date },
      { property: 'article:author', content: 'Francesco Anzalone' },
    ],

    // Twitter Card
    twitterTags: [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: article.title },
      { name: 'twitter:description', content: article.excerpt },
      { name: 'twitter:image', content: imageUrl },
    ],
  };
}

/**
 * Render meta tags as HTML
 */
export function renderMetaTags(tags) {
  let html = '';

  tags.ogTags.forEach(tag => {
    html += `  <meta property="${tag.property}" content="${escapeHtml(tag.content)}">\n`;
  });

  tags.twitterTags.forEach(tag => {
    html += `  <meta name="${tag.name}" content="${escapeHtml(tag.content)}">\n`;
  });

  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

## 7. ARTICLE TEMPLATE

**File:** `scripts/templates/article.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- SEO -->
  <title>{{seo.title}}</title>
  <meta name="description" content="{{seo.description}}">
  <link rel="canonical" href="{{seo.canonical}}">

  <!-- Open Graph & Twitter -->
  {{{metaTags}}}

  <!-- Styles -->
  <link rel="stylesheet" href="../styles/style.scss">

  <!-- Highlight.js Theme -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
</head>
<body>
  <!-- Navigation (copy from main site) -->
  <nav class="main-nav">
    <ul>
      <li><a href="../index.html#about">About</a></li>
      <li><a href="../index.html#skills">Skills</a></li>
      <li><a href="../index.html#projects">Projects</a></li>
      <li><a href="../index.html#contact">Contact</a></li>
      <li><a href="index.html" class="active">Blog</a></li>
    </ul>
  </nav>

  <!-- Article -->
  <main class="article-container">
    <article class="blog-article">
      <header class="article-header">
        <a href="index.html" class="back-link">← Back to Blog</a>

        <h1>{{article.title}}</h1>

        <div class="article-meta">
          <time datetime="{{article.date}}">{{article.dateFormatted}}</time>
          <span class="separator">•</span>
          <span>{{article.readTime}} min read</span>
        </div>

        <div class="article-tags">
          {{#each article.tags}}
          <span class="tag">{{this}}</span>
          {{/each}}
        </div>
      </header>

      {{#if article.image}}
      <figure class="featured-image">
        <img src="{{article.image}}" alt="{{article.title}}" loading="lazy">
      </figure>
      {{/if}}

      <div class="article-content">
        {{{article.htmlContent}}}
      </div>

      <footer class="article-footer">
        <div class="author-bio">
          <h3>About the Author</h3>
          <p>
            <strong>Francesco Anzalone</strong> is a Full Stack Developer specializing in
            TypeScript, React, and scalable architectures. Connect on
            <a href="https://linkedin.com/in/francesco-anzalone" target="_blank" rel="noopener">LinkedIn</a>
            or <a href="https://github.com/francesco-anzalone" target="_blank" rel="noopener">GitHub</a>.
          </p>
        </div>

        <a href="index.html" class="button-primary">← Back to Blog</a>
      </footer>
    </article>
  </main>
</body>
</html>
```

---

## 8. BLOG INDEX TEMPLATE

**File:** `scripts/templates/blog-index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Blog | Francesco Anzalone</title>
  <meta name="description" content="Technical articles and case studies on Full Stack Development, TypeScript, and modern web architectures.">

  <link rel="stylesheet" href="../styles/style.scss">
</head>
<body>
  <!-- Navigation -->
  <nav class="main-nav">
    <ul>
      <li><a href="../index.html#about">About</a></li>
      <li><a href="../index.html#skills">Skills</a></li>
      <li><a href="../index.html#projects">Projects</a></li>
      <li><a href="../index.html#contact">Contact</a></li>
      <li><a href="index.html" class="active">Blog</a></li>
    </ul>
  </nav>

  <!-- Blog Index -->
  <main class="blog-index-container">
    <header class="blog-header">
      <h1>Technical Articles</h1>
      <p>Case studies, deep dives, and lessons learned from building real-world applications.</p>
    </header>

    <div class="articles-list">
      {{#each articles}}
      <article class="article-preview">
        {{#if this.image}}
        <a href="{{this.slug}}.html" class="article-image">
          <img src="{{this.image}}" alt="{{this.title}}" loading="lazy">
        </a>
        {{/if}}

        <div class="article-info">
          <h2><a href="{{this.slug}}.html">{{this.title}}</a></h2>

          <div class="article-meta">
            <time datetime="{{this.date}}">{{this.dateFormatted}}</time>
            <span class="separator">•</span>
            <span>{{this.readTime}} min read</span>
          </div>

          <p class="article-excerpt">{{this.excerpt}}</p>

          <div class="article-tags">
            {{#each this.tags}}
            <span class="tag">{{this}}</span>
            {{/each}}
          </div>

          <a href="{{this.slug}}.html" class="read-more">Read article →</a>
        </div>
      </article>
      {{/each}}
    </div>
  </main>
</body>
</html>
```

---

## 9. STYLING

### 9.1 Article Page Styles

**File:** `src/blog/styles/article.scss`

```scss
@use '../../styles/variables' as vars;

.article-container {
  max-width: 960px;
  margin: 80px auto 0;
  padding: 2rem 1.5rem;
}

.blog-article {
  background: vars.$background-dark-secondary;
  border-radius: vars.$border-radius;
  padding: 3rem;
  box-shadow: vars.$shadow-large;

  @media (max-width: 768px) {
    padding: 2rem 1.5rem;
  }
}

.article-header {
  margin-bottom: 3rem;

  .back-link {
    display: inline-block;
    color: vars.$accent-1;
    text-decoration: none;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;

    &:hover {
      text-decoration: underline;
    }
  }

  h1 {
    font-size: 2.5rem;
    color: vars.$accent-1;
    margin-bottom: 1rem;
    line-height: 1.2;

    @media (max-width: 768px) {
      font-size: 2rem;
    }
  }
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.95rem;
  margin-bottom: 1rem;

  .separator {
    opacity: 0.5;
  }
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  .tag {
    background: rgba(vars.$accent-1, 0.2);
    color: vars.$accent-1;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    border: 1px solid rgba(vars.$accent-1, 0.3);
  }
}

.featured-image {
  margin: 2rem 0 3rem;

  img {
    width: 100%;
    border-radius: vars.$border-radius;
    box-shadow: vars.$shadow-medium;
  }
}

.article-content {
  max-width: 720px;
  margin: 0 auto 3rem;

  // Import markdown styles
  @import 'markdown';
}

.article-footer {
  border-top: 1px solid rgba(vars.$accent-1, 0.2);
  padding-top: 2rem;
  margin-top: 3rem;

  .author-bio {
    margin-bottom: 2rem;

    h3 {
      color: vars.$accent-1;
      margin-bottom: 0.75rem;
    }

    p {
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.85);
    }

    a {
      color: vars.$accent-1;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
```

### 9.2 Markdown Content Styles

**File:** `src/blog/styles/markdown.scss`

```scss
// Article content typography
font-size: 18px;
line-height: 1.8;
color: rgba(255, 255, 255, 0.9);

h2, h3, h4 {
  color: vars.$accent-1;
  margin-top: 2em;
  margin-bottom: 0.75em;
  font-weight: 600;
}

h2 {
  font-size: 1.75rem;
  border-bottom: 2px solid rgba(vars.$accent-1, 0.3);
  padding-bottom: 0.5rem;
}

h3 {
  font-size: 1.4rem;
}

h4 {
  font-size: 1.1rem;
}

p {
  margin: 1.5em 0;
}

a {
  color: vars.$accent-1;
  text-decoration: underline;

  &:hover {
    opacity: 0.8;
  }
}

ul, ol {
  margin: 1.5em 0;
  padding-left: 2em;

  li {
    margin: 0.5em 0;
  }
}

blockquote {
  margin: 2em 0;
  padding: 1em 1.5em;
  border-left: 4px solid vars.$accent-1;
  background: rgba(vars.$accent-1, 0.05);
  font-style: italic;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: vars.$border-radius;
  margin: 2em 0;
}

// Code blocks
pre {
  background: #282c34;
  border-radius: vars.$border-radius;
  padding: 1.5rem;
  overflow-x: auto;
  margin: 2em 0;

  code {
    font-family: 'Fira Code', 'Monaco', 'Courier New', monospace;
    font-size: 0.9em;
    line-height: 1.6;
  }
}

code {
  font-family: 'Fira Code', 'Monaco', 'Courier New', monospace;
  background: rgba(vars.$accent-1, 0.1);
  color: vars.$accent-1;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

pre code {
  background: none;
  color: #abb2bf;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 2em 0;

  th, td {
    padding: 0.75rem;
    border: 1px solid rgba(vars.$accent-1, 0.3);
    text-align: left;
  }

  th {
    background: rgba(vars.$accent-1, 0.1);
    color: vars.$accent-1;
    font-weight: 600;
  }
}
```

### 9.3 Blog Index Styles

**File:** `src/blog/styles/blog.scss`

```scss
@use '../../styles/variables' as vars;

.blog-index-container {
  max-width: 960px;
  margin: 80px auto 0;
  padding: 2rem 1.5rem;
}

.blog-header {
  text-align: center;
  margin-bottom: 3rem;

  h1 {
    font-size: 2.5rem;
    color: vars.$accent-1;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.7);
  }
}

.articles-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.article-preview {
  background: vars.$background-dark-secondary;
  border-radius: vars.$border-radius;
  overflow: hidden;
  box-shadow: vars.$shadow-medium;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: vars.$shadow-large;
  }

  .article-image {
    display: block;

    img {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
  }

  .article-info {
    padding: 2rem;

    h2 {
      margin: 0 0 0.75rem;

      a {
        color: vars.$accent-1;
        text-decoration: none;
        font-size: 1.5rem;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .article-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .article-excerpt {
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 1rem;
    }

    .article-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;

      .tag {
        background: rgba(vars.$accent-1, 0.2);
        color: vars.$accent-1;
        padding: 0.25rem 0.75rem;
        border-radius: 12px;
        font-size: 0.85rem;
      }
    }

    .read-more {
      color: vars.$accent-1;
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
```

---

## 10. IMPLEMENTATION STEPS

### Step 1: Setup (30 minutes)

```bash
# Create folder structure
mkdir -p content/blog
mkdir -p scripts/templates
mkdir -p scripts/utils
mkdir -p src/blog/styles

# Install dependencies
npm install --save-dev markdown-it gray-matter highlight.js handlebars

# Update .gitignore
echo "src/blog/*.html" >> .gitignore
```

### Step 2: Build Scripts (4 hours)

1. Create `scripts/utils/markdown-parser.js`
2. Create `scripts/utils/frontmatter-validator.js`
3. Create `scripts/utils/seo-generator.js`
4. Create `scripts/generate-blog.js` (main script)
5. Test with one markdown file

### Step 3: Templates (2 hours)

1. Create `scripts/templates/article.html`
2. Create `scripts/templates/blog-index.html`
3. Test template rendering

### Step 4: Styling (4 hours)

1. Create `src/blog/styles/article.scss`
2. Create `src/blog/styles/blog.scss`
3. Create `src/blog/styles/markdown.scss`
4. Import into `src/styles/style.scss`

### Step 5: Navigation (1 hour)

1. Add Blog link to `src/index.html` navigation
2. Style active state

### Step 6: Testing & Polish (2 hours)

1. Write 1-2 test articles
2. Run Lighthouse audits
3. Test responsive design
4. Cross-browser testing

**Total: ~6 days (40-50 hours)**

---

## 11. MAINTENANCE

### Adding New Articles

1. Create `content/blog/my-new-article.md`
2. Add frontmatter
3. Write content in markdown
4. Run `npm run generate-blog`
5. Preview with `npm start`
6. Commit and deploy

### Example Article

```markdown
---
title: "Building a VS Code Extension: Lessons from 10K Downloads"
date: 2025-01-15
excerpt: "Key architectural decisions and lessons learned from building a successful VS Code extension."
tags: [typescript, vscode, tooling, dx]
readTime: 8
image: /assets/blog/vscode-extension.jpg
---

# Introduction

Building a VS Code extension that serves 10,000+ developers taught me...

## Architecture Decisions

### TypeScript for Type Safety

One of the first decisions was...

\`\`\`typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Extension activation code
}
\`\`\`

## Lessons Learned

1. **Start simple**: MVP first, features later
2. **Listen to users**: GitHub issues are goldmines
3. **Performance matters**: Extensions run in the main thread

## Conclusion

The journey from 0 to 10K downloads took...
```

---

## 12. DELIVERABLES CHECKLIST

- [ ] Build pipeline generates HTML from markdown
- [ ] Syntax highlighting works with Atom One Dark theme
- [ ] Blog index shows articles in reverse chronological order
- [ ] Article pages have proper typography (18px, 1.8 line-height)
- [ ] Styling matches existing portfolio design
- [ ] SEO meta tags present on all pages
- [ ] Open Graph tags for social sharing
- [ ] Sitemap.xml generated
- [ ] Responsive on mobile and desktop
- [ ] Navigation includes Blog link with active state
- [ ] Lighthouse scores: Performance ≥90, SEO ≥95, Accessibility ≥95
- [ ] Cross-browser tested

---

**End of Simplified Architecture Document**
