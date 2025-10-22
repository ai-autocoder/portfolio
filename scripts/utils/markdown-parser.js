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
    typographer: true,     // Smart quotes, dashes, ellipses

    // Syntax highlighting with highlight.js
    highlight: function (code, language) {
      if (language && hljs.getLanguage(language)) {
        try {
          return hljs.highlight(code, {
            language: language,
            ignoreIllegals: true
          }).value;
        } catch (err) {
          console.warn(`Highlight.js error for language ${language}:`, err.message);
        }
      }

      // Auto-detect language if not specified
      try {
        return hljs.highlightAuto(code).value;
      } catch (err) {
        console.warn('Highlight.js auto-detection failed:', err.message);
      }

      // Fallback: return escaped code
      return escapeHtml(code);
    }
  });
}

/**
 * Customize renderer for external links
 * External links open in new tab with security attributes
 */
export function setupExternalLinks(md) {
  const defaultLinkOpenRenderer = md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const hrefIndex = tokens[idx].attrIndex('href');
    if (hrefIndex >= 0) {
      const href = tokens[idx].attrs[hrefIndex][1];
      // Open external links in new tab
      if (href.startsWith('http://') || href.startsWith('https://')) {
        tokens[idx].attrSet('target', '_blank');
        tokens[idx].attrSet('rel', 'noopener noreferrer');
      }
    }
    return defaultLinkOpenRenderer(tokens, idx, options, env, self);
  };
}

/**
 * Parse markdown content to HTML
 * @param {string} content - Raw markdown content
 * @returns {string} - Rendered HTML
 */
export function parseMarkdown(content) {
  const md = createMarkdownParser();
  setupExternalLinks(md);
  return md.render(content);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
