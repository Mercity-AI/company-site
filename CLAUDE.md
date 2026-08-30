# CLAUDE.md

Working notes for this repo. Build/test/style conventions live in `AGENTS.md`
and still apply — this file covers what the site *is* and where the current
redesign work stands.

## Branch

`redesign`, branched from `astro-migration`. The shipping site and the V2
experiment live side by side; nothing on `/v2*` can affect `/`.

## Routes

| Route | What it is |
|---|---|
| `/` | The shipping landing page. Redesigned sections, original hero. |
| `/v2` | Landing page V2. Standalone experiment, own layout and type stack. |
| `/v2-open` | Two treatments of the open-source section, A and B, for comparison. |
| `/design.html` | Design lab. Static file in `public/`, no Astro layout. |
| `/blog`, `/research`, `/about`, `/contact`, `/open-source/simula` | Unchanged. |

`/v2*` and `/design.html` are `noindex`. They are working surfaces, not
shipping pages.

## The shipping page (`/`)

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

## V2 (`/v2`)

Standalone. `src/layouts/V2Layout.astro` does **not** extend `BaseLayout`,
carries no `ClientRouter`, and scopes its own palette and fonts.

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
on hover.

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

**In use on `/v2`:**

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

## Still placeholder

Assay, Sieve and Anvil are invented; only Simula is real. Every number on
`/v2` is fabricated — "14 releases", "9 checkpoints", "30+ write-ups",
"6–14 weeks". These need replacing before V2 could ship.
