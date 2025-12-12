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


def normalize_html_body(html: str) -> str:
    html = (html or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    return html + "\n"


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


