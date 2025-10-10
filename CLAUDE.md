# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a portfolio website built as a single-page application showcasing Francesco Anzalone's work as a Full Stack Developer. The site features internationalization (English/Italian), a project carousel using Swiper, and a contact form.

## Build & Development Commands

```bash
# Development server with hot reload (opens default browser)
npm start

# Development server (opens in Chrome)
npm start-chrome

# Production build (outputs to dist/)
npm run build

# Lint JavaScript/TypeScript files
npm run lint
```

## Tech Stack

- **Bundler**: Parcel (configured via package.json source field: `src/index.html`)
- **Languages**: HTML5, JavaScript (ES6+), TypeScript, SCSS
- **Key Dependencies**:
  - i18next + i18next-browser-languagedetector (internationalization)
  - Swiper (project carousel)
  - Parcel transformers: @parcel/transformer-sass, @parcel/transformer-webmanifest

## Architecture

### Entry Points & Module Flow

1. **src/index.html** - Main HTML file with inline structure
   - Loads `src/index.js` as module entry point
   - Loads `src/styles/style.scss` for global styles

2. **src/index.js** - Application initialization
   - Initializes i18next for translations
   - Sets up language switcher
   - Initializes Swiper carousel
   - Handles mobile menu open/close

3. **src/locales/language.js** - i18next configuration and DOM updates
   - Configures i18next with browser language detection
   - `updateContent()` - Maps element IDs to translation keys and updates DOM
   - `setupLanguageSwitch()` - Binds language toggle to checkbox
   - Special handling for placeholder attributes (uses `.attribute.` syntax in keys)

4. **src/swiper/swiper.ts** - Swiper carousel configuration
   - TypeScript file configuring coverflow effect
   - Used for project showcase section

### Internationalization Pattern

Translation files: `src/locales/en.json` and `src/locales/it.json`

The translation system uses a custom pattern in `language.js`:
- Standard translations: Element ID → translation key (e.g., `"nav-about": "nav.about"`)
- Attribute translations: Use `.attribute.` in key (e.g., `"form-name": "placeholder.attribute.contact.form.name"`)
- Multi-line content: JSON arrays automatically converted to HTML with `<br/>` tags

### Styling Architecture

Main SCSS file: `src/styles/style.scss` imports:
- `variables.scss` - Color scheme, fonts, shadows, border-radius
- `buttons.scss` - Button styles (primary/secondary)
- `lang-switcher.scss` - Language toggle switch styles
- `swiper.scss` - Swiper carousel customization

Color scheme uses CSS custom properties via SCSS variables:
- Primary accent: `$accent-1` (teal/blue)
- Dark backgrounds: `$background-dark`, `$background-dark-secondary`
- Mobile-first responsive design with breakpoints at 425px, 768px, 992px

### Project Structure Key Points

- **Projects Section**: Swiper carousel in `index.html` (lines 259-542) contains inline project cards
  - Each card: screenshot (webp/fallback), tech tags, title, description, links
  - Technologies displayed as styled spans in `.project-technology-list`

- **Navigation**: Fixed mobile menu (slides in from right), horizontal desktop nav with gradient overlay

- **Contact Form**: Uses Formspree (https://formspree.io/f/mwkybgav) for form handling

## Parcel Configuration

Parcel uses convention over configuration:
- Entry point: `"source": "src/index.html"` in package.json
- Auto-detects and processes: SCSS, TypeScript, webmanifest, image optimization
- ESLint config: `eslint.config.js` (flat config format)

## Important Patterns

1. **Adding New Projects**: Edit `src/index.html` swiper-wrapper section. Follow existing card structure with:
   - `<picture>` element with webp/fallback sources
   - Technology tags in `project-technology-list`
   - External links for "View live" and "GitHub"

2. **Adding Translations**:
   - Add key-value pairs to both `src/locales/en.json` and `src/locales/it.json`
   - Update `elementsToUpdate` object in `src/locales/language.js`
   - For placeholder attributes, use format: `"element-id": "placeholder.attribute.actual.translation.key"`

3. **Styling Changes**:
   - Global styles in `src/styles/style.scss`
   - Use existing SCSS variables for consistency
   - Follow mobile-first responsive pattern with media queries

## Notes

- Site uses module scripts (`type="module"`), so all JS is strict mode
- Images should be optimized with webp versions + fallbacks
- The language switcher is a styled checkbox in the navigation
- Swiper is configured with coverflow effect and keyboard navigation
