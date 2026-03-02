import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    sourceDir: '.notion',
    contentDir: 'content',
    publicBlogDir: 'public/blog',
    dryRun: false,
    move: false,
    overwrite: false,
    author: 'Mercity Research Team',
    category: 'Research',
    publishedAt: new Date().toISOString().slice(0, 10),
  };

  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--source' && rest[i + 1]) {
      args.sourceDir = rest[++i];
    } else if (arg === '--content-dir' && rest[i + 1]) {
      args.contentDir = rest[++i];
    } else if (arg === '--public-dir' && rest[i + 1]) {
      args.publicBlogDir = rest[++i];
    } else if (arg === '--author' && rest[i + 1]) {
      args.author = rest[++i];
    } else if (arg === '--category' && rest[i + 1]) {
      args.category = rest[++i];
    } else if (arg === '--published-at' && rest[i + 1]) {
      args.publishedAt = rest[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--move') {
      args.move = true;
    } else if (arg === '--overwrite') {
      args.overwrite = true;
    } else if (!arg.startsWith('-') && args.sourceDir === '.notion') {
      // Positional shortcut: pnpm import:notion -- ".notion/LCM Blog"
      args.sourceDir = arg;
    }
  }

  return args;
}

const args = parseArgs(process.argv);

function safeDecodeURIComponent(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function stripNotionIdSuffix(name) {
  return name
    .replace(/\s+[0-9a-f]{32}$/i, '')
    .replace(/\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '')
    .trim();
}

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}

function encodePathSegments(pathLike) {
  return toPosixPath(pathLike)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function walkMarkdownFiles(dir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdownFiles(full));
      continue;
    }
    if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      out.push(full);
    }
  }
  return out;
}

function walkFiles(dir, root = dir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, root));
      continue;
    }
    if (entry.isFile()) {
      const rel = toPosixPath(full.slice(root.length + 1));
      out.push({ full, rel });
    }
  }
  return out;
}

function splitPathAndSuffix(url) {
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  if (q === -1 && h === -1) return { pathPart: url, suffix: '' };
  const idx = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  return {
    pathPart: url.slice(0, idx),
    suffix: url.slice(idx),
  };
}

function normalizeRef(input) {
  let v = String(input || '').trim();
  if (!v) return '';
  if (v.startsWith('<') && v.endsWith('>')) v = v.slice(1, -1);
  v = v.replace(/\\/g, '/');
  v = safeDecodeURIComponent(v);
  v = v.replace(/^\.\/+/, '');
  v = v.replace(/^\/+/, '');
  v = v.replace(/\/{2,}/g, '/');
  return v;
}

function extractTitleAndStripH1(markdown, fallbackTitle) {
  const lines = markdown.split('\n');
  let title = fallbackTitle;
  let h1Index = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^#\s+(.+?)\s*$/);
    if (m) {
      title = m[1].trim();
      h1Index = i;
    }
    break;
  }

  if (h1Index >= 0) {
    lines.splice(h1Index, 1);
    if (lines[h1Index] && lines[h1Index].trim() === '') {
      lines.splice(h1Index, 1);
    }
  }

  return { title, body: lines.join('\n') };
}

function extractSummary(body, fallback = '') {
  const lines = body.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === '---') continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('![')) continue;
    if (t.startsWith('>')) continue;
    if (t.startsWith('```')) continue;
    const clean = t.replace(/\s+/g, ' ').trim();
    if (clean) {
      if (clean.length <= 500) return clean;
      return clean.slice(0, 497).trimEnd() + '...';
    }
  }
  const fallbackClean = String(fallback || '').replace(/\s+/g, ' ').trim();
  if (!fallbackClean) return 'Imported from Notion.';
  if (fallbackClean.length <= 500) return fallbackClean;
  return fallbackClean.slice(0, 497).trimEnd() + '...';
}

function normalizeAuthors(authors, fallbackAuthor) {
  if (Array.isArray(authors) && authors.length > 0) {
    if (typeof authors[0] === 'string') {
      return authors.map((name) => ({ name }));
    }
    return authors;
  }
  if (typeof authors === 'string' && authors.trim()) {
    return [{ name: authors.trim() }];
  }
  return [{ name: fallbackAuthor }];
}

function rewriteLinks(markdown, resolveLink) {
  let out = markdown;

  // Markdown images
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, target) => {
    const replacement = resolveLink(target);
    if (!replacement) return full;
    return `![${alt}](${replacement})`;
  });

  // Markdown links (skip images)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, text, target, offset, whole) => {
    if (offset > 0 && whole[offset - 1] === '!') return full;
    const replacement = resolveLink(target);
    if (!replacement) return full;
    return `[${text}](${replacement})`;
  });

  // HTML src / href
  out = out.replace(/(<(?:img|source|video|audio)[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (full, a, url, b) => {
    const replacement = resolveLink(url);
    if (!replacement) return full;
    return `${a}${replacement}${b}`;
  });
  out = out.replace(/(<a[^>]+href=["'])([^"']+)(["'][^>]*>)/gi, (full, a, url, b) => {
    const replacement = resolveLink(url);
    if (!replacement) return full;
    return `${a}${replacement}${b}`;
  });

  return out;
}

function isRemoteOrSpecialUrl(url) {
  return /^(?:https?:|data:|cid:|mailto:|tel:)/i.test(url);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function getAssetDirForMarkdown(mdFile) {
  const mdDir = dirname(mdFile);
  const mdBase = basename(mdFile, extname(mdFile));
  const cleanBase = stripNotionIdSuffix(mdBase);
  const candidate = join(mdDir, cleanBase);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

function buildAssetMap(assetDir, slug) {
  const refsToNewUrl = new Map();
  const files = walkFiles(assetDir);
  const assetFolderName = basename(assetDir);

  for (const file of files) {
    const rel = toPosixPath(file.rel);
    const outUrl = `/blog/${slug}/${encodePathSegments(rel)}`;
    const key1 = normalizeRef(`${assetFolderName}/${rel}`);
    const key2 = normalizeRef(rel);
    refsToNewUrl.set(key1, outUrl);
    refsToNewUrl.set(key2, outUrl);
  }

  return { refsToNewUrl, files };
}

function importOne(mdFile, paths, counters) {
  const originalName = basename(mdFile);
  const rawBase = basename(mdFile, extname(mdFile));
  const cleanedBase = stripNotionIdSuffix(rawBase);
  const slug = slugify(cleanedBase);

  if (!slug) {
    console.log(`   Skipping ${originalName}: could not derive slug.`);
    counters.skipped += 1;
    return;
  }

  const destContentFile = join(paths.contentDir, `${slug}.md`);
  if (existsSync(destContentFile) && !args.overwrite) {
    console.log(`   Skipping ${originalName}: ${destContentFile} already exists (use --overwrite).`);
    counters.skipped += 1;
    return;
  }

  const raw = readFileSync(mdFile, 'utf-8');
  const parsed = matter(raw);
  const extracted = extractTitleAndStripH1(parsed.content || '', cleanedBase);
  const title = (parsed.data?.title || extracted.title || cleanedBase).trim();
  const assetDir = getAssetDirForMarkdown(mdFile);

  let refsToNewUrl = new Map();
  let assetFiles = [];
  if (assetDir) {
    const built = buildAssetMap(assetDir, slug);
    refsToNewUrl = built.refsToNewUrl;
    assetFiles = built.files;
  }

  const rewrittenBody = rewriteLinks(extracted.body, (target) => {
    const trimmed = String(target || '').trim();
    if (!trimmed) return null;
    if (isRemoteOrSpecialUrl(trimmed)) return null;
    const split = splitPathAndSuffix(trimmed);
    const key = normalizeRef(split.pathPart);
    const mapped = refsToNewUrl.get(key);
    if (!mapped) return null;
    counters.rewrittenRefs += 1;
    return `${mapped}${split.suffix}`;
  });

  const frontmatter = { ...(parsed.data || {}) };
  frontmatter.title = frontmatter.title || title;
  frontmatter.slug = frontmatter.slug || slug;
  frontmatter.publishedAt = frontmatter.publishedAt || args.publishedAt;
  frontmatter.summary = frontmatter.summary || extractSummary(rewrittenBody, title);
  frontmatter.authors = normalizeAuthors(frontmatter.authors, args.author);
  frontmatter.tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  frontmatter.category = frontmatter.category || args.category;
  if (typeof frontmatter.isTopPick !== 'boolean') frontmatter.isTopPick = false;

  const outMarkdown = matter.stringify(rewrittenBody, frontmatter);
  const destAssetDir = join(paths.publicBlogDir, slug);

  console.log(`\n- Importing: ${originalName}`);
  console.log(`  Slug: ${slug}`);
  console.log(`  Content: ${destContentFile}`);
  if (assetDir) {
    console.log(`  Assets: ${assetDir} -> ${destAssetDir} (${assetFiles.length} file(s))`);
  } else {
    console.log('  Assets: none found (no sibling Notion asset folder).');
  }

  if (args.dryRun) {
    counters.imported += 1;
    counters.assetFiles += assetFiles.length;
    return;
  }

  ensureDir(paths.contentDir);
  ensureDir(paths.publicBlogDir);
  ensureDir(destAssetDir);

  writeFileSync(destContentFile, outMarkdown, 'utf-8');

  for (const file of assetFiles) {
    const src = file.full;
    const dest = join(destAssetDir, file.rel);
    ensureDir(dirname(dest));
    const destExists = existsSync(dest);
    if (destExists && !args.overwrite) {
      console.log(`  Asset exists, skipping: ${dest}`);
      continue;
    }
    if (destExists && args.overwrite) {
      unlinkSync(dest);
    }
    if (args.move) {
      renameSync(src, dest);
    } else {
      copyFileSync(src, dest);
    }
  }

  if (args.move) {
    unlinkSync(mdFile);
  }

  counters.imported += 1;
  counters.assetFiles += assetFiles.length;
}

function main() {
  const sourceDir = resolve(projectRoot, args.sourceDir);
  const contentDir = resolve(projectRoot, args.contentDir);
  const publicBlogDir = resolve(projectRoot, args.publicBlogDir);

  console.log('Notion Import');
  console.log(`- Source: ${sourceDir}`);
  console.log(`- Content dir: ${contentDir}`);
  console.log(`- Public blog dir: ${publicBlogDir}`);
  console.log(`- Mode: ${args.dryRun ? 'dry-run' : 'live'}`);
  console.log(`- Source handling: ${args.move ? 'move (remove source files)' : 'copy (keep source files)'}`);
  console.log(`- Overwrite: ${args.overwrite ? 'yes' : 'no'}`);

  if (!existsSync(sourceDir)) {
    console.error(`\nSource directory not found: ${sourceDir}`);
    process.exit(1);
  }

  const mdFiles = walkMarkdownFiles(sourceDir);
  if (mdFiles.length === 0) {
    console.log('\nNo markdown files found to import.');
    return;
  }

  console.log(`\nFound ${mdFiles.length} markdown file(s).`);

  const counters = {
    imported: 0,
    skipped: 0,
    assetFiles: 0,
    rewrittenRefs: 0,
  };

  for (const file of mdFiles) {
    importOne(file, { contentDir, publicBlogDir }, counters);
  }

  console.log('\nImport complete.');
  console.log(`- Imported: ${counters.imported}`);
  console.log(`- Skipped: ${counters.skipped}`);
  console.log(`- Asset files: ${counters.assetFiles}`);
  console.log(`- Rewritten refs: ${counters.rewrittenRefs}`);
}

main();
