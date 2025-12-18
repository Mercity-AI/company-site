import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import posts with JSON assertion
import postsData from '../.velite/posts.json' with { type: 'json' };
const posts = postsData.default || postsData;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find the hashed CSS file in dist/assets/
function findCSSFile() {
  const assetsDir = path.join(process.cwd(), 'dist/assets');
  
  if (!fs.existsSync(assetsDir)) {
    console.warn('⚠️  dist/assets directory not found. CSS link will be generic.');
    return '/assets/index.css';
  }
  
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
  
  return cssFile ? `/assets/${cssFile}` : '/assets/index.css';
}

// Format date for display
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Escape strings for JSON-LD
function escapeJsonLd(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ');
}

// Generate HTML for a single blog post
function generateBlogHTML(post, cssFile) {
  const formattedDate = formatDate(post.publishedAt);
  const currentYear = new Date().getFullYear();
  
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO Meta Tags -->
    <title>${escapeJsonLd(post.title)} | Mercity Research</title>
    <meta name="description" content="${escapeJsonLd(post.summary)}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeJsonLd(post.title)}">
    <meta property="og:description" content="${escapeJsonLd(post.summary)}">
    ${post.image ? `<meta property="og:image" content="${post.image}">` : ''}
    <meta property="og:url" content="https://yourdomain.com/blog-post/${post.slug}.html">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeJsonLd(post.title)}">
    <meta name="twitter:description" content="${escapeJsonLd(post.summary)}">
    ${post.image ? `<meta name="twitter:image" content="${post.image}">` : ''}
    
    <!-- Article metadata -->
    <meta property="article:published_time" content="${post.publishedAt}">
    <meta property="article:author" content="${post.authors[0]?.name || 'Mercity Research'}">
    ${post.updatedAt ? `<meta property="article:modified_time" content="${post.updatedAt}">` : ''}
    
    <!-- Canonical URL -->
    <link rel="canonical" href="https://yourdomain.com/blog-post/${post.slug}.html">
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    
    <!-- Highlight.js for code blocks -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/atom-one-dark.min.css">
    
    <!-- Compiled CSS from Vite build -->
    <link rel="stylesheet" href="${cssFile}">
    
    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "${escapeJsonLd(post.title)}",
      "description": "${escapeJsonLd(post.summary)}",
      ${post.image ? `"image": "${post.image}",` : ''}
      "datePublished": "${post.publishedAt}",
      "dateModified": "${post.updatedAt || post.publishedAt}",
      "author": {
        "@type": "Person",
        "name": "${escapeJsonLd(post.authors[0]?.name || 'Mercity Research')}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Mercity Research",
        "logo": {
          "@type": "ImageObject",
          "url": "https://yourdomain.com/logo.png"
        }
      }
    }
    </script>
  </head>
  <body class="min-h-screen flex flex-col bg-background text-text-main font-sans selection:bg-slate-200 selection:text-slate-900">
    
    <!-- Navigation Header -->
    <header class="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 py-4">
      <div class="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <a href="/" class="text-xl font-medium tracking-tight flex items-center gap-2 group">
          <div class="w-3 h-3 bg-slate-900 rounded-sm group-hover:rotate-45 transition-transform duration-500"></div>
          <span class="font-serif italic text-slate-900">Mercity</span>
        </a>
        <nav class="hidden md:flex items-center gap-12">
          <a href="/#research" class="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-300 relative group">
            Research
            <span class="absolute -bottom-1 left-0 w-0 h-[1px] bg-slate-900 transition-all duration-300 group-hover:w-full"></span>
          </a>
          <a href="/about" class="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-300 relative group">
            About
            <span class="absolute -bottom-1 left-0 w-0 h-[1px] bg-slate-900 transition-all duration-300 group-hover:w-full"></span>
          </a>
          <a href="/blog" class="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-300 relative group">
            Journal
            <span class="absolute -bottom-1 left-0 w-0 h-[1px] bg-slate-900 transition-all duration-300 group-hover:w-full"></span>
          </a>
          <button class="px-5 py-2 text-xs font-semibold uppercase tracking-wider border border-slate-200 rounded-full hover:bg-slate-900 hover:text-white transition-all duration-300">
            Join Waitlist
          </button>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-grow pt-24">
      <div class="max-w-4xl mx-auto px-6 py-12">
        
        <!-- Back to Blog Link -->
        <a href="/blog" class="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-900 transition-colors mb-12 group">
          <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Journal
        </a>

        <article>
          <header class="mb-12">
            <!-- Category, Reading Time, Date -->
            <div class="flex items-center gap-4 text-sm text-slate-500 font-mono mb-6">
              <span class="bg-slate-100 px-3 py-1 rounded-full text-slate-900">${post.category}</span>
              <span>${post.readingTime}</span>
              <span>${formattedDate}</span>
            </div>

            <!-- Title -->
            <h1 class="text-4xl md:text-6xl font-light text-slate-900 leading-tight mb-8">
              ${post.title}
            </h1>

            <!-- Author -->
            <div class="flex items-center gap-4 border-t border-b border-slate-100 py-6">
              <div>
                <p class="text-sm font-medium text-slate-900">${post.authors[0]?.name || 'Mercity Research'}</p>
                ${post.authors[0]?.role ? `<p class="text-xs text-slate-500">${post.authors[0].role}</p>` : ''}
              </div>
            </div>
          </header>

          <!-- Tags -->
          ${post.tags && post.tags.length > 0 ? `
          <div class="flex flex-wrap gap-2 mb-8">
            ${post.tags.map(tag => `<span class="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">${tag}</span>`).join('')}
          </div>
          ` : ''}

          <!-- Full Post Content (HTML from Velite) -->
          <div class="prose prose-lg prose-slate max-w-none">
            ${post.content}
          </div>
        </article>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-200 mt-20 bg-white/50 backdrop-blur-sm">
      <div class="max-w-7xl mx-auto px-6 py-16">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div class="col-span-1 md:col-span-2">
            <h3 class="font-serif italic text-xl mb-6">Mercity</h3>
            <p class="text-slate-500 max-w-sm font-light leading-relaxed">
              Building the cognitive architecture for the next century. 
              We are a research laboratory dedicated to safe, general intelligence.
            </p>
          </div>
          <div>
            <h4 class="text-xs font-bold uppercase tracking-widest text-slate-900 mb-6">Sitemap</h4>
            <ul class="space-y-4 text-sm text-slate-500 font-light">
              <li><a href="/" class="hover:text-slate-900 transition-colors">Home</a></li>
              <li><a href="/about" class="hover:text-slate-900 transition-colors">About Us</a></li>
              <li><a href="/blog" class="hover:text-slate-900 transition-colors">Research Journal</a></li>
            </ul>
          </div>
          <div>
            <h4 class="text-xs font-bold uppercase tracking-widest text-slate-900 mb-6">Connect</h4>
            <ul class="space-y-4 text-sm text-slate-500 font-light">
              <li><a href="#" class="hover:text-slate-900 transition-colors">Twitter / X</a></li>
              <li><a href="#" class="hover:text-slate-900 transition-colors">LinkedIn</a></li>
              <li><a href="#" class="hover:text-slate-900 transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div class="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between text-xs text-slate-400 font-light">
          <p>&copy; ${currentYear} Mercity Research Labs. All rights reserved.</p>
          <div class="flex gap-6 mt-4 md:mt-0">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
    
  </body>
</html>`;
}

// Main execution
function main() {
  console.log('🚀 Generating static blog post HTML files...\n');
  
  // Find CSS file
  const cssFile = findCSSFile();
  console.log(`📦 Using CSS file: ${cssFile}`);
  
  // Create output directory
  const outputDir = path.join(process.cwd(), 'dist/blog-post');
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`📁 Created directory: ${outputDir}\n`);
  
  // Generate HTML for each post
  let successCount = 0;
  let errorCount = 0;
  
  posts.forEach(post => {
    try {
      const html = generateBlogHTML(post, cssFile);
      const outputPath = path.join(outputDir, `${post.slug}.html`);
      fs.writeFileSync(outputPath, html, 'utf-8');
      console.log(`✅ Generated: ${post.slug}.html`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error generating ${post.slug}.html:`, error.message);
      errorCount++;
    }
  });
  
  console.log(`\n🎉 Complete! Generated ${successCount} blog post HTML files`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} files failed to generate`);
  }
}

main();

