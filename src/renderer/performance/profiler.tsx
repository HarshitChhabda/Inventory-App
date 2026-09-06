import React, { Profiler, ProfilerOnRenderCallback } from 'react';

interface RenderMetric {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  timestamp: number;
}

const metrics: RenderMetric[] = [];
const MAX_METRICS = 500;
let enabled = false;

export function setProfilingEnabled(value: boolean): void {
  enabled = value;
  if (value) metrics.length = 0;
}

export function isProfilingEnabled(): boolean {
  return enabled;
}

export function getMetrics(): ReadonlyArray<RenderMetric> {
  return metrics;
}

export function getSlowRenders(thresholdMs: number = 16): RenderMetric[] {
  return metrics.filter(m => m.actualDuration > thresholdMs);
}

export function getSummary(): {
  totalRenders: number;
  slowRenders: number;
  avgDuration: number;
  maxDuration: number;
  mountCount: number;
  updateCount: number;
} {
  if (metrics.length === 0) {
    return { totalRenders: 0, slowRenders: 0, avgDuration: 0, maxDuration: 0, mountCount: 0, updateCount: 0 };
  }
  const durations = metrics.map(m => m.actualDuration);
  return {
    totalRenders: metrics.length,
    slowRenders: durations.filter(d => d > 16).length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    mountCount: metrics.filter(m => m.phase === 'mount').length,
    updateCount: metrics.filter(m => m.phase !== 'mount').length,
  };
}

export function clearMetrics(): void {
  metrics.length = 0;
}

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  if (!enabled) return;
  if (metrics.length >= MAX_METRICS) {
    metrics.shift();
  }
  metrics.push({
    id,
    phase: phase as RenderMetric['phase'],
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    timestamp: Date.now(),
  });
  if (actualDuration > 50) {
    console.debug(`[Profiler] ${id}: ${phase} ${actualDuration.toFixed(1)}ms`);
  }
};

export function ProfiledComponent({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

export default ProfiledComponent;
