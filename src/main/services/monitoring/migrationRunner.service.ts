import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface Migration {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: Date;
  up: (prisma: PrismaClient) => Promise<void>;
  down: (prisma: PrismaClient) => Promise<void>;
}

export interface MigrationRecord {
  id: string;
  name: string;
  version: string;
  appliedAt: Date;
  checksum: string;
}

export interface MigrationStatus {
  applied: MigrationRecord[];
  pending: Migration[];
  currentVersion: string;
}

// ============================================================
// MIGRATION RUNNER
// ============================================================

export class MigrationRunner {
  private migrationsDir: string;
  private prisma: PrismaClient;
  private migrations: Migration[] = [];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.migrationsDir = path.join(app.getPath('userData'), 'InventoryData', 'migrations');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }
  }

  // ------------------------------------------------------------
  // MIGRATION MANAGEMENT
  // ------------------------------------------------------------

  registerMigration(migration: Migration) {
    // Check for duplicate IDs
    if (this.migrations.find(m => m.id === migration.id)) {
      throw new Error(`Migration with ID ${migration.id} already registered`);
    }

    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  registerMigrations(migrations: Migration[]) {
    migrations.forEach(m => this.registerMigration(m));
  }

  // ------------------------------------------------------------
  // MIGRATION STATUS
  // ------------------------------------------------------------

  async getStatus(): Promise<MigrationStatus> {
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map(m => m.id));
    const pending = this.migrations.filter(m => !appliedIds.has(m.id));
    const currentVersion = applied.length > 0
      ? applied[applied.length - 1].version
      : '0.0.0';

    return {
      applied,
      pending,
      currentVersion,
    };
  }

  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      // Check if migration table exists
      const tableExists = await this.prisma.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='_MigrationHistory'
      ` as any[];

      if (tableExists.length === 0) {
        // Create migration table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS _MigrationHistory (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT NOT NULL
          )
        `;
        return [];
      }

      const records = await this.prisma.$queryRaw`
        SELECT * FROM _MigrationHistory ORDER BY appliedAt ASC
      ` as MigrationRecord[];

      return records;
    } catch (err) {
      console.error('Failed to get applied migrations:', err);
      return [];
    }
  }

  // ------------------------------------------------------------
  // MIGRATION EXECUTION
  // ------------------------------------------------------------

  async runPending(): Promise<{ applied: string[]; errors: string[] }> {
    const status = await this.getStatus();
    const applied: string[] = [];
    const errors: string[] = [];

    for (const migration of status.pending) {
      try {
        console.log(`Applying migration: ${migration.name} (${migration.version})`);

        // Run the migration
        await migration.up(this.prisma);

        // Record the migration
        const checksum = this.calculateChecksum(migration);
        await this.recordMigration(migration, checksum);

        applied.push(migration.id);
        console.log(`Successfully applied migration: ${migration.name}`);
      } catch (err) {
        const errorMsg = `Failed to apply migration ${migration.name}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);

        // Stop on first error to prevent partial migrations
        break;
      }
    }

    return { applied, errors };
  }

  async rollback(targetVersion?: string): Promise<{ rolledBack: string[]; errors: string[] }> {
    const status = await this.getStatus();
    const rolledBack: string[] = [];
    const errors: string[] = [];

    // Determine which migrations to rollback
    const toRollback = targetVersion
      ? status.applied
          .filter(m => m.version > targetVersion)
          .reverse()
      : status.applied.slice(-1); // Rollback last migration only

    for (const record of toRollback) {
      const migration = this.migrations.find(m => m.id === record.id);
      if (!migration) {
        errors.push(`Migration ${record.name} not found in registered migrations`);
        continue;
      }

      try {
        console.log(`Rolling back migration: ${migration.name} (${migration.version})`);

        // Run the rollback
        await migration.down(this.prisma);

        // Remove the record
        await this.removeMigrationRecord(migration.id);

        rolledBack.push(migration.id);
        console.log(`Successfully rolled back migration: ${migration.name}`);
      } catch (err) {
        const errorMsg = `Failed to rollback migration ${migration.name}: ${err}`;
        console.error(errorMsg);
        errors.push(errorMsg);

        // Stop on first error
        break;
      }
    }

    return { rolledBack, errors };
  }

  // ------------------------------------------------------------
  // MIGRATION RECORDING
  // ------------------------------------------------------------

  private async recordMigration(migration: Migration, checksum: string) {
    await this.prisma.$executeRaw`
      INSERT INTO _MigrationHistory (id, name, version, appliedAt, checksum)
      VALUES (${migration.id}, ${migration.name}, ${migration.version}, ${new Date().toISOString()}, ${checksum})
    `;
  }

  private async removeMigrationRecord(id: string) {
    await this.prisma.$executeRaw`
      DELETE FROM _MigrationHistory WHERE id = ${id}
    `;
  }

  private calculateChecksum(migration: Migration): string {
    const content = `${migration.id}${migration.name}${migration.version}${migration.up.toString()}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // ------------------------------------------------------------
  // MIGRATION FILE PERSISTENCE
  // ------------------------------------------------------------

  saveMigrationFile(migration: Migration) {
    const filename = `${migration.version}-${migration.id}.json`;
    const filepath = path.join(this.migrationsDir, filename);

    const data = {
      id: migration.id,
      name: migration.name,
      description: migration.description,
      version: migration.version,
      createdAt: migration.createdAt.toISOString(),
      up: migration.up.toString(),
      down: migration.down.toString(),
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  loadMigrationFiles(): Migration[] {
    try {
      const files = fs.readdirSync(this.migrationsDir)
        .filter(f => f.endsWith('.json'))
        .sort();

      return files.map(file => {
        const filepath = path.join(this.migrationsDir, file);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        // SAFETY: Instead of new Function() which executes arbitrary code,
        // migrations must be registered programmatically via registerMigration().
        // Loaded files are recorded but their up/down are no-ops.
        const safeUp = async (_prisma: PrismaClient) => {
          console.warn(`Migration file ${file} loaded but up() is disabled for security. Register migration programmatically.`);
        };
        const safeDown = async (_prisma: PrismaClient) => {
          console.warn(`Migration file ${file} loaded but down() is disabled for security. Register migration programmatically.`);
        };

        return {
          id: data.id,
          name: data.name,
          description: data.description,
          version: data.version,
          createdAt: new Date(data.createdAt),
          up: safeUp,
          down: safeDown,
        };
      });
    } catch (err) {
      console.error('Failed to load migration files:', err);
      return [];
    }
  }

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=${tableName}
    ` as any[];

    return result.length > 0;
  }

  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw`
      SELECT name FROM pragma_table_info(${tableName})
      WHERE name=${columnName}
    ` as any[];

    return result.length > 0;
  }

  async addColumnIfNotExists(
    tableName: string,
    columnName: string,
    columnType: string,
    defaultValue?: string
  ) {
    const exists = await this.columnExists(tableName, columnName);
    if (!exists) {
      const defaultClause = defaultValue ? ` DEFAULT ${defaultValue}` : '';
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}${defaultClause}`
      );
    }
  }

  async createIndexIfNotExists(
    tableName: string,
    indexName: string,
    columns: string[],
    unique: boolean = false
  ) {
    const uniqueClause = unique ? 'UNIQUE ' : '';
    const columnsClause = columns.join(', ');
    await this.prisma.$executeRawUnsafe(
      `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnsClause})`
    );
  }
}

// Singleton instance
let instance: MigrationRunner | null = null;

export function getMigrationRunner(prisma: PrismaClient): MigrationRunner {
  if (!instance) {
    instance = new MigrationRunner(prisma);
  }
  return instance;
}
