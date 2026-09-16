/**
 * Leak severity tier indicating retention persistence and heap impact.
 */
export type LeakSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Diagnostic categorization of detected frontend memory leaks.
 */
export type LeakType = 'detached-dom' | 'uncollected-object' | 'event-listener' | 'closure-rejection';

/**
 * Standard performance memory API extension.
 */
export interface PerformanceMemory {
  readonly jsHeapSizeLimit: number;
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
}

/**
 * Temporal snapshot of browser runtime memory state.
 */
export interface MemorySnapshot {
  timestamp: number;
  usedHeapBytes: number;
  totalHeapBytes: number;
  heapLimitBytes: number;
  activeTrackersCount: number;
}

/**
 * Metadata recorded during initial target registration.
 */
export interface LeakTargetMeta {
  description: string;
  retainedAt: number;
  category?: string;
  context?: Record<string, unknown>;
}

/**
 * Structured diagnostic diagnostic generated when GC fails to collect a weak reference.
 */
export interface LeakReport {
  id: string;
  type: LeakType;
  severity: LeakSeverity;
  targetDescription: string;
  detectedAt: number;
  retainedDurationMs: number;
  estimatedBytes?: number;
  stack?: string;
  meta?: Record<string, unknown>;
}

/**
 * Aggregated metric summary for diagnostic consumers.
 */
export interface DiagnosticMetrics {
  totalLeakedCount: number;
  totalActiveTrackers: number;
  heapGrowthTrendRatio: number;
  lastDiagnosticTime: number;
}

/**
 * Profiler engine configuration options.
 */
export interface ProfilerConfig {
  sampleIntervalMs?: number;
  leakThresholdMs?: number;
  maxRetainedObjects?: number;
  autoStart?: boolean;
  debug?: boolean;
}

/**
 * Utility: Converts raw byte quantities into human-readable formatted string units.
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Utility: Formats elapsed time values in milliseconds to readable time strings.
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * Utility: Evaluates leak parameters to derive appropriate severity level.
 */
export function computeSeverity(retainedDurationMs: number, bytes?: number): LeakSeverity {
  if (retainedDurationMs > 30000 || (bytes && bytes > 10 * 1024 * 1024)) {
    return 'critical';
  }
  if (retainedDurationMs > 15000 || (bytes && bytes > 2 * 1024 * 1024)) {
    return 'high';
  }
  if (retainedDurationMs > 5000) {
    return 'medium';
  }
  return 'low';
}

/**
 * Utility: Formatted color logger for internal runtime diagnostics.
 */
export class SharedLogger {
  private static PREFIX = '[leak-doctor]';

  static info(message: string, ...args: unknown[]): void {
    console.log(`\x1b[36m${this.PREFIX}\x1b[0m ${message}`, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(`\x1b[33m${this.PREFIX} [WARN]\x1b[0m ${message}`, ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(`\x1b[31m${this.PREFIX} [ERROR]\x1b[0m ${message}`, ...args);
  }
}