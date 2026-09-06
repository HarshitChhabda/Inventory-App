import { PrismaClient } from '@prisma/client';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { getLogger } from '../services/monitoring/logger.service';

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
      getLogger().info(`[Database] Copied bundled database from ${bundledDbPath} to ${dbPath}`, 'Database');
    } else {
      getLogger().info(`[Database] Bundled database not found at ${bundledDbPath}, Prisma will create a new one at ${dbPath}`, 'Database');
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

  // Create CurrentStockBalance table for O(1) stock reads
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CurrentStockBalance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER NOT NULL,
      financialYearId INTEGER NOT NULL,
      storeId INTEGER NOT NULL,
      itemId INTEGER NOT NULL,
      availableQty REAL DEFAULT 0,
      installedQty REAL DEFAULT 0,
      damagedQty REAL DEFAULT 0,
      repairQty REAL DEFAULT 0,
      scrapQty REAL DEFAULT 0,
      totalValue REAL DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(companyId, financialYearId, storeId, itemId)
    )
  `);
  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_csb_company_fy_store ON CurrentStockBalance(companyId, financialYearId, storeId)');
  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_csb_company_fy_item ON CurrentStockBalance(companyId, financialYearId, itemId)');

  // Create StockMonthlySummary for O(1) monthly trend queries
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS StockMonthlySummary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId INTEGER NOT NULL,
      financialYearId INTEGER NOT NULL,
      yearMonth TEXT NOT NULL,
      quantityIn REAL DEFAULT 0,
      quantityOut REAL DEFAULT 0,
      UNIQUE(companyId, financialYearId, yearMonth)
    )
  `);
  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_sms_company_fy ON StockMonthlySummary(companyId, financialYearId)');

  // Covering index for transaction report GROUP BY movementType
  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_le_movement_cover ON LedgerEntry(companyId, financialYearId, movementType, quantityIn, quantityOut)');

  // Rebuild CurrentStockBalance if empty (first run or fresh DB)
  await rebuildCurrentStockBalance(client);
}

async function rebuildCurrentStockBalance(client: PrismaClient): Promise<void> {
  const cnt = await client.$queryRawUnsafe<{ c: number }[]>(
    'SELECT COUNT(*) as c FROM CurrentStockBalance'
  );
  if (Number(cnt[0].c) > 0) return; // Already populated

  const ledgerCnt = await client.$queryRawUnsafe<{ c: number }[]>(
    'SELECT COUNT(*) as c FROM LedgerEntry'
  );
  if (Number(ledgerCnt[0].c) === 0) return; // No ledger entries

  getLogger().info('[DB] Rebuilding CurrentStockBalance from ledger...', 'Database');

  const entries = await client.$queryRawUnsafe<any[]>(
    `SELECT companyId, financialYearId, storeId, itemId, locationId, movementType, CAST(quantityIn AS TEXT) as quantityIn, CAST(quantityOut AS TEXT) as quantityOut, CAST(rate AS TEXT) as rate
     FROM LedgerEntry ORDER BY transactionDate ASC, createdAt ASC, id ASC`
  );

  // Group by (companyId, financialYearId, storeId, itemId)
  const groups = new Map<string, any[]>();
  for (const e of entries) {
    const key = `${e.companyId}:${e.financialYearId}:${e.storeId}:${e.itemId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  let count = 0;
  for (const [key, pairEntries] of groups) {
    const [companyId, financialYearId, storeId, itemId] = key.split(':').map(Number);

    let available = 0, installed = 0, damaged = 0, repair = 0, scrap = 0, totalValue = 0;
    for (const e of pairEntries) {
      const delta = computeDelta(e.movementType, Number(e.quantityIn), Number(e.quantityOut), e.locationId);
      available += delta.av;
      installed += delta.inst;
      damaged += delta.dmg;
      repair += delta.rep;
      scrap += delta.scr;
      totalValue += (Number(e.quantityIn) - Number(e.quantityOut)) * Number(e.rate || 0);
    }

    await client.$executeRawUnsafe(
      `INSERT INTO CurrentStockBalance (companyId, financialYearId, storeId, itemId, availableQty, installedQty, damagedQty, repairQty, scrapQty, totalValue)
       VALUES (?, ?, ?, ?, MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?), MAX(0,?))`,
      companyId, financialYearId, storeId, itemId,
      available, installed, damaged, repair, scrap, totalValue
    );
    count++;
  }

  getLogger().info(`[DB] Rebuilt CurrentStockBalance: ${count} item-store pairs`, 'Database');

  // Also rebuild StockMonthlySummary if empty
  await rebuildMonthlySummary(client);
}

async function rebuildMonthlySummary(client: PrismaClient): Promise<void> {
  const cnt = await client.$queryRawUnsafe<{ c: number }[]>(
    'SELECT COUNT(*) as c FROM StockMonthlySummary'
  );
  if (Number(cnt[0].c) > 0) return;

  const ledgerCnt = await client.$queryRawUnsafe<{ c: number }[]>(
    'SELECT COUNT(*) as c FROM LedgerEntry'
  );
  if (Number(ledgerCnt[0].c) === 0) return;

  getLogger().info('[DB] Rebuilding StockMonthlySummary from ledger...', 'Database');

  const rows = await client.$queryRawUnsafe<Array<{ companyId: number; financialYearId: number; ym: string; tin: number; tout: number }>>(
    `SELECT companyId, financialYearId, strftime('%Y-%m', transactionDate) as ym, CAST(SUM(quantityIn) AS TEXT) as tin, CAST(SUM(quantityOut) AS TEXT) as tout
     FROM LedgerEntry GROUP BY companyId, financialYearId, ym ORDER BY companyId, financialYearId, ym`
  );

  for (const r of rows) {
    await client.$executeRawUnsafe(
      `INSERT INTO StockMonthlySummary (companyId, financialYearId, yearMonth, quantityIn, quantityOut)
       VALUES (?, ?, ?, ?, ?)`,
      r.companyId, r.financialYearId, r.ym, Number(r.tin), Number(r.tout)
    );
  }

  getLogger().info(`[DB] Rebuilt StockMonthlySummary: ${rows.length} monthly rows`, 'Database');
}

function computeDelta(movementType: string, qtyIn: number, qtyOut: number, locationId?: number | null) {
  let av = 0, inst = 0, dmg = 0, rep = 0, scr = 0;
  switch (movementType) {
    case 'OPENING_BALANCE':
    case 'OPENING_STOCK':
    case 'PURCHASE_RECEIPT':
    case 'TRANSFER_IN':
    case 'RETURN_IN':
    case 'CARRY_FORWARD':
    case 'ADJUSTMENT_PLUS':
    case 'ISSUE_IN':
    case 'REPLACEMENT_IN':
      av = qtyIn - qtyOut; break;
    case 'ISSUE_OUT':
    case 'TRANSFER_OUT':
    case 'RETURN_OUT':
    case 'VENDOR_RETURN':
    case 'ADJUSTMENT_MINUS':
    case 'REPLACEMENT_OUT':
      av = qtyIn - qtyOut; break;
    case 'INSTALL_OUT':
      av = -qtyOut; inst = qtyOut; break;
    case 'UNINSTALL_OUT':
      inst = -qtyOut; break;
    case 'SHIFT_IN':
      if (locationId) { inst = qtyIn; } else { av = qtyIn; }
      break;
    case 'SHIFT_OUT':
      if (locationId) { inst = -qtyOut; } else { av = -qtyOut; }
      break;
    case 'INSTALL_IN':
      break;
    case 'DAMAGE_OUT':
      av = -qtyOut; dmg = qtyOut; break;
    case 'DAMAGE_IN':
      break;
    case 'REPAIR_OUT':
      av = -qtyOut; rep = qtyOut; break;
    case 'REPAIR_IN':
      av = qtyIn; rep = -qtyOut; break;
    case 'SCRAP_OUT':
      av = -qtyOut; scr = qtyOut; break;
    case 'REVERSAL':
      av = qtyIn - qtyOut; break;
    default:
      av = qtyIn - qtyOut;
  }
  return { av, inst, dmg, rep, scr };
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
    getLogger().info('[Migrations] No migrations directory found, skipping.', 'Migrations');
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
    getLogger().info(`[Migrations] Applying: ${dir}`, 'Migrations');

    try {
      for (const rawStatement of sql.split(';').map(s => s.trim()).filter(s => s.length > 0)) {
        // Strip leading SQL comments (-- ...) before inspecting statement type
        const statement = rawStatement
          .split('\n')
          .filter(line => !line.trimStart().startsWith('--'))
          .join('\n')
          .trim();

        if (statement.length === 0) continue;

        const upper = statement.toUpperCase();
        if (upper.startsWith('ALTER TABLE') && upper.includes('ADD COLUMN')) {
          const colMatch = statement.match(/ADD\s+COLUMN\s+"?(\w+)"?\s/i);
          if (colMatch) {
            const colName = colMatch[1];
            const tableMatch = statement.match(/ALTER\s+TABLE\s+"?(\w+)"?\s/i);
            if (tableMatch) {
              const tableName = tableMatch[1];
              const check = await client.$queryRawUnsafe<{ cnt: number }[]>(
                `SELECT COUNT(*) as cnt FROM pragma_table_info('${tableName}') WHERE name = '${colName}'`
              );
              if (check[0]?.cnt > 0) {
                getLogger().info(`[Migrations] Column ${colName} already exists in ${tableName}, skipping.`, 'Migrations');
                continue;
              }
            }
          }
        }
        await client.$executeRawUnsafe(statement);
      }
      await client.$executeRawUnsafe(`INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)`,
        dir, dir, dir);
      getLogger().info(`[Migrations] Applied: ${dir}`, 'Migrations');
    } catch (err: any) {
      getLogger().error(`[Migrations] Failed: ${dir} — ${err.message}`, 'Migrations');
    }
  }

  getLogger().info('[Migrations] Done.', 'Migrations');
}
