/**
 * JSON-LD structured data.
 *
 * Every page gets one <script type="application/ld+json"> holding a single
 * @graph (V2Layout renders it). The graph always carries the Organization
 * and the WebSite; pages add their own nodes through the layout's `schema`
 * prop, built with the helpers below. Nodes point at each other through
 * stable @id values, so every post resolves to the same Organization and
 * each author to one Person, whichever page an engine reads.
 *
 * All URLs are absolute, on the canonical host (www) with a trailing slash,
 * matching <link rel="canonical">. Values come from the content
 * collections and the pages' own data; nothing per-post is hard-coded here.
 *
 * Spec: the "JSON-LD recommendations" section of the AEO/GEO audit
 * (Nov 2026). Checked by tests/jsonld.test.mjs against the built site.
 */
import { authorSlug, canonicalAuthorName } from '@/data/authors';
import { SITE_NAME, absoluteImage, canonicalUrl } from '@/utils/seo';

export type SchemaNode = Record<string, unknown>;

const HOME = canonicalUrl('/');
export const ORGANIZATION_ID = `${HOME}#organization`;
export const WEBSITE_ID = `${HOME}#website`;
const LOGO_ID = `${HOME}#logo`;

/* ── Organization facts ──────────────────────────────────────────────
   One primary name, the others as alternates (the audit found four in
   use). The logo is the nav lockup; Google asks for at least 112px on
   each side, which 855 × 292 meets. */
const ORG_NAME = 'Mercity';
const ORG_ALTERNATE_NAMES = ['Mercity AI', 'Mercity Research', 'Mercity Research Labs'];
const FOUNDED = '2023'; // as on /about
const FOUNDER = 'Pranav Patel';
const CONTACT_EMAIL = 'pranav@mercity.io'; // as on /contact and in the footer
const ORG_SAME_AS = [
  'https://www.linkedin.com/company/mercity-ai/',
  'https://github.com/Mercity-AI',
  'https://huggingface.co/Mercity',
  'https://x.com/MercityAI',
];
const ORG_KNOWS_ABOUT = [
  'Synthetic data generation',
  'LLM guardrails',
  'AI security',
  'Red teaming',
  'LLM evaluation',
  'AI agent stress testing',
  'Decision models',
  'Model optimization',
  'Model distillation',
  'Layer pruning',
  'Quantization',
  'Fine-tuning',
  'Sparse autoencoders',
  'Model pretraining',
  'Large language models',
  'Diffusion models',
  'Computer vision',
];

/* The three services, as the nav's Services dropdown lists them. Their
   Service nodes live on the service pages; the Organization lists them by
   @id with name and URL, so the catalogue reads on its own anywhere. */
const ORG_SERVICES = [
  { name: 'Synthetic data generation', path: '/services/synthetic-data' },
  { name: 'LLM guardrails and security', path: '/services/llm-guardrails' },
  { name: 'Model optimization', path: '/services/model-optimization' },
];
export const serviceId = (path: string) => `${canonicalUrl(path)}#service`;

/* ── Ids ─────────────────────────────────────────────────────────── */

/** A Person's stable id. Matches the author pages the audit proposes (/authors/<slug>/). */
export function personId(name: string): string {
  return canonicalUrl(`/authors/${authorSlug(name)}/`) + '#person';
}

const ref = (id: string) => ({ '@id': id });
const pageId = (path: string) => `${canonicalUrl(path)}#webpage`;
const breadcrumbId = (path: string) => `${canonicalUrl(path)}#breadcrumb`;

function imageObject(src: string | undefined): SchemaNode | undefined {
  if (!src) return undefined;
  return { '@type': 'ImageObject', url: absoluteImage(src) };
}

/** Drop undefined values, so optional fields simply don't appear. */
function compact<T extends SchemaNode>(node: T): T {
  return Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined)) as T;
}

/* ── Sitewide nodes ──────────────────────────────────────────────── */

export function organizationNode(): SchemaNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: ORG_NAME,
    alternateName: ORG_ALTERNATE_NAMES,
    url: HOME,
    logo: {
      '@type': 'ImageObject',
      '@id': LOGO_ID,
      url: absoluteImage('/no-background-logo.png'),
      contentUrl: absoluteImage('/no-background-logo.png'),
      width: 855,
      height: 292,
      caption: ORG_NAME,
    },
    image: ref(LOGO_ID),
    description:
      'Mercity is a research-first AI firm founded in 2023. It works with companies on problems off-the-shelf APIs cannot solve: synthetic data generation, LLM guardrails and security, and model optimization, and it publishes its research, datasets, models and tools in the open.',
    foundingDate: FOUNDED,
    founder: personNode(FOUNDER),
    email: CONTACT_EMAIL,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: CONTACT_EMAIL,
      url: canonicalUrl('/contact'),
      availableLanguage: ['en'],
    },
    address: { '@type': 'PostalAddress', addressCountry: 'IN' },
    sameAs: ORG_SAME_AS,
    knowsAbout: ORG_KNOWS_ABOUT,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Mercity services',
      itemListElement: ORG_SERVICES.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', '@id': serviceId(s.path), name: s.name, url: canonicalUrl(s.path) },
      })),
    },
  };
}

export function websiteNode(): SchemaNode {
  // No SearchAction: the site has no search.
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: HOME,
    name: ORG_NAME,
    alternateName: SITE_NAME,
    publisher: ref(ORGANIZATION_ID),
    inLanguage: 'en',
  };
}

/* ── Building blocks ─────────────────────────────────────────────── */

export function personNode(name: string, role?: string): SchemaNode {
  return compact({
    '@type': 'Person',
    '@id': personId(name),
    name: canonicalAuthorName(name),
    jobTitle: role,
  });
}

const PAGE_TYPES = new Set(['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'FAQPage', 'ProfilePage']);
const isPageNode = (n: SchemaNode) => [n['@type']].flat().some((t) => PAGE_TYPES.has(String(t)));

interface WebPageOptions {
  path: string;
  name: string;
  description?: string;
  type?: string | string[];
  image?: string;
  /** Nodes or refs for `about` and `mainEntity`. */
  about?: SchemaNode;
  mainEntity?: SchemaNode | SchemaNode[];
  /** Questions answered on the page: makes it an FAQPage too, the questions its mainEntity. */
  faqs?: FaqItem[];
  keywords?: string[];
  /** Pages and sites this one points readers to (research behind a service...). Paths or URLs. */
  relatedLink?: string[];
  breadcrumb?: boolean;
  datePublished?: string;
  dateModified?: string;
}

const absolute = (u: string) => (/^https?:\/\//.test(u) ? u : canonicalUrl(u));

export function webPageNode(o: WebPageOptions): SchemaNode {
  const faqs = o.faqs ?? [];
  const base = [o.type ?? 'WebPage'].flat();
  return compact({
    '@type': faqs.length && !base.includes('FAQPage') ? [...base, 'FAQPage'] : o.type ?? 'WebPage',
    '@id': pageId(o.path),
    url: canonicalUrl(o.path),
    name: o.name,
    description: o.description,
    isPartOf: ref(WEBSITE_ID),
    publisher: ref(ORGANIZATION_ID),
    about: o.about,
    mainEntity: faqs.length ? faqEntities(faqs) : o.mainEntity,
    keywords: o.keywords?.length ? o.keywords : undefined,
    relatedLink: o.relatedLink?.length ? o.relatedLink.map(absolute) : undefined,
    primaryImageOfPage: imageObject(o.image),
    breadcrumb: o.breadcrumb ? ref(breadcrumbId(o.path)) : undefined,
    datePublished: o.datePublished,
    dateModified: o.dateModified,
    inLanguage: 'en',
  });
}

/** Home is always first; the last crumb is the page itself. */
export function breadcrumbNode(path: string, trail: { name: string; path?: string }[]): SchemaNode {
  const crumbs = [{ name: 'Home', path: '/' }, ...trail];
  return {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId(path),
    itemListElement: crumbs.map((c, i) =>
      compact({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: canonicalUrl(i === crumbs.length - 1 ? path : (c.path ?? '/')),
      }),
    ),
  };
}

/* ── Hand-written extras: topics, citations, FAQs ────────────────── */

export type Topic = string | { name: string; sameAs?: string };
export interface FaqItem {
  q: string;
  a: string;
}
export interface Citation {
  name: string;
  url: string;
  type?: 'paper' | 'code' | 'dataset' | 'model' | 'page';
  author?: string;
}

/** The `jsonld` frontmatter block (schema in src/content.config.ts). */
export interface JsonLdExtras {
  abstract?: string;
  about?: Topic[];
  keywords?: string[];
  citation?: Citation[];
  faq?: FaqItem[];
}

export function topicNodes(topics: Topic[] | undefined): SchemaNode[] | undefined {
  if (!topics?.length) return undefined;
  return topics.map((t) =>
    typeof t === 'string' ? { '@type': 'Thing', name: t } : compact({ '@type': 'Thing', name: t.name, sameAs: t.sameAs }),
  );
}

/* Datasets stay CreativeWork: Google validates a Dataset node for a
   description, which a citation does not carry. */
const CITATION_TYPES = {
  paper: 'ScholarlyArticle',
  code: 'SoftwareSourceCode',
  dataset: 'CreativeWork',
  model: 'CreativeWork',
  page: 'CreativeWork',
} as const;

export function citationNodes(citations: Citation[] | undefined): SchemaNode[] | undefined {
  if (!citations?.length) return undefined;
  return citations.map((c) => {
    const type = CITATION_TYPES[c.type ?? 'page'];
    return compact({
      '@type': type,
      name: c.name,
      url: c.url,
      codeRepository: type === 'SoftwareSourceCode' ? c.url : undefined,
      author: c.author ? c.author.split(',').map((name) => ({ '@type': 'Person', name: name.trim() })) : undefined,
    });
  });
}

/** Questions for an FAQPage's mainEntity. */
export function faqEntities(faqs: FaqItem[]): SchemaNode[] {
  return faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  }));
}

/** Case-insensitive union, first spelling wins. */
function mergeKeywords(...lists: (string[] | undefined)[]): string[] | undefined {
  const seen = new Map<string, string>();
  for (const k of lists.flat()) {
    if (k && !seen.has(k.trim().toLowerCase())) seen.set(k.trim().toLowerCase(), k.trim());
  }
  return seen.size ? [...seen.values()] : undefined;
}

/* ── Articles: blog posts and research logs ──────────────────────── */

/** The parts of a content-collection entry the article schema needs. */
export interface ArticleEntry {
  data: {
    title: string;
    summary: string;
    publishedAt: Date;
    updatedAt?: Date;
    authors: { name: string; role?: string }[];
    tags: string[];
    category: string;
    image?: string;
    jsonld?: JsonLdExtras;
  };
  body?: string;
}

/** Prose words in a markdown/MDX body: code, tags, imports and markup removed. */
export function countWords(body: string | undefined): number | undefined {
  if (!body) return undefined;
  const text = body
    .replace(/^```[\s\S]*?^```/gm, ' ')
    .replace(/<(script|style|code|pre)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/^(import|export)\s.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[#*_>`|~\\{}[\]()$=-]+/g, ' ');
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.length || undefined;
}

interface ArticleOptions {
  entry: ArticleEntry;
  path: string;
  /** BlogPosting for /blog-post/, TechArticle for /research/. */
  type: 'BlogPosting' | 'TechArticle';
  section: { name: string; path: string };
  /** Citations the page adds on top of the frontmatter's (a log's paper). */
  citations?: Citation[];
  /** Extra fields for the article node (mentions...). */
  extra?: SchemaNode;
}

export function articleNodes({ entry, path, type, section, citations = [], extra = {} }: ArticleOptions): SchemaNode[] {
  const d = entry.data;
  const x = d.jsonld ?? {};
  const url = canonicalUrl(path);
  const published = d.publishedAt.toISOString();
  const modified = (d.updatedAt ?? d.publishedAt).toISOString();
  const authors = d.authors.map((a) => personNode(a.name, a.role));
  const cover = d.image ?? '/banner.png';
  const faqs = x.faq ?? [];
  // One entry per URL: the page's own citations first, then the frontmatter's.
  const cited = [...citations, ...(x.citation ?? [])].filter(
    (c, i, all) => all.findIndex((o) => o.url === c.url) === i,
  );

  const article = compact({
    '@type': type,
    '@id': `${url}#article`,
    headline: d.title,
    description: d.summary,
    abstract: x.abstract,
    image: imageObject(cover),
    thumbnailUrl: absoluteImage(cover),
    datePublished: published,
    dateModified: modified,
    author: authors,
    publisher: ref(ORGANIZATION_ID),
    mainEntityOfPage: ref(pageId(path)),
    isPartOf: ref(WEBSITE_ID),
    url,
    about: topicNodes(x.about),
    keywords: mergeKeywords(d.tags, x.keywords),
    articleSection: d.category,
    citation: citationNodes(cited),
    wordCount: countWords(entry.body),
    inLanguage: 'en',
    isAccessibleForFree: true,
    ...extra,
  });

  return [
    webPageNode({
      path,
      name: d.title,
      description: d.summary,
      image: d.image,
      // With questions the page is also an FAQPage, the questions its
      // mainEntity; the article stays the page's mainEntityOfPage.
      faqs,
      breadcrumb: true,
      datePublished: published,
      dateModified: modified,
    }),
    article,
    breadcrumbNode(path, [section, { name: d.title }]),
  ];
}

/* ── Listings: /blog and /research ───────────────────────────────── */

export function collectionNodes(o: {
  path: string;
  name: string;
  description: string;
  items: { url: string; name: string }[];
  keywords?: string[];
  /** Further nodes the page shows (papers on /research). */
  parts?: SchemaNode[];
}): SchemaNode[] {
  const listId = `${canonicalUrl(o.path)}#itemlist`;
  const parts = o.parts ?? [];
  return [
    compact({
      ...webPageNode({
        path: o.path,
        name: o.name,
        description: o.description,
        type: 'CollectionPage',
        mainEntity: ref(listId),
        keywords: o.keywords,
        breadcrumb: true,
      }),
      hasPart: parts.length ? parts.map((p) => ref(String(p['@id']))) : undefined,
    }),
    ...parts,
    {
      '@type': 'ItemList',
      '@id': listId,
      numberOfItems: o.items.length,
      itemListElement: o.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: canonicalUrl(item.url),
        name: item.name,
      })),
    },
    breadcrumbNode(o.path, [{ name: o.name }]),
  ];
}

/* ── Papers (src/data/papers.ts) ─────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A published paper. Its research log, when there is one, is `subjectOf` it. */
export function paperNode(p: {
  title: string;
  summary: string;
  authors: string;
  date: string;
  venue: string;
  href: string;
  code?: string;
  log?: string;
}): SchemaNode {
  const [mon, year] = p.date.split(' ');
  const m = MONTHS.indexOf(mon);
  return compact({
    '@type': 'ScholarlyArticle',
    '@id': `${p.href}#paper`,
    headline: p.title,
    name: p.title,
    abstract: p.summary,
    author: p.authors.split(',').map((n) => personNode(n.trim())),
    datePublished: m >= 0 && year ? `${year}-${String(m + 1).padStart(2, '0')}` : undefined,
    url: p.href,
    publisher: p.venue.startsWith('arXiv') ? { '@type': 'Organization', name: 'arXiv', url: 'https://arxiv.org/' } : undefined,
    sourceOrganization: ref(ORGANIZATION_ID),
    subjectOf: p.log ? ref(`${canonicalUrl(p.log)}#article`) : undefined,
    isBasedOn: p.code ? { '@type': 'SoftwareSourceCode', codeRepository: p.code, url: p.code } : undefined,
  });
}

/* ── Service pages ───────────────────────────────────────────────── */

export function serviceNodes(o: {
  path: string;
  name: string;
  description: string;
  serviceType: string;
  /** The page's buyer FAQ, shown in full on the page. */
  faqs?: FaqItem[];
  /** What the service covers, as the page lists it: becomes hasOfferCatalog. */
  offers?: { name: string; description?: string }[];
  /** What the client receives. */
  outputs?: string[];
  /** The research, tools and datasets the page cites as evidence. */
  relatedLink?: string[];
  keywords?: string[];
}): SchemaNode[] {
  const url = canonicalUrl(o.path);
  const id = serviceId(o.path);
  return [
    webPageNode({
      path: o.path,
      name: o.name,
      description: o.description,
      about: ref(id),
      faqs: o.faqs,
      keywords: o.keywords,
      relatedLink: o.relatedLink,
      breadcrumb: true,
    }),
    compact({
      '@type': 'Service',
      '@id': id,
      name: o.name,
      serviceType: o.serviceType,
      description: o.description,
      url,
      provider: ref(ORGANIZATION_ID),
      hasOfferCatalog: o.offers?.length
        ? {
            '@type': 'OfferCatalog',
            name: o.name,
            itemListElement: o.offers.map((s) => ({
              '@type': 'Offer',
              itemOffered: compact({ '@type': 'Service', name: s.name, description: s.description }),
            })),
          }
        : undefined,
      serviceOutput: o.outputs?.length ? o.outputs.map((name) => ({ '@type': 'Thing', name })) : undefined,
    }),
    breadcrumbNode(o.path, [{ name: o.name }]),
  ];
}

/* ── Assembly ────────────────────────────────────────────────────── */

export interface PageContext {
  path: string;
  title: string;
  description?: string;
  image?: string;
}

/**
 * The page's whole graph: Organization and WebSite first, then the page's
 * own nodes. A page that passes no page-type node gets a plain WebPage.
 */
export function pageGraph(ctx: PageContext, nodes: SchemaNode[] = []): SchemaNode {
  const page = nodes.some(isPageNode)
    ? []
    : [webPageNode({ path: ctx.path, name: ctx.title, description: ctx.description, image: ctx.image })];
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationNode(), websiteNode(), ...page, ...nodes],
  };
}

/** Serialise for a <script> tag: `<` is escaped so no string can close it. */
export function jsonLdScript(graph: SchemaNode): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}
