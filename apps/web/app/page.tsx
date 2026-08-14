'use client';

import React, { useState } from 'react';
import { ScanResult } from './api/scan/route';

export default function DiagnosticDashboard() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ url }),
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

        <form onSubmit={handleScan} style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
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
        </form>

        {error && (
          <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: '#7f1d1d', color: '#fecaca', marginBottom: '2rem' }}>
            🚨 {error}
          </div>
        )}

        {scanResult && (
          <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>{scanResult.url}</h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Scanned at {new Date(scanResult.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: scanResult.healthScore > 80 ? '#4ade80' : scanResult.healthScore > 50 ? '#facc15' : '#f87171' }}>
                  {scanResult.healthScore}/100
                </span>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>HEALTH SCORE</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>RETAINED LEAK SIZE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>{scanResult.formattedLeakedBytes}</div>
              </div>

              <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>INITIAL HEAP</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>{(scanResult.initialHeapBytes / (1024 * 1024)).toFixed(2)} MB</div>
              </div>

              <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>POST-GC HEAP</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>{(scanResult.postGcHeapBytes / (1024 * 1024)).toFixed(2)} MB</div>
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