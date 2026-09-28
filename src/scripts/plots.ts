/* Interactive figures in an article. The markdown places an empty
     <div class="plot" data-plot="/research/assets/figures/…/name.json"></div>
   and Plotly draws the spec into it. Plotly is ~1.4 MB, so it loads once
   and only when the first figure comes near the viewport. */
type Plotly = (typeof import('plotly.js-cartesian-dist-min'))['default'];

const CONFIG = {
  responsive: true,
  displaylogo: false,
  scrollZoom: false,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
};

let plotly: Promise<Plotly> | undefined;

async function draw(el: HTMLElement) {
  // a UMD bundle: depending on interop, the API is the default export or the namespace itself
  plotly ??= import('plotly.js-cartesian-dist-min').then((m) => m.default ?? (m as unknown as Plotly));
  const [Plotly, spec] = await Promise.all([
    plotly,
    fetch(el.dataset.plot!).then((res) => {
      if (!res.ok) throw new Error(`${el.dataset.plot}: ${res.status}`);
      return res.json();
    }),
  ]);
  // On a phone the chart title runs off the edge; the caption under the chart says the same.
  if (el.clientWidth < 640) spec.layout.title = { text: '' };
  await Plotly.newPlot(el, spec.data, spec.layout, CONFIG);
}

const figures = document.querySelectorAll<HTMLElement>('.v2-prose [data-plot]');
if (figures.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        draw(el).catch((err) => {
          console.error('plot failed', el.dataset.plot, err);
          // one retry: a failed load (e.g. a flaky network) must not leave the figure blank for good
          if (el.dataset.retried) return;
          el.dataset.retried = '1';
          plotly = undefined;
          io.observe(el);
        });
      }
    },
    { rootMargin: '600px 0px' },
  );
  figures.forEach((el) => io.observe(el));
}
