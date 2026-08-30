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
| `/v2-open` | Two treatments of the open-source section, for comparison. |
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
button is square.

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
| `curvesOverlay` | Hero corner | Transparent overlay, no ground of its own, CSS-masked so it has no edge. |
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
  Both draw a visible rectangle. `curvesOverlay` is the correct pattern.
- Generators should fill the frame they are given. Large internal insets make
  the art box look empty; 2–4% is the working range.

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
