import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { track, trackElement, leakDoctor } from '@leak-doctor/profiler';
import '@leak-doctor/toolbar';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'leak-doctor-toolbar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'leak-doctor-toolbar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

interface LeakedRef {
  id: string;
  type: string;
  data: unknown;
}

const App: React.FC = () => {
  const [leakedRefs, setLeakedRefs] = useState<LeakedRef[]>([]);
  const [detachedElements, setDetachedElements] = useState<HTMLElement[]>([]);

  const simulateDetachedDomLeak = () => {
    const container = document.createElement('div');
    container.className = 'detached-leak-node';
    container.innerHTML = `<h3>Detached Tree Node</h3><p>Allocated at ${new Date().toLocaleTimeString()}</p>`;

    const trackId = trackElement(container, 'Detached DOM Tree');

    setDetachedElements((prev) => [...prev, container]);
    setLeakedRefs((prev) => [...prev, { id: trackId, type: 'Detached DOM Node', data: container }]);
  };

  const simulateClosureBufferLeak = () => {
    const largeBuffer = new Array(1000000).fill('⚡ LEAK DOCTOR MEMORY TEST BUFFER ⚡');
    const closureObj = {
      buffer: largeBuffer,
      created: Date.now(),
    };

    const trackId = track(closureObj, '10MB Array Closure Leak', { category: 'Simulated Object' });

    setLeakedRefs((prev) => [...prev, { id: trackId, type: 'Large Object Buffer', data: closureObj }]);
  };

  const simulateEventListenerLeak = () => {
    const dummyData = new Array(500000).fill('Listener Retained Payload');
    const leakHandler = () => {
      console.log('Window Resize Event Triggered', dummyData.length);
    };

    window.addEventListener('resize', leakHandler);
    const trackId = track(leakHandler, 'Unremoved Window Resize Listener');

    setLeakedRefs((prev) => [...prev, { id: trackId, type: 'Event Listener Closure', data: leakHandler }]);
  };

  const releaseAllLeaks = () => {
    setDetachedElements([]);
    setLeakedRefs([]);
    leakDoctor.clear();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto', color: '#f8fafc', backgroundColor: '#0f172a', borderRadius: '12px', minHeight: '80vh' }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ color: '#38bdf8', margin: '0 0 0.5rem 0' }}>⚡ LeakDoctor Playground</h1>
        <p style={{ color: '#94a3b8', margin: 0 }}>Interactive frontend memory leak testbed environment.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={simulateDetachedDomLeak}
          style={{ padding: '0.75rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          ➕ Leak Detached DOM Node
        </button>

        <button
          onClick={simulateClosureBufferLeak}
          style={{ padding: '0.75rem 1rem', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          ⚡ Leak 10MB Object Buffer
        </button>

        <button
          onClick={simulateEventListenerLeak}
          style={{ padding: '0.75rem 1rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          🎧 Leak Window Listener
        </button>
      </div>

      <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Simulated Retained References ({leakedRefs.length})</h2>
          <button
            onClick={releaseAllLeaks}
            style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Release References
          </button>
        </div>

        {leakedRefs.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No active leaked references in JS state.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {leakedRefs.map((item, idx) => (
              <li key={idx} style={{ padding: '0.5rem 0.75rem', background: '#0f172a', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{item.type}</span>
                <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{item.id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <leak-doctor-toolbar />
    </div>
  );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);