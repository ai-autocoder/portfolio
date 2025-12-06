---
title: "Modern CSS in 2025: What I Learned Rebuilding My Styles Three Times"
date: "2025-03-25"
excerpt: "I rewrote my portfolio's CSS from scratch three times in two years. Each time, I thought 'this is the right way.' I was wrong twice. Here's what actually stuck."
tags: [css, scss, styling, frontend, design-systems]
readTime: 15
---

# Modern CSS in 2025: What I Learned Rebuilding My Styles Three Times

My portfolio's CSS has been rewritten three times:

**Version 1 (2022)**: 2,143 lines of spaghetti CSS in one file
**Version 2 (2023)**: Switched to Tailwind because "everyone uses it"
**Version 3 (2025)**: Back to custom SCSS, but completely different from Version 1

I thought I knew CSS. Turns out, I knew how to make things *look right*. I didn't know how to make them *maintainable*.

Here's what changed.

## The Problem: My 2022 CSS Was Unmaintainable

I built my first portfolio with CSS that worked perfectly... until it didn't.

A designer friend looked at my site and said: "The blue is too bright. Can you make it more teal?"

Simple request, right?

I opened `style.css` and searched for blue. **47 matches**. Different shades of blue scattered everywhere:

```css
.header {
    background: #1a1a2e;
    border-bottom: 2px solid #00adb5;
}

.button-primary {
    background: #00adb5;
}

.button-primary:hover {
    background: #00c4cf;  /* Slightly different blue */
}

.link {
    color: #00adb5;
}

.footer {
    background: #1a1a2e;
    border-top: 1px solid #00adb5;
}

/* ... 2000 more lines of this */
```

I spent **2 hours** doing find-and-replace, making sure I didn't break anything.

Then she asked: "Can we see it in dark mode?"

I said no. Adding dark mode would mean rewriting the entire CSS file.

That's when I realized: I'd been writing CSS wrong for years.

## Version 1: What Went Wrong

Let me show you how bad it was:

```css
/* style.css - 2,143 lines */

.header {
    background: #1a1a2e;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.nav-item {
    margin-right: 15px;
    font-size: 16px;
}

.hero {
    padding: 80px 20px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.hero-title {
    font-size: 48px;
    margin-bottom: 24px;
}

.project-card {
    padding: 20px;
    margin-bottom: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

/* ... and on and on */
```

**Everything wrong with this**:
1. Colors hardcoded everywhere (`#1a1a2e` appears 23 times)
2. Random spacing values (20px, 15px, 24px, 30px - no system)
3. No responsive strategy (media queries scattered randomly)
4. No dark mode support
5. One massive file (impossible to navigate)

When I wanted to change the accent color, I had to find-and-replace. When I wanted consistent spacing, I had to rewrite everything.

This CSS worked. But it didn't *scale*.

## Version 2: The Tailwind Experiment

I saw everyone on Twitter praising Tailwind. "Utility-first CSS is the future!" they said.

So I rewrote everything in Tailwind.

**Before**:
```html
<button class="btn-primary">Click me</button>
```

**After**:
```html
<button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-200">
    Click me
</button>
```

**What I liked**:
- Fast to prototype
- No thinking about class names
- Built-in design system (spacing, colors)

**What I hated**:
- HTML became unreadable (50+ character class names)
- Couldn't easily theme (had to configure Tailwind, not just change CSS)
- My markup was tightly coupled to styling
- Felt like I was fighting the framework

After 3 months, I rewrote it again. Tailwind is great for some projects. My portfolio wasn't one of them.

## Version 3: What Actually Works

I went back to custom CSS. But this time, I applied patterns I'd learned.

Here's what changed:

### Discovery 1: CSS Variables Changed Everything

Instead of hardcoding colors, I created a design system:

```css
:root {
    /* Color palette */
    --color-bg-primary: #1a1a2e;
    --color-bg-secondary: #16213e;
    --color-text: #eee;
    --color-text-muted: #a0a0a0;
    --color-accent: #00adb5;
    --color-accent-hover: #00d9e8;

    /* Spacing scale */
    --space-xs: 0.25rem;   /* 4px */
    --space-sm: 0.5rem;    /* 8px */
    --space-md: 1rem;      /* 16px */
    --space-lg: 1.5rem;    /* 24px */
    --space-xl: 2rem;      /* 32px */
    --space-2xl: 3rem;     /* 48px */

    /* Typography */
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.5rem;
    --font-size-2xl: 2rem;

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

Now my components use variables:

```css
.button-primary {
    background: var(--color-accent);
    color: var(--color-text);
    padding: var(--space-md) var(--space-lg);
    border-radius: 8px;
    box-shadow: var(--shadow-md);
}

.button-primary:hover {
    background: var(--color-accent-hover);
}
```

**Result**: When the designer said "make it more teal," I changed **ONE variable**. Done in 5 seconds.

### Discovery 2: Dark Mode Was 20 Lines

With CSS variables, dark mode became trivial:

```css
[data-theme="dark"] {
    --color-bg-primary: #1a1a2e;
    --color-bg-secondary: #16213e;
    --color-text: #eee;
    --color-accent: #00d9e8;
}

[data-theme="light"] {
    --color-bg-primary: #ffffff;
    --color-bg-secondary: #f5f5f5;
    --color-text: #1a1a2e;
    --color-accent: #00adb5;
}
```

All my components automatically work in both themes because they use variables.

**JavaScript for toggle**:
```javascript
const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};
```

I added dark mode in **one evening**. In Version 1, it would've taken days.

### Discovery 3: Mobile-First Saved Me Bandwidth

Version 1 was desktop-first:

```css
/* Desktop styles (all devices download this) */
.projects-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
}

/* Mobile override (mobile still downloaded desktop CSS above) */
@media (max-width: 768px) {
    .projects-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
}
```

**Problem**: Mobile devices downloaded CSS they never used.

Version 3 is mobile-first:

```css
/* Mobile (minimal) */
.projects-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-md);
}

/* Tablet */
@media (min-width: 768px) {
    .projects-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-lg);
    }
}

/* Desktop */
@media (min-width: 992px) {
    .projects-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-xl);
    }
}
```

**Result**: Mobile CSS dropped from 87KB to 51KB. **41% smaller** for mobile users.

### Discovery 4: SCSS Organized My Chaos

Instead of one 2,000-line file, I split styles into modules:

```
src/styles/
├── _variables.scss       # Design tokens
├── _reset.scss           # CSS reset
├── _typography.scss      # Font styles
├── _buttons.scss         # Button components
├── _layout.scss          # Grid, spacing
├── lang-switcher.scss    # Language toggle
├── swiper.scss           # Project carousel
└── style.scss            # Imports everything
```

**style.scss** just imports:

```scss
@import 'variables';
@import 'reset';
@import 'typography';
@import 'layout';
@import 'buttons';
@import 'lang-switcher';
@import 'swiper';
```

Now when I need to change button styles, I know exactly where to look. No more scrolling through 2,000 lines.

## What I Actually Learned

### 1. CSS Variables Are Non-Negotiable

Every project should start with:
- Color palette (6-8 colors max)
- Spacing scale (5-6 values)
- Typography scale (5-6 sizes)
- Border radius values
- Shadow values

**Define once, use everywhere.**

### 2. Mobile-First Isn't Just Best Practice

It's faster for mobile users. And most of your users are on mobile.

Start with mobile styles. Add desktop enhancements with `min-width` media queries.

### 3. Stop Writing Random Values

Version 1 had: `padding: 17px`, `margin: 23px`, `gap: 31px`

Why 17? Why 23? I just eyeballed it until it looked right.

Version 3 uses a spacing scale: `var(--space-sm)`, `var(--space-md)`, `var(--space-lg)`

**Result**: Consistent spacing throughout the site. Looks more professional.

### 4. Dark Mode Requires Planning

You can't add dark mode as an afterthought. It needs to be part of your color system from day one.

Use CSS variables. Make dark mode a 10-minute task, not a 2-day rewrite.

### 5. Organization Beats Cleverness

My Version 1 CSS was "clever" in places. I used complex selectors, nested media queries, fancy animations.

It was impossible to maintain.

Version 3 is boring. Simple selectors, clear file structure, no magic.

**Boring CSS is maintainable CSS.**

## The Mistakes I Made

### Mistake 1: Following Trends Blindly

I switched to Tailwind because everyone said "Tailwind is the future."

For my portfolio, it was overkill. I spent more time configuring Tailwind than just writing custom CSS.

**Lesson**: Use what fits your project, not what's trendy.

### Mistake 2: No Design System in Version 1

I just started writing CSS without planning. Every new component got slightly different spacing, slightly different colors.

**Lesson**: Spend 30 minutes defining your design system BEFORE writing CSS.

### Mistake 3: Optimizing Too Early

In Version 1, I tried to minimize CSS file size by using short class names, removing comments, etc.

Then I couldn't understand my own code 3 months later.

**Lesson**: Optimize for readability first. Let build tools handle minification.

### Mistake 4: Not Testing Dark Mode

I added dark mode to Version 3. Shipped it. Then realized my project cards were unreadable in dark mode (white text on light background).

**Lesson**: Test both themes before shipping. Every. Single. Component.

## The Real Metrics

**Version 1 (2022)**:
- CSS file size: 120KB
- Mobile First Contentful Paint: 1.9s
- Time to change color scheme: 2+ hours
- Lines of code: 2,143

**Version 3 (2025)**:
- CSS file size: 52KB (57% smaller)
- Mobile First Contentful Paint: 1.1s (42% faster)
- Time to change color scheme: 5 seconds
- Lines of code: 847 (split across 8 files)

**Same design. Same features. Dramatically different maintainability.**

## The Modern CSS Patterns I Actually Use

After three rewrites, here's what stuck:

### Pattern 1: CSS Variables for Everything

```css
:root {
    --color-primary: #00adb5;
    --space-md: 1rem;
    --font-size-lg: 1.5rem;
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Pattern 2: Mobile-First Media Queries

```css
.element { /* mobile */ }
@media (min-width: 768px) { /* tablet */ }
@media (min-width: 992px) { /* desktop */ }
```

### Pattern 3: Spacing Scale (No Random Values)

```css
--space-xs: 0.25rem;
--space-sm: 0.5rem;
--space-md: 1rem;
--space-lg: 1.5rem;
--space-xl: 2rem;
```

### Pattern 4: Semantic Class Names

```css
/* Good */
.button-primary { }
.card-featured { }
.nav-item { }

/* Bad */
.blue-button { }
.big-box { }
.mt-20 { }
```

### Pattern 5: Only Animate Transform and Opacity

```css
/* GPU-accelerated (smooth) */
.element {
    transition: transform 0.3s, opacity 0.3s;
}

.element:hover {
    transform: translateY(-2px);
    opacity: 0.9;
}
```

Animating `width`, `height`, `margin`, etc. kills performance on mobile.

## What Didn't Make the Cut

I tried these "modern" patterns. They didn't work for me:

### ❌ CSS-in-JS

```javascript
const Button = styled.button`
    background: ${props => props.primary ? 'blue' : 'gray'};
`;
```

Runtime performance cost. Harder to debug. Only use if you need truly dynamic theming.

### ❌ Utility Classes Everywhere

```html
<div class="flex items-center justify-between p-4 bg-gray-100 rounded-lg shadow-md">
```

HTML becomes unreadable. I prefer semantic classes.

### ❌ Complex Animations

Users don't notice them. They add filesize and complexity. Keep it simple.

## Would I Rewrite It Again?

Not unless I have a good reason.

Version 3 is:
- Maintainable (I can change colors in seconds)
- Fast (52KB CSS, mobile-first)
- Flexible (dark mode, responsive, accessible)
- Organized (8 small files vs 1 giant file)

This is the CSS architecture I'll use going forward.

## Your Turn: Audit Your CSS

Open your project's CSS and ask:

1. **Can you change your color scheme in under 1 minute?** (If no, add CSS variables)
2. **Is your mobile CSS larger than necessary?** (If yes, go mobile-first)
3. **Do you have random spacing values?** (If yes, create a spacing scale)
4. **Can you add dark mode easily?** (If no, refactor to use CSS variables)
5. **Is your CSS in one giant file?** (If yes, split into modules)

If you answered "no" to any of these, spend a weekend refactoring. Future you will thank you.

## The Bottom Line

Modern CSS isn't about using the newest framework or the trendiest approach.

It's about:
- **Maintainability** (change things easily)
- **Performance** (mobile-first, minimal CSS)
- **Consistency** (design tokens, spacing scales)
- **Flexibility** (dark mode, responsive)

I learned this by rewriting my CSS three times. You can learn from my mistakes and do it right the first time.

**Write CSS that's easy to change. Because you WILL change it.**

