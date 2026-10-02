import matter from 'gray-matter';

/**
 * Parse frontmatter from markdown file
 * @param {string} fileContent - Raw markdown file content
 * @param {string} filePath - Path to file (for error messages)
 * @returns {Object} - { frontmatter, content }
 */
export function parseFrontmatter(fileContent, filePath) {
  try {
    const result = matter(fileContent, {
      excerpt: false,
      language: 'yaml'
    });

    return {
      frontmatter: result.data,
      content: result.content
    };
  } catch (error) {
    throw new Error(`Failed to parse frontmatter in ${filePath}: ${error.message}`);
  }
}

/**
 * Validate frontmatter schema
 * @param {Object} data - Frontmatter data object
 * @param {string} filePath - Path to file (for error messages)
 * @throws {Error} If validation fails
 */
export function validateFrontmatter(data, filePath) {
  const errors = [];

  // Required fields
  const required = ['title', 'date', 'excerpt', 'tags', 'readTime'];
  const missing = required.filter(field => !(field in data));

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
  }

  // Validate title
  if (data.title && (typeof data.title !== 'string' || data.title.length === 0)) {
    errors.push('title must be a non-empty string');
  }
  if (data.title && data.title.length > 70) {
    errors.push('title should be max 70 characters for SEO (current: ' + data.title.length + ')');
  }

  // Validate date format (YYYY-MM-DD)
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('date must be in YYYY-MM-DD format');
  }

  // Validate excerpt
  if (data.excerpt && typeof data.excerpt !== 'string') {
    errors.push('excerpt must be a string');
  }
  if (data.excerpt && (data.excerpt.length < 150 || data.excerpt.length > 160)) {
    console.warn(`⚠️  ${filePath}: excerpt should be 150-160 characters (current: ${data.excerpt.length})`);
  }

  // Validate tags
  if (data.tags) {
    if (!Array.isArray(data.tags)) {
      errors.push('tags must be an array');
    } else if (data.tags.length < 2 || data.tags.length > 6) {
      errors.push('tags must have 2-6 items (current: ' + data.tags.length + ')');
    }
  }

  // Validate readTime
  if (data.readTime && (typeof data.readTime !== 'number' || data.readTime < 1)) {
    errors.push('readTime must be a positive number');
  }

  // Validate image (optional)
  if (data.image && typeof data.image !== 'string') {
    errors.push('image must be a string path');
  }

  // Validate published flag (optional, default true)
  if ('published' in data && typeof data.published !== 'boolean') {
    errors.push('published must be a boolean');
  }

  // Throw all errors at once
  if (errors.length > 0) {
    throw new Error(
      `❌ Validation errors in ${filePath}:\n` +
      errors.map(err => `   - ${err}`).join('\n')
    );
  }

  return true;
}

/**
 * Validate the markdown body
 * @param {string} content - Markdown content without frontmatter
 * @param {string} filePath - Path to file (for error messages)
 * @throws {Error} If validation fails
 */
export function validateContent(content, filePath) {
  // The article template renders the title as the page's only h1, so a
  // "# " heading in the body would show the title twice. Fenced code is
  // skipped: "# " there is a shell or YAML comment, not a heading.
  const outsideFences = content.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '');
  const h1 = outsideFences.match(/^# .*/m);

  if (h1) {
    throw new Error(
      `❌ Validation errors in ${filePath}:\n` +
      `   - remove the "# " heading ("${h1[0].slice(2, 60)}"): the template renders the title as the h1; start sections at "##"`
    );
  }

  return true;
}
