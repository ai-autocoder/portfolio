---
title: "Accessibility Isn't Optional: What I Learned After a User Couldn't Use My App"
date: "2024-07-15"
excerpt: "A screen reader user emailed me saying my web app was unusable. That email changed how I build every project. Here's what I learned about making web apps accessible."
tags: [accessibility, a11y, frontend, ux, web-development]
readTime: 14
---

# Accessibility Isn't Optional: What I Learned After a User Couldn't Use My App

I got an email that made me feel terrible.

"I use a screen reader to browse the web. I wanted to try your app, but I can't navigate the main form. The buttons don't have labels, and I can't tell what the form fields are for."

I'd spent months building this project. I was proud of the UI. Clean design, smooth animations, responsive layout. But I'd never once tested it with a screen reader.

For this user, my beautiful interface was a wall.

That email was two years ago. Since then, accessibility has become part of how I build everything. Not because it's legally required (though it often is), but because it's the right thing to do. And honestly, it makes you a better developer.

## The Wake-Up Call: Testing with a Screen Reader

After that email, I downloaded NVDA (a free screen reader for Windows) and tried to use my own app.

It was bad. Really bad.

```html
<!-- What I had built -->
<div class="btn-primary" onclick="submitForm()">
  <i class="icon-check"></i>
</div>

<div class="input-wrapper">
  <input type="text" class="form-input" />
</div>

<div class="dropdown" onclick="toggleDropdown()">
  Select an option
</div>
```

What the screen reader announced:
- "Clickable" (no idea what the button does)
- Nothing (input with no label)
- "Select an option" (no indication it's interactive)

I'd built an app that worked perfectly for sighted users and was completely broken for everyone else.

## The Basics I Should Have Known

### Semantic HTML Matters

My first fix was embarrassingly simple: use actual HTML elements.

```html
<!-- Before: Divs pretending to be buttons -->
<div class="btn" onclick="submit()">Submit</div>

<!-- After: Actual buttons -->
<button type="submit" class="btn">Submit Application</button>
```

Real buttons:
- Are focusable with keyboard (Tab key)
- Can be activated with Enter or Space
- Are announced as "button" by screen readers
- Work without JavaScript

I'd been reinventing the wheel badly.

### Labels Are Not Optional

```html
<!-- Before: No connection between label and input -->
<span>Email</span>
<input type="text" class="email-input" />

<!-- After: Properly associated label -->
<label for="email">Email Address</label>
<input type="email" id="email" name="email" required />
```

Screen readers now announce: "Email Address, edit text, required"

The user knows exactly what to enter.

### Images Need Alt Text

```html
<!-- Before: Decorative and informative images treated the same -->
<img src="company-logo.png" />
<img src="decorative-wave.svg" />

<!-- After: Meaningful alt for informative, empty for decorative -->
<img src="company-logo.png" alt="TechCorp Logo" />
<img src="decorative-wave.svg" alt="" role="presentation" />
```

If an image conveys information, describe it. If it's purely decorative, use an empty alt so screen readers skip it.

## The Fixes That Made the Biggest Difference

### 1. Keyboard Navigation

Many users can't use a mouse. Carpal tunnel, motor impairments, or just preference. My app needed to work with keyboard alone.

```css
/* Don't remove focus outlines */
/* I used to do this. Don't. */
*:focus {
  outline: none; /* NEVER DO THIS */
}

/* Instead, make focus visible and styled */
*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Then I made sure everything was reachable:

```javascript
// Before: Click-only interaction
document.querySelector('.dropdown').addEventListener('click', toggleDropdown);

// After: Keyboard support
const dropdown = document.querySelector('.dropdown');
dropdown.setAttribute('tabindex', '0');
dropdown.setAttribute('role', 'button');
dropdown.setAttribute('aria-expanded', 'false');

dropdown.addEventListener('click', toggleDropdown);
dropdown.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleDropdown();
  }
});
```

### 2. ARIA Labels for Complex Components

Some UI patterns don't have native HTML equivalents. That's where ARIA comes in.

```html
<!-- Custom dropdown with proper ARIA -->
<div class="dropdown-container">
  <button
    aria-haspopup="listbox"
    aria-expanded="false"
    aria-labelledby="dropdown-label"
    id="dropdown-button"
  >
    <span id="dropdown-label">Select job type</span>
    <span aria-hidden="true">▼</span>
  </button>

  <ul
    role="listbox"
    aria-labelledby="dropdown-label"
    hidden
  >
    <li role="option" tabindex="-1">Full-time</li>
    <li role="option" tabindex="-1">Part-time</li>
    <li role="option" tabindex="-1">Contract</li>
  </ul>
</div>
```

ARIA tells assistive technology what your custom components actually are.

### 3. Skip Links for Navigation

Screen reader users don't want to hear the entire navigation menu on every page.

```html
<body>
  <!-- Skip link, visually hidden until focused -->
  <a href="#main-content" class="skip-link">
    Skip to main content
  </a>

  <nav>
    <!-- Navigation items -->
  </nav>

  <main id="main-content" tabindex="-1">
    <!-- Page content -->
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: var(--color-accent);
  color: white;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

Press Tab on a page with skip links, and keyboard users can jump straight to the content.

### 4. Color Contrast

My original design had light gray text on a slightly darker gray background. Looked sleek. Was unreadable for users with low vision.

```css
/* Before: 2.5:1 contrast ratio (fails WCAG) */
.muted-text {
  color: #999;
  background: #eee;
}

/* After: 4.5:1 contrast ratio (passes WCAG AA) */
.muted-text {
  color: #595959;
  background: #eee;
}
```

I use the WebAIM Contrast Checker to verify. It takes 30 seconds and catches issues before they ship.

### 5. Error Messages That Make Sense

```html
<!-- Before: Visual-only error indication -->
<input type="email" class="error" />
<span class="error-text">Invalid email</span>

<!-- After: Programmatically associated error -->
<label for="email">Email Address</label>
<input
  type="email"
  id="email"
  aria-describedby="email-error"
  aria-invalid="true"
/>
<span id="email-error" role="alert">
  Please enter a valid email address
</span>
```

Screen readers now announce the error when users focus the field.

## Testing Tools I Actually Use

### Automated Testing

```bash
# Lighthouse accessibility audit
npx lighthouse https://yoursite.com --only-categories=accessibility

# axe-core for development
npm install @axe-core/react
```

```javascript
// In development, axe-core logs issues to console
import React from 'react';
import ReactDOM from 'react-dom';

if (process.env.NODE_ENV === 'development') {
  import('@axe-core/react').then(axe => {
    axe.default(React, ReactDOM, 1000);
  });
}
```

Automated tools catch about 30-40% of accessibility issues. The obvious stuff like missing alt text, low contrast, missing labels.

### Manual Testing

Automated tools can't catch everything. I manually test:

1. **Keyboard navigation**: Can I reach everything with Tab? Can I activate buttons with Enter/Space? Can I close modals with Escape?

2. **Screen reader**: I test with NVDA on Windows, VoiceOver on Mac. Does the content make sense when read aloud?

3. **Zoom**: Does the layout work at 200% zoom? 400%?

4. **Motion**: Do animations respect `prefers-reduced-motion`?

```css
/* Respect user preferences for reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Common Mistakes I Made (And Still See)

### Mistake 1: Icon Buttons Without Labels

```html
<!-- Bad: What does this button do? -->
<button>
  <svg><!-- hamburger menu icon --></svg>
</button>

<!-- Good: Screen reader announces "Open menu, button" -->
<button aria-label="Open menu">
  <svg aria-hidden="true"><!-- hamburger menu icon --></svg>
</button>
```

### Mistake 2: Placeholder as Label

```html
<!-- Bad: Placeholder disappears when typing -->
<input type="text" placeholder="Enter your name" />

<!-- Good: Label is always visible -->
<label for="name">Your name</label>
<input type="text" id="name" placeholder="e.g., John Smith" />
```

### Mistake 3: Using Color Alone to Convey Information

```html
<!-- Bad: Only color indicates error -->
<input type="text" style="border-color: red" />

<!-- Good: Color + icon + text -->
<input type="text" aria-invalid="true" aria-describedby="error" />
<span id="error">
  <svg aria-hidden="true"><!-- error icon --></svg>
  This field is required
</span>
```

### Mistake 4: Trapping Focus in Modals (Or Not)

When a modal opens, focus should:
1. Move into the modal
2. Stay trapped in the modal until it closes
3. Return to the trigger element when closed

```javascript
// Focus management for modals
function openModal(modal, trigger) {
  modal.hidden = false;

  // Find first focusable element
  const focusable = modal.querySelector('button, input, [tabindex="0"]');
  focusable?.focus();

  // Trap focus inside modal
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(modal, trigger);
    }
    // Tab trapping logic here
  });
}

function closeModal(modal, trigger) {
  modal.hidden = true;
  trigger.focus(); // Return focus to trigger
}
```

## The Business Case (When You Need One)

Sometimes you need to convince stakeholders. Here's what worked for me:

**Legal risk**: Many countries require accessibility. The EU's European Accessibility Act, the ADA in the US. Lawsuits are increasing.

**Market size**: 15-20% of people have some form of disability. That's not a small market.

**SEO benefits**: Semantic HTML, proper headings, alt text. All things search engines love.

**Better UX for everyone**: Captions help people in noisy environments. Good contrast helps in bright sunlight. Keyboard navigation helps power users.

But honestly? The best argument is: "Some people literally cannot use our product. We should fix that."

## What Changed in My Process

Before that email, accessibility was an afterthought. Something I'd "add later" (which meant never).

Now it's part of my development process:

**During design**: Check color contrast, ensure focus states are designed, plan keyboard interactions.

**During development**: Use semantic HTML, test with keyboard as I build, run axe-core in dev mode.

**Before shipping**: Full keyboard navigation test, screen reader test, Lighthouse audit.

It adds maybe 10-15% to development time upfront. But it saves huge amounts of time compared to retrofitting accessibility later.

## Resources That Actually Helped

- [WebAIM](https://webaim.org/) - Practical accessibility guides
- [A11y Project](https://www.a11yproject.com/) - Checklist and patterns
- [Inclusive Components](https://inclusive-components.design/) - Accessible component patterns
- [NVDA](https://www.nvaccess.org/) - Free screen reader for testing

## The Result

I emailed that user back. Told them I'd fixed the issues and asked if they'd try again.

They did. It worked.

"Thank you for taking the time to fix this. Most developers don't."

That sentence stuck with me. Most developers don't bother. Which means if you do, you're already ahead.

Accessibility isn't a feature. It's a quality bar. And meeting it makes you a better developer.
