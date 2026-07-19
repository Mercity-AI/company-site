function findMatchingDelimiter(source, openIndex, openChar, closeChar) {
  if (source[openIndex] !== openChar) return -1;

  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];

    if (ch === '\\') {
      i += 1;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
      continue;
    }

    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function splitTargetAndSuffix(rawTarget) {
  const raw = String(rawTarget || '');
  const trimmed = raw.trim();
  if (!trimmed) return { target: '', suffix: '' };

  // Support angle-bracket destinations: (<path with spaces> "title")
  const angleMatch = trimmed.match(/^<([^>]*)>([\s\S]*)$/);
  if (angleMatch) {
    return {
      target: angleMatch[1],
      suffix: angleMatch[2] || '',
    };
  }

  // Support inline titles by splitting at first whitespace:
  // (image.png "caption"), (image.png 'caption'), (image.png (caption))
  const wsIndex = trimmed.search(/\s/);
  if (wsIndex === -1) return { target: trimmed, suffix: '' };
  return {
    target: trimmed.slice(0, wsIndex),
    suffix: trimmed.slice(wsIndex),
  };
}

export function walkMarkdownLinks(markdown) {
  const source = String(markdown || '');
  const tokens = [];

  let i = 0;
  while (i < source.length) {
    let type = null;
    let start = i;
    let labelOpen = -1;

    if (source[i] === '!' && source[i + 1] === '[') {
      type = 'image';
      labelOpen = i + 1;
    } else if (source[i] === '[') {
      type = 'link';
      labelOpen = i;
    } else {
      i += 1;
      continue;
    }

    const labelClose = findMatchingDelimiter(source, labelOpen, '[', ']');
    if (labelClose === -1) {
      i = start + 1;
      continue;
    }

    // Allow optional markdown whitespace/newline between ] and (
    let targetOpen = labelClose + 1;
    while (targetOpen < source.length && /\s/.test(source[targetOpen])) {
      targetOpen += 1;
    }
    if (source[targetOpen] !== '(') {
      i = start + 1;
      continue;
    }

    const targetClose = findMatchingDelimiter(source, targetOpen, '(', ')');
    if (targetClose === -1) {
      i = start + 1;
      continue;
    }

    const rawTarget = source.slice(targetOpen + 1, targetClose);
    const parsedTarget = splitTargetAndSuffix(rawTarget);
    const end = targetClose + 1;
    tokens.push({
      type,
      start,
      end,
      label: source.slice(labelOpen + 1, labelClose),
      target: parsedTarget.target,
      targetSuffix: parsedTarget.suffix,
      rawTarget,
      raw: source.slice(start, end),
    });

    i = end;
  }

  return tokens;
}

export function replaceMarkdownLinks(markdown, replaceFn) {
  const source = String(markdown || '');
  const tokens = walkMarkdownLinks(source);
  if (tokens.length === 0) return source;

  let out = '';
  let cursor = 0;

  for (const token of tokens) {
    out += source.slice(cursor, token.start);
    const replacement = replaceFn(token);
    if (typeof replacement === 'string' && replacement.length > 0) {
      if (token.type === 'image') {
        out += `![${token.label}](${replacement}${token.targetSuffix || ''})`;
      } else {
        out += `[${token.label}](${replacement}${token.targetSuffix || ''})`;
      }
    } else {
      out += token.raw;
    }
    cursor = token.end;
  }

  out += source.slice(cursor);
  return out;
}

export function extractMarkdownImageTargets(markdown) {
  return walkMarkdownLinks(markdown)
    .filter((token) => token.type === 'image')
    .map((token) => token.target);
}
