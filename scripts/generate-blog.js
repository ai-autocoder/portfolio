import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { parseFrontmatter, validateFrontmatter } from './utils/frontmatter-validator.js';
import { parseMarkdown } from './utils/markdown-parser.js';
import { generateSeoTags, renderMetaTags, formatDate } from './utils/seo-generator.js';

// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.join(__dirname, '../content/blog');
const OUTPUT_DIR = path.join(__dirname, '../src/blog');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

/**
 * Main function to generate blog HTML files
 */
async function generateBlog() {
  console.log('\n🚀 Generating blog...\n');

  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Get all markdown files from content directory
    const markdownFiles = fs.readdirSync(CONTENT_DIR)
      .filter(file => file.endsWith('.md'));

    if (markdownFiles.length === 0) {
      console.log('⚠️  No markdown files found in content/blog/');
      console.log('   Create some .md files there to generate blog posts.\n');
      // Create empty index page
      generateBlogIndex([]);
      return;
    }

    console.log(`📝 Found ${markdownFiles.length} markdown file(s)\n`);

    // Process each markdown file
    const articles = [];
    let errors = 0;

    for (const file of markdownFiles) {
      try {
        const article = await processMarkdownFile(file);
        articles.push(article);
        console.log(`   ✓ ${file} → ${article.slug}.html`);
      } catch (error) {
        console.error(`   ✗ ${file}: ${error.message}`);
        errors++;
      }
    }

    // Sort articles by date (newest first)
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Generate blog index page
    generateBlogIndex(articles);
    console.log(`   ✓ Generated blog index page`);

    // Summary
    console.log(`\n✅ Blog generation complete!`);
    console.log(`   ${articles.length} article(s) processed`);
    if (errors > 0) {
      console.log(`   ${errors} error(s) encountered\n`);
      process.exit(1);
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Blog generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Process a single markdown file
 * @param {string} filename - Markdown filename
 * @returns {Object} - Article object
 */
function processMarkdownFile(filename) {
  const filePath = path.join(CONTENT_DIR, filename);
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  // Parse and validate frontmatter
  const { frontmatter, content } = parseFrontmatter(fileContent, filename);
  validateFrontmatter(frontmatter, filename);

  // Skip if marked as not published
  if (frontmatter.published === false) {
    throw new Error('Marked as unpublished (published: false)');
  }

  // Generate slug from filename (remove .md extension)
  const slug = filename.replace(/\.md$/, '');

  // Parse markdown content to HTML
  const htmlContent = parseMarkdown(content);

  // Create article object
  const article = {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    dateFormatted: formatDate(frontmatter.date),
    excerpt: frontmatter.excerpt,
    tags: frontmatter.tags,
    readTime: frontmatter.readTime,
    image: frontmatter.image || null,
    htmlContent,
  };

  // Generate SEO meta tags
  const seo = generateSeoTags(article);
  const metaTags = renderMetaTags(seo);

  // Render article template
  const articleTemplateSource = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'article.html'),
    'utf-8'
  );
  const articleTemplate = Handlebars.compile(articleTemplateSource);
  const articleHtml = articleTemplate({ article, seo, metaTags });

  // Write article HTML to output directory
  const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
  fs.writeFileSync(outputPath, articleHtml, 'utf-8');

  return article;
}

/**
 * Generate blog index page with list of articles
 * @param {Array} articles - Array of article objects
 */
function generateBlogIndex(articles) {
  const indexTemplateSource = fs.readFileSync(
    path.join(TEMPLATES_DIR, 'blog-index.html'),
    'utf-8'
  );
  const indexTemplate = Handlebars.compile(indexTemplateSource);
  const indexHtml = indexTemplate({ articles });

  const outputPath = path.join(OUTPUT_DIR, 'index.html');
  fs.writeFileSync(outputPath, indexHtml, 'utf-8');
}

// Run the generator
generateBlog();
