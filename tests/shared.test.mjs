/**
 * Unit tests for @leak-doctor/shared utilities (MAINT-001 formatBytes hardening).
 * Zero-dependency: runs on Node's built-in test runner against the built package.
 * Run `pnpm build` first (tests import packages' dist output).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { formatBytes, formatDurationMs, computeSeverity } = await import('../packages/shared/dist/index.mjs');

test('formatBytes formats positive values', () => {
  assert.equal(formatBytes(0), '0 Bytes');
  assert.equal(formatBytes(512), '512 Bytes');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(10 * 1024 * 1024), '10 MB');
});

test('formatBytes handles negative and non-finite input (no NaN)', () => {
  assert.equal(formatBytes(-1536), '-1.5 KB');
  assert.equal(formatBytes(NaN), '0 Bytes');
  assert.equal(formatBytes(Infinity), '0 Bytes');
});

test('formatDurationMs formats ms and seconds', () => {
  assert.equal(formatDurationMs(500), '500ms');
  assert.equal(formatDurationMs(1500), '1.50s');
});

test('computeSeverity maps thresholds', () => {
  assert.equal(computeSeverity(1000), 'low');
  assert.equal(computeSeverity(6000), 'medium');
  assert.equal(computeSeverity(20_000), 'high');
  assert.equal(computeSeverity(40_000), 'critical');
  assert.equal(computeSeverity(1000, 11 * 1024 * 1024), 'critical');
});
