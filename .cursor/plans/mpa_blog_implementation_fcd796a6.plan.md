---
name: MPA Blog Implementation
overview: "Transform the blog architecture from SPA to MPA: keep homepage/about as SPA but convert each blog post into standalone HTML pages with full SEO-friendly content, reducing bundle size by ~80% and achieving perfect SEO."
todos:
  - id: create-generator-script
    content: Create scripts/generate-blog-pages.js to generate HTML files from posts.json
    status: completed
  - id: create-html-template
    content: Create scripts/blog-template.js with full SEO-optimized HTML template
    status: completed
  - id: update-build-pipeline
    content: Modify package.json build script to run generator after vite build
    status: completed
  - id: update-blog-list-links
    content: Change React Router Links to regular <a> tags in BlogList.tsx
    status: completed
  - id: update-home-links
    content: Change featured post Links to <a> tags in Home.tsx
    status: completed
    dependencies:
      - update-blog-list-links
  - id: configure-nginx
    content: Update nginx.conf to handle blog post HTML file routing
    status: completed
  - id: add-structured-data
    content: Implement JSON-LD structured data in blog HTML template
    status: completed
  - id: create-sitemap
    content: Create scripts/generate-sitemap.js for SEO
    status: completed
  - id: optional-metadata-collection
    content: Optionally modify velite.config.ts to create metadata-only collection
    status: completed
  - id: test-build
    content: Run full build and test generated HTML files
    status: completed
    dependencies:
      - create-generator-script
      - create-html-template
      - update-build-pipeline
---

# MPA Blog Post Architecture Implementation

## Overview

Convert individual blog posts from React Router SPA navigation to full HTML pages while maintaining SPA experience for homepage, about, and blog list pages. This will dramatically improve SEO, reduce bundle size, and maintain support for interactive React components within blog posts.

## Current Architecture Analysis

**Current State:**

- Single-page application using React Router
- All blog content bundled in main JS (~500KB+)
- Posts imported from `.velite/posts.json` containing full HTML content
- Navigation via React Router's `<Link>` components
- Single entry point: `dist/index.html` with `<div id="root">`

**Target State:**

- Hybrid architecture: SPA for marketing pages, MPA for blog posts
- Individual HTML files: `dist/blog-post/[slug].html`
- Each blog page: ~30-50KB with full SEO-friendly HTML
- Regular `<a>` tags for blog post links (full page loads)
- Support for React components within blog posts

---

## Implementation Steps

### Phase 1: Build System Modifications

#### 1.1 Create Blog Page Generator Script

**File:** `scripts/generate-blog-pages.js`Create a Node.js script that:

- Reads posts from `.velite/posts.json`
- Generates individual HTML files for each blog post
- Uses a template that includes full post content in HTML
- Embeds metadata for SEO (title, description, og:tags)
- Includes links to necessary CSS/JS for interactivity

**Key Requirements:**

- Import posts from `.velite/index.js` (ES modules)
- Create `dist/blog-post/` directory
- Generate one `[slug].html` per post
- Include header/nav/footer in each HTML file
- Inject post-specific meta tags
- Reference optimized CSS bundle
- Include minimal runtime JS for interactive components (if any)

**Template Structure:**

```javascript
<!DOCTYPE html>
<html>
  <head>
    - SEO meta tags (title, description, og:*)
    - Structured data (JSON-LD for Article)
    - Canonical URL
    - CSS bundle link
    - Google Fonts (already in use)
  </head>
  <body>
    - Navigation header (static HTML)
    - Article content (full HTML from Velite)
    - Footer (static HTML)
    - Optional: Minimal JS for interactive components
  </body>
</html>
```



#### 1.2 Update Build Pipeline

**File:** `package.json`Modify build script to:

```json
{
  "scripts": {
    "build": "velite build && vite build && node scripts/generate-blog-pages.js",
    "build:blog": "node scripts/generate-blog-pages.js"
  }
}
```

**Execution Order:**

1. `velite build` - Generates posts.json with HTML content
2. `vite build` - Bundles React SPA
3. `generate-blog-pages.js` - Creates static blog HTML files

---

### Phase 2: Content Separation

#### 2.1 Modify Velite Configuration (Optional Optimization)

**File:** [`velite.config.ts`](velite.config.ts)**Current:** Single collection with full content**Consider:** Creating metadata-only collection for blog listAdd a second collection for metadata:

```typescript
const postsMetadata = defineCollection({
  name: "PostMetadata",
  pattern: "**/*.mdx",
  schema: s.object({
    // Only lightweight fields (no content, raw, toc)
    title, slug, publishedAt, summary, authors,
    tags, category, image, readingTime
  })
});
```

This allows:

- [`pages/BlogList.tsx`](pages/BlogList.tsx) imports lightweight metadata
- [`pages/Home.tsx`](pages/Home.tsx) imports only metadata
- Reduces main bundle size by excluding full HTML content

**Impact:**

- Main bundle reduction: ~400KB → ~100KB
- Blog list page loads instantly
- Individual posts still have full HTML in static files

#### 2.2 Create Blog Runtime Module (For Interactive Components)

**File:** `scripts/blog-runtime.tsx`A lightweight module that:

- Detects interactive component mount points in blog HTML
- Lazy loads React components only when needed
- Mounts components to DOM with props from data attributes

**Example Structure:**

```typescript
// Detect [data-component="ComponentName"] elements
// Lazy import component
// Mount with React.createRoot()
```

This enables authors to add:

```html
<div data-component="ThreeJSDemo" data-props='{"model":"transformer"}'></div>
```

And have it automatically hydrate on page load.---

### Phase 3: Navigation & Routing Updates

#### 3.1 Update Blog List Navigation

**File:** [`pages/BlogList.tsx`](pages/BlogList.tsx)**Current:**

```tsx
<Link to={post.permalink}>
```

**Change to:**

```tsx
<a href={`/blog-post/${post.slug}.html`}>
```

**Impact:**

- Clicking blog post triggers full page load
- Browser fetches standalone HTML file
- No React Router involvement
- Perfect for SEO crawlers

#### 3.2 Update Home Page Featured Posts

**File:** [`pages/Home.tsx`](pages/Home.tsx)Similar changes:

- Line 26: Change `<Link to={recentPosts[0]?.permalink}> `to `<a href>`
- Line 44: Change `<Link to={recentPosts[1]?.permalink}> `to `<a href>`
- Lines 160-163: Change `<Link>` wrapper for featured content

#### 3.3 Remove Blog Post SPA Route (Optional)

**File:** [`App.tsx`](App.tsx)**Consider removing:**

```tsx
<Route path="/blog-post/:slug" element={<BlogPostPage />} />
```

Since blog posts now load via static HTML, React Router doesn't need this route. However, you could keep it as a fallback for development.---

### Phase 4: Static HTML Template Creation

#### 4.1 Create Blog Post HTML Template Function

**File:** `scripts/blog-template.js`**Key Elements:**

1. **Navigation Header** (replicate from [`components/Layout.tsx`](components/Layout.tsx)):

- Logo linking to "/"
- Nav links: Research, About, Journal
- Join Waitlist button
- Mobile menu toggle (needs minimal JS)

2. **Article Content:**

- Post metadata (date, category, reading time)
- Author info
- Tags
- Full HTML content from `post.content`

3. **Footer** (replicate from Layout.tsx):

- Sitemap links
- Social links
- Copyright

4. **SEO Metadata:**

- `<title>` from post.title
- `<meta name="description">` from post.summary
- Open Graph tags (og:title, og:description, og:image)
- Twitter Card tags
- Structured data (JSON-LD for Article schema)
- Canonical URL

**Styling Considerations:**

- Reference compiled CSS from `dist/assets/index-[hash].css`
- Ensure Tailwind classes work (include full CSS bundle)
- Copy Highlight.js styles from [`index.html`](index.html) for code blocks

---

### Phase 5: SEO & Performance Optimization

#### 5.1 Add Structured Data

For each blog post HTML, include JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "post.title",
  "datePublished": "post.publishedAt",
  "author": { "@type": "Person", "name": "post.authors[0].name" },
  "image": "post.image",
  "publisher": { "@type": "Organization", "name": "Mercity Research" }
}
```



#### 5.2 Configure nginx for HTML Routing

**File:** [`nginx.conf`](nginx.conf)**Update routing rules:**

```nginx
# Serve blog post HTML files directly
location ~ ^/blog-post/(.+)$ {
    try_files /blog-post/$1.html /blog-post/$1 =404;
}

# SPA fallback for everything else
location / {
    try_files $uri $uri/ /index.html;
}
```

This ensures:

- `/blog-post/neural-nets` serves `neural-nets.html`
- All other routes fall back to React SPA
- Clean URLs without `.html` extension

#### 5.3 Generate Sitemap

**File:** `scripts/generate-sitemap.js`Create XML sitemap including:

- Homepage
- About page
- Blog list page
- All individual blog post URLs

Place in `dist/sitemap.xml` for search engines.---

### Phase 6: Interactive Component Support

#### 6.1 Component Mount Points System

For blog posts with interactive React components:**In MDX files (authored content):**

```html
<div id="neural-net-demo" data-component="NeuralNetDemo" data-props='{"layers":[3,4,2]}'></div>
```

**In blog-runtime.js:**

- Scan for `[data-component]` elements
- Dynamically import component modules
- Create React roots and mount components
- Pass props from `data-props` attribute

**Bundle optimization:**

- Code-split each interactive component
- Load only components used in that specific post
- Use dynamic imports for lazy loading

#### 6.2 Create Component Registry

**File:** `components/blog-components/index.ts`Export all blog-embeddable components:

```typescript
export { default as NeuralNetDemo } from './NeuralNetDemo';
export { default as ThreeJSVisualization } from './ThreeJSVisualization';
export { default as InteractivePlot } from './InteractivePlot';
```

This allows the runtime to discover and load components.---

### Phase 7: Development & Testing Workflow

#### 7.1 Development Mode Considerations

**Challenge:** Static HTML files aren't generated during `vite dev`**Solutions:Option A:** Run generator in watch mode

```json
{
  "scripts": {
    "dev": "concurrently \"velite --watch\" \"vite\" \"node scripts/watch-blog-pages.js\""
  }
}
```

**Option B:** Keep SPA route for development

- Use React Router for dev mode
- Only generate static HTML for production builds

#### 7.2 Preview Generated Pages

After build:

```bash
npm run preview
```

Test:

- Navigate to `/blog-post/advanced-guide-to-visual-language-models.html`
- Verify SEO meta tags (view source)
- Check page load performance
- Test interactive components (if any)
- Verify navigation back to blog list

---

## File Checklist

**New Files to Create:**

- [ ] `scripts/generate-blog-pages.js` - Main generator
- [ ] `scripts/blog-template.js` - HTML template function
- [ ] `scripts/blog-runtime.tsx` - Component hydration
- [ ] `scripts/generate-sitemap.js` - Sitemap generator
- [ ] `components/blog-components/index.ts` - Component registry

**Files to Modify:**

- [ ] [`package.json`](package.json) - Update build script
- [ ] [`pages/BlogList.tsx`](pages/BlogList.tsx) - Change Link to <a>
- [ ] [`pages/Home.tsx`](pages/Home.tsx) - Change Link to <a> for featured posts
- [ ] [`nginx.conf`](nginx.conf) - Add routing rules for HTML files
- [ ] [`velite.config.ts`](velite.config.ts) - Optional: add metadata collection
- [ ] [`App.tsx`](App.tsx) - Optional: remove blog post route

**Files to Reference (for template creation):**

- [`components/Layout.tsx`](components/Layout.tsx) - Nav/footer structure
- [`index.css`](index.css) - Ensure all styles included
- [`pages/BlogPost.tsx`](pages/BlogPost.tsx) - Article structure reference
- [`index.html`](index.html) - Base HTML structure, fonts, highlight.js

---

## Expected Outcomes

### Bundle Size Impact

- **Before:** Main bundle ~500KB (includes all blog content)
- **After:** Main bundle ~100KB (metadata only)
- **Blog pages:** 30-50KB each (HTML + minimal JS)

### SEO Impact

- Full HTML content visible to crawlers
- Meta tags in initial HTML
- Social media previews work perfectly
- Google indexing: instant (no JS execution needed)

### Performance Metrics

- **Time to First Byte:** 10-50ms (static HTML)
- **First Contentful Paint:** 100-300ms
- **Time to Interactive:** 200-400ms
- **Bundle download:** 80% reduction

### User Experience

- Blog posts load instantly (no SPA routing)
- Smooth navigation within marketing pages
- Interactive components work seamlessly
- Back button behavior: natural page navigation

---

## Rollback Plan

If issues arise:

1. Keep old BlogPost.tsx route active
2. Generate static HTML but don't change links
3. Test both approaches in parallel
4. Use feature flag to switch between SPA/MPA

## Future Enhancements

1. **Prerendering for SPA pages:** Generate HTML for homepage/about too
2. **View Transitions API:** Smooth page transitions despite full loads
3. **Service Worker:** Cache blog pages for offline reading
4. **RSS Feed:** Generate feed.xml alongside sitemap