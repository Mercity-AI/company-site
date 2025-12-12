#!/usr/bin/env python3
"""
Import Webflow-exported blog posts CSV into Velite-compatible MDX files.

This script preserves the HTML body from the CSV (Webflow rich text HTML).

Examples:
  # Import a single post by slug (recommended for pilots)
  python3 import_webflow_csv_to_mdx.py --slug advanced-guide-to-visual-language-models

  # Import first 2 rows (useful for quick testing)
  python3 import_webflow_csv_to_mdx.py --limit 2

  # Import everything (full migration)
  python3 import_webflow_csv_to_mdx.py --all --overwrite
"""

from __future__ import annotations

import argparse
import csv
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional


DEFAULT_CSV = "Pranav's Radical Site - Blog Posts.csv"
DEFAULT_OUT_DIR = "content"


def parse_webflow_dt_to_iso_date(s: str) -> str:
    """
    Webflow CSV uses strings like:
      'Sun Jun 02 2024 19:09:10 GMT+0000 (Coordinated Universal Time)'
    We convert to ISO date: 'YYYY-MM-DD' (Velite expects isodate).
    """
    s = (s or "").strip()
    if not s:
        return ""
    # Drop the parenthetical timezone name for stable parsing
    if " (" in s:
        s = s.split(" (", 1)[0]
    dt = datetime.strptime(s, "%a %b %d %Y %H:%M:%S GMT%z")
    return dt.date().isoformat()


def yaml_double_quote(s: str) -> str:
    """Return a YAML-safe double-quoted scalar."""
    s = (s or "")
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    # Keep it single-line for frontmatter fields like summary/title
    s = " ".join(s.splitlines()).strip()
    return f"\"{s}\""


def slugify_heading(text: str) -> str:
    """
    Convert heading text to a URL-friendly slug for anchor links.
    Example: "Foundational Concepts" -> "foundational-concepts"
    """
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = text.replace("&nbsp;", " ").replace("&amp;", "and")
    # Convert to lowercase and replace spaces/special chars with hyphens
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')


def add_heading_ids(html: str) -> str:
    """
    Add id attributes to all headings (h1-h6) for in-page navigation.
    Example: <h2>Foundational Concepts</h2> -> <h2 id="foundational-concepts">Foundational Concepts</h2>
    """
    def replace_heading(match):
        tag = match.group(1)
        attrs = match.group(2) or ''
        content = match.group(3)
        
        # Skip if heading already has an id
        if 'id=' in attrs:
            return match.group(0)
        
        # Generate slug from heading text content
        slug = slugify_heading(content)
        
        # Add id attribute
        if attrs.strip():
            new_attrs = f'{attrs} id="{slug}"'
        else:
            new_attrs = f' id="{slug}"'
        
        return f'<{tag}{new_attrs}>{content}</{tag}>'
    
    # Match headings: <h1...>...</h1> through <h6...>...</h6>
    html = re.sub(
        r'<(h[1-6])([^>]*)>(.*?)</\1>',
        replace_heading,
        html,
        flags=re.DOTALL
    )
    
    return html


def remove_anchor_wrapping_from_headings(html: str) -> str:
    """
    Remove anchor tags that wrap heading content.
    Example: <h5><a href="...">Cross-Modal Transformers</a></h5> -> <h5>Cross-Modal Transformers</h5>
    
    This fixes the bug where some headings appear as clickable links instead of plain headings.
    """
    # Pattern to match headings that contain anchor tags
    # Matches: <h1-6><a ...>text</a></h1-6>
    def unwrap_anchor(match):
        opening_tag = match.group(1)  # <h2 ...>
        anchor_content = match.group(2)  # text inside <a>...</a>
        closing_tag = match.group(3)  # </h2>
        
        return f'{opening_tag}{anchor_content}{closing_tag}'
    
    # Remove anchor tags from within headings
    html = re.sub(
        r'(<h[1-6][^>]*>)\s*<a[^>]*>(.*?)</a>\s*(</h[1-6]>)',
        unwrap_anchor,
        html,
        flags=re.DOTALL
    )
    
    return html


def clean_html_content(html: str) -> str:
    """
    Clean and normalize HTML content from Webflow export.
    
    Removes:
    - Empty id="" attributes
    - Empty paragraphs with zero-width characters
    - Unnecessary whitespace and line breaks
    - Zero-width characters (zero-width space, zero-width non-joiner, etc.)
    - Anchor tags wrapping headings
    
    Adds:
    - Proper id attributes to all headings for in-page navigation
    """
    html = (html or "").strip()
    
    # Normalize line endings
    html = html.replace("\r\n", "\n").replace("\r", "\n")
    
    # Remove zero-width characters (U+200B, U+200C, U+200D, U+FEFF, etc.)
    # Common zero-width characters: ​ ‌ ‍  
    html = html.replace("\u200B", "")  # Zero-width space
    html = html.replace("\u200C", "")  # Zero-width non-joiner
    html = html.replace("\u200D", "")  # Zero-width joiner
    html = html.replace("\uFEFF", "")  # Zero-width no-break space
    html = html.replace("&#8203;", "")  # HTML entity for zero-width space
    
    # Remove anchor tags that wrap headings (must be done before adding IDs)
    html = remove_anchor_wrapping_from_headings(html)
    
    # Remove empty id="" attributes from all HTML tags
    html = re.sub(r'\s+id=""', '', html)
    
    # Add proper id attributes to all headings for in-page navigation
    html = add_heading_ids(html)
    
    # Standardize image alignment to center (change fullwidth to center)
    html = re.sub(r'w-richtext-align-fullwidth', 'w-richtext-align-center', html)
    html = re.sub(r'data-rt-align="fullwidth"', 'data-rt-align="center"', html)
    
    # Remove empty paragraphs (with or without attributes)
    # First pass: Remove paragraphs that only contain empty inline elements
    # Matches: <p><em></em></p>, <p><strong></strong></p>, etc.
    html = re.sub(r'<p[^>]*>(\s*<(em|strong|span|i|b|u)[^>]*>\s*</\2>\s*)+</p>', '', html)
    
    # Second pass: Remove completely empty paragraphs
    # Matches: <p></p>, <p id=""></p>, <p class="something"></p>, etc.
    html = re.sub(r'<p[^>]*>\s*</p>', '', html)
    
    # Remove multiple consecutive blank lines (more than 2 newlines)
    html = re.sub(r'\n{3,}', '\n\n', html)
    
    # Clean up whitespace around block elements
    # Remove extra newlines before/after common block elements
    block_elements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'figure', 'blockquote', 'ul', 'ol', 'li']
    for element in block_elements:
        # Remove extra newlines before opening tags
        html = re.sub(rf'\n{{2,}}(<{element}[^>]*>)', r'\n\1', html)
        # Remove extra newlines after closing tags
        html = re.sub(rf'(</{element}>)\n{{2,}}', r'\1\n', html)
    
    # Final cleanup: strip trailing/leading whitespace
    html = html.strip()
    
    return html + "\n"


def normalize_html_body(html: str) -> str:
    """Alias for backward compatibility."""
    return clean_html_content(html)


@dataclass(frozen=True)
class CsvPost:
    title: str
    slug: str
    published_at: str
    created_at: str
    updated_at: str
    summary: str
    author: str
    category: str
    cover_image: str
    html_body: str


def row_to_post(row: Dict[str, str]) -> CsvPost:
    title = (row.get("Name") or "").strip()
    slug = (row.get("Slug") or "").strip()
    published_at = parse_webflow_dt_to_iso_date(row.get("Published On") or "")
    created_at = parse_webflow_dt_to_iso_date(row.get("Created On") or "")
    updated_at = parse_webflow_dt_to_iso_date(row.get("Updated On") or "")
    summary = (row.get("Meta description") or "").strip()
    author = (row.get("Author") or "").strip()
    category = (row.get("Post category") or "").strip()
    cover_image = (row.get("Blog Post Cover") or "").strip()
    html_body = normalize_html_body(row.get("Blog Post Content") or "")

    missing = [k for k, v in [("Name", title), ("Slug", slug), ("Published On", published_at), ("Meta description", summary), ("Author", author)] if not v]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    return CsvPost(
        title=title,
        slug=slug,
        published_at=published_at,
        created_at=created_at,
        updated_at=updated_at,
        summary=summary,
        author=author,
        category=category,
        cover_image=cover_image,
        html_body=html_body,
    )


def iter_csv_rows(csv_path: Path) -> Iterable[Dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def build_mdx(post: CsvPost) -> str:
    fm: List[str] = [
        "---",
        f"title: {yaml_double_quote(post.title)}",
        f"slug: {post.slug}",
        f"publishedAt: {yaml_double_quote(post.published_at)}",
    ]
    if post.created_at:
        fm.append(f"createdAt: {yaml_double_quote(post.created_at)}")
    if post.updated_at:
        fm.append(f"updatedAt: {yaml_double_quote(post.updated_at)}")
    fm.extend(
        [
            f"summary: {yaml_double_quote(post.summary)}",
            "authors:",
            f"  - name: {yaml_double_quote(post.author)}",
        ]
    )
    if post.category:
        fm.append(f"category: {yaml_double_quote(post.category)}")
    if post.cover_image:
        # Stored only; rendering is optional in the UI
        fm.append(f"image: {yaml_double_quote(post.cover_image)}")
    fm.extend(["---", "", ""])

    return "\n".join(fm) + post.html_body


def write_post(out_dir: Path, post: CsvPost, overwrite: bool) -> Path:
    out_path = out_dir / f"{post.slug}.mdx"
    if out_path.exists() and not overwrite:
        raise FileExistsError(f"Refusing to overwrite existing file: {out_path}")
    out_path.write_text(build_mdx(post), encoding="utf-8")
    return out_path


def main() -> int:
    ap = argparse.ArgumentParser(description="Import Webflow blog CSV into MDX files.")
    ap.add_argument("--csv", dest="csv_path", default=DEFAULT_CSV, help=f"Path to CSV (default: {DEFAULT_CSV})")
    ap.add_argument("--out-dir", dest="out_dir", default=DEFAULT_OUT_DIR, help=f"Output directory for MDX (default: {DEFAULT_OUT_DIR})")

    sel = ap.add_mutually_exclusive_group(required=True)
    sel.add_argument("--slug", dest="slug", help="Import exactly one row matching this slug")
    sel.add_argument("--limit", dest="limit", type=int, help="Import first N rows")
    sel.add_argument("--all", dest="all_rows", action="store_true", help="Import all rows")

    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing MDX files")
    ap.add_argument("--dry-run", action="store_true", help="Print what would happen without writing files")

    args = ap.parse_args()

    csv_path = Path(args.csv_path)
    out_dir = Path(args.out_dir)

    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    if not args.dry_run:
        out_dir.mkdir(parents=True, exist_ok=True)

    rows = list(iter_csv_rows(csv_path))
    chosen: List[Dict[str, str]] = []

    if args.slug:
        target = args.slug.strip()
        chosen = [r for r in rows if (r.get("Slug") or "").strip() == target]
        if not chosen:
            raise SystemExit(f"Slug not found in CSV: {target}")
    elif args.limit is not None:
        if args.limit <= 0:
            raise SystemExit("--limit must be > 0")
        chosen = rows[: args.limit]
    else:
        chosen = rows

    wrote: List[Path] = []
    for row in chosen:
        post = row_to_post(row)
        rel = out_dir / f"{post.slug}.mdx"
        if args.dry_run:
            print(f"[dry-run] would write: {rel}")
            continue
        wrote.append(write_post(out_dir, post, overwrite=args.overwrite))

    if not args.dry_run:
        print(f"Imported {len(wrote)} post(s) into {out_dir}")
        for p in wrote:
            print(f" - {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


