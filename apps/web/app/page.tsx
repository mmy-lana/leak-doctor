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
        body: JSON.stringify({ url, interactions: interactions.filter((i) => i.value.trim().length > 0) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Diagnostic scan failed.');
      }

      setScanResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.5rem' }}>⚡ LeakDoctor Web Scanner</h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Headless Chromium DOM & JS Heap Memory Leak Audit</p>
        </header>

        <form onSubmit={handleScan} style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', fontSize: '1rem' }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '1rem 2rem', borderRadius: '8px', border: 'none', backgroundColor: loading ? '#475569' : '#0284c7', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Auditing Heap...' : 'Run Audit'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              ⚙️ {showAdvanced ? 'Hide Advanced Interaction Rules' : 'Add Custom Interaction Rules (Button Text / CSS / XPath)'}
            </button>
          </div>

          {showAdvanced && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>AUTOMATED BUTTON CLICK RULES</span>
                <button
                  type="button"
                  onClick={addRule}
                  style={{ padding: '0.25rem 0.75rem', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  + Add Step
                </button>
              </div>

              {interactions.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>No custom rules added. Smart auto-clicker will execute by default.</p>
              ) : (
                interactions.map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <select
                      value={rule.type}
                      onChange={(e) => updateRule(idx, 'type', e.target.value as InteractionRule['type'])}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', fontSize: '0.85rem' }}
                    >
                      <option value="text">Button Text (e.g. Fast traffic)</option>
                      <option value="selector">CSS Selector (e.g. button.high-traffic)</option>
                      <option value="xpath">XPath (e.g. /html/body/div[1]/button[1])</option>
                    </select>

                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => updateRule(idx, 'value', e.target.value)}
                      placeholder={rule.type === 'text' ? 'Fast traffic' : rule.type === 'selector' ? 'button.high-traffic' : '/html/body/div[1]/button[1]'}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', fontSize: '0.85rem' }}
                    />

                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      style={{ padding: '0.5rem 0.75rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </form>

        {error && (
          <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: '#7f1d1d', color: '#fecaca', marginBottom: '2rem' }}>
            🚨 {error}
          </div>
        )}

        {scanResult && (
          <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '2rem' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
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
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                  }}
                >
                  {scanResult.url} ↗
                </a>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Scanned at {new Date(scanResult.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              {/* Audit Result 1: Passive Baseline */}
              <div style={{ backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '8px', border: '1px solid #334155', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
                    1. PASSIVE BASELINE
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: scanResult.passiveHealthScore > 80 ? '#4ade80' : '#facc15' }}>
                      {scanResult.passiveHealthScore}/100
                    </span>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>PASSIVE SCORE</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>INITIAL HEAP BASELINE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                  {scanResult.formattedPassiveLeakedBytes}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4ade80' }}>✓ Memory footprint prior to user actions</div>
              </div>

              {/* Audit Result 2: Interactive Test */}
              <div style={{ backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '8px', border: '1px solid #0284c7', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
                    2. INTERACTIVE LEAK AUDIT
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: scanResult.interactiveHealthScore > 80 ? '#4ade80' : scanResult.interactiveHealthScore > 50 ? '#facc15' : '#f87171' }}>
                      {scanResult.interactiveHealthScore}/100
                    </span>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>LEAK SCORE</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>RETAINED LEAK SIZE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: scanResult.interactiveLeakedBytes > 0 ? '#fb923c' : '#4ade80', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                  {scanResult.formattedInteractiveLeakedBytes}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', wordBreak: 'break-word', backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                  ⚡ {scanResult.actionTestedDescription}
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '0.75rem' }}>DIAGNOSTIC RECOMMENDATIONS</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {scanResult.recommendations.map((rec, i) => (
                  <li key={i} style={{ padding: '0.75rem', backgroundColor: '#1e293b', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
                    💡 {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}