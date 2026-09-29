const BETTER = '#15803d';
const WORSE = '#b91c1c';
const NEUTRAL = '#6b7280';

export function deltaColor(value, direction) {
  if (!Number.isFinite(value) || value === 0) return NEUTRAL;
  const improves = direction === 'lower' ? value < 0 : value > 0;
  return improves ? BETTER : WORSE;
}

// Only explicitly marked comparison charts use outcome colors. Other traces
// retain the model colors, so ordinary loss curves and scores are unaffected.
export function colorPlotDeltas(data, direction) {
  return data.map(trace => {
    if (trace.type === 'heatmap') {
      const low = direction === 'lower' ? BETTER : WORSE;
      const high = direction === 'lower' ? WORSE : BETTER;
      return { ...trace, colorscale: [[0, low], [0.5, '#f8faf9'], [1, high]] };
    }
    if (trace.type !== 'bar' || !Array.isArray(trace.text) ||
        !trace.text.every(text => /^[+−-]\d+(?:\.\d+)?$/.test(String(text)))) return trace;
    const colors = trace.text.map(text => deltaColor(Number(String(text).replace('−', '-')), direction));
    return { ...trace, marker: { ...trace.marker, color: colors }, textfont: { ...trace.textfont, color: colors } };
  });
}
