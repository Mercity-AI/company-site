---
name: Mercity Website Overhaul
overview: Comprehensive overhaul of the Mercity Research landing page including new sections, navigation changes, background randomization, contact functionality, OG image fixes, and various content/link updates.
todos:
  - id: nav-header
    content: "Update navigation: Replace 'Join Waitlist' with 'Contact Us', remove 'Journal' nav item"
    status: pending
  - id: hero-ctas
    content: "Hero section: Remove 'Our Mission' button, rename 'Read the Journal' to 'Read Our Research'"
    status: pending
  - id: bento-grid
    content: Create demo bento grid component for homepage -- exploratory, user will review and iterate
    status: pending
  - id: latest-publications
    content: Rename 'Latest from the Lab' to 'Latest Publications', show blog images on cards
    status: pending
  - id: bridging-text
    content: Add research-to-enterprise bridging text section on homepage
    status: pending
  - id: quote-section
    content: Replace the Dr. Elena Vora quote with new approved content
    status: pending
  - id: bg-randomization
    content: Implement 70/30 background randomization (default vs CircuitLattice/GradientMesh/ArchitecturalGrid/InteractiveNeuralGrid)
    status: pending
  - id: remove-team
    content: Remove team section from About page
    status: pending
  - id: contact-page
    content: Create Contact Us page with form and Calendly embed
    status: pending
  - id: fix-links
    content: "Fix social links (actual URLs), make email a mailto: link, fix careers -> LinkedIn redirect"
    status: pending
  - id: banner-image
    content: Move banner.png to public/static/, convert to JPG, update references
    status: pending
  - id: og-images
    content: "Fix OG images: add static meta tags in index.html, add prerendering for crawlers"
    status: pending
  - id: showcase-cleanup
    content: Update AnimationShowcase to match new CTAs, clean up footer/nav references
    status: pending
isProject: false
---

# Mercity Website Overhaul Plan

## 1. Navigation and Header Changes

**File:** `[components/Layout.tsx](components/Layout.tsx)`

- **Replace "Join Waitlist" button** with a "Contact Us" button linking to a new `/contact` route
- **Remove "Journal" nav item** from `navLinks` array (line 36), keep only "Research" and "About"
- Update mobile menu accordingly
- Make the "Contact Us" button work in both desktop and mobile nav

## 2. Hero Section Updates

**File:** `[pages/Home.tsx](pages/Home.tsx)` (lines 67-111)

- **Remove the "Our Mission" button** entirely (the `<Link to="/about">` with ArrowRight)
- **Rename "Read the Journal"** to "Read Our Research" (keep linking to `/blog`)
- This leaves a single CTA link in the hero

## 3. Bento Grid Section (Exploratory / Demo)

**New file:** `components/BentoGrid.tsx`, **Updated:** `[pages/Home.tsx](pages/Home.tsx)`

- Create a **demo** bento-grid-style component and insert it between the Research Areas section (line 154) and the Featured Work section (line 156)
- Asymmetric card layout showcasing open source work / technical advancements (datasets, models, research highlights)
- Each card with a title, short description, and relevant tags/badges
- **This is exploratory** -- build it, show it, then user will review and decide what to keep/change/remove
- User will also provide a reference from "Ionioia's site" for design inspiration later

## 4. Rename "Latest from the Lab" to "Latest Publications"

**File:** `[pages/Home.tsx](pages/Home.tsx)` (lines 156-206)

- Change section title from "Latest from the Lab" to "Latest Publications"
- Rework the `featuredContent` array to pull from actual blog posts (rather than hardcoded Dataset/Model entries)
- **Show blog post images** instead of gradient placeholders: use `post.image` for the card thumbnail area (line 172), fall back to gradient if no image exists

## 5. Research-to-Enterprise Bridging Text Section

**File:** `[pages/Home.tsx](pages/Home.tsx)` -- insert between the new bento grid and Latest Publications, or between Latest Publications and the Quote section

- Add a new text/copy section that bridges the lab identity with enterprise positioning
- Positions Mercity as a research partner: "We are a research lab that builds production-ready AI capabilities for enterprise teams"
- Exact copy TBD -- will need user input on tone and messaging

## 6. Update Quote Section

**File:** `[pages/Home.tsx](pages/Home.tsx)` (lines 208-224)

- Replace the current quote from fictional "Dr. Elena Vora" with a real or approved quote
- User to provide new quote content

## 7. Background Randomization (70/30 Split)

**Files:** `[components/Layout.tsx](components/Layout.tsx)`, `[components/BlurBackground.tsx](components/BlurBackground.tsx)`

- Modify the `Layout` component to implement randomization on the homepage:
  - **70% of the time**: Show the default `BlurBackground` (current behavior)
  - **30% of the time**: Randomly pick from these 4 variants defined in `[components/BackgroundVariations.tsx](components/BackgroundVariations.tsx)`:
    - `CircuitLattice`
    - `GradientMesh`
    - `ArchitecturalGrid`
    - `InteractiveNeuralGrid`
- Use a `useMemo` or `useState` with a random seed on mount so it stays consistent during the session
- Only apply on the homepage (`/`), other pages keep the default background

## 8. Remove Team Section from About Page

**File:** `[pages/About.tsx](pages/About.tsx)`

- Remove the `teamMembers` array (lines 6-35), the "The Team" header (lines 76-79), and the team grid (lines 81-105)
- Keep the intro text and the "Join our research" CTA section

## 9. Create Contact Us Page

**New file:** `pages/Contact.tsx`, **Updated:** `[App.tsx](App.tsx)`

- Create a new `/contact` route and page with:
  - A contact form (name, email, company, message) -- can use a service like Formspree, or a simple mailto action
  - **Calendly inline embed** using the provided widget code:
    - URL: `https://calendly.com/pranav-mercity/30min`
    - Load the Calendly external widget script: `https://assets.calendly.com/assets/external/widget.js`
- Add route in `App.tsx`
- Link the "Contact Us" nav button to this page

## 10. Fix Social/Connect Links

**File:** `[components/Layout.tsx](components/Layout.tsx)` (lines 140-149)

- Replace placeholder `href="#"` links with actual URLs:
  - Twitter/X: `https://x.com/Pranav2278`
  - LinkedIn: `https://www.linkedin.com/company/mercity-ai/`
  - GitHub: `https://github.com/Mercity-AI/`
- Make `hello@mercity.ai` a proper `mailto:hello@mercity.ai` link
- Add `target="_blank" rel="noopener noreferrer"` to external links

## 11. Careers Redirect to LinkedIn

**File:** `[components/Layout.tsx](components/Layout.tsx)` (line 136), `[pages/About.tsx](pages/About.tsx)` (line 114)

- Update the footer "Careers" link to: `https://www.linkedin.com/company/mercity-ai/jobs/`
- Update the "View Open Positions" button on the About page to link to the same URL
- Add `target="_blank" rel="noopener noreferrer"` since it's an external link

## 12. OG Images and Meta Tags (Critical Technical Issue)

**Files:** `[index.html](index.html)`, `[components/SEO.tsx](components/SEO.tsx)`

**Problem:** This is a client-side SPA. Social media crawlers (Facebook, Twitter, LinkedIn, Slack) do NOT execute JavaScript, so `react-helmet-async` meta tags are invisible to them. OG images will never show in link previews in the current setup.

**Additionally:** The default OG fallback image (`/static/banner.png`) does not exist.

**Solution (three steps):**

1. **Banner image:** Move the provided `banner.png` to `public/static/`, convert to JPG using `sips` (macOS built-in), and update the SEO component's fallback path to `/static/banner.jpg`
2. **Add static fallback meta tags** in `index.html` for the homepage (title, description, og:image, twitter:card) -- this gives baseline coverage for the homepage
3. **Add prerendering** via `vite-plugin-prerender` (or similar) to generate static HTML for key routes (`/`, `/about`, `/blog`, `/contact`, and all `/blog-post/*` slugs) at build time. This ensures crawlers see the correct per-page meta tags including blog-specific OG images

Blog posts already pass `post.image` to the SEO component, so once prerendering is in place, blog OG images should work automatically.

## 13. Design Showcase Cleanup

**File:** `[pages/AnimationShowcase.tsx](pages/AnimationShowcase.tsx)`

- Update the showcase hero to match new CTAs (remove "Our Mission", update "Read the Journal" text)
- Consider removing the `/showcase` link from the footer sitemap and mobile nav (it's a dev/design tool, not user-facing)

## Items Requiring User Input Before Implementation

- ~~Actual social media URLs~~ -- **RESOLVED** (X, LinkedIn, GitHub provided)
- ~~LinkedIn jobs portal URL~~ -- **RESOLVED** (`/company/mercity-ai/jobs/`)
- ~~Calendly scheduling link~~ -- **RESOLVED** (`pranav-mercity/30min`)
- ~~Default OG banner image~~ -- **RESOLVED** (`banner.png` provided)
- New quote to replace the Dr. Elena Vora quote
- Exact copy for the "research-to-enterprise" bridging section
- Reference from "Ionioia's site" for bento grid design inspiration (bento grid will be built as demo first)

