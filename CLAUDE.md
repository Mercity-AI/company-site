# CLAUDE.md

Working notes for this repo. Build/test/style conventions live in `AGENTS.md`
and still apply — this file covers what the site *is* and where the current
redesign work stands.

## Branch

`redesign`, branched from `astro-migration`. V2 is now the home page; the
previous home is parked at `/legacy`. Research, Blog, Simula and About
are on the V2 shell too. Only Contact still uses `BaseLayout`, so the
two shells live side by side until it moves.

## Status — landing page design is done

As of 2026-09-24 the design of `/` is **finished and stable**. Layout,
palette, type, motion, nav, backdrops and section structure are settled —
do not reopen them without being asked. What remains is **copy work**:
replacing placeholder numbers, tightening section text, and swapping in real
tools as they ship (see *Still placeholder* below). Treat design changes on
`/` as regressions unless the request is explicitly about design.

## Routes

| Route | What it is |
|---|---|
| `/` | The landing page. Formerly `/v2`; `src/pages/index.astro` on `V2Layout`. |
| `/legacy` | The previous home page, retired. `noindex`, kept for comparison. |
| `/v2` | Redirects to `/`. |
| `/v2-open` | Two treatments of the open-source section, A and B, for comparison. |
| `/design.html` | Design lab. Static file in `public/`, no Astro layout. |
| `/research`, `/research/[slug]` | Listing and logs, on `V2Layout`. See *Research and Blog*. |
| `/blog`, `/blog-post/[slug]` | Listing and posts, on `V2Layout`. Same components. |
| `/open-source/simula` | The Simula product page, on `V2Layout`. See *Simula*. |
| `/about` | On `V2Layout`. Quiet page; every figure computed from the collections. See *About*. |
| `/contact` | Unchanged, on `BaseLayout`. The last page on the old shell. |

`/legacy`, `/v2-open` and `/design.html` are `noindex` and excluded from the
sitemap. They are working surfaces, not shipping pages.

## The legacy page (`/legacy`)

Sections in order: hero → what we work on → who we work with → we ship
openly → tooling. `BentoGrid`, "Research to Enterprise", "Latest
Publications" and the closing pull-quote were removed.

Type is Inter + Playfair Display, slate neutrals, indigo `#4f46e5`.

Two independent sizing levers in `src/styles/global.css`:

- `html { font-size: 102% }` — the **type** scale.
- `--spacing: 0.2647rem` — the **layout** scale (a 4.32px step, +8% on
  Tailwind's 4px). Drives every `p-`/`m-`/`gap-`/`w-`/`h-` utility.

Horizontal padding is one class, `.page-gutter`, applied across all 17
containers. `.hero-original` pins the hero to its pre-scale pixel sizing;
delete that block and the hero scales with everything else.

Media-query breakpoints resolve against the browser default and are
deliberately unaffected by the root font-size.

## V2 (`/`)

Standalone. `src/layouts/V2Layout.astro` does **not** extend `BaseLayout`,
carries no `ClientRouter`, and scopes its own palette and fonts. It carries
its own copy of the SEO head (title/OG/canonical via `src/utils/seo.ts`),
Clarity and gtag, and accepts `noindex` for working surfaces.

**Palette** — three hues chosen off the wheel from the existing indigo,
documented on `/design.html`:

- **Indigo 243°** — identity. Links, primary actions, emphasis.
- **Teal 178°** — measurement. Charts, data, anything that means a number.
- **Amber 34°** — signal. Cautions and exceptions only. If amber appears
  twice on a screen, one of them is decoration.
- **Neutrals at hue 240**, 7–14% saturation — pulled toward the anchor, not
  stock grey.

**Type** — Fraunces for the hero headline and every heading (`--hero-serif`),
Inter for body, JetBrains Mono for labels. Inter Tight survives only on the
nav wordmark. Heading weights sit at 400; the serif does not need the weight a
sans did at the same size.

**Motion** — one curve everywhere: 600ms, `cubic-bezier(.22, 1, .36, 1)`,
24px rise, fired once via IntersectionObserver at `-10%` of the viewport.
`data-rv` marks a reveal, `--rv-delay` staggers it.

**Nav** — full-bleed at rest; past 28px of scroll the header background
collapses and re-forms as a centred 792px pill on the inner bar, which loses
20% of its height. The bar's pill is the only rounded corner left; every
button is square. Both hero buttons and both CTAs wipe black left to right
on hover. The wordmark is the logo lockup (`/no-background-logo.png`),
38px tall at rest and 30px in the pill; the PNG carries its own padding, so
it reads smaller than its box. Links are the site's real routes (Research,
Blog, Open source, About, plus the Contact CTA), declared once as
`navLinks` in the layout and reused by the mobile sheet. They sit at
14.4px / weight 500 with a 1px underline that grows on hover. "Open source"
is a dropdown (hover or focus-within) whose children come from
`navLinks[].children`; the panel is square-cornered with the pill's shadow.
Below 900px the link row hides behind a square menu button; the sheet opens
under the bar, pins the header back to its full-bleed state, lists dropdown
children as indented sub-rows, and closes on link click, Escape, or resize
past 900px. Below 480px the CTA hides too and "Contact us" lives in the
sheet.

**Footer** — three columns (brand, Site, Connect) over a copyright/legal
strip. Same links as the `BaseLayout` footer.

**Hero** — exactly one viewport. `min-height: calc(100vh - var(--nav-h))`,
declared again in `svh` so mobile does not count the URL bar, with the content
flex-centred rather than placed by asymmetric padding.

`--nav-h` (62.2px) is defined once in the layout and `.v2-bar` derives its own
height from it, so the hero cannot drift from the nav it subtracts. The nav is
sticky, not fixed, so it occupies layout space — hero plus nav is what equals
one screen.

The headline is upright, one colour, and breaks to two rows via
`max-width: 36ch` plus `text-wrap: balance`. Do **not** use a `<br>`: if the
longer half does not fit the container it wraps again and you get four lines,
not two. The size cap is what makes two rows possible — at the current
`clamp(35.2px, 5.39vw, 63.8px)` the longer line runs about 1040px against
roughly 1079px of available width, so it is close. If it tips to three lines,
either drop the cap a few px or let the hero break out of `--shell` to a wider
measure.

## Research and Blog (V2)

Both sections run on `V2Layout` with the home page's tokens, type and
motion, built from three components in `src/components/v2/`:

- **`ListHead`** — eyebrow, serif h1, lede, mono count line. No backdrop:
  the home hero spends the boldness, inner pages open on type.
- **`EntryRow`** — one entry: mono meta column (category, date), serif
  title, two-line clamped summary, author · read time, 4:3 thumbnail.
  Hover is the nav's 1px underline drawn as `text-decoration` so it
  follows a wrapped title, plus a mono "Read →" that slides in. Rows draw
  their own top rule; `:last-child` closes with a bottom rule. Below 900px
  the meta goes inline above the title; below 560px the thumbnail hides.
- **`Article`** — post header (back link, category eyebrow, h1, summary
  as lede, author/date/read-time rule row), the body in `.v2-prose`, a tag
  strip, then a tinted "More from …" band of `EntryRow`s with a `.wipe`
  link back to the listing. The cover image shows in the header **only
  when the body does not already contain it** (`body.includes(image)`):
  the research logs open with their cover figure, most blog posts don't.

`/research` leads with the newest log as a two-column card (image left,
copy right) and lists the rest under "Earlier". `/blog` groups by year
with a serif year label and mono count.

`entryToRow()` in `src/utils/blog.ts` maps a collection entry to
`EntryRow` props so the four pages share one shape.

**Prose** lives in `src/styles/v2-article.css`, imported by `Article`.
It has to cover two kinds of body: markdown rendered by Astro (research)
and webflow-era HTML pasted into markdown (most of the blog), so
selectors are element-level with a few `.w-embed` cases. Notably webflow
exported whole scripts as a bare `<code class="language-py">` inside
`.w-embed` with no `<pre>`; the stylesheet renders those as blocks.
Code blocks sit on `--n-900` with a highlight.js palette that keeps the
colour rule: indigo for keywords, teal for values, neutrals otherwise.
KaTeX CSS is imported alongside.

`V2Layout` now takes the article meta props (`type`, `publishedTime`,
`modifiedTime`, `author`, `tags`) and marks the current section's nav
link with `aria-current="page"`, which keeps its underline at rest.
`.wipe` and `.band-tint` moved from `index.astro` into the layout since
the listing pages use them too.

**Verifying reveals in the Browser pane:** if the pane is collapsed,
`document.visibilityState` is `hidden`, IntersectionObserver never fires,
and every `data-rv` element stays at opacity 0 while screenshots return
stale frames. That is the pane, not the site. Check with the pane open.

## Simula (`/open-source/simula`)

The library's product page, on `V2Layout`. Its one loud element is the
hero plate (`plate` generator + the wordmark in Fraunces italic); after
that the page is type, rules and two teal data figures. Nine sections,
alternating ground and tint: hero → premise (three ideas + `leafgrid`)
→ pipeline (five stages as one flush bordered object, numbered because
order matters, each ending in its artifact filename in teal) → one data
point (a five-step trace with a 1px rail: mix → meta-prompt → record →
critic → lineage) → three model roles (cards with a serif figure) →
running it (install, the five CLI commands, the demo video in a plain
dark frame, the minimum viable YAML) → evaluation (2×2 with rules) →
numbers from the 1K run (a bordered stat grid, teal serif numerals) plus
limits → closer.

**Every number and artifact is real**, taken from the research log's
1,000-row job-posting run and 10K e-commerce run, and from the README.
The one illustrative line is the meta-prompt text in the trace; the row
it produces is the actual row from the log. Simula is **not on PyPI**
(the `simula` package there is unrelated) — install is from the repo.

The demo video is the CDN copy of `public/simula-demo.mp4` (a terminal
running `simula run`), with `public/simula-demo-poster.jpg` extracted at
14s. It is muted, looped, `preload="none"`, and only plays while ≥35%
in view; reduced-motion leaves it on the poster.

Code samples are pre-tokenised HTML strings (`tok-k` keys indigo,
`tok-s`/`tok-n` values teal, `tok-c` quiet) on the same `--n-900` ground
as the research log's code blocks. The page's `<ol>`s carry their own
numbering, so they reset `list-style` themselves — the layout only
resets `ul`.

## About (`/about`)

Type-only, no backdrop: `ListHead` → "How we work" (four principles,
2×2 with rules, unnumbered because order does not matter; the copy is
lifted from the home page so the two never disagree) → "In numbers" (a
stat grid **computed at build** from the `research` and `posts`
collections: log count, post count, first year, author count; the
open-source count is the hardcoded pair Simula + PromptKeep) → "Who
writes here" (every author name from both collections with write-up
count and year span, as one flush grid) → two closer cards (contact,
careers).

There are no team photos, bios or titles in the repo and the page
invents none. Authors sign inconsistently across three years, so an
`ALIAS` map in the page frontmatter folds `Pranav` → `Pranav Patel`,
`Juhi` → `Juhi Singh` and the `Sonawale` typo → `Sonawane`; a bare
`Yash` (one 2024 post) is ambiguous and is left as written. Fix the
frontmatter in `content/` and the map can shrink.

## Backdrop generators

`public/v2-backdrops.js`. Seeded, deterministic, drawn once on entering view
and redrawn on resize. Declared per canvas:

```html
<canvas data-backdrop="divergence" data-seed="6104" data-dpr="1.3"></canvas>
```

A variant switcher is supported but currently unused:

```html
<div data-backdrop-switch="#someCanvasId">
  <button data-variant="evalBars">Bad number</button>
</div>
```

**In use on `/`:**

| Generator | Where | What it says |
|---|---|---|
| `blurlight` | Hero ground | Blurred tints, dithered, grained. |
| `heroCurves` | Hero, full bleed | Five lines entering one edge and leaving the other, rising as they cross. Transparent, no ground, no grain; masked so the top of the hero stays clear. Coordinates are fractions of the hero's own height. |
| `sdTarget` | Synthetic data | Bars matched to a dashed target curve — generated to spec. |
| `archLoss` | Custom architecture | A training run with the checkpoints we kept. |
| `evalBars` | Evaluation | Benchmark bars with the bad one marked, not hidden. |
| `divergence` | Product teams | A bundle converging while one line departs — differentiation. |
| `structure` | Enterprises | Columns driven through every layer — structural integration. |
| `strata`, `isoline`, `contour` | Open-source cards | Ambient. |

**In use on `/open-source/simula`:**

| Generator | Where | What it says |
|---|---|---|
| `plate` | Hero | The repo's own identity — white italic type on grained indigo cloth — drawn on-system. Per-pixel fbm weave, a darker pool where the wordmark sits, heavy mono grain. The wordmark is HTML on top. |
| `leafgrid` | Premise | Coverage with a denominator: every taxonomy leaf is a cell, one band per factor, sampled leaves fill teal, hollow cells were never reached. |

Also available, currently unused: `blurfield`, `convergence`, `facets`,
`curves`, `ridgeline`, `halftone`, `sdGap`, `sdCurriculum`, `sdFanout`,
`archReshape`, `archStack`, `archWiring`, `evalThreshold`, `evalScatter`,
`evalRegression`.

Two rules learned the hard way:

- A generator used **as an overlay** must not paint a ground or apply grain.
  Both draw a visible rectangle, and grain draws it even where the marks are
  invisible. `heroCurves` is the correct pattern: `clearRect`, strokes only.
- Generators should fill the frame they are given. Large internal insets make
  the art box look empty; 2–4% is the working range.

## Open-source treatments (`/v2-open`)

Both live on the page, labelled, running the same content and graphics with
different seeds.

- **A** — sticky left column, panels as separate cards with gaps. Scrolls.
- **B** — one bordered object: every internal edge shared, no gaps, left block
  full height. Capped to `min(100vh - 190px, 760px)` with the three panels
  sharing that height via flex, so all three are visible at once. Panel
  padding, title size and copy tighten to suit, and the body is clamped to
  three lines. Below 1000px the cap lifts and panels return to natural height.

A flush stack cannot use the lift-and-shadow hover — a panel lifting out of a
continuous rectangle leaves a hole. B shifts background instead.

## Design lab (`/design.html`)

Standalone, no dependencies. Colour wheel and derivation, generated ramps with
live WCAG contrast, five type pairings in one specimen (Warm Technical is
selected), a calibration panel for size/weight/contrast, treatments (dither,
grain, blur) and the backdrop catalogue.

Contours use hand-rolled marching squares. `d3-contour` was tried and removed:
its UMD build needs `d3-array` as a peer, and without it every call throws
silently.

## Gotchas

- **Stale HMR.** Rewriting a whole `.astro` file at once often leaves the
  browser holding the previous stylesheet — the page renders with old class
  names styled and new ones bare. It looks like broken CSS and is not. Verify
  with `curl localhost:4321/<route> | grep '<style'` before debugging; fix
  with a hard reload, and restart the dev server after wholesale rewrites.
- **`pkill -f "astro dev"` does not reliably kill the server.** It can leave a
  process holding 4321 so the "restarted" server quietly comes up on 4322 and
  the open tab keeps talking to the stale one. Kill by port
  (`lsof -ti :4321 | xargs kill -9`) and confirm the log says 4321.
- **Astro inlines small stylesheets** into the HTML instead of emitting a
  `.css` chunk. Grepping only `dist/_astro/*.css` will make a page's CSS look
  missing when it is present.

## Still placeholder — the copy to-do list

The design is done; this is what the remaining work is about.

- **Numbers.** Every number on `/` is fabricated and live: "6–14 weeks",
  "14 releases", "9 checkpoints", "30+ write-ups". All in the data arrays at
  the top of `src/pages/index.astro`.
- **Tooling.** Four cards. Simula and PromptKeep are real and link out
  (PromptKeep to github.com/Mercity-AI/promptkeep, since there is no
  `/open-source/promptkeep` page). Sieve and Anvil are invented and render as
  blurred "Coming soon" cards via `soon: true` in the `tooling` array — swap
  in a real tool by giving it an `href` and dropping `soon`. Assay was
  removed.
- **Section copy** in general has not had a final edit pass.
