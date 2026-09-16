import { leakDoctor, track, trackElement } from '@leak-doctor/profiler';
import { formatBytes, formatDurationMs, LeakReport, MemorySnapshot } from '@leak-doctor/shared';

export { leakDoctor, track, trackElement };

export class LeakDoctorToolbar extends HTMLElement {
  private root: ShadowRoot;
  private isMinimized: boolean = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.attachEventListeners();
    leakDoctor.start({ autoStart: true });
  }

  private attachEventListeners(): void {
    leakDoctor.on<MemorySnapshot>('snapshot', (snapshot: MemorySnapshot) => this.updateSnapshot(snapshot));
    leakDoctor.on('leak', () => this.updateReports());
    leakDoctor.on('clear', () => this.updateReports());
  }

  private toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    const content = this.root.querySelector('.ld-body') as HTMLElement;
    const toggleBtn = this.root.querySelector('.ld-toggle-btn') as HTMLElement;
    if (content && toggleBtn) {
      content.style.display = this.isMinimized ? 'none' : 'block';
      toggleBtn.innerText = this.isMinimized ? '+' : '−';
    }
  }

  private updateSnapshot(snapshot: MemorySnapshot): void {
    const heapVal = this.root.querySelector('#ld-heap-val');
    const heapBar = this.root.querySelector('#ld-heap-bar') as HTMLElement;
    const trackerVal = this.root.querySelector('#ld-tracker-val');

    if (heapVal) {
      heapVal.textContent = snapshot.usedHeapBytes > 0 
        ? formatBytes(snapshot.usedHeapBytes) 
        : 'N/A (Chromium)';
      if (snapshot.usedHeapBytes === 0) {
        heapVal.setAttribute('title', 'window.performance.memory is only supported in Chromium browsers');
      }
    }
    if (trackerVal) trackerVal.textContent = snapshot.activeTrackersCount.toString();

    if (heapBar && snapshot.heapLimitBytes > 0) {
      const percentage = Math.min(100, Math.round((snapshot.usedHeapBytes / snapshot.heapLimitBytes) * 100));
      heapBar.style.width = `${percentage}%`;
    }
  }

  private updateReports(): void {
    const reports = leakDoctor.getReports();
    const countBadge = this.root.querySelector('#ld-leak-count');
    const listContainer = this.root.querySelector('#ld-reports-list');

    if (countBadge) countBadge.textContent = reports.length.toString();

    if (listContainer) {
      if (reports.length === 0) {
        listContainer.innerHTML = '<div class="ld-empty">No Leaks Detected</div>';
        return;
      }

      listContainer.innerHTML = reports
        .map(
          (report: LeakReport) => `
        <div class="ld-report-card ld-severity-${report.severity}">
          <div class="ld-card-header">
            <span class="ld-badge ld-badge-${report.severity}">${report.severity.toUpperCase()}</span>
            <span class="ld-time">${formatDurationMs(report.retainedDurationMs)} retained</span>
          </div>
          <div class="ld-card-title">${this.escapeHtml(report.targetDescription)}</div>
          <div class="ld-card-type">Type: ${report.type}</div>
        </div>
      `
        )
        .join('');
    }
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private triggerGC(): void {
    leakDoctor.performDiagnosticSweep();
    this.updateReports();
  }

  private clearReports(): void {
    leakDoctor.clear();
    this.updateReports();
  }

  private render(): void {
    this.root.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
          font-size: 12px;
          color: #e2e8f0;
        }
        .ld-container {
          width: 320px;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(8px);
          border: 1px solid #334155;
          border-radius: 10px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }
        .ld-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #1e293b;
          border-bottom: 1px solid #334155;
          font-weight: 600;
        }
        .ld-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #38bdf8;
        }
        .ld-brand svg {
          width: 16px;
          height: 16px;
        }
        .ld-toggle-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 16px;
          cursor: pointer;
          padding: 0 4px;
        }
        .ld-body {
          padding: 12px;
        }
        .ld-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .ld-stat-box {
          background: #0f172a;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #1e293b;
        }
        .ld-stat-label {
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
        }
        .ld-stat-value {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
          margin-top: 2px;
        }
        .ld-progress-bg {
          height: 4px;
          background: #334155;
          border-radius: 2px;
          margin-top: 6px;
          overflow: hidden;
        }
        .ld-progress-fill {
          height: 100%;
          width: 0%;
          background: #38bdf8;
          transition: width 0.3s ease;
        }
        .ld-section-title {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
        }
        .ld-reports-list {
          max-height: 160px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ld-empty {
          text-align: center;
          color: #64748b;
          padding: 12px;
        }
        .ld-report-card {
          background: #1e293b;
          padding: 8px;
          border-radius: 6px;
          border-left: 3px solid #94a3b8;
        }
        .ld-severity-low { border-left-color: #38bdf8; }
        .ld-severity-medium { border-left-color: #facc15; }
        .ld-severity-high { border-left-color: #fb923c; }
        .ld-severity-critical { border-left-color: #f87171; }
        .ld-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .ld-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 3px;
        }
        .ld-badge-low { background: #0369a1; color: #e0f2fe; }
        .ld-badge-medium { background: #854d0e; color: #fef08a; }
        .ld-badge-high { background: #9a3412; color: #ffedd5; }
        .ld-badge-critical { background: #991b1b; color: #fee2e2; }
        .ld-card-title {
          font-weight: 600;
          color: #f1f5f9;
          word-break: break-all;
        }
        .ld-card-type {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        .ld-actions {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }
        .ld-btn {
          flex: 1;
          background: #334155;
          border: none;
          color: #f8fafc;
          padding: 6px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 11px;
        }
        .ld-btn:hover {
          background: #475569;
        }
      </style>
      <div class="ld-container">
        <div class="ld-header">
          <div class="ld-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              <path d="M8 14h2l2-4 2 6 2-2h2" stroke="#10b981" stroke-width="1.8" />
            </svg>
            LeakDoctor
          </div>
          <button class="ld-toggle-btn" id="ld-toggle">−</button>
        </div>
        <div class="ld-body">
          <div class="ld-stats-grid">
            <div class="ld-stat-box">
              <div class="ld-stat-label">Used Heap</div>
              <div class="ld-stat-value" id="ld-heap-val">0 Bytes</div>
              <div class="ld-progress-bg"><div class="ld-progress-fill" id="ld-heap-bar"></div></div>
            </div>
            <div class="ld-stat-box">
              <div class="ld-stat-label">Active Trackers</div>
              <div class="ld-stat-value" id="ld-tracker-val">0</div>
            </div>
          </div>
          <div class="ld-section-title">
            <span>DETECTED LEAKS</span>
            <span id="ld-leak-count">0</span>
          </div>
          <div class="ld-reports-list" id="ld-reports-list">
            <div class="ld-empty">No Leaks Detected</div>
          </div>
          <div class="ld-actions">
            <button class="ld-btn" id="ld-sweep-btn">Sweep</button>
            <button class="ld-btn" id="ld-clear-btn">Clear</button>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('#ld-toggle')?.addEventListener('click', () => this.toggleMinimize());
    this.root.querySelector('#ld-sweep-btn')?.addEventListener('click', () => this.triggerGC());
    this.root.querySelector('#ld-clear-btn')?.addEventListener('click', () => this.clearReports());
  }

  public static mount(): void {
    if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
      if (!customElements.get('leak-doctor-toolbar')) {
        customElements.define('leak-doctor-toolbar', LeakDoctorDoctorToolbarHost);
      }
      if (!document.querySelector('leak-doctor-toolbar')) {
        const el = document.createElement('leak-doctor-toolbar');
        document.body.appendChild(el);
      }
    }
  }
}

class LeakDoctorDoctorToolbarHost extends LeakDoctorToolbar {}

if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
  if (!customElements.get('leak-doctor-toolbar')) {
    customElements.define('leak-doctor-toolbar', LeakDoctorToolbar);
  }
}