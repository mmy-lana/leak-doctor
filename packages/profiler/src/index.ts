import {
  LeakReport,
  LeakSeverity,
  LeakType,
  MemorySnapshot,
  DiagnosticMetrics,
  ProfilerConfig,
  PerformanceMemory,
  computeSeverity,
  SharedLogger,
} from '@leak-doctor/shared';

interface TrackedRecord {
  id: string;
  ref: WeakRef<object>;
  description: string;
  retainedAt: number;
  type: LeakType;
  isDomElement: boolean;
  expectFreed: boolean;
  meta?: Record<string, unknown>;
  stack?: string;
}

type EventCallback<T = unknown> = (data: T) => void;

export class LeakDoctorEngine {
  private static instance: LeakDoctorEngine | null = null;
  private trackedItems: Map<string, TrackedRecord> = new Map();
  private reports: Map<string, LeakReport> = new Map();
  private finalizationRegistry: FinalizationRegistry<string> | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private firstUsedHeapBytes = 0;
  private lastUsedHeapBytes = 0;

  private config: Required<ProfilerConfig> = {
    sampleIntervalMs: 3000,
    leakThresholdMs: 8000,
    maxRetainedObjects: 500,
    autoStart: true,
    debug: false,
  };

  private constructor() {
    if (typeof window === 'undefined') {
      return; // SSR Safety Guard
    }

    this.initFinalizationRegistry();
  }

  public static getInstance(): LeakDoctorEngine {
    if (!LeakDoctorEngine.instance) {
      LeakDoctorEngine.instance = new LeakDoctorEngine();
    }
    return LeakDoctorEngine.instance;
  }

  private initFinalizationRegistry(): void {
    if (typeof FinalizationRegistry !== 'undefined') {
      this.finalizationRegistry = new FinalizationRegistry<string>((id: string) => {
        this.handleGarbageCollected(id);
      });
    } else {
      SharedLogger.warn('FinalizationRegistry is not supported in this runtime environment.');
    }
  }

  public start(customConfig?: Partial<ProfilerConfig>): void {
    if (typeof window === 'undefined') return;

    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    if (!this.sampleTimer) {
      this.sampleTimer = setInterval(() => {
        this.performDiagnosticSweep();
      }, this.config.sampleIntervalMs);
      SharedLogger.info('Memory Leak Diagnostic Engine Started.');
    }
  }

  public stop(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
      SharedLogger.info('Memory Leak Diagnostic Engine Stopped.');
    }
  }

  /**
   * Registers a target for retention monitoring.
   *
   * Semantics (BUG-001): non-DOM targets are "retention watched" by default and
   * produce NO leak report while they stay alive — the engine cannot distinguish a
   * legitimately long-lived object from a leak. Pass `meta: { expectFreed: true }`
   * to assert the target should be garbage-collected once the application drops
   * its references; a target still retained past `leakThresholdMs` is then reported
   * as a leak. Detached DOM elements are always reported once retained past the
   * threshold (a detached-but-uncollected node is a genuine leak signal).
   */
  public track<T extends object>(target: T, description: string = 'Anonymous Object', meta?: Record<string, unknown>): string {
    if (typeof window === 'undefined' || !target) return '';

    const id = `ld_ref_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const isDomElement = typeof Element !== 'undefined' && target instanceof Element;
    const type: LeakType = isDomElement ? 'detached-dom' : 'uncollected-object';

    const record: TrackedRecord = {
      id,
      ref: new WeakRef(target),
      description,
      retainedAt: Date.now(),
      type,
      isDomElement,
      expectFreed: meta?.expectFreed === true,
      meta,
      stack: new Error().stack,
    };

    // BUG-003: enforce maxRetainedObjects. Overflow behavior: registrations past the
    // cap are refused (empty id) with a warning, keeping the registry bounded.
    if (this.trackedItems.size >= this.config.maxRetainedObjects) {
      SharedLogger.warn(`Tracker limit reached (${this.config.maxRetainedObjects}); ignoring "${description}".`);
      return '';
    }

    this.trackedItems.set(id, record);

    if (this.finalizationRegistry) {
      try {
        this.finalizationRegistry.register(target, id);
      } catch {
        // Suppress target registration errors
      }
    }

    return id;
  }

  public trackElement(element: Element, description?: string, meta?: Record<string, unknown>): string {
    const desc = description || `DOM Element <${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}>`;
    return this.track(element, desc, meta);
  }

  private handleGarbageCollected(id: string): void {
    this.trackedItems.delete(id);
    this.reports.delete(id);
    this.emit('gc', { id });
  }

  public performDiagnosticSweep(): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const currentSnapshot = this.getMemorySnapshot();

    for (const [id, record] of this.trackedItems.entries()) {
      const derefValue = record.ref.deref();

      if (!derefValue) {
        this.trackedItems.delete(id);
        this.reports.delete(id);
        continue;
      }

      const retentionTimeMs = now - record.retainedAt;
      let isLeaked = false;

      if (record.isDomElement && derefValue instanceof Element) {
        const isDisconnected = !derefValue.isConnected;
        if (isDisconnected && retentionTimeMs >= this.config.leakThresholdMs) {
          isLeaked = true;
        }
      } else if (record.expectFreed && retentionTimeMs >= this.config.leakThresholdMs) {
        // BUG-001: only targets the consumer asserted should have been freed
        // (meta.expectFreed) are flagged. Strongly-referenced objects tracked for
        // retention watching are never reported as leaks.
        isLeaked = true;
      }

      if (isLeaked) {
        const severity: LeakSeverity = computeSeverity(retentionTimeMs);
        const report: LeakReport = {
          id,
          type: record.type,
          severity,
          targetDescription: record.description,
          detectedAt: now,
          retainedDurationMs: retentionTimeMs,
          stack: record.stack,
          meta: record.meta,
        };

        const isNewReport = !this.reports.has(id);
        this.reports.set(id, report);

        if (isNewReport) {
          this.emit('leak', report);
          if (this.config.debug) {
            SharedLogger.warn(`Potential ${report.type} detected [${severity.toUpperCase()}]: ${report.targetDescription}`);
          }
        }
      }
    }

    this.emit('snapshot', currentSnapshot);
  }

  public getMemorySnapshot(): MemorySnapshot {
    let usedBytes = 0;
    let totalBytes = 0;
    let limitBytes = 0;

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as unknown as { memory: PerformanceMemory }).memory;
      usedBytes = mem.usedJSHeapSize;
      totalBytes = mem.totalJSHeapSize;
      limitBytes = mem.jsHeapSizeLimit;
    }

    // BUG-002: keep heap history for getMetrics().heapGrowthTrendRatio.
    if (usedBytes > 0) {
      if (this.firstUsedHeapBytes === 0) this.firstUsedHeapBytes = usedBytes;
      this.lastUsedHeapBytes = usedBytes;
    }

    return {
      timestamp: Date.now(),
      usedHeapBytes: usedBytes,
      totalHeapBytes: totalBytes,
      heapLimitBytes: limitBytes,
      activeTrackersCount: this.trackedItems.size,
    };
  }

  public getReports(): LeakReport[] {
    return Array.from(this.reports.values()).sort((a, b) => b.retainedDurationMs - a.retainedDurationMs);
  }

  public getMetrics(): DiagnosticMetrics {
    return {
      totalLeakedCount: this.reports.size,
      totalActiveTrackers: this.trackedItems.size,
      // BUG-002: ratio of the latest observed used-heap to the first observed
      // used-heap (1.0 = stable since first sample, >1 = growth). 0 before any sample.
      heapGrowthTrendRatio: this.firstUsedHeapBytes > 0 ? this.lastUsedHeapBytes / this.firstUsedHeapBytes : 0,
      lastDiagnosticTime: Date.now(),
    };
  }

  public clear(): void {
    this.trackedItems.clear();
    this.reports.clear();
    this.emit('clear', null);
  }

  public on<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  public off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const eventSet = this.listeners.get(event);
    if (eventSet) {
      eventSet.delete(callback as EventCallback);
    }
  }

  private emit<T = unknown>(event: string, data: T): void {
    const eventSet = this.listeners.get(event);
    if (eventSet) {
      eventSet.forEach((cb) => cb(data));
    }
  }
}

export const leakDoctor = LeakDoctorEngine.getInstance();
export const track = (target: object, desc?: string, meta?: Record<string, unknown>) => leakDoctor.track(target, desc, meta);
export const trackElement = (element: Element, desc?: string, meta?: Record<string, unknown>) => leakDoctor.trackElement(element, desc, meta);