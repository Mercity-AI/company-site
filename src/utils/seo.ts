export const SITE_NAME = 'Mercity Research';
export const SITE_DESCRIPTION =
  'Research-grade, reality-ready. Shipping the research to production. Custom training, real optimization, genuine architecture.';
export const SITE_URL = 'https://www.mercity.ai';
export const DEFAULT_OG_IMAGE = '/banner.png';

export function fullTitle(title?: string): string {
  if (!title || title === SITE_NAME) {
    return SITE_NAME;
  }
  return `${title} | ${SITE_NAME}`;
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export function absoluteImage(path?: string): string {
  if (!path) {
    return absoluteUrl(DEFAULT_OG_IMAGE);
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return absoluteUrl(path);
}
