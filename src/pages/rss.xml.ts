import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getPostUrl, sortPostsByPublishedDate } from '@/utils/blog';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/utils/seo';

export async function GET(context: { site: URL | undefined }) {
  const posts = sortPostsByPublishedDate(await getCollection('posts'));

  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site ?? SITE_URL,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      link: getPostUrl(post),
      pubDate: post.data.publishedAt,
    })),
  });
}
