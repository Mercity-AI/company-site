import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getPostUrl, getResearchUrl, sortPostsByPublishedDate } from '@/utils/blog';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/utils/seo';

export async function GET(context: { site: URL | undefined }) {
  const posts = await getCollection('posts');
  const research = await getCollection('research');

  const items = sortPostsByPublishedDate([
    ...posts.map((post) => ({ data: post.data, link: getPostUrl(post) })),
    ...research.map((entry) => ({ data: entry.data, link: getResearchUrl(entry) })),
  ]);

  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site ?? SITE_URL,
    items: items.map((item) => ({
      title: item.data.title,
      description: item.data.summary,
      link: item.link,
      pubDate: item.data.publishedAt,
    })),
  });
}
