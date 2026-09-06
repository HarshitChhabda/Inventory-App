import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ============================================================
// TYPES
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  source?: string;
  context?: Record<string, any>;
  stack?: string;
  requestId?: string;
  userId?: string;
}

export interface LoggerOptions {
  maxFileSize: number; // Max file size in bytes (default: 10MB)
  maxFiles: number; // Max number of log files (default: 30)
  compress: boolean; // Compress old log files
  consoleOutput: boolean; // Output to console
  fileOutput: boolean; // Output to file
}

// ============================================================
// LOGGER SERVICE
// ============================================================

export class Logger {
  private logsDir: string;
  private options: LoggerOptions;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30,
      compress: false,
      consoleOutput: true,
      fileOutput: true,
      ...options,
    };

    this.logsDir = path.join(app.getPath('userData'), 'InventoryData', 'logs');
    this.ensureDirectories();
    this.startFlushInterval();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private startFlushInterval() {
    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000);
  }

  // ------------------------------------------------------------
  // LOGGING METHODS
  // ------------------------------------------------------------

  debug(message: string, source?: string, context?: Record<string, any>) {
    this.log('debug', message, source, context);
  }

  info(message: string, source?: string, context?: Record<string, any>) {
    this.log('info', message, source, context);
  }

  warn(message: string, source?: string, context?: Record<string, any>) {
    this.log('warn', message, source, context);
  }

  error(message: string, source?: string, context?: Record<string, any>, stack?: string) {
    this.log('error', message, source, context, stack);
  }

  fatal(message: string, source?: string, context?: Record<string, any>, stack?: string) {
    this.log('fatal', message, source, context, stack);
  }

  // ------------------------------------------------------------
  // CORE LOG METHOD
  // ------------------------------------------------------------

  private log(level: LogLevel, message: string, source?: string, context?: Record<string, any>, stack?: string) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      source,
      context,
      stack,
    };

    // Add to buffer
    this.buffer.push(entry);

    // Console output
    if (this.options.consoleOutput) {
      this.logToConsole(entry);
    }

    // File output (immediate for errors and fatals)
    if (this.options.fileOutput && (level === 'error' || level === 'fatal')) {
      this.writeLogToFile(entry);
    }
  }

  private logToConsole(entry: LogEntry) {
    const prefix = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}]${entry.source ? ` [${entry.source}]` : ''}`;
    const message = `${prefix} ${entry.message}`;
    const context = entry.context ? JSON.stringify(entry.context) : '';

    switch (entry.level) {
      case 'debug':
        console.debug(message, context);
        break;
      case 'info':
        console.log(message, context);
        break;
      case 'warn':
        console.warn(message, context);
        break;
      case 'error':
      case 'fatal':
        console.error(message, context, entry.stack || '');
        break;
    }
  }

  // ------------------------------------------------------------
  // FILE WRITING
  // ------------------------------------------------------------

  private writeLogToFile(entry: LogEntry) {
    try {
      const date = entry.timestamp.toISOString().split('T')[0];
      const filename = `app-${date}.log`;
      const filepath = path.join(this.logsDir, filename);

      // Check file size and rotate if needed
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > this.options.maxFileSize) {
          this.rotateLogFile(filepath);
        }
      }

      const line = this.formatLogLine(entry);
      fs.appendFileSync(filepath, line, 'utf-8');
    } catch (err) {
      console.error('Failed to write log to file:', err);
    }
  }

  private formatLogLine(entry: LogEntry): string {
    const parts = [
      entry.timestamp.toISOString(),
      `[${entry.level.toUpperCase()}]`,
      entry.source ? `[${entry.source}]` : '',
      entry.message,
    ];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.stack) {
      parts.push(`\nStack: ${entry.stack}`);
    }

    return parts.filter(Boolean).join(' ') + '\n';
  }

  private rotateLogFile(filepath: string) {
    try {
      const ext = path.extname(filepath);
      const base = path.basename(filepath, ext);
      const dir = path.dirname(filepath);

      // Find next available rotation number
      let rotation = 1;
      let newFilename = `${base}-${rotation}${ext}`;
      let newPath = path.join(dir, newFilename);

      while (fs.existsSync(newPath)) {
        rotation++;
        newFilename = `${base}-${rotation}${ext}`;
        newPath = path.join(dir, newFilename);
      }

      // Rename current file
      fs.renameSync(filepath, newPath);

      // Clean up old rotations if exceeding max
      this.cleanupOldRotations(dir, base, ext);
    } catch (err) {
      console.error('Failed to rotate log file:', err);
    }
  }

  private cleanupOldRotations(dir: string, base: string, ext: string) {
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith(base) && f.endsWith(ext))
        .sort();

      // Keep only maxFiles
      if (files.length > this.options.maxFiles) {
        const toDelete = files.slice(0, files.length - this.options.maxFiles);
        toDelete.forEach(file => {
          fs.unlinkSync(path.join(dir, file));
        });
      }
    } catch (err) {
      console.error('Failed to cleanup old log rotations:', err);
    }
  }

  // ------------------------------------------------------------
  // BUFFER FLUSH
  // ------------------------------------------------------------

  flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    entries.forEach(entry => {
      if (entry.level !== 'error' && entry.level !== 'fatal') {
        this.writeLogToFile(entry);
      }
    });
  }

  // ------------------------------------------------------------
  // LOG RETRIEVAL
  // ------------------------------------------------------------

  getLogs(options?: {
    level?: LogLevel;
    source?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    try {
      const files = fs.readdirSync(this.logsDir)
        .filter(f => f.startsWith('app-') && f.endsWith('.log'))
        .sort()
        .reverse();

      let allLogs: LogEntry[] = [];

      for (const file of files) {
        const filepath = path.join(this.logsDir, file);
        const content = fs.readFileSync(filepath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          const entry = this.parseLogLine(line);
          if (entry) {
            allLogs.push(entry);
          }
        }

        // Limit files to read
        if (allLogs.length > 10000) break;
      }

      // Apply filters
      if (options?.level) {
        allLogs = allLogs.filter(l => l.level === options.level);
      }

      if (options?.source) {
        allLogs = allLogs.filter(l => l.source === options.source);
      }

      if (options?.since) {
        allLogs = allLogs.filter(l => l.timestamp >= options.since!);
      }

      // Sort by timestamp descending
      allLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (options?.limit) {
        allLogs = allLogs.slice(0, options.limit);
      }

      return allLogs;
    } catch (err) {
      console.error('Failed to read logs:', err);
      return [];
    }
  }

  private parseLogLine(line: string): LogEntry | null {
    try {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[(\w+)\]\s+(?:\[(\w+)\]\s+)?(.+?)(?:\s+(\{.+\}))?$/);
      if (!match) return null;

      const [, timestamp, level, source, message, contextStr] = match;

      return {
        level: level.toLowerCase() as LogLevel,
        message,
        timestamp: new Date(timestamp),
        source: source || undefined,
        context: contextStr ? JSON.parse(contextStr) : undefined,
      };
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------
  // CLEANUP
  // ------------------------------------------------------------

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }

  getStats() {
    const files = fs.readdirSync(this.logsDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'));

    let totalSize = 0;
    files.forEach(file => {
      const stats = fs.statSync(path.join(this.logsDir, file));
      totalSize += stats.size;
    });

    return {
      logFiles: files.length,
      totalSize,
      bufferSize: this.buffer.length,
    };
  }
}

// Singleton instance
let instance: Logger | null = null;

export function getLogger(options?: Partial<LoggerOptions>): Logger {
  if (!instance) {
    instance = new Logger(options);
  }
  return instance;
}
