import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as cron from 'node-cron';
import { backupDatabase } from '../database/prisma.client';
import { getPrismaClient } from '../database/prisma.client';
import { getLogger } from './monitoring/logger.service';

// ============================================================
// TYPES
// ============================================================

export interface BackupVersion {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  checksum: string;
  timestamp: Date;
  type: 'manual' | 'scheduled' | 'pre-import' | 'pre-upgrade' | 'disaster-recovery';
  label?: string;
  metadata?: Record<string, any>;
}

export interface BackupIntegrityResult {
  valid: boolean;
  checksum: string;
  expectedChecksum?: string;
  size: number;
  error?: string;
}

export interface DisasterRecoveryResult {
  success: boolean;
  backupPath: string;
  checksum: string;
  restoredAt: Date;
  message: string;
}

export interface BackupManifest {
  version: string;
  createdAt: Date;
  backups: BackupVersion[];
  retentionPolicy: RetentionPolicy;
}

export interface RetentionPolicy {
  manualKeep: number;
  scheduledKeep: number;
  preImportKeep: number;
  preUpgradeKeep: number;
  disasterRecoveryKeep: number;
}

// ============================================================
// ENHANCED BACKUP SERVICE
// ============================================================

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
  private versionsDir: string;
  private manifestPath: string;
  private retentionPolicy: RetentionPolicy;

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
    this.versionsDir = path.join(this.baseDir, 'backups', 'versions');
    this.manifestPath = path.join(this.baseDir, 'backups', 'manifest.json');

    this.retentionPolicy = {
      manualKeep: 50,
      scheduledKeep: 100,
      preImportKeep: 10,
      preUpgradeKeep: 5,
      disasterRecoveryKeep: 20,
    };

    this.ensureDirectories();
  }

  private ensureDirectories() {
    const dirs = [
      this.baseDir, this.fifteenMinDir, this.dailyDir, this.weeklyDir,
      this.monthlyDir, this.yearlyDir, this.exportsDir, this.attachmentsDir,
      this.versionsDir,
    ];
    for (const dir of dirs) {
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
    this.versionsDir = path.join(this.baseDir, 'backups', 'versions');
    this.manifestPath = path.join(this.baseDir, 'backups', 'manifest.json');
    this.ensureDirectories();
  }

  getBaseDir(): string { return this.baseDir; }
  getExportsDir(): string { return this.exportsDir; }

  // ------------------------------------------------------------
  // SHA-256 CHECKSUM
  // ------------------------------------------------------------

  private computeChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  verifyChecksum(filePath: string, expectedChecksum: string): BackupIntegrityResult {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, checksum: '', size: 0, error: 'File not found' };
      }

      const checksum = this.computeChecksum(filePath);
      const stats = fs.statSync(filePath);

      return {
        valid: checksum === expectedChecksum,
        checksum,
        expectedChecksum,
        size: stats.size,
        error: checksum !== expectedChecksum ? 'Checksum mismatch - file may be corrupted' : undefined,
      };
    } catch (err) {
      return {
        valid: false,
        checksum: '',
        size: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ------------------------------------------------------------
  // VERSIONED BACKUPS
  // ------------------------------------------------------------

  private generateBackupId(): string {
    return `bkp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private async createVersionedBackup(
    type: BackupVersion['type'],
    label?: string,
    metadata?: Record<string, any>
  ): Promise<BackupVersion> {
    const now = new Date();
    const id = this.generateBackupId();
    const filename = `${id}.db`;
    const filepath = path.join(this.versionsDir, filename);

    await backupDatabase(filepath);

    const checksum = this.computeChecksum(filepath);
    const stats = fs.statSync(filepath);

    const version: BackupVersion = {
      id,
      filename,
      filepath,
      size: stats.size,
      checksum,
      timestamp: now,
      type,
      label,
      metadata,
    };

    // Update manifest
    const manifest = this.loadManifest();
    manifest.backups.push(version);
    this.saveManifest(manifest);

    // Apply retention policy
    this.applyRetentionPolicy();

    return version;
  }

  // ------------------------------------------------------------
  // PUBLIC BACKUP METHODS
  // ------------------------------------------------------------

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

  // Versioned backup methods
  async createManualBackup(label?: string): Promise<BackupVersion> {
    return this.createVersionedBackup('manual', label);
  }

  async createPreImportBackup(importType: string, rowCount: number): Promise<BackupVersion> {
    return this.createVersionedBackup('pre-import', `Pre-import: ${importType}`, {
      importType,
      rowCount,
    });
  }

  async createPreUpgradeBackup(version: string): Promise<BackupVersion> {
    return this.createVersionedBackup('pre-upgrade', `Pre-upgrade: ${version}`, {
      appVersion: version,
    });
  }

  async createDisasterRecoveryBackup(): Promise<BackupVersion> {
    return this.createVersionedBackup('disaster-recovery', 'Disaster Recovery Backup');
  }

  // ------------------------------------------------------------
  // MANIFEST MANAGEMENT
  // ------------------------------------------------------------

  private loadManifest(): BackupManifest {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const data = fs.readFileSync(this.manifestPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch {}

    return {
      version: '1.0.0',
      createdAt: new Date(),
      backups: [],
      retentionPolicy: this.retentionPolicy,
    };
  }

  private saveManifest(manifest: BackupManifest): void {
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  // ------------------------------------------------------------
  // RETENTION POLICY
  // ------------------------------------------------------------

  private applyRetentionPolicy(): void {
    const manifest = this.loadManifest();

    const grouped: Record<string, BackupVersion[]> = {};
    for (const backup of manifest.backups) {
      if (!grouped[backup.type]) grouped[backup.type] = [];
      grouped[backup.type].push(backup);
    }

    const limits: Record<string, number> = {
      manual: this.retentionPolicy.manualKeep,
      scheduled: this.retentionPolicy.scheduledKeep,
      'pre-import': this.retentionPolicy.preImportKeep,
      'pre-upgrade': this.retentionPolicy.preUpgradeKeep,
      'disaster-recovery': this.retentionPolicy.disasterRecoveryKeep,
    };

    const toDelete: string[] = [];

    for (const [type, backups] of Object.entries(grouped)) {
      const limit = limits[type] || 50;
      if (backups.length > limit) {
        const sorted = backups.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const excess = sorted.slice(limit);
        for (const backup of excess) {
          toDelete.push(backup.id);
          if (fs.existsSync(backup.filepath)) {
            fs.unlinkSync(backup.filepath);
          }
        }
      }
    }

    manifest.backups = manifest.backups.filter(b => !toDelete.includes(b.id));
    this.saveManifest(manifest);
  }

  // ------------------------------------------------------------
  // LIST VERSIONED BACKUPS
  // ------------------------------------------------------------

  listVersionedBackups(type?: BackupVersion['type']): BackupVersion[] {
    const manifest = this.loadManifest();
    let backups = manifest.backups;

    if (type) {
      backups = backups.filter(b => b.type === type);
    }

    return backups.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // ------------------------------------------------------------
  // INTEGRITY VERIFICATION
  // ------------------------------------------------------------

  async verifyAllBackups(): Promise<Array<BackupVersion & { integrity: BackupIntegrityResult }>> {
    const manifest = this.loadManifest();
    const results: Array<BackupVersion & { integrity: BackupIntegrityResult }> = [];

    for (const backup of manifest.backups) {
      const integrity = this.verifyChecksum(backup.filepath, backup.checksum);
      results.push({ ...backup, integrity });
    }

    return results;
  }

  async verifyBackupIntegrity(backupId: string): Promise<BackupIntegrityResult> {
    const manifest = this.loadManifest();
    const backup = manifest.backups.find(b => b.id === backupId);

    if (!backup) {
      return { valid: false, checksum: '', size: 0, error: 'Backup not found in manifest' };
    }

    return this.verifyChecksum(backup.filepath, backup.checksum);
  }

  // ------------------------------------------------------------
  // DISASTER RECOVERY
  // ------------------------------------------------------------

  async disasterRecoveryRestore(backupId: string): Promise<DisasterRecoveryResult> {
    const manifest = this.loadManifest();
    const backup = manifest.backups.find(b => b.id === backupId);

    if (!backup) {
      throw new Error('Backup not found in manifest');
    }

    // Verify integrity before restore
    const integrity = this.verifyChecksum(backup.filepath, backup.checksum);
    if (!integrity.valid) {
      throw new Error(`Backup integrity check failed: ${integrity.error}`);
    }

    // Create a safety backup of current state before restore
    await this.createDisasterRecoveryBackup();

    // Perform the restore
    await this.restoreBackup(backup.filepath);

    return {
      success: true,
      backupPath: backup.filepath,
      checksum: backup.checksum,
      restoredAt: new Date(),
      message: `Successfully restored from backup ${backupId} (${backup.label || backup.type})`,
    };
  }

  // ------------------------------------------------------------
  // EXISTING METHODS (kept for backward compatibility)
  // ------------------------------------------------------------

  private cleanupOldFiles(directory: string, keepCount: number) {
    if (!fs.existsSync(directory)) return;
    const files = fs.readdirSync(directory).filter((f) => f.endsWith('.db')).sort().reverse();
    if (files.length > keepCount) {
      for (const file of files.slice(keepCount)) {
        fs.unlinkSync(path.join(directory, file));
      }
    }
  }

  cleanup15MinBackups() { this.cleanupOldFiles(this.fifteenMinDir, 8); }
  cleanupDailyBackups() { this.cleanupOldFiles(this.dailyDir, 7); }
  cleanupWeeklyBackups() { this.cleanupOldFiles(this.weeklyDir, 4); }
  cleanupMonthlyBackups() { this.cleanupOldFiles(this.monthlyDir, 6); }
  cleanupYearlyBackups() { this.cleanupOldFiles(this.yearlyDir, 3); }

  startScheduledBackups() {
    // Every hour (reduced from 15 min to save storage)
    cron.schedule('0 * * * *', async () => {
      try { await this.performBackup(); this.cleanup15MinBackups(); } catch (e: any) { getLogger().error(`Hourly backup failed: ${e.message}`, 'Backup', undefined, e.stack); }
    });

    cron.schedule('0 0 * * *', async () => {
      try { await this.performDailyBackup(); this.cleanupDailyBackups(); } catch (e: any) { getLogger().error(`Daily backup failed: ${e.message}`, 'Backup', undefined, e.stack); }
    });

    cron.schedule('0 0 * * 0', async () => {
      try { await this.performWeeklyBackup(); this.cleanupWeeklyBackups(); } catch (e: any) { getLogger().error(`Weekly backup failed: ${e.message}`, 'Backup', undefined, e.stack); }
    });

    cron.schedule('0 0 1 * *', async () => {
      try { await this.performMonthlyBackup(); this.cleanupMonthlyBackups(); } catch (e: any) { getLogger().error(`Monthly backup failed: ${e.message}`, 'Backup', undefined, e.stack); }
    });

    cron.schedule('0 0 1 1 *', async () => {
      try { await this.performYearlyBackup(); this.cleanupYearlyBackups(); } catch (e: any) { getLogger().error(`Yearly backup failed: ${e.message}`, 'Backup', undefined, e.stack); }
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
    scanDir(this.fifteenMinDir, 'hourly');
    scanDir(this.dailyDir, 'daily');
    scanDir(this.weeklyDir, 'weekly');
    scanDir(this.monthlyDir, 'monthly');
    scanDir(this.yearlyDir, 'yearly');
    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  getStorageInfo(): { totalSize: number; totalCount: number; byType: Record<string, { count: number; size: number }>; backupPath: string } {
    const byType: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;
    let totalCount = 0;

    const scanDir = (dir: string, type: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db'));
      let typeSize = 0;
      for (const file of files) {
        const stats = fs.statSync(path.join(dir, file));
        typeSize += stats.size;
      }
      byType[type] = { count: files.length, size: typeSize };
      totalSize += typeSize;
      totalCount += files.length;
    };

    scanDir(this.fifteenMinDir, 'hourly');
    scanDir(this.dailyDir, 'daily');
    scanDir(this.weeklyDir, 'weekly');
    scanDir(this.monthlyDir, 'monthly');
    scanDir(this.yearlyDir, 'yearly');

    return { totalSize, totalCount, byType, backupPath: this.baseDir };
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
