'use client';

import React, { useState } from 'react';
import { ScanResult, InteractionRule } from './api/scan/route';

export default function DiagnosticDashboard() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [interactions, setInteractions] = useState<InteractionRule[]>([]);

  React.useEffect(() => {
    // Purge any previously cached URL so the input starts blank
    localStorage.removeItem('ld_scan_url');
  }, []);

  const addRule = () => {
    setInteractions((prev) => [...prev, { type: 'text', value: '' }]);
  };

  const removeRule = (index: number) => {
    setInteractions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof InteractionRule, val: string) => {
    setInteractions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          interactions: interactions.filter((i) => i.value.trim().length > 0),
          autoClick: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const ref = data.requestId ? ` (ref: ${data.requestId})` : '';
        throw new Error(`${data.error || 'Diagnostic scan failed.'}${ref}`);
      }

      setScanResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#090a0f', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid #1e2029', paddingBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.4rem, 5vw, 2.1rem)', fontWeight: 700, color: '#f4f4f5', margin: 0, display: 'flex', alignItems: 'center', gap: '12px', letterSpacing: '-0.02em', minWidth: 0 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                  <path d="M8 14h2l2-4 2 6 2-2h2" stroke="#34d399" strokeWidth={1.8} />
                </svg>
                LeakDoctor Scanner
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: '0.35rem 0 0 0' }}>Headless Chromium DOM & JS heap memory diagnostics</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a
                href="https://github.com/mmy-lana/leak-doctor"
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '0.45rem 0.85rem', backgroundColor: '#13151f', border: '1px solid #232634', borderRadius: '6px', color: '#d4d4d8', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 500 }}
              >
                GitHub
              </a>
              <a
                href="https://leak-doctor-playground.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '0.45rem 0.85rem', backgroundColor: '#13151f', border: '1px solid #232634', borderRadius: '6px', color: '#93c5fd', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 500 }}
              >
                Playground
              </a>
            </div>
          </div>
        </header>

        <form onSubmit={handleScan} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              placeholder="https://example.com"
              aria-label="URL to audit"
              required
              style={{ flex: 1, minWidth: '240px', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #272a38', backgroundColor: '#11131c', color: '#f4f4f5', fontSize: '0.95rem', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: '1px solid #3b82f6', backgroundColor: loading ? '#1f2430' : '#2563eb', color: '#ffffff', fontSize: '0.9rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ background: 'transparent', border: 'none', color: '#93c5fd', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500, padding: '4px 0' }}
            >
              {showAdvanced ? 'Hide Custom Interaction Steps' : 'Add Custom Interaction Steps (Optional)'}
            </button>
          </div>

          {showAdvanced && (
            <div style={{ marginTop: '0.75rem', padding: '1rem', backgroundColor: '#11131c', borderRadius: '6px', border: '1px solid #1e2029' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em' }}>CUSTOM INTERACTION STEPS</span>
                <button
                  type="button"
                  onClick={addRule}
                  style={{ padding: '0.25rem 0.6rem', backgroundColor: '#1e2230', color: '#f4f4f5', border: '1px solid #2e3344', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  + Add Step
                </button>
              </div>

              {interactions.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>No custom rules configured. By default, the scanner discovers and tests 3-5 visible buttons and interactive elements automatically.</p>
              ) : (
                interactions.map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <select
                      value={rule.type}
                      onChange={(e) => updateRule(idx, 'type', e.target.value as InteractionRule['type'])}
                      aria-label="Interaction rule type"
                      style={{ padding: '0.45rem', borderRadius: '4px', border: '1px solid #272a38', backgroundColor: '#161824', color: '#f4f4f5', fontSize: '0.8rem' }}
                    >
                      <option value="text">Button Text</option>
                      <option value="selector">CSS Selector</option>
                      <option value="xpath">XPath</option>
                    </select>

                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => updateRule(idx, 'value', e.target.value)}
                      placeholder={rule.type === 'text' ? 'e.g. Load More' : rule.type === 'selector' ? 'button.primary' : '//button[1]'}
                      aria-label="Interaction rule value"
                      style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid #272a38', backgroundColor: '#161824', color: '#f4f4f5', fontSize: '0.8rem' }}
                    />

                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      style={{ padding: '0.45rem 0.75rem', backgroundColor: '#2d181b', border: '1px solid #4a1d24', color: '#fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </form>

        <style>{`
          @keyframes ld-pulse-progress {
            0% { left: -30%; width: 30%; }
            50% { left: 40%; width: 50%; }
            100% { left: 100%; width: 30%; }
          }
          @keyframes ld-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}</style>

        {loading && (
          <div role="status" aria-live="polite" style={{ backgroundColor: '#11131c', borderRadius: '8px', border: '1px solid #1e2029', padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60a5fa"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'ld-spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <div style={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.95rem' }}>
                Executing Headless Memory Audit
              </div>
            </div>

            <div style={{ height: '3px', width: '100%', backgroundColor: '#1b1e2a', borderRadius: '2px', overflow: 'hidden', position: 'relative', marginBottom: '1rem' }}>
              <div
                style={{
                  position: 'absolute',
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  borderRadius: '2px',
                  animation: 'ld-pulse-progress 1.6s ease-in-out infinite',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
              <div>1. Headless CDP session init</div>
              <div>2. Baseline post-GC heap snapshot</div>
              <div>3. Triggering interactive elements</div>
              <div>4. Post-interaction retention diff</div>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={{ padding: '0.85rem 1rem', borderRadius: '6px', backgroundColor: '#2d181b', border: '1px solid #4a1d24', color: '#fca5a5', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            [ERROR] {error}
          </div>
        )}

        {scanResult && (
          <div role="status" aria-live="polite" style={{ backgroundColor: '#11131c', borderRadius: '8px', border: '1px solid #1e2029', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #1e2029', paddingBottom: '0.85rem' }}>
              <div style={{ overflow: 'hidden', paddingRight: '1rem' }}>
                <a
                  href={scanResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={scanResult.url}
                  style={{
                    display: 'inline-block',
                    maxWidth: '650px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#93c5fd',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                  }}
                >
                  {scanResult.url} ↗
                </a>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                  Audited at {new Date(scanResult.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Audit Result 1: Passive Baseline */}
              <div style={{ backgroundColor: '#161824', padding: '1.1rem', borderRadius: '6px', border: '1px solid #232634' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.03em' }}>
                    1. PASSIVE BASELINE
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: scanResult.passiveHealthScore > 80 ? '#4ade80' : '#facc15' }}>
                      {scanResult.passiveHealthScore}/100
                    </span>
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>SCORE</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>INITIAL HEAP</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f4f4f5', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
                  {scanResult.formattedPassiveLeakedBytes}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#34d399' }}>Clean memory footprint prior to interactions</div>
              </div>

              {/* Audit Result 2: Interactive Test */}
              <div style={{ backgroundColor: '#161824', padding: '1.1rem', borderRadius: '6px', border: '1px solid #232634' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.03em' }}>
                    2. INTERACTIVE RETENTION
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: scanResult.interactiveHealthScore > 80 ? '#4ade80' : scanResult.interactiveHealthScore > 50 ? '#facc15' : '#f87171' }}>
                      {scanResult.interactiveHealthScore}/100
                    </span>
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>SCORE</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>RETAINED GROWTH</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: scanResult.interactiveLeakedBytes > 0 ? '#fb923c' : '#4ade80', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
                  {scanResult.formattedInteractiveLeakedBytes}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', wordBreak: 'break-word', backgroundColor: '#0e1017', padding: '0.5rem', borderRadius: '4px', border: '1px solid #1a1c28' }}>
                  {scanResult.actionTestedDescription}
                </div>
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 600, letterSpacing: '0.04em' }}>DIAGNOSTIC RECOMMENDATIONS</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {scanResult.recommendations.map((rec, i) => (
                  <li key={i} style={{ padding: '0.65rem 0.8rem', backgroundColor: '#161824', border: '1px solid #232634', borderRadius: '4px', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d4d4d8' }}>
                    - {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <footer style={{ marginTop: '3.5rem', paddingTop: '1.25rem', borderTop: '1px solid #1e2029', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div>
            Built by <a href="https://github.com/mmy-lana" target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', textDecoration: 'none', padding: '4px 0', display: 'inline-block' }}>@mmy-lana</a>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="https://www.npmjs.com/package/@leak-doctor/profiler" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'none', padding: '4px 0', display: 'inline-block' }}>@leak-doctor/profiler</a>
            <a href="https://www.npmjs.com/package/@leak-doctor/toolbar" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'none', padding: '4px 0', display: 'inline-block' }}>@leak-doctor/toolbar</a>
            <a href="https://www.npmjs.com/package/@leak-doctor/shared" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'none', padding: '4px 0', display: 'inline-block' }}>@leak-doctor/shared</a>
          </div>
        </footer>
      </div>
    </main>
  );
}