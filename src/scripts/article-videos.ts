/* Article.astro explicitly initializes this. Each video in an article body
   is wrapped in a frame that shows a loading indicator while the browser
   fetches enough to play, and again whenever playback stops to buffer.
   Without JavaScript the video plays as a plain element. */
const initialized = new WeakSet<HTMLVideoElement>();

export function init_article_videos(root: ParentNode = document) {
  const videos = [...root.querySelectorAll<HTMLVideoElement>('.v2-prose video')]
    .filter((video) => !initialized.has(video));

  for (const video of videos) {
    initialized.add(video);
    const frame = document.createElement('div');
    frame.className = 'video-frame';
    const indicator = document.createElement('span');
    indicator.className = 'video-loading';
    indicator.setAttribute('aria-hidden', 'true');
    video.replaceWith(frame);
    frame.append(video, indicator);

    const setLoading = (loading: boolean) => {
      frame.dataset.loading = String(loading);
      video.setAttribute('aria-busy', String(loading));
    };
    const canPlay = () => video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;

    // The video may already be playable, or idle, by the time this runs.
    setLoading(!canPlay() && video.networkState !== HTMLMediaElement.NETWORK_IDLE);

    for (const type of ['loadstart', 'waiting', 'seeking']) {
      video.addEventListener(type, () => setLoading(true));
    }
    video.addEventListener('play', () => { if (!canPlay()) setLoading(true); });
    for (const type of ['canplay', 'playing', 'seeked', 'error', 'abort', 'emptied']) {
      video.addEventListener(type, () => setLoading(false));
    }
    // Browsers that skip preloading (iOS Safari, data saver) stop fetching
    // at rest and report `suspend`; nothing is loading, so hide the indicator.
    video.addEventListener('suspend', () => { if (video.paused) setLoading(false); });
  }
}
