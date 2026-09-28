/* Interactive figures in an article. The markdown places
     <div class="plot" data-plot="/research/assets/figures/…/name.json"><img …></div>
   and the image stays as the fallback (feeds, no JS, load errors) until
   Plotly draws the spec over it. Plotly is ~1.4 MB, so it loads once and
   only when the first figure comes near the viewport. */
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
  const host = document.createElement('div');
  el.append(host);
  await Plotly.newPlot(host, spec.data, spec.layout, CONFIG);
  el.querySelector(':scope > img')?.remove();
}

const figures = document.querySelectorAll<HTMLElement>('.v2-prose [data-plot]');
if (figures.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        draw(e.target as HTMLElement).catch((err) => console.error('plot failed', err));
      }
    },
    { rootMargin: '600px 0px' },
  );
  figures.forEach((el) => io.observe(el));
}
