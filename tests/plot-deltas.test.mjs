import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deltaColor, colorPlotDeltas } from '../src/utils/plot-deltas.js';

test('score improvements and loss improvements use opposite signs', () => {
  assert.equal(deltaColor(0.5, 'higher'), '#15803d');
  assert.equal(deltaColor(-0.5, 'higher'), '#b91c1c');
  assert.equal(deltaColor(-0.5, 'lower'), '#15803d');
  assert.equal(deltaColor(0.5, 'lower'), '#b91c1c');
  assert.equal(deltaColor(0, 'higher'), '#6b7280');
});

test('comparison coloring preserves ordinary model traces and zero deltas', () => {
  const score = { type: 'bar', text: ['41.2'], marker: { color: 'blue' } };
  const delta = { type: 'bar', text: ['+0.7', '-0.2', '+0.0'], marker: { color: 'blue' } };
  const colored = colorPlotDeltas([score, delta], 'higher');
  assert.equal(colored[0], score);
  assert.deepEqual(colored[1].marker.color, ['#15803d', '#b91c1c', '#6b7280']);
  assert.equal(delta.marker.color, 'blue');
});
