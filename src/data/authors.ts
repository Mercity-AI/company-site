/**
 * One name per person.
 *
 * The same people sign differently across three years of posts. Map the
 * short and misspelt forms onto the full name; anything ambiguous stays
 * as written. The About page counts authors with this, and the JSON-LD
 * uses it so one person resolves to one Person node across every post.
 */
export const AUTHOR_ALIASES: Record<string, string> = {
  Pranav: 'Pranav Patel',
  Juhi: 'Juhi Singh',
  'Yash Sonawale': 'Yash Sonawane',
};

export function canonicalAuthorName(name: string): string {
  const trimmed = name.trim();
  return AUTHOR_ALIASES[trimmed] ?? trimmed;
}

/** URL-safe slug for an author name: "Pranav Patel" -> "pranav-patel". */
export function authorSlug(name: string): string {
  return canonicalAuthorName(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
