interface HeapSnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  label: string;
}

const snapshots: HeapSnapshot[] = [];
let baseline: HeapSnapshot | null = null;

export function captureHeapSnapshot(label: string): HeapSnapshot | null {
  if (typeof window === 'undefined' || !window.performance) return null;
  const perf = (window.performance as any);
  const memory = perf.memory;
  if (!memory) return null;

  const snap: HeapSnapshot = {
    timestamp: Date.now(),
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    label,
  };

  if (!baseline) baseline = snap;
  snapshots.push(snap);
  return snap;
}

export function getBaseline(): HeapSnapshot | null {
  return baseline;
}

export function getSnapshots(): ReadonlyArray<HeapSnapshot> {
  return snapshots;
}

export function getMemoryDelta(): {
  baselineToNow: number;
  baselineToNowMB: number;
  peak: number;
  peakMB: number;
  current: number;
  currentMB: number;
} | null {
  if (snapshots.length < 2 || !baseline) return null;
  const now = snapshots[snapshots.length - 1];
  const peak = snapshots.reduce((max, s) => Math.max(max, s.usedJSHeapSize), 0);
  return {
    baselineToNow: now.usedJSHeapSize - baseline.usedJSHeapSize,
    baselineToNowMB: (now.usedJSHeapSize - baseline.usedJSHeapSize) / 1024 / 1024,
    peak,
    peakMB: peak / 1024 / 1024,
    current: now.usedJSHeapSize,
    currentMB: now.usedJSHeapSize / 1024 / 1024,
  };
}

export function clearSnapshots(): void {
  snapshots.length = 0;
  baseline = null;
}

export function isMemoryProfilingAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const perf = (window.performance as any);
  return !!(perf && perf.memory);
}

export function requestGarbageCollection(): void {
  if (typeof window !== 'undefined') {
    (window as any).gc?.();
  }
}

export function getMemoryReport(): string {
  const delta = getMemoryDelta();
  if (!delta) return 'Memory profiling not available (Electron --expose-gc not enabled)';
  return [
    `Memory Report`,
    `  Baseline: ${(baseline!.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`,
    `  Current:  ${delta.currentMB.toFixed(1)} MB`,
    `  Peak:     ${delta.peakMB.toFixed(1)} MB`,
    `  Delta:    ${delta.baselineToNowMB.toFixed(1)} MB`,
    `  Snapshots: ${snapshots.length}`,
  ].join('\n');
}
