import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';
import { backupDatabase } from '../database/prisma.client';
import { getPrismaClient } from '../database/prisma.client';

export class BackupService {
  private baseDir: string;
  private dbDir: string;
  private fifteenMinDir: string;
  private dailyDir: string;
  private weeklyDir: string;
  private monthlyDir: string;
  private yearlyDir: string;
  private exportsDir: string;
  private attachmentsDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(app.getPath('userData'), 'InventoryData');
    this.dbDir = this.baseDir;
    this.fifteenMinDir = path.join(this.baseDir, 'backups', '15min');
    this.dailyDir = path.join(this.baseDir, 'backups', 'daily');
    this.weeklyDir = path.join(this.baseDir, 'backups', 'weekly');
    this.monthlyDir = path.join(this.baseDir, 'backups', 'monthly');
    this.yearlyDir = path.join(this.baseDir, 'backups', 'yearly');
    this.exportsDir = path.join(this.baseDir, 'exports');
    this.attachmentsDir = path.join(this.baseDir, 'attachments');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    for (const dir of [this.baseDir, this.fifteenMinDir, this.dailyDir, this.weeklyDir, this.monthlyDir, this.yearlyDir, this.exportsDir, this.attachmentsDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  updateBaseDir(newDir: string) {
    this.baseDir = newDir;
    this.dbDir = this.baseDir;
    this.fifteenMinDir = path.join(this.baseDir, 'backups', '15min');
    this.dailyDir = path.join(this.baseDir, 'backups', 'daily');
    this.weeklyDir = path.join(this.baseDir, 'backups', 'weekly');
    this.monthlyDir = path.join(this.baseDir, 'backups', 'monthly');
    this.yearlyDir = path.join(this.baseDir, 'backups', 'yearly');
    this.exportsDir = path.join(this.baseDir, 'exports');
    this.attachmentsDir = path.join(this.baseDir, 'attachments');
    this.ensureDirectories();
  }

  getBaseDir(): string { return this.baseDir; }
  getExportsDir(): string { return this.exportsDir; }

  async performBackup(): Promise<string> {
    const now = new Date();
    const filename = `inventory_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}.db`;
    const backupPath = path.join(this.fifteenMinDir, filename);
    await backupDatabase(backupPath);
    return backupPath;
  }

  async performDailyBackup(): Promise<string> {
    const now = new Date();
    const filename = `inventory_daily_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.db`;
    const backupPath = path.join(this.dailyDir, filename);
    await backupDatabase(backupPath);
    return backupPath;
  }

  async performWeeklyBackup(): Promise<string> {
    const now = new Date();
    const filename = `inventory_weekly_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.db`;
    const backupPath = path.join(this.weeklyDir, filename);
    await backupDatabase(backupPath);
    return backupPath;
  }

  async performMonthlyBackup(): Promise<string> {
    const now = new Date();
    const filename = `inventory_monthly_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.db`;
    const backupPath = path.join(this.monthlyDir, filename);
    await backupDatabase(backupPath);
    return backupPath;
  }

  async performYearlyBackup(): Promise<string> {
    const now = new Date();
    const filename = `inventory_yearly_${now.getFullYear()}.db`;
    const backupPath = path.join(this.yearlyDir, filename);
    await backupDatabase(backupPath);
    return backupPath;
  }

  private cleanupOldFiles(directory: string, keepCount: number) {
    if (!fs.existsSync(directory)) return;
    const files = fs.readdirSync(directory).filter((f) => f.endsWith('.db')).sort().reverse();
    if (files.length > keepCount) {
      for (const file of files.slice(keepCount)) {
        fs.unlinkSync(path.join(directory, file));
      }
    }
  }

  cleanup15MinBackups() { this.cleanupOldFiles(this.fifteenMinDir, 48); }
  cleanupDailyBackups() { this.cleanupOldFiles(this.dailyDir, 30); }
  cleanupWeeklyBackups() { this.cleanupOldFiles(this.weeklyDir, 12); }
  cleanupMonthlyBackups() { this.cleanupOldFiles(this.monthlyDir, 24); }
  cleanupYearlyBackups() { this.cleanupOldFiles(this.yearlyDir, 5); }

  startScheduledBackups() {
    cron.schedule('*/15 * * * *', async () => {
      try { await this.performBackup(); this.cleanup15MinBackups(); } catch (e) { console.error('15-min backup failed:', e); }
    });

    cron.schedule('0 0 * * *', async () => {
      try { await this.performDailyBackup(); this.cleanupDailyBackups(); } catch (e) { console.error('Daily backup failed:', e); }
    });

    cron.schedule('0 0 * * 0', async () => {
      try { await this.performWeeklyBackup(); this.cleanupWeeklyBackups(); } catch (e) { console.error('Weekly backup failed:', e); }
    });

    cron.schedule('0 0 1 * *', async () => {
      try { await this.performMonthlyBackup(); this.cleanupMonthlyBackups(); } catch (e) { console.error('Monthly backup failed:', e); }
    });

    cron.schedule('0 0 1 1 *', async () => {
      try { await this.performYearlyBackup(); this.cleanupYearlyBackups(); } catch (e) { console.error('Yearly backup failed:', e); }
    });
  }

  listBackups(): Array<{ path: string; name: string; size: number; date: Date; type: string }> {
    const backups: Array<{ path: string; name: string; size: number; date: Date; type: string }> = [];
    const scanDir = (dir: string, type: string) => {
      if (!fs.existsSync(dir)) return;
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.db'))) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        backups.push({ path: filePath, name: file, size: stats.size, date: stats.mtime, type });
      }
    };
    scanDir(this.fifteenMinDir, '15min');
    scanDir(this.dailyDir, 'daily');
    scanDir(this.weeklyDir, 'weekly');
    scanDir(this.monthlyDir, 'monthly');
    scanDir(this.yearlyDir, 'yearly');
    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async restoreBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');

    const stats = fs.statSync(backupPath);
    if (stats.size < 1024) throw new Error('Backup file too small — likely corrupted');

    const dbPath = path.join(this.dbDir, 'inventory.db');
    const tempPath = path.join(this.dbDir, 'inventory_restoring.db');

    fs.copyFileSync(backupPath, tempPath);

    try {
      const prisma = getPrismaClient();
      await prisma.$disconnect();
    } catch {}

    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      fs.renameSync(tempPath, dbPath);
    } catch (err) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw new Error('Restore failed: could not replace database file');
    }
  }
}
