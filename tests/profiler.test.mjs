/**
 * Unit tests for @leak-doctor/profiler leak semantics (BUG-001/002/003).
 * Zero-dependency: runs on Node's built-in test runner against the built package.
 * Run `pnpm build` first (tests import packages' dist output).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis; // the engine's SSR guard checks `typeof window`

const { leakDoctor, track } = await import('../packages/profiler/dist/index.mjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('strongly-referenced object (default track) produces NO leak report', async () => {
  leakDoctor.clear();
  leakDoctor.start({ leakThresholdMs: 50, sampleIntervalMs: 15 });
  const cache = { data: 'legitimately long-lived cache' };
  globalThis.__holdStrong = cache;
  track(cache, 'Legitimate Long-Lived Cache');
  await sleep(180);
  leakDoctor.performDiagnosticSweep();
  assert.equal(leakDoctor.getReports().length, 0);
  leakDoctor.stop();
});

test('expectFreed object retained past threshold IS reported', async () => {
  leakDoctor.clear();
  leakDoctor.start({ leakThresholdMs: 50, sampleIntervalMs: 15 });
  const leaked = { data: 'should have been freed' };
  globalThis.__holdLeaked = leaked;
  track(leaked, 'Asserted Should-Be-Freed', { expectFreed: true });
  await sleep(180);
  leakDoctor.performDiagnosticSweep();
  const reports = leakDoctor.getReports();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].targetDescription, 'Asserted Should-Be-Freed');
  assert.ok(['low', 'medium', 'high', 'critical'].includes(reports[0].severity));
  leakDoctor.stop();
});

test('maxRetainedObjects cap is enforced (BUG-003)', async () => {
  leakDoctor.clear();
  leakDoctor.start({ leakThresholdMs: 10_000, sampleIntervalMs: 60_000, maxRetainedObjects: 2 });
  const a = { a: 1 };
  const b = { b: 2 };
  const c = { c: 3 };
  globalThis.__holdCap = [a, b, c];
  const idA = track(a, 'A');
  const idB = track(b, 'B');
  const idC = track(c, 'C');
  assert.ok(idA.startsWith('ld_ref_'));
  assert.ok(idB.startsWith('ld_ref_'));
  assert.equal(idC, '', 'third registration past the cap must be refused');
  assert.equal(leakDoctor.getMetrics().totalActiveTrackers, 2);
  leakDoctor.stop();
});

test('heapGrowthTrendRatio is computed from heap samples (BUG-002)', async () => {
  leakDoctor.clear();
  let used = 1000;
  Object.defineProperty(performance, 'memory', {
    configurable: true,
    get: () => ({ usedJSHeapSize: used, totalJSHeapSize: used * 2, jsHeapSizeLimit: 100_000 }),
  });
  leakDoctor.getMemorySnapshot(); // first sample -> 1000
  used = 2500;
  leakDoctor.getMemorySnapshot(); // latest sample -> 2500
  const metrics = leakDoctor.getMetrics();
  assert.equal(metrics.heapGrowthTrendRatio, 2.5);
});

test('clear() empties reports and trackers', () => {
  leakDoctor.clear();
  assert.equal(leakDoctor.getReports().length, 0);
  assert.equal(leakDoctor.getMetrics().totalActiveTrackers, 0);
});
