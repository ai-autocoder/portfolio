# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio website for Francesco Anzalone (Full Stack Developer). Two parts:

1. **Main page** (`src/index.html`) — single-page app with hero, about, services, tech stack, VS Code extension stats, projects, and contact form. Bilingual (English/Italian) via i18next.
2. **Blog** (`src/blog/`) — English-only static pages generated from markdown by `scripts/generate-blog.js`. Generated HTML is gitignored; only the SCSS under `src/blog/styles/` is tracked.

## Build & Development Commands

```bash
# Development server with hot reload (runs generate-blog first via prestart)
npm start

# Production build to dist/ (runs generate-blog first via prebuild)
npm run build

# Regenerate blog HTML from content/blog/*.md
npm run generate-blog

# Lint JavaScript/TypeScript files
npm run lint
```

Note: Parcel does not clean `dist/` between builds — delete it for a trustworthy output check.

## Tech Stack

- **Bundler**: Parcel (entry: `"source": "src/index.html"` in package.json; blog pages are reached through anchor links and bundled automatically)
- **Languages**: HTML5, JavaScript (ES6+), TypeScript, SCSS
- **Key dependencies**: i18next + i18next-browser-languagedetector, Swiper (mobile project carousel)
- **Blog pipeline (dev deps)**: gray-matter/handlebars/markdown-it/highlight.js in `scripts/`

## Architecture

### Main page module flow

1. `src/index.html` — content inline, loads `src/index.js` and `src/styles/style.scss`
2. `src/index.js` — initializes i18next, language switcher, Swiper/grid, mobile menu, scroll-triggered entrance animations (IntersectionObserver)
3. `src/locales/language.js` — i18next config + `updateContent()` mapping element IDs to translation keys
4. `src/swiper/swiper.ts` — projects section behavior: below 992px a Swiper carousel; at ≥992px the Swiper is destroyed and `.projects-grid-mode` renders a 2-column CSS grid (see `styles/swiper.scss`). Swiper CSS is imported here by direct file path because Parcel's resolver doesn't read the package "exports" aliases (`swiper/css` will not resolve).

### Blog pipeline

- Markdown sources: `content/blog/*.md` with frontmatter (title, date, excerpt, tags, readTime, optional image, optional `published: false`)
- Generator: `scripts/generate-blog.js` + `scripts/utils/` (frontmatter validation, markdown-it with build-time highlight.js, SEO/OG tag generation) + Handlebars templates in `scripts/templates/`
- Output: `src/blog/*.html` (gitignored). The generator deletes stale `.html` files before regenerating.
- Articles without a frontmatter image get a fallback OG image via a relative meta tag in the template (`src/media/img/og-default.jpg`), which Parcel bundles.

### Internationalization Pattern

Translation files: `src/locales/en.json` and `src/locales/it.json` (keep both in sync).

- Standard translations: Element ID → translation key (e.g., `"nav-about": "nav.about"`) in the `elementsToUpdate` object in `language.js`
- Attribute translations: `.attribute.` in the key (e.g., `"form-name": "placeholder.attribute.contact.form.name"`)
- JSON arrays become sequential `<p>` elements
- `<html lang>` is synced to the active language in `language.js`
- Blog pages are English-only by design

### Styling Architecture

`src/styles/style.scss` imports: `fonts.scss`, `variables.scss`, `buttons.scss`, `lang-switcher.scss`, `swiper.scss`, plus blog styles `src/blog/styles/{article,blog}.scss`. Everything compiles into one bundle, so:

- Define `@keyframes` only once, in `style.scss` (duplicates across partials silently override each other)
- Design tokens live in `variables.scss`: fluid type scale (`$text-xs`…`$text-5xl`), spacing (`$space-1`…`$space-24`), colors, radii, shadows, transitions, breakpoints (425/768/992/1200/1400), z-index scale
- Fonts: self-hosted open-source WOFF2 — Fraunces (`$font-display`), Inter (`$font-body`), JetBrains Mono (`$font-mono`) declared in `fonts.scss`, preloaded in `index.html` and both blog templates
- Heading color system: display headings use `$text-primary`; accent (`$accent-primary`) is reserved for links, tags, markers, and data emphasis
- `$text-tertiary` (#94A3B8) is the minimum-contrast muted text color (≥4.5:1 on card backgrounds) — don't darken it
- Code blocks use a local Tokyo Night highlight.js palette in `article.scss` (no CDN theme)
- Mobile-first (min-width) media queries on the main page; section titles are sentence case in content (no baked-in uppercase)

## Important Patterns

1. **Adding new projects**: Edit the swiper-wrapper section in `src/index.html`. Follow the existing card structure: `<picture>` with webp + fallback, technology tags, unique descriptive `alt` text, "View live"/"GitHub" links. Cards must work in both carousel (mobile) and grid (desktop) modes.

2. **Adding blog articles**: Create a markdown file in `content/blog/` with valid frontmatter, then `npm run generate-blog`. Never edit `src/blog/*.html` directly (generated). Template changes go in `scripts/templates/` — keep `<head>` parity (favicons, webmanifest, Cloudflare analytics beacon, font preloads) with `src/index.html`.

3. **Adding translations**: Add keys to both `en.json` and `it.json`, then map the element ID in `elementsToUpdate` in `language.js`. Form fields have visually-hidden `<label>`s that are translated alongside placeholders.

4. **Styling changes**: Use tokens from `variables.scss`; no hardcoded colors/sizes. Follow the heading color system above.

## Notes

- Site uses module scripts (`type="module"`), so all JS is strict mode
- Images should be optimized with webp versions + fallbacks
- The language switcher is a styled checkbox (`#lang-switch`) with an aria-label
- Contact form posts to Formspree (https://formspree.io/f/mwkybgav)
- Cloudflare Web Analytics beacon is included on the main page and both blog templates
