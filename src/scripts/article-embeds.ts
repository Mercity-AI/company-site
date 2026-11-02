/* Article.astro explicitly initializes this. An interactive figure in a
   post body is a self-contained HTML page served beside the post
   (public/blog/<slug>/) and framed as `<iframe class="article-embed">`.
   Each frame grows to its page's height, so the figure never scrolls
   inside the article; it is same-origin, which is what lets us read that
   height. Without JavaScript the frame keeps the height in the markdown. */
const initialized = new WeakSet<HTMLIFrameElement>();

export function init_article_embeds(root: ParentNode = document) {
  const frames = [...root.querySelectorAll<HTMLIFrameElement>('.v2-prose iframe.article-embed')]
    .filter((frame) => !initialized.has(frame));

  for (const frame of frames) {
    initialized.add(frame);
    let observer: ResizeObserver | undefined;

    const fit = () => {
      const doc = frame.contentDocument;
      const win = frame.contentWindow as (Window & typeof globalThis) | null;
      // A lazy frame holds about:blank until it comes near the viewport.
      if (!doc || !win || doc.URL === 'about:blank') return;
      const resize = () => {
        frame.style.height = `${Math.ceil(doc.documentElement.getBoundingClientRect().height)}px`;
      };
      observer?.disconnect();
      // The frame's own ResizeObserver, so it runs with the figure's layout.
      observer = new win.ResizeObserver(resize);
      observer.observe(doc.documentElement);
      resize();
    };

    frame.addEventListener('load', fit);
    // The frame may have loaded before this ran.
    if (frame.contentDocument?.readyState === 'complete') fit();
  }
}
