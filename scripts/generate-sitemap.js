import fs from 'fs';
import path from 'path';

// Import posts with JSON assertion
import postsData from '../.velite/posts.json' with { type: 'json' };
const posts = postsData.default || postsData;

const domain = 'https://yourdomain.com'; // TODO: Replace with your actual domain

function generateSitemap() {
  console.log('🗺️  Generating sitemap.xml...\n');
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>${domain}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>
  
  <!-- About Page -->
  <url>
    <loc>${domain}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>
  
  <!-- Blog List Page -->
  <url>
    <loc>${domain}/blog</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>
  
  <!-- Blog Posts -->
${posts.map(post => `  <url>
    <loc>${domain}/blog-post/${post.slug}.html</loc>
    <lastmod>${post.updatedAt || post.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;

  const outputPath = path.join(process.cwd(), 'dist/sitemap.xml');
  fs.writeFileSync(outputPath, sitemap, 'utf-8');
  
  console.log(`✅ Generated sitemap.xml with ${posts.length + 3} URLs`);
  console.log(`📍 Location: ${outputPath}\n`);
  console.log('📝 Remember to update the domain in scripts/generate-sitemap.js');
  console.log('📝 Submit sitemap to Google Search Console: https://search.google.com/search-console\n');
}

generateSitemap();

