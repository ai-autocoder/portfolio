# Product Requirements Document: Simple Portfolio Blog

**Project:** Minimal Technical Blog for Portfolio Website
**Version:** 2.0
**Date:** 2025-10-22
**Owner:** Francesco Anzalone
**Status:** Planning

---

## Executive Summary

### Problem Statement

The current portfolio website showcases projects and VS Code extensions but lacks a medium to demonstrate:
- Technical expertise through detailed case studies
- Communication skills via technical writing
- Current knowledge of modern development practices

### Proposed Solution

Implement a **simple, elegant blog** with:
- Markdown-based articles with syntax highlighting
- Clean, professional styling matching the existing portfolio design
- Basic SEO optimization for discoverability
- Mobile-responsive design
- **English only** (no internationalization complexity)
- **No interactive features** (no filtering, search, or JavaScript components)
- Simple chronological list of articles

### Business Objectives

1. **Demonstrate technical communication skills** to recruiters and hiring managers
2. **Improve SEO visibility** for relevant technical keywords
3. **Provide shareable content** for LinkedIn and professional networks
4. **Showcase expertise** beyond project portfolios

### Success Metrics

**Primary (3-month post-launch):**
- 3+ published high-quality articles (800-1200 words each)
- Lighthouse scores: Performance ≥90, SEO ≥95, Accessibility ≥95
- Mobile-responsive across all devices
- Professional appearance matching portfolio quality

**Secondary (6-month post-launch):**
- 5+ published articles
- 1+ recruiter mentions blog in outreach
- Blog linked in all job applications

---

## Scope

### In Scope (MVP)

1. **Build Pipeline**
   - Node.js script to convert markdown to HTML
   - YAML frontmatter for article metadata
   - Syntax highlighting for code blocks
   - Automated SEO meta tag generation

2. **Blog Index Page**
   - Simple chronological list of articles
   - Each entry: title, date, read time, excerpt
   - Link to individual article pages
   - Clean, minimal design

3. **Individual Article Pages**
   - Well-formatted article content
   - Typography optimized for reading (18px, 1.8 line-height)
   - Code blocks with syntax highlighting
   - Article metadata (date, read time, tags)
   - "Back to Blog" navigation link

4. **Navigation**
   - Add "Blog" link in header after "Contact"
   - Active state when on blog pages

5. **SEO Basics**
   - Unique title and meta description per article
   - Open Graph tags for social sharing
   - Semantic HTML
   - Sitemap.xml generation

6. **Styling**
   - Match existing portfolio design system
   - Reuse colors, typography, spacing
   - Dark theme with teal accent
   - Responsive breakpoints

### Out of Scope (Not Included)

- ❌ Homepage integration (no featured articles section)
- ❌ Internationalization (English only)
- ❌ Tag filtering or search
- ❌ Reading progress indicators
- ❌ Code copy buttons
- ❌ Comments system
- ❌ View counters
- ❌ RSS feed

---

## User Stories

### Epic 1: Content Creation

#### US-1.1: Write articles in Markdown

**As a content author, I want to write articles in Markdown so that I can focus on content without HTML complexity.**

**Acceptance Criteria:**
- [ ] Markdown files stored in `content/blog/` directory
- [ ] YAML frontmatter supports: title, date, excerpt, tags, readTime, image
- [ ] Standard markdown syntax: headings, lists, links, images, code blocks
- [ ] Build script validates frontmatter schema

**Priority:** P0 (Must Have)

#### US-1.2: Code syntax highlighting

**As a developer reader, I want code snippets to have syntax highlighting so that technical content is readable.**

**Acceptance Criteria:**
- [ ] Code blocks with language specifier render with syntax highlighting
- [ ] Supports: JavaScript, TypeScript, Python, HTML, CSS, SCSS, JSON, Bash
- [ ] Theme matches existing portfolio dark theme

**Priority:** P0 (Must Have)

---

### Epic 2: Blog Index Page

#### US-2.1: View list of articles

**As a visitor, I want to see a chronological list of articles so that I can choose what to read.**

**Acceptance Criteria:**
- [ ] Articles listed newest first
- [ ] Each entry shows: title, date, read time, excerpt
- [ ] Clicking entry navigates to full article
- [ ] Responsive on mobile and desktop
- [ ] Styling matches portfolio design

**Priority:** P0 (Must Have)

---

### Epic 3: Individual Article Pages

#### US-3.1: Read well-formatted articles

**As a reader, I want to read well-formatted articles so that technical content is easy to understand.**

**Acceptance Criteria:**
- [ ] Article content rendered from markdown with proper HTML
- [ ] Typography: 18px body, 1.8 line-height, max 720px width
- [ ] Headings hierarchy: H1 (title), H2 (sections), H3 (subsections)
- [ ] Images: responsive, lazy loaded, alt text
- [ ] Links: open external links in new tab
- [ ] Code blocks: syntax highlighted, proper spacing

**Priority:** P0 (Must Have)

#### US-3.2: View article metadata

**As a reader, I want to see article metadata so that I can assess relevance.**

**Acceptance Criteria:**
- [ ] Header shows: title, publish date, read time
- [ ] Tech tags displayed as pills/badges
- [ ] "Back to Blog" navigation link
- [ ] Author info at bottom

**Priority:** P0 (Must Have)

---

### Epic 4: SEO & Discoverability

#### US-4.1: Search engine optimization

**As a content author, I want articles indexed by search engines so that they're discoverable.**

**Acceptance Criteria:**
- [ ] Unique `<title>` tag per article
- [ ] Meta description (150-160 chars)
- [ ] Open Graph tags for social sharing
- [ ] Semantic HTML: `<article>`, `<header>`, `<time>`
- [ ] Sitemap.xml includes all articles

**Priority:** P0 (Must Have)

---

### Epic 5: Navigation & Integration

#### US-5.1: Add Blog link to navigation

**As a visitor, I want to access the blog from the main navigation so that I can easily find articles.**

**Acceptance Criteria:**
- [ ] "Blog" link added to header navigation after "Contact"
- [ ] Link navigates to `/blog/` index page
- [ ] Active state when on blog pages
- [ ] Mobile menu includes blog link

**Priority:** P0 (Must Have)

---

## Technical Specifications

### Simplified Frontmatter Schema

```yaml
title: string                       # Article title (required)
date: YYYY-MM-DD                    # Publish date (required)
excerpt: string                     # 150-160 char summary (required)
tags: string[]                      # Technology tags (required, 2-6)
readTime: number                    # Minutes to read (required)
image: string                       # Featured image path (optional)
published: boolean                  # Draft vs published (optional, default true)
```

**Example:**
```yaml
---
title: "Building a VS Code Extension: Lessons from 10K Downloads"
date: 2025-01-15
excerpt: "Key architectural decisions and lessons learned from building and publishing a successful VS Code extension."
tags: [typescript, vscode, tooling]
readTime: 8
image: /assets/blog/vscode-extension.jpg
published: true
---

# Article content starts here...
```

### URL Structure

**Simple and clean:**
- Blog index: `/blog/` or `/blog/index.html`
- Articles: `/blog/{slug}.html` (slug derived from filename)

### Folder Structure

```
my-website/
├── content/
│   └── blog/
│       ├── vscode-extension-journey.md
│       ├── react-performance.md
│       └── b2b-architecture.md
│
├── scripts/
│   ├── generate-blog.js           # Main build script
│   ├── templates/
│   │   ├── article.html           # Article page template
│   │   └── blog-index.html        # Blog listing template
│   └── utils/
│       ├── markdown-parser.js
│       └── seo-generator.js
│
├── src/
│   ├── blog/
│   │   ├── index.html             # Generated blog index
│   │   ├── vscode-extension-journey.html
│   │   ├── react-performance.html
│   │   └── styles/
│   │       ├── blog.scss          # Blog index styles
│   │       ├── article.scss       # Article page styles
│   │       └── markdown.scss      # Content styles
│   │
│   ├── index.html                 # Homepage (add Blog nav link)
│   └── styles/
│       └── style.scss             # Import blog styles
```

### Build Script Flow

```
1. Scan content/blog/*.md
2. For each markdown file:
   - Parse YAML frontmatter
   - Validate required fields
   - Convert markdown to HTML
   - Apply syntax highlighting
   - Generate SEO meta tags
   - Render article template
   - Write to src/blog/{slug}.html
3. Generate blog index page
   - Sort articles by date (newest first)
   - Render blog-index template
   - Write to src/blog/index.html
4. Generate sitemap.xml
5. Log summary
```

### Design Requirements

**Visual Consistency:**
- **Colors:** Use existing `$accent-1`, `$background-dark`, `$background-dark-secondary`
- **Typography:** Roboto (existing font)
- **Spacing:** Consistent with portfolio sections
- **Buttons:** Reuse `.button-primary` class for navigation

**Responsive Design:**
- Mobile: <768px (single column)
- Desktop: ≥768px (centered content, max 960px)

**Article Page Typography:**
- Body: 18px, line-height 1.8
- Max width: 720px for optimal readability
- Code blocks: Fira Code or Monaco, 14-16px

---

## Implementation Phases

### Phase 1: Build Pipeline (Days 1-2)

**Tasks:**
1. Create folder structure
2. Install dependencies: `markdown-it`, `gray-matter`, `highlight.js`, `handlebars`
3. Create `scripts/generate-blog.js` skeleton
4. Implement markdown parsing with syntax highlighting
5. Create article template
6. Write one test article
7. Test: `node scripts/generate-blog.js`

**Deliverable:** Working build script that generates one HTML article

---

### Phase 2: Styling (Days 3-4)

**Tasks:**
1. Create `src/blog/styles/article.scss`
2. Create `src/blog/styles/blog.scss`
3. Create `src/blog/styles/markdown.scss`
4. Import blog styles into `src/styles/style.scss`
5. Style code blocks with dark theme
6. Test responsive design

**Deliverable:** Fully styled article and blog index pages

---

### Phase 3: Blog Index & Navigation (Day 5)

**Tasks:**
1. Create blog index template
2. Update build script to generate index page
3. Add "Blog" link to navigation in `src/index.html`
4. Style navigation active state
5. Test navigation flow

**Deliverable:** Functional blog index with navigation

---

### Phase 4: SEO & Polish (Day 6)

**Tasks:**
1. Add SEO meta tags to templates
2. Implement Open Graph tags
3. Generate sitemap.xml
4. Run Lighthouse audits
5. Fix accessibility issues
6. Cross-browser testing

**Deliverable:** Production-ready blog with SEO optimization

---

### Total Effort Estimate

**Development:** 6 days (approximately 40-50 hours)

**Content Creation:** Separate timeline (not included in development estimate)

---

## Success Criteria

### Technical Validation

- [ ] All markdown files generate HTML without errors
- [ ] Build completes in <5 seconds
- [ ] Lighthouse Performance ≥90
- [ ] Lighthouse SEO ≥95
- [ ] Lighthouse Accessibility ≥95
- [ ] No console errors
- [ ] Works on Chrome, Firefox, Safari, Edge
- [ ] Mobile responsive (tested on iOS and Android)

### Visual Quality

- [ ] Styling matches existing portfolio design
- [ ] Typography is readable and professional
- [ ] Code blocks are clearly formatted with syntax colors
- [ ] Layout is clean and minimal
- [ ] No layout shifts on page load

---

## Dependencies

**NPM Packages:**
```json
{
  "markdown-it": "^14.0.0",
  "gray-matter": "^4.0.3",
  "highlight.js": "^11.9.0",
  "handlebars": "^4.7.8"
}
```

**Existing Assets:**
- SCSS variables (`src/styles/variables.scss`)
- Typography (Roboto font)
- Color scheme (dark theme with teal accent)
- Button styles (`.button-primary`)

---

## Maintenance Plan

**Adding New Articles:**
1. Write markdown file in `content/blog/`
2. Add frontmatter metadata
3. Run `npm run generate-blog`
4. Review generated HTML in browser
5. Commit and deploy

**Updating Existing Articles:**
1. Edit markdown file
2. Update frontmatter `date` field (optional: add `updated` field)
3. Run `npm run generate-blog`
4. Review changes
5. Commit and deploy

---

## Approval & Sign-Off

**Prepared By:** Francesco Anzalone
**Date:** 2025-10-22
**Version:** 2.0 (Simplified)

**Status:** Ready for Implementation

---

**End of Simplified PRD**
