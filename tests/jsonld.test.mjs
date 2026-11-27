/**
 * JSON-LD on the built site. Run after `pnpm build`; skipped when there
 * is no dist/ yet.
 *
 * Every HTML page must carry exactly one ld+json script that parses, holds
 * the Organization and WebSite nodes, uses only absolute https URLs on the
 * canonical host for its own pages, and gives each schema type its
 * required fields.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: the repo path has a space, which .pathname
// leaves as %20, and the tests then skip as if nothing were built.
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const HOST = 'https://www.mercity.ai';

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

function graphOf(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  return blocks.map((m) => JSON.parse(m[1]));
}

const types = (node) => [node['@type']].flat();

/** Every string under a URL-ish key, with its path for the error message. */
function urlFields(value, path = '$', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => urlFields(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' && ['@id', 'url', 'item', 'contentUrl', 'logo', 'image', 'codeRepository'].includes(k)) {
        out.push([`${path}.${k}`, v]);
      } else urlFields(v, `${path}.${k}`, out);
    }
  }
  return out;
}

const REQUIRED = {
  Organization: ['@id', 'name', 'url', 'logo', 'sameAs'],
  WebSite: ['@id', 'name', 'url', 'publisher'],
  BlogPosting: ['headline', 'description', 'image', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage'],
  TechArticle: ['headline', 'description', 'image', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage'],
  BreadcrumbList: ['itemListElement'],
  ItemList: ['itemListElement'],
  Service: ['name', 'serviceType', 'provider', 'url'],
  SoftwareApplication: ['name', 'applicationCategory', 'operatingSystem', 'offers'],
  SoftwareSourceCode: ['codeRepository'],
  Person: ['@id', 'name'],
};

const built = existsSync(DIST);

test('every built page has one valid JSON-LD graph', { skip: !built && 'no dist/; run pnpm build first' }, () => {
  // Static HTML copied from public/ (the design lab, figure embeds) is not a
  // site page and carries no layout.
  const files = htmlFiles(DIST).filter((f) => !existsSync(join(PUBLIC, relative(DIST, f))));
  assert.ok(files.length > 10, 'expected the built pages in dist/');

  for (const file of files) {
    const where = relative(DIST, file);
    const html = readFileSync(file, 'utf8');
    if (/http-equiv="refresh"/.test(html)) continue; // Astro redirect stubs

    const scripts = graphOf(html);
    assert.equal(scripts.length, 1, `${where}: expected exactly one ld+json script`);
    const [doc] = scripts;
    assert.equal(doc['@context'], 'https://schema.org', `${where}: @context`);
    const graph = doc['@graph'];
    assert.ok(Array.isArray(graph), `${where}: @graph`);

    const all = graph.flatMap((n) => [n, ...Object.values(n).flat().filter((v) => v && typeof v === 'object' && v['@type'])]);
    for (const t of ['Organization', 'WebSite']) {
      assert.ok(graph.some((n) => types(n).includes(t)), `${where}: no ${t} node`);
    }
    assert.ok(
      graph.some((n) => types(n).some((t) => /Page$/.test(t))),
      `${where}: no WebPage-type node`,
    );

    for (const node of all) {
      for (const t of types(node)) {
        // Another organisation named in passing (a paper's publisher) is not held to ours.
        if (t === 'Organization' && !node['@id']) continue;
        for (const field of REQUIRED[t] ?? []) {
          const v = node[field];
          assert.ok(v !== undefined && v !== '' && !(Array.isArray(v) && !v.length), `${where}: ${t} missing ${field}`);
        }
      }
      for (const field of ['datePublished', 'dateModified']) {
        if (node[field]) assert.ok(!Number.isNaN(Date.parse(node[field])), `${where}: bad ${field}`);
      }
    }

    for (const [path, url] of urlFields(graph)) {
      assert.match(url, /^https:\/\//, `${where}: ${path} is not an absolute https URL: ${url}`);
      if (url.startsWith('https://mercity.ai')) assert.fail(`${where}: ${path} uses the bare host: ${url}`);
    }

    // The page node's URL is the canonical URL.
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    const page = graph.find((n) => types(n).some((t) => /Page$/.test(t)));
    assert.equal(page.url, canonical, `${where}: page url differs from canonical`);
    assert.ok(canonical.startsWith(HOST), `${where}: canonical not on ${HOST}`);
  }
});

test('posts and logs carry an article with their jsonld block; services, home and Simula an FAQ', { skip: !built && 'no dist/; run pnpm build first' }, () => {
  const read = (p) => graphOf(readFileSync(join(DIST, p), 'utf8'))[0]['@graph'];
  const dirs = (p) => (existsSync(join(DIST, p)) ? readdirSync(join(DIST, p)) : []);

  // Every post and log carries its hand-written `jsonld` frontmatter: an
  // abstract, topics, and an FAQ whose last question is the Mercity one.
  const articleChecks = (f, type) => {
    const g = read(f);
    const article = g.find((n) => types(n).includes(type));
    assert.ok(article, `${f}: no ${type}`);
    assert.ok(article.abstract, `${f}: no abstract (add a jsonld block to the frontmatter)`);
    assert.ok(article.about?.length, `${f}: no about topics`);
    const page = g.find((n) => types(n).includes('FAQPage'));
    assert.ok(page && page.mainEntity.length >= 2, `${f}: no FAQ questions`);
    const names = page.mainEntity.map((q) => q.name);
    assert.equal(names.filter((n) => /^How can Mercity help/.test(n)).length, 1, `${f}: needs one "How can Mercity help" question`);
    assert.match(names.at(-1), /^How can Mercity help/, `${f}: the Mercity question goes last`);
  };
  for (const slug of dirs('blog-post')) {
    const f = join('blog-post', slug, 'index.html');
    if (!existsSync(join(DIST, f)) || /http-equiv="refresh"/.test(readFileSync(join(DIST, f), 'utf8'))) continue;
    articleChecks(f, 'BlogPosting');
  }
  for (const slug of dirs('research')) {
    const f = join('research', slug, 'index.html');
    if (!existsSync(join(DIST, f))) continue;
    articleChecks(f, 'TechArticle');
  }
  for (const f of ['index.html', join('open-source', 'simula', 'index.html')]) {
    const faq = read(f).find((n) => types(n).includes('FAQPage'));
    assert.ok(faq && faq.mainEntity.length > 0, `${f}: no FAQ questions`);
  }
  for (const s of ['synthetic-data', 'llm-guardrails', 'model-optimization']) {
    const g = read(join('services', s, 'index.html'));
    assert.ok(g.some((n) => types(n).includes('Service')), `${s}: no Service`);
    const faq = g.find((n) => types(n).includes('FAQPage'));
    assert.ok(faq && faq.mainEntity.length > 0, `${s}: no FAQ questions`);
  }
});
