# Repository Guidelines

## Project Structure & Module Organization
- `src/pages/`: Route files (`index.astro`, `blog/index.astro`, `blog-post/[slug].astro`, etc.).
- `src/layouts/`: Shared shells (`BaseLayout.astro`, `ShowcaseLayout.astro`).
- `src/components/`: UI building blocks. Use `.astro` for static components and `.tsx` for interactive React islands.
- `src/content.config.ts`: Astro Content Collections schema.
- `content/*.md`: Blog posts with frontmatter (`title`, `slug`, `publishedAt`, `summary`, `authors`, etc.).
- `public/`: Static assets (logos, favicon, blog images).
- `scripts/`: Content utilities (R2 upload/check scripts).

## Build, Test, and Development Commands
Use `pnpm` only.
- `pnpm dev`: Start Astro dev server.
- `pnpm build`: Create production build in `dist/`.
- `pnpm preview`: Preview production build locally.
- `pnpm check`: Run Astro type/content checks.
- `pnpm upload:images --dry-run`: Preview Markdown image rewrites/uploads.
- `pnpm check:images`: Validate image references in `content/`.

## Coding Style & Naming Conventions
- Language: TypeScript + Astro (ES modules).
- Indentation: 2 spaces; keep formatting consistent with existing files.
- Components: `PascalCase` (`HeroSection.tsx`, `BlurBackground.astro`).
- Routes/content filenames: kebab-case where appropriate (`guide-to-...md`).
- Keep route logic in `src/pages/`; shared logic in `src/utils/`.
- Prefer minimal client JS; keep interactivity in islands only when needed.

## Testing Guidelines
- No dedicated unit-test framework is configured yet.
- Required validation before PR: `pnpm check` and `pnpm build`.
- For UI changes, manually verify key paths: `/`, `/blog`, `/blog-post/:slug`, `/contact`, `/showcase`.
- Specifically test back/forward navigation with view transitions and mobile menu behavior.

## Commit & Pull Request Guidelines
- Commit style in history is short, imperative, and task-focused (e.g., `Fix blog back navigation script scope`).
- Prefer clear, scoped commits over vague messages like “update”.
- PRs should include:
  - What changed and why.
  - Affected routes/files.
  - Screenshots/video for UI changes.
  - Commands run (`pnpm check`, `pnpm build`) and outcomes.

## Security & Configuration Tips
- Never commit secrets; keep credentials in `.env`.
- Start from `.env.example` for new environments.
- For R2 operations, run dry-run mode first before live uploads.
