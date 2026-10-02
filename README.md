# francescoanzalone.dev

[![CI](https://github.com/ai-autocoder/portfolio/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ai-autocoder/portfolio/actions/workflows/ci.yml)

Source of [francescoanzalone.dev](https://francescoanzalone.dev): my personal site, with projects, published VS Code extensions and a technical blog. The homepage is in English and Italian; the blog is in English.

## Stack

- **Parcel** builds the site from `src/index.html`, with no framework.
- **SCSS** with design tokens (type scale, spacing, colours) in `src/styles/variables.scss`, and self-hosted WOFF2 fonts.
- **i18next** for the English/Italian homepage. Translations live in `src/locales/en.json` and `src/locales/it.json`.
- **Swiper** for the project carousel on small screens. From 992px wide the projects switch to a CSS grid.
- **Blog generator** (`scripts/generate-blog.js`): Markdown in `content/blog/` with validated frontmatter becomes static HTML through markdown-it, build-time highlight.js and Handlebars templates. The generator also writes the Open Graph and Twitter tags for each article.
- **CI**: GitHub Actions runs lint and a production build on every push and pull request to `main`. Netlify deploys `main`.

## Run it locally

Requires Node.js 20.

```bash
npm ci
npm start          # dev server at http://localhost:1234 (generates the blog first)
npm run build      # production build to dist/
npm run lint       # ESLint on src/
```

Parcel doesn't clean `dist/` between builds, so delete it before checking a production build.

## Project layout

```
content/blog/       Markdown articles
scripts/            Blog generator, templates and build helpers
src/index.html      Homepage
src/locales/        i18next setup and translations
src/styles/         SCSS partials and tokens
src/blog/styles/    Blog and article styles (blog HTML is generated, not committed)
```
