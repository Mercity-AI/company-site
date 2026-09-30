import { colorPlotDeltas } from '@/utils/plot-deltas.js';

/* Article.astro explicitly initializes this loader. Chart JSON and the
   shared Plotly bundle prefetch nearby; rendering and entrance animations
   wait for the chart to enter the viewport. */
type Plotly = (typeof import('plotly.js-cartesian-dist-min'))['default'];
interface PlotSpec {
  data: unknown[];
  layout: { height?: number; title?: unknown; [key: string]: unknown };
}

const CONFIG = {
  responsive: true,
  displaylogo: false,
  scrollZoom: false,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
};
const initialized = new WeakSet<HTMLElement>();
let plotly: Promise<Plotly> | undefined;

function loadPlotly() {
  return plotly ??= import('plotly.js-cartesian-dist-min')
    .then((m) => m.default ?? (m as unknown as Plotly))
    .catch((error) => {
      plotly = undefined;
      throw error;
    });
}

function animatePlot(el: HTMLElement) {
  el.dataset.plotState = 'rendered';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const timing = { duration: 850, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
  // Animate the rendered SVG, leaving data, axes, hover values, and PNG
  // export intact. These effects disappear when finished, before replotting.
  el.querySelectorAll<SVGPathElement>('.scatterlayer .js-line').forEach((path) => {
    // Preserve genuinely dashed series rather than replacing their styling.
    if (getComputedStyle(path).strokeDasharray !== 'none') {
      path.animate([{ opacity: 0 }, { opacity: 1 }], timing);
      return;
    }
    const length = path.getTotalLength();
    path.animate([
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: `${length}`, opacity: 0 },
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: '0', opacity: 1 },
    ], timing);
  });
  el.querySelectorAll<SVGPathElement>('.barlayer .point path').forEach((path) => {
    const box = path.getBBox();
    const start = path.getAttribute('d')?.match(/^M\s*([-\d.e+]+)[,\s]+([-\d.e+]+)/i);
    if (!start) return;
    // Plotly bar paths start at their baseline. Handle negative and
    // horizontal bars as well as the usual upward-growing positive bars.
    const trace = path.closest('.trace') as (SVGElement & {
      __data__?: { trace?: { orientation?: string } };
    }) | null;
    const vertical = trace?.__data__?.trace?.orientation !== 'h';
    const baseline = Number(start[vertical ? 2 : 1]);
    path.style.transformBox = 'fill-box';
    path.style.transformOrigin = vertical
      ? `center ${baseline > box.y + box.height / 2 ? 'bottom' : 'top'}`
      : `${baseline > box.x + box.width / 2 ? 'right' : 'left'} center`;
    path.animate([
      { transform: vertical ? 'scaleY(0)' : 'scaleX(0)', opacity: 0 },
      { transform: vertical ? 'scaleY(1)' : 'scaleX(1)', opacity: 1 },
    ], timing);
  });
  el.querySelectorAll<SVGElement>(
    '.scatterlayer .points, .scatterlayer .fills, .barlayer .bartext, .heatmaplayer',
  ).forEach((node) => node.animate([{ opacity: 0 }, { opacity: 1 }], timing));
}

export function init_article_plots(root: ParentNode = document) {
  const figures = [...root.querySelectorAll<HTMLElement>('.v2-prose [data-plot]')]
    .filter((el) => !initialized.has(el));
  if (!figures.length) return;

  for (const el of figures) {
    initialized.add(el);
    let prepared: Promise<[Plotly, PlotSpec]> | undefined;
    let visible = false;
    let drawing = false;
    let viewport: IntersectionObserver | undefined;

    const prepare = () => prepared ??= Promise.all([
      loadPlotly(),
      fetch(el.dataset.plot!).then(async (res): Promise<PlotSpec> => {
        if (!res.ok) throw new Error(`${el.dataset.plot}: ${res.status}`);
        return res.json();
      }),
    ]).catch((error) => {
      prepared = undefined;
      throw error;
    });

    const draw = async () => {
      if (drawing || el.dataset.plotState === 'rendered' || el.dataset.plotState === 'ready') return;
      drawing = true;
      el.dataset.plotState = 'rendering';
      el.setAttribute('aria-busy', 'true');
      // A transient request failure gets one automatic retry.
      try {
        let resources: [Plotly, PlotSpec];
        try { resources = await prepare(); }
        catch { resources = await prepare(); }
        const [Plotly, spec] = resources;
        if (!el.isConnected) return;
        const layout = { ...spec.layout };
        if (el.closest('figure-views')) {
          layout.title = { text: '' };
          const margin = layout.margin as { t?: number; [key: string]: unknown } | undefined;
          if (margin?.t) layout.margin = { ...margin, t: Math.max(32, margin.t - 24) };
        } else if (el.clientWidth < 640) layout.title = { text: '' };
        el.replaceChildren();
        const data = el.dataset.deltaDirection
          ? colorPlotDeltas(spec.data, el.dataset.deltaDirection) : spec.data;
        // The modebar crowds a phone-width chart and has nothing touch needs.
        const config = el.clientWidth < 640 ? { ...CONFIG, displayModeBar: false } : CONFIG;
        await Plotly.newPlot(el, data, layout, config);
        el.dataset.plotState = 'ready';
        if (visible) {
          animatePlot(el);
          viewport?.disconnect();
        }
      } catch (error) {
        console.error('plot failed', el.dataset.plot, error);
        el.dataset.plotState = 'error';
        // role=img flattens descendants for assistive technology; expose
        // the retry control as an actual button in the failure state.
        el.setAttribute('role', 'group');
        const message = document.createElement('p');
        message.textContent = 'This chart could not load.';
        message.setAttribute('role', 'status');
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry chart';
        retry.addEventListener('click', () => {
          prepared = undefined;
          void draw();
        });
        el.replaceChildren(message, retry);
      } finally {
        drawing = false;
        el.setAttribute('aria-busy', 'false');
      }
    };

    if (!('IntersectionObserver' in window)) {
      visible = true;
      void draw();
      continue;
    }
    const nearby = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      nearby.disconnect();
      void prepare().catch(() => { /* draw handles retries and the visible error state */ });
    }, { rootMargin: '600px 0px' });
    viewport = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.1);
      if (!visible) return;
      if (el.dataset.plotState === 'ready') {
        animatePlot(el);
        viewport?.disconnect();
      } else if (el.dataset.plotState !== 'error') {
        void draw();
      }
    }, { threshold: 0.1 });
    nearby.observe(el);
    viewport.observe(el);
  }
}
