import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/scripts/runs-viewer.js', import.meta.url), 'utf8');
const ticks = source.slice(source.indexOf('function niceTicks'), source.indexOf('function bisect'));

test('log ticks terminate for empty, invalid, and ordinary ranges', () => {
  // Execute the production helper under a timeout: the old zero-domain
  // loop freezes the browser rather than throwing a normal exception.
  for (const [lo, hi, expected] of [
    [0, 1, []], [-1, 1, []], [Infinity, Infinity, []], [1, 0.1, []],
    [0.1, 1, [0.1, 0.2, 0.5, 1]], [1, 10, [1, 2, 5, 10]],
  ]) {
    const result = vm.runInNewContext(`${ticks}\nlogTicks(lo, hi)`, { lo, hi }, { timeout: 100 });
    assert.deepEqual(Array.from(result), expected);
  }
});

test('empty logarithmic plots render a finite axis and a recoverable empty state', () => {
  const renderStart = source.indexOf('  render() {');
  const renderEnd = source.indexOf('\n    valFmt(', renderStart);
  const render = source.slice(renderStart, renderEnd).replace('  render() {', 'function render() {');
  const svg = {
    clientWidth: 900,
    clientHeight: 480,
    setAttribute() {},
    innerHTML: '',
  };
  const plot = {
    m: { title: 'Train loss', delta: true }, mk: 'loss', zoom: null,
    el: { querySelector: () => ({ textContent: '' }) }, resetBtn: {}, svg,
  };
  vm.runInNewContext(`${ticks}\n${render}\nrender.call(plot)`, {
    plot, root: { id: 'test' }, state: { delta: false, log: true, xaxis: 'step' }, REF: 'baseline_qknorm',
    buildSeries: () => [], xDomain: () => [0, 3053],
  }, { timeout: 100 });
  assert.match(svg.innerHTML, /No runs selected/);
  assert.doesNotMatch(svg.innerHTML, /NaN|Infinity/);
  assert.ok(Number.isFinite(plot.geom.Y(0.5)));
});
