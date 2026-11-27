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

const DIST = new URL('../dist/', import.meta.url).pathname;
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
  SoftwareSourceCode: ['codeRepository', 'programmingLanguage'],
  Person: ['@id', 'name'],
};

const built = existsSync(DIST);

test('every built page has one valid JSON-LD graph', { skip: !built && 'no dist/; run pnpm build first' }, () => {
  const files = htmlFiles(DIST).filter((f) => !f.endsWith('design.html'));
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

test('posts and logs carry an article, services an FAQ', { skip: !built && 'no dist/; run pnpm build first' }, () => {
  const read = (p) => graphOf(readFileSync(join(DIST, p), 'utf8'))[0]['@graph'];
  const dirs = (p) => (existsSync(join(DIST, p)) ? readdirSync(join(DIST, p)) : []);

  for (const slug of dirs('blog-post')) {
    const f = join('blog-post', slug, 'index.html');
    if (!existsSync(join(DIST, f)) || /http-equiv="refresh"/.test(readFileSync(join(DIST, f), 'utf8'))) continue;
    assert.ok(read(f).some((n) => types(n).includes('BlogPosting')), `${f}: no BlogPosting`);
  }
  for (const slug of dirs('research')) {
    const f = join('research', slug, 'index.html');
    if (!existsSync(join(DIST, f))) continue;
    assert.ok(read(f).some((n) => types(n).includes('TechArticle')), `${f}: no TechArticle`);
  }
  for (const s of ['synthetic-data', 'llm-guardrails', 'model-optimization']) {
    const g = read(join('services', s, 'index.html'));
    assert.ok(g.some((n) => types(n).includes('Service')), `${s}: no Service`);
    const faq = g.find((n) => types(n).includes('FAQPage'));
    assert.ok(faq && faq.mainEntity.length > 0, `${s}: no FAQ questions`);
  }
});
