/// <reference types="astro/client" />

declare module 'plotly.js-cartesian-dist-min' {
  const Plotly: {
    newPlot(root: HTMLElement, data: unknown[], layout?: unknown, config?: unknown): Promise<HTMLElement>;
  };
  export default Plotly;
}
