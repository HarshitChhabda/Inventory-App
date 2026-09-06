import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ============================================================
// TYPES
// ============================================================

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceEntry {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

// ============================================================
// PERFORMANCE MONITORING SERVICE
// ============================================================

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private entries: PerformanceEntry[] = [];
  private logs: LogEntry[] = [];
  private logsDir: string;
  private maxLogs: number = 10000;
  private maxMetrics: number = 5000;

  constructor() {
    this.logsDir = path.join(app.getPath('userData'), 'InventoryData', 'logs');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  // ------------------------------------------------------------
  // PERFORMANCE TIMING
  // ------------------------------------------------------------

  startTimer(operation: string): () => PerformanceEntry {
    const startTime = performance.now();
    const id = `${operation}_${Date.now()}`;

    return (success = true, metadata?: Record<string, any>): PerformanceEntry => {
      const endTime = performance.now();
      const entry: PerformanceEntry = {
        operation,
        startTime,
        endTime,
        duration: endTime - startTime,
        success,
        metadata,
      };

      this.entries.push(entry);

      // Keep only last 1000 entries in memory
      if (this.entries.length > 1000) {
        this.entries = this.entries.slice(-1000);
      }

      // Log slow operations (> 1 second)
      if (entry.duration > 1000) {
        this.log('warn', `Slow operation: ${operation} took ${entry.duration.toFixed(2)}ms`, 'performance');
      }

      return entry;
    };
  }

  // ------------------------------------------------------------
  // METRICS
  // ------------------------------------------------------------

  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>) {
    const metric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    this.metrics.push(metric);

    // Keep only last N metrics in memory
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(name?: string, since?: Date): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (since !== undefined) {
      filtered = filtered.filter(m => m.timestamp >= since);
    }

    return filtered;
  }

  getAverageMetric(name: string, since?: Date): number {
    const metrics = this.getMetrics(name, since);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  // ------------------------------------------------------------
  // LOGGING
  // ------------------------------------------------------------

  log(level: LogEntry['level'], message: string, source?: string, metadata?: Record<string, any>, stack?: string) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      source,
      metadata,
      stack,
    };

    this.logs.push(entry);

    // Keep only last N logs in memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Write to file
    this.writeLogToFile(entry);

    // Console output
    const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase()}]${source ? ` [${source}]` : ''}`;
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`, metadata || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, metadata || '');
        break;
      case 'debug':
        console.debug(`${prefix} ${message}`, metadata || '');
        break;
      default:
        console.log(`${prefix} ${message}`, metadata || '');
    }
  }

  info(message: string, source?: string, metadata?: Record<string, any>) {
    this.log('info', message, source, metadata);
  }

  warn(message: string, source?: string, metadata?: Record<string, any>) {
    this.log('warn', message, source, metadata);
  }

  error(message: string, source?: string, metadata?: Record<string, any>, stack?: string) {
    this.log('error', message, source, metadata, stack);
  }

  debug(message: string, source?: string, metadata?: Record<string, any>) {
    this.log('debug', message, source, metadata);
  }

  // ------------------------------------------------------------
  // LOG FILE WRITING
  // ------------------------------------------------------------

  private writeLogToFile(entry: LogEntry) {
    try {
      const date = entry.timestamp.toISOString().split('T')[0];
      const filename = `app-${date}.log`;
      const filepath = path.join(this.logsDir, filename);

      const line = [
        entry.timestamp.toISOString(),
        `[${entry.level.toUpperCase()}]`,
        entry.source ? `[${entry.source}]` : '',
        entry.message,
        entry.metadata ? JSON.stringify(entry.metadata) : '',
        entry.stack ? `\nStack: ${entry.stack}` : '',
      ].filter(Boolean).join(' ') + '\n';

      fs.appendFileSync(filepath, line, 'utf-8');
    } catch (err) {
      console.error('Failed to write log to file:', err);
    }
  }

  // ------------------------------------------------------------
  // LOG RETRIEVAL
  // ------------------------------------------------------------

  getLogs(options?: {
    level?: LogEntry['level'];
    source?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let filtered = this.logs;

    if (options?.level) {
      filtered = filtered.filter(l => l.level === options.level);
    }

    if (options?.source) {
      filtered = filtered.filter(l => l.source === options.source);
    }

    if (options?.since !== undefined) {
      filtered = filtered.filter(l => l.timestamp >= options.since!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  // ------------------------------------------------------------
  // CRASH REPORTING
  // ------------------------------------------------------------

  reportCrash(error: Error, context?: Record<string, any>) {
    this.error('Application Crash', 'crash-reporter', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
    });

    // Write crash report to separate file
    try {
      const crashReport = {
        timestamp: new Date().toISOString(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
        system: {
          platform: process.platform,
          arch: process.arch,
          electronVersion: process.versions.electron,
          nodeVersion: process.versions.node,
        },
      };

      const filename = `crash-${Date.now()}.json`;
      const filepath = path.join(this.logsDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(crashReport, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write crash report:', err);
    }
  }

  // ------------------------------------------------------------
  // STATISTICS
  // ------------------------------------------------------------

  getStats() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentLogs = this.getLogs({ since: lastHour });
    const dailyLogs = this.getLogs({ since: lastDay });

    return {
      totalLogs: this.logs.length,
      totalMetrics: this.metrics.length,
      totalEntries: this.entries.length,
      lastHour: {
        total: recentLogs.length,
        errors: recentLogs.filter(l => l.level === 'error').length,
        warnings: recentLogs.filter(l => l.level === 'warn').length,
      },
      lastDay: {
        total: dailyLogs.length,
        errors: dailyLogs.filter(l => l.level === 'error').length,
        warnings: dailyLogs.filter(l => l.level === 'warn').length,
      },
      slowOperations: this.entries
        .filter(e => e.duration > 1000)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
    };
  }

  // ------------------------------------------------------------
  // EXPORT
  // ------------------------------------------------------------

  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'level', 'source', 'message', 'metadata'];
    const rows = this.logs.map(log => [
      log.timestamp.toISOString(),
      log.level,
      log.source || '',
      `"${log.message.replace(/"/g, '""')}"`,
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// Singleton instance
let instance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!instance) {
    instance = new PerformanceMonitor();
  }
  return instance;
}
