import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { DataIntegrityService } from '../../src/main/services/dataIntegrity.service';
import { requireAuth, serialize } from './helpers';
import { getLogger } from '../../src/main/services/monitoring/logger.service';

let integrityInterval: ReturnType<typeof setInterval> | null = null;

export function registerDataIntegrityIPC(prisma: PrismaClient) {
  const svc = new DataIntegrityService(prisma);

  ipcMain.handle('integrity:runFullAudit', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.runFullAudit(companyId));
  });

  ipcMain.handle('integrity:getAuditSummary', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.getAuditSummary(companyId));
  });

  ipcMain.handle('integrity:checkNegativeStock', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.checkNegativeStock(companyId));
  });

  ipcMain.handle('integrity:checkOrphanTransactions', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.checkOrphanTransactions(companyId));
  });

  ipcMain.handle('integrity:checkDuplicateVouchers', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.checkDuplicateVouchers(companyId));
  });

  ipcMain.handle('integrity:checkStockLedgerSync', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.checkStockLedgerSync(companyId));
  });

  ipcMain.handle('integrity:checkFinancialYearIntegrity', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.checkFinancialYearIntegrity(companyId));
  });

  ipcMain.handle('integrity:checkReferentialIntegrity', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.checkReferentialIntegrity(companyId));
  });
}

/**
 * Start periodic integrity checks (runs daily at 2 AM).
 * Logs warnings for any failures but does not block the application.
 */
export function startScheduledIntegrityChecks(prisma: PrismaClient) {
  const svc = new DataIntegrityService(prisma);
  const logger = getLogger();

  // Run once on startup (delayed 30s to let app initialize)
  setTimeout(async () => {
    try {
      const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
      for (const company of companies) {
        const results = await svc.runFullAudit(company.id);
        const failures = results.filter(r => r.status === 'FAIL');
        if (failures.length > 0) {
          logger.warn(`Integrity check found ${failures.length} issues for company ${company.id}: ${failures.map(f => f.check).join(', ')}`, 'integrity');
        }
      }
    } catch (err) {
      logger.error('Startup integrity check failed', 'integrity', err);
    }
  }, 30000);

  // Schedule daily checks at 2 AM
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(2, 0, 0, 0);
  if (next2AM <= now) next2AM.setDate(next2AM.getDate() + 1);
  const msUntil2AM = next2AM.getTime() - now.getTime();

  setTimeout(() => {
    runDailyIntegrityCheck(svc, prisma, logger);
    integrityInterval = setInterval(() => runDailyIntegrityCheck(svc, prisma, logger), 24 * 60 * 60 * 1000);
  }, msUntil2AM);
}

async function runDailyIntegrityCheck(svc: DataIntegrityService, prisma: PrismaClient, logger: ReturnType<typeof getLogger>) {
  try {
    const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
    for (const company of companies) {
      const results = await svc.runFullAudit(company.id);
      const failures = results.filter(r => r.status === 'FAIL');
      if (failures.length > 0) {
        logger.warn(`Daily integrity check: ${failures.length} issues for company ${company.id}: ${failures.map(f => `${f.check}(${f.count ?? ''})`).join(', ')}`, 'integrity');
      } else {
        logger.info(`Daily integrity check: all clear for company ${company.id}`, 'integrity');
      }
    }
  } catch (err) {
    logger.error('Daily integrity check failed', 'integrity', err);
  }
}

export function stopScheduledIntegrityChecks() {
  if (integrityInterval) {
    clearInterval(integrityInterval);
    integrityInterval = null;
  }
}
