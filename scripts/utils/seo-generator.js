/**
 * Generate SEO meta tags for an article
 * @param {Object} article - Article object with frontmatter and slug
 * @param {string} baseUrl - Base URL of the website
 * @returns {Object} - SEO metadata object
 */
export function generateSeoTags(article, baseUrl = 'https://francescoanzalone.com') {
  const url = `${baseUrl}/blog/${article.slug}.html`;
  const imageUrl = article.image
    ? `${baseUrl}${article.image}`
    : `${baseUrl}/assets/og-default.jpg`;

  return {
    title: `${article.title} | Francesco Anzalone`,
    description: article.excerpt,
    canonical: url,
    keywords: article.tags.join(', '),

    // Open Graph meta tags for social sharing
    ogTags: [
      { property: 'og:type', content: 'article' },
      { property: 'og:title', content: article.title },
      { property: 'og:description', content: article.excerpt },
      { property: 'og:url', content: url },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'article:published_time', content: article.date },
      { property: 'article:author', content: 'Francesco Anzalone' },
    ],

    // Twitter Card meta tags
    twitterTags: [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: article.title },
      { name: 'twitter:description', content: article.excerpt },
      { name: 'twitter:image', content: imageUrl },
    ],
  };
}

/**
 * Render meta tags as HTML string
 * @param {Object} seoTags - SEO tags object from generateSeoTags
 * @returns {string} - HTML string of meta tags
 */
export function renderMetaTags(seoTags) {
  let html = '';

  // Open Graph tags
  seoTags.ogTags.forEach(tag => {
    html += `  <meta property="${tag.property}" content="${escapeHtml(tag.content)}">\n`;
  });

  // Twitter Card tags
  seoTags.twitterTags.forEach(tag => {
    html += `  <meta name="${tag.name}" content="${escapeHtml(tag.content)}">\n`;
  });

  return html.trim();
}

/**
 * Escape HTML to prevent XSS in meta tags
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Format date for display (e.g., "January 15, 2025")
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {string} - Formatted date
 */
export function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}
