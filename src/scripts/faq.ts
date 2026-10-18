/**
 * FAQ accordions on native <details data-faq>. Each item opens and
 * closes on its own (no shared `name`, so nothing else collapses), and
 * its height eases between the question alone and the whole item on
 * the site's curve. While an item closes it keeps `open` until the
 * animation ends, so it carries `is-closing` for icons to read.
 * Reduced motion keeps the browser's instant toggle.
 */
const EASE = 'cubic-bezier(.22, 1, .36, 1)';
const DURATION = 450;

export function initFaq(selector = 'details[data-faq]') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll<HTMLDetailsElement>(selector).forEach((el) => {
    const summary = el.querySelector('summary');
    if (!summary) return;
    let anim: Animation | null = null;

    // Offset heights to CSS heights, whatever the box model.
    const toCss = (offset: number) => {
      const cs = getComputedStyle(el);
      if (cs.boxSizing === 'border-box') return offset;
      const edges = ['borderTopWidth', 'borderBottomWidth', 'paddingTop', 'paddingBottom'] as const;
      return offset - edges.reduce((sum, k) => sum + parseFloat(cs[k]), 0);
    };
    const closedHeight = () => {
      const cs = getComputedStyle(el);
      return summary.offsetHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    };

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const start = el.offsetHeight;
      const closing = el.open && !el.classList.contains('is-closing');
      anim?.cancel();
      el.classList.toggle('is-closing', closing);
      if (!closing) el.open = true;
      const end = closing ? closedHeight() : el.offsetHeight;

      el.style.overflow = 'hidden';
      anim = el.animate({ height: [`${toCss(start)}px`, `${toCss(end)}px`] }, { duration: DURATION, easing: EASE });
      anim.onfinish = () => {
        anim = null;
        el.style.overflow = '';
        if (closing) {
          el.open = false;
          el.classList.remove('is-closing');
        }
      };
    });
  });
}
