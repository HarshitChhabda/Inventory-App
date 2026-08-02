import { PrismaClient } from '@prisma/client';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let prisma: PrismaClient;

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'InventoryData');
  const dbPath = path.join(dbDir, 'inventory.db');

  if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const bundledDbPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'prisma', 'dev.db')
      : path.join(app.getAppPath(), 'prisma', 'dev.db');
      
    if (fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, dbPath);
      console.log(`[Database] Copied bundled database from ${bundledDbPath} to ${dbPath}`);
    } else {
      console.log(`[Database] Bundled database not found at ${bundledDbPath}, Prisma will create a new one at ${dbPath}`);
    }
  }

  return dbPath;
}

function getPrismaDirname(): string {
  if (app.isPackaged) {
    // extraResources path: resources/node_modules/.prisma/client
    const resourcesPath = path.join(process.resourcesPath, 'node_modules', '.prisma', 'client');
    if (fs.existsSync(resourcesPath)) return resourcesPath;
  }
  return path.join(__dirname, '..', '..', 'node_modules', '.prisma', 'client');
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const dbPath = getDatabasePath();
    const dirname = getPrismaDirname();

    // Set engine binary path for packaged app
    if (app.isPackaged) {
      const enginePath = path.join(dirname, 'query_engine-windows.dll.node');
      if (fs.existsSync(enginePath)) {
        process.env.PRISMA_QUERY_ENGINE_BINARY = enginePath;
      }
      const schemaPath = path.join(dirname, 'schema.prisma');
      if (fs.existsSync(schemaPath)) {
        process.env.PRISMA_SCHEMA_DIR = dirname;
      }
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`,
        },
      },
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}

export async function initializeDatabase(): Promise<void> {
  const client = getPrismaClient();

  await client.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await client.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  await client.$queryRawUnsafe('PRAGMA cache_size = -128000');
  await client.$queryRawUnsafe('PRAGMA foreign_keys = ON');
  await client.$queryRawUnsafe('PRAGMA temp_store = MEMORY');
  await client.$queryRawUnsafe('PRAGMA mmap_size = 536870912');
  await client.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
  await client.$queryRawUnsafe('PRAGMA page_size = 8192');
  await client.$queryRawUnsafe('PRAGMA wal_autocheckpoint = 1000');
  await client.$queryRawUnsafe('PRAGMA optimize');
}

export async function backupDatabase(backupPath: string): Promise<void> {
  const client = getPrismaClient();
  await client.$executeRawUnsafe(`VACUUM INTO '${backupPath}'`);
}

export async function runMigrations(): Promise<void> {
  const dbPath = getDatabasePath();
  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'prisma', 'migrations')
    : path.join(app.getAppPath(), 'prisma', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log('[Migrations] No migrations directory found, skipping.');
    return;
  }

  const client = getPrismaClient();

  // Ensure migration tracking table exists
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      finished_at DATETIME,
      migration_name TEXT NOT NULL,
      logs TEXT,
      rolled_back_at DATETIME,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  const applied = await client.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL`
  );
  const appliedSet = new Set(applied.map((r) => r.migration_name));

  const migrationDirs = fs.readdirSync(migrationsDir)
    .filter((d) => d.match(/^\d{14}_/))
    .sort();

  for (const dir of migrationDirs) {
    if (appliedSet.has(dir)) continue;

    const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;

    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`[Migrations] Applying: ${dir}`);

    await client.$executeRawUnsafe(`INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at) VALUES (?, ?, ?, datetime('now'))`,
      dir, dir, dir);

    try {
      for (const statement of sql.split(';').map(s => s.trim()).filter(s => s.length > 0)) {
        await client.$executeRawUnsafe(statement);
      }
      await client.$executeRawUnsafe(
        `UPDATE _prisma_migrations SET finished_at = datetime('now'), applied_steps_count = 1 WHERE migration_name = ?`,
        dir
      );
      console.log(`[Migrations] Applied: ${dir}`);
    } catch (err: any) {
      await client.$executeRawUnsafe(
        `UPDATE _prisma_migrations SET logs = ? WHERE migration_name = ?`,
        err.message, dir
      );
      console.error(`[Migrations] Failed: ${dir} — ${err.message}`);
    }
  }

  console.log('[Migrations] Done.');
}
