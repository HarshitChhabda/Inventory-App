import { ipcMain } from 'electron';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { requireAuth, auditLog, serialize } from './helpers';
import { TransactionEngine } from '../../src/main/services/transactionEngine.service';
import { StockEngine } from '../../src/main/services/stockEngine.service';
import ExcelJS from 'exceljs';

export function registerStockIpc() {
  const prisma = getPrismaClient();
  const txEngine = new TransactionEngine(prisma);
  const stockEngine = new StockEngine(prisma);

  // ==================== ITEM HISTORY PAGINATED ====================

  ipcMain.handle('stock:getItemHistoryPaginated', async (_event, params: {
    companyId: number;
    financialYearId: number;
    itemId: number;
    storeId?: number;
    locationId?: number;
    departmentId?: number;
    startDate?: string;
    endDate?: string;
    voucherType?: string;
    movementType?: string;
    page?: number;
    pageSize?: number;
  }) => {
    requireAuth();
    const { StockLedgerService } = await import('../../src/main/services/stockLedger.service');
    const service = new StockLedgerService(prisma);

    const filters: any = {};
    if (params.storeId) filters.storeId = params.storeId;
    if (params.locationId) filters.locationId = params.locationId;
    if (params.departmentId) filters.departmentId = params.departmentId;
    if (params.startDate) filters.startDate = new Date(params.startDate);
    if (params.endDate) filters.endDate = new Date(params.endDate);
    if (params.voucherType) filters.voucherType = params.voucherType;
    if (params.movementType) filters.movementType = params.movementType;
    if (params.page) filters.page = params.page;
    if (params.pageSize) filters.pageSize = params.pageSize;

    return service.getItemHistoryPaginated(
      params.companyId,
      params.financialYearId,
      params.itemId,
      filters,
    );
  });

  // ==================== ISSUE BREAKDOWN ====================
  // Drill-down for issued qty — shows where items went (by store)

  ipcMain.handle('stock:getIssueBreakdown', async (_event, companyId: number, financialYearId: number, itemId: number) => {
    requireAuth();

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        companyId,
        financialYearId,
        itemId,
        movementType: 'ISSUE_OUT',
      },
      include: {
        store: true,
        location: true,
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });

    const breakdown: Record<number, any> = {};
    for (const entry of entries) {
      const storeId = entry.storeId;
      const storeName = entry.store?.name || 'Unknown Store';
      const locName = entry.location
        ? `${entry.location.locationType} - ${entry.location.name}`
        : '';

      if (!breakdown[storeId]) {
        breakdown[storeId] = {
          storeId,
          storeName,
          totalQty: 0,
          transactions: [],
        };
      }
      breakdown[storeId].totalQty += Number(entry.quantityOut || 0);
      breakdown[storeId].transactions.push({
        id: entry.id,
        date: entry.transactionDate instanceof Date ? entry.transactionDate.toISOString() : entry.transactionDate,
        quantity: Number(entry.quantityOut || 0),
        voucherNo: entry.voucherNo,
        balanceAfter: Number(entry.balanceQty || 0),
        locationName: locName,
        remarks: null,
      });
    }

    return Object.values(breakdown).sort((a: any, b: any) => b.totalQty - a.totalQty);
  });

  // ==================== ROOM-TO-ROOM SHIFT ====================
  // Shifts an installed asset between rooms within the same store.
  // Stock is STORE-LEVEL — room shifts only update AssetInstallation records.
  // No ledger entries are created because the store's stock balance doesn't change.

  ipcMain.handle('stock:room-shift', async (_event, data: {
    companyId: number;
    financialYearId: number;
    dharamshalaId: number;
    fromRoomId: number;
    toRoomId: number;
    itemId: number;
    quantity: number;
    rate: number;
    date: string;
    createdBy: string;
    remarks?: string;
    shiftType?: string;
  }) => {
    const { companyId, financialYearId, dharamshalaId, fromRoomId, toRoomId, itemId, quantity, rate, date, createdBy, remarks, shiftType } = data;
    requireAuth();

    if (!companyId || !financialYearId || !dharamshalaId || !fromRoomId || !toRoomId || !itemId || !quantity || quantity <= 0) {
      throw new Error('Invalid input: all IDs and positive quantity are required');
    }
    if (fromRoomId === toRoomId) throw new Error('Source and destination rooms must be different');

    const [dharamshala, fromRoom, toRoom, item] = await Promise.all([
      prisma.department.findUnique({ where: { id: dharamshalaId } }),
      prisma.location.findUnique({ where: { id: fromRoomId } }),
      prisma.location.findUnique({ where: { id: toRoomId } }),
      prisma.item.findUnique({ where: { id: itemId } }),
    ]);

    const isDP = shiftType === 'DP';
    const expectedType = isDP ? 'Department' : 'Dharamshala';
    if (!dharamshala || !dharamshala.isActive || dharamshala.departmentType !== expectedType) {
      throw new Error(`Department #${dharamshalaId} is not a valid active ${expectedType}`);
    }
    if (!fromRoom || fromRoom.locationType !== 'Room' || !fromRoom.parentId) {
      throw new Error(`Location #${fromRoomId} is not a valid Room`);
    }
    if (!toRoom || toRoom.locationType !== 'Room' || !toRoom.parentId) {
      throw new Error(`Location #${toRoomId} is not a valid Room`);
    }
    if (!item || !item.isActive) throw new Error(`Item #${itemId} not found or inactive`);

    const qty = Number(quantity);
    const txDate = new Date(date);
    const refTransferId = `SHIFT-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      // Validate sufficient installed quantity at source room
      const srcInstall = await tx.assetInstallation.findFirst({
        where: { itemId, roomId: fromRoomId, storeId: dharamshalaId, status: 'ACTIVE' },
      });

      if (!srcInstall || Number(srcInstall.quantity) < qty) {
        const installedQty = srcInstall ? Number(srcInstall.quantity) : 0;
        throw new Error(`Insufficient installed stock in source room: ${item.itemName} has ${installedQty} installed, requested ${qty}`);
      }

      // Move AssetInstallation: reduce source, increase destination
      if (Number(srcInstall.quantity) === qty) {
        // Full move — deactivate source
        await tx.assetInstallation.update({
          where: { id: srcInstall.id },
          data: {
            status: 'INACTIVE',
            uninstalledDate: txDate,
            uninstalledBy: createdBy,
            remarks: `Shifted to ${toRoom.name} via ${refTransferId}`,
          },
        });
      } else {
        // Partial move — reduce source quantity
        await tx.assetInstallation.update({
          where: { id: srcInstall.id },
          data: { quantity: { decrement: qty } },
        });
      }

      // Create or update destination installation
      const dstInstall = await tx.assetInstallation.findFirst({
        where: { itemId, roomId: toRoomId, storeId: dharamshalaId, status: 'ACTIVE' },
      });

      if (dstInstall) {
        await tx.assetInstallation.update({
          where: { id: dstInstall.id },
          data: { quantity: { increment: qty } },
        });
      } else {
        await tx.assetInstallation.create({
          data: {
            itemId,
            roomId: toRoomId,
            storeId: dharamshalaId,
            installedDate: txDate,
            quantity: qty,
            installedBy: createdBy,
            status: 'ACTIVE',
            remarks: `Shifted from ${fromRoom.name} via ${refTransferId}`,
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          companyId,
          action: 'CREATE',
          tableName: 'AssetInstallation',
          recordId: null,
          description: `Room shift: ${item.itemName} × ${qty} from ${fromRoom.name} to ${toRoom.name}`,
          newValues: JSON.stringify({ refTransferId, fromRoomId, toRoomId, itemId, quantity: qty }),
        },
      });

      return { success: true, refTransferId, message: `Shifted ${qty} ${item.itemName} from ${fromRoom.name} to ${toRoom.name}` };
    });

    return JSON.parse(JSON.stringify(result));
  });

  // ==================== RETURN TO STORE ====================
  // Returns items from a dharamshala room or pool back to a store.
  // Creates RETURN_OUT + RETURN_IN ledger entries through TransactionEngine.

  ipcMain.handle('stock:return-to-store', async (_event, data: {
    companyId: number;
    financialYearId: number;
    dharamshalaId: number;
    targetStoreId: number;
    itemId: number;
    quantity: number;
    rate: number;
    date: string;
    createdBy: string;
    fromRoomId?: number | null;
    remarks?: string;
  }) => {
    const { companyId, financialYearId, dharamshalaId, targetStoreId, itemId, quantity, rate, date, createdBy, fromRoomId, remarks } = data;
    requireAuth();

    if (!companyId || !financialYearId || !dharamshalaId || !targetStoreId || !itemId || !quantity || quantity <= 0) {
      throw new Error('Invalid input: all IDs and positive quantity are required');
    }

    const [dharamshala, store, item] = await Promise.all([
      prisma.department.findUnique({ where: { id: dharamshalaId } }),
      prisma.store.findUnique({ where: { id: targetStoreId } }),
      prisma.item.findUnique({ where: { id: itemId } }),
    ]);

    if (!dharamshala || !dharamshala.isActive || dharamshala.departmentType !== 'Dharamshala') {
      throw new Error(`Department #${dharamshalaId} is not a valid active Dharamshala`);
    }
    if (!store || !store.isActive) {
      throw new Error(`Store #${targetStoreId} is not valid or active`);
    }
    if (!item || !item.isActive) throw new Error(`Item #${itemId} not found or inactive`);

    if (fromRoomId) {
      const room = await prisma.location.findUnique({ where: { id: fromRoomId } });
      if (!room || room.locationType !== 'Room') throw new Error(`Location #${fromRoomId} is not a valid Room`);
    }

    const qty = Number(quantity);
    const itemRate = Number(rate) || 0;
    const txDate = new Date(date);

    // Create department return transaction through TransactionEngine
    const txInput = {
      companyId,
      financialYearId,
      movementType: 'DR' as const,
      transactionDate: txDate,
      fromStoreId: dharamshalaId,
      toStoreId: targetStoreId,
      fromLocationId: fromRoomId || undefined,
      purpose: fromRoomId
        ? `Return from room to store`
        : `Return from dharamshala pool to store`,
      remarks: remarks || `Return by ${createdBy}`,
      createdBy,
      items: [{
        itemId,
        quantity: qty,
        rate: itemRate,
        condition: 'GOOD' as const,
        fromLocationId: fromRoomId || undefined,
        remarks: remarks || `Returned to store`,
      }],
    };

    const txResult = await txEngine.createMovement(txInput);

    // Deactivate/reduce AssetInstallation if returning from room
    if (fromRoomId) {
      const srcInstall = await prisma.assetInstallation.findFirst({
        where: { itemId, roomId: fromRoomId, storeId: dharamshalaId, status: 'ACTIVE' },
      });
      if (srcInstall) {
        if (Number(srcInstall.quantity) <= qty) {
          await prisma.assetInstallation.update({
            where: { id: srcInstall.id },
            data: {
              status: 'INACTIVE',
              uninstalledDate: txDate,
              uninstalledBy: createdBy,
              remarks: `Returned to store via ${txResult.voucherNo}`,
            },
          });
        } else {
          await prisma.assetInstallation.update({
            where: { id: srcInstall.id },
            data: { quantity: { decrement: qty } },
          });
        }
      }
    }

    return {
      success: true,
      voucherNo: txResult.voucherNo,
      message: `Returned ${qty} ${item.itemName} to ${store.name}`,
    };
  });

  // ==================== BULK OPENING STOCK IMPORT ====================
  // Imports opening stock through TransactionEngine using OB (Opening Balance) movement type.

  ipcMain.handle('stock:opening-stock:bulk-import', async (_event, data: {
    companyId: number;
    financialYearId: number;
    rows: Array<{
      storeName?: string;
      dharamshalaDept?: string;
      roomLocation?: string;
      itemCode?: string;
      itemName?: string;
      unit?: string;
      quantity?: number;
      rate?: number;
      date?: string;
      status?: string;
      remarks?: string;
    }>;
  }) => {
    const { companyId, financialYearId, rows } = data;
    requireAuth();

    // Find first active user for createdBy
    const activeUser = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
    const createdByUser = activeUser?.username || 'admin';

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Verify financial year is valid and open
    const fy = await prisma.financialYear.findUnique({ where: { id: financialYearId } });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Cannot import opening stock to closed financial year');

    for (const row of rows) {
      try {
        const safeStr = (val: any): string => {
          if (val === null || val === undefined) return '';
          if (val instanceof Date) return val.toISOString().split('T')[0];
          return String(val).trim();
        };

        const storeName = safeStr(row.storeName || row.dharamshalaDept);
        const roomLocation = safeStr(row.roomLocation);
        const itemCode = safeStr(row.itemCode);
        const itemName = safeStr(row.itemName);
        const qty = Number(row.quantity);
        const rate = Number(row.rate || 0);
        const status = safeStr(row.status) || 'Available';
        const remarks = safeStr(row.remarks);
        const dateStr = safeStr(row.date);

        if (qty === null || qty === undefined || isNaN(qty) || qty < 0) {
          skipped++;
          errors.push(`Row: Invalid quantity (received: "${row.quantity}", item: "${itemName || itemCode}")`);
          continue;
        }

        if (!storeName) {
          skipped++;
          errors.push(`Row: Store/Department name is required`);
          continue;
        }

        // 1. Find Item
        let item = null;
        if (itemCode) {
          item = await prisma.item.findFirst({ where: { itemCode } });
        }
        if (!item && itemName) {
          item = await prisma.item.findFirst({ where: { itemName } });
        }
        if (!item && itemName) {
          item = await prisma.item.findFirst({ where: { itemName: { contains: itemName } } });
        }
        if (!item) {
          skipped++;
          errors.push(`Item "${itemCode || itemName}" not found. Create it in Item Master first.`);
          continue;
        }

        // 2. Resolve Store — must match by Company + StoreName
        const store = await prisma.store.findFirst({
          where: { companyId, name: storeName, isActive: true },
        });
        if (!store) {
          skipped++;
          errors.push(`Store "${storeName}" not found. Create it in Store Master first.`);
          continue;
        }

        // 3. Parse date
        let txDate = fy.startDate;
        if (dateStr) {
          let parsed: Date | null = null;
          if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            parsed = new Date(dateStr);
          } else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateStr)) {
            const parts = dateStr.split(/[-/]/);
            parsed = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const parts = dateStr.split('/');
            parsed = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          } else {
            parsed = new Date(dateStr);
          }
          if (parsed && !isNaN(parsed.getTime())) {
            txDate = parsed;
          }
        }

        // 4. Determine condition from status
        const statusLower = status.toLowerCase();
        let condition = 'GOOD';
        if (statusLower === 'installed') condition = 'INSTALLED';
        else if (statusLower === 'damaged') condition = 'DAMAGED';
        else if (statusLower === 'repair') condition = 'REPAIR';

        // 4b. Check for duplicate opening balance (same item+store+FY already has OB)
        const existingOB = await prisma.ledgerEntry.findFirst({
          where: {
            companyId,
            financialYearId,
            itemId: item.id,
            storeId: store.id,
            movementType: 'OPENING_BALANCE',
          },
        });
        if (existingOB) {
          skipped++;
          errors.push(`Row: "${itemName || itemCode}" already has opening balance in "${storeName}" — skipped (use Undo to re-import)`);
          continue;
        }

        // 5. Create opening balance through TransactionEngine
        const txInput = {
          companyId,
          financialYearId,
          movementType: 'OB' as const,
          transactionDate: txDate,
          toStoreId: store.id,
          purpose: `Opening balance import for ${fy.label}`,
          remarks: remarks || `Import: ${status} | ${storeName}${roomLocation ? ' / ' + roomLocation : ''}`,
          createdBy: createdByUser,
          items: [{
            itemId: item.id,
            quantity: qty,
            rate,
            condition,
            remarks: 'Opening balance',
          }],
        };

        await txEngine.createMovement(txInput);

        // 6. If installed status, create AssetInstallation record
        if (statusLower === 'installed' && roomLocation) {
          const location = await prisma.location.findFirst({
            where: { name: roomLocation, storeId: store.id, isActive: true },
          });
          if (!location) {
            skipped++;
            errors.push(`Location "${roomLocation}" not found in store "${storeName}"`);
            continue;
          }

          // Find or create room under this location
          let room = await prisma.room.findFirst({
            where: { locationId: location.id, name: roomLocation },
          });
          if (!room) {
            room = await prisma.room.create({
              data: {
                locationId: location.id,
                name: roomLocation,
                isActive: true,
              },
            });
          }

          // Check for existing installation
          const existingInstall = await prisma.assetInstallation.findFirst({
            where: { itemId: item.id, roomId: room.id, storeId: store.id, status: 'ACTIVE' },
          });

          if (existingInstall) {
            await prisma.assetInstallation.update({
              where: { id: existingInstall.id },
              data: { quantity: { increment: qty } },
            });
          } else {
            await prisma.assetInstallation.create({
              data: {
                itemId: item.id,
                roomId: room.id,
                storeId: store.id,
                installedDate: txDate,
                quantity: qty,
                installedBy: 'System',
                status: 'ACTIVE',
                remarks: `Opening installed asset import`,
              },
            });
          }
        }

        imported++;
      } catch (err: any) {
        skipped++;
        errors.push(err.message);
      }
    }

    if (imported > 0) {
      await auditLog('IMPORT', 'LedgerEntry', undefined, `Bulk imported opening stock: ${imported} records via TransactionEngine`);
    }

    return { imported, skipped, total: rows.length, errors: errors.slice(0, 20) };
  });

  // ==================== UNDO OPENING STOCK IMPORT ====================
  // Removes opening balance transactions created by bulk import.

  ipcMain.handle('stock:opening-stock:undoImport', async (_event, data: {
    companyId: number;
    financialYearId: number;
    storeId?: number;
    minutes?: number;
  }) => {
    requireAuth();
    const { companyId, financialYearId, storeId, minutes } = data;

    if (!storeId && !minutes) {
      throw new Error('Provide storeId (undo by store) or minutes (undo by time window)');
    }

    // Find OB transactions matching the criteria
    const whereClause: any = {
      companyId,
      financialYearId,
      voucherType: 'OB',
      createdBy: 'System',
    };

    if (minutes) {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      whereClause.createdAt = { gte: cutoff };
    }
    if (storeId) {
      whereClause.toStoreId = storeId;
    }

    const txHeaders = await prisma.transactionHeader.findMany({
      where: whereClause,
      select: { id: true, voucherNo: true },
    });

    if (txHeaders.length === 0) {
      throw new Error('No opening balance import transactions found to undo');
    }

    const headerIds = txHeaders.map(h => h.id);

    // Delete ledger entries, transaction details, and headers
    const deleted = await prisma.$transaction(async (tx) => {
      const delLedger = await tx.ledgerEntry.deleteMany({ where: { transactionId: { in: headerIds } } });
      const delDetails = await tx.transactionDetail.deleteMany({ where: { transactionId: { in: headerIds } } });
      const delHeaders = await tx.transactionHeader.deleteMany({ where: { id: { in: headerIds } } });
      return { count: delHeaders.count };
    });

    await auditLog('DELETE', 'TransactionHeader', undefined, `Undid opening stock import: ${deleted.count} transactions`);

    return { deleted: deleted.count, message: `Deleted ${deleted.count} opening balance transactions` };
  });

  // ==================== OPENING INSTALLED ASSET IMPORT ====================
  // Imports historical installed assets. Creates AssetInstallation records.
  // Stock is store-level — installed assets are tracked via AssetInstallation, not ledger.

  ipcMain.handle('stock:opening-installed-asset:import', async (_event, data: {
    companyId: number;
    financialYearId: number;
    rows: Array<{
      storeName?: string;
      locationName?: string;
      itemCode?: string;
      itemName?: string;
      assetNumber?: string;
      serialNumber?: string;
      quantity?: number;
      installationDate?: string;
      status?: string;
      remarks?: string;
    }>;
  }) => {
    const { companyId, financialYearId, rows } = data;
    requireAuth();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const safeStr = (val: any): string => {
          if (val === null || val === undefined) return '';
          if (val instanceof Date) return val.toISOString().split('T')[0];
          return String(val).trim();
        };

        const storeName = safeStr(row.storeName);
        const locationName = safeStr(row.locationName);
        const itemCode = safeStr(row.itemCode);
        const itemName = safeStr(row.itemName);
        const assetNumber = safeStr(row.assetNumber);
        const serialNumber = safeStr(row.serialNumber);
        const qty = Number(row.quantity || 1);
        const status = safeStr(row.status) || 'ACTIVE';
        const remarks = safeStr(row.remarks);

        if (!storeName) {
          skipped++;
          errors.push(`Row: Store name is required`);
          continue;
        }

        // Resolve store
        const store = await prisma.store.findFirst({
          where: { companyId, name: storeName, isActive: true },
        });
        if (!store) {
          skipped++;
          errors.push(`Store "${storeName}" not found`);
          continue;
        }

        // Resolve item
        let item = null;
        if (itemCode) {
          item = await prisma.item.findFirst({ where: { itemCode } });
        }
        if (!item && itemName) {
          item = await prisma.item.findFirst({ where: { itemName } });
        }
        if (!item) {
          skipped++;
          errors.push(`Item "${itemCode || itemName}" not found`);
          continue;
        }

        // Resolve location/room
        let roomId: number | undefined;
        if (locationName) {
          const location = await prisma.location.findFirst({
            where: { name: locationName, storeId: store.id, isActive: true },
          });
          if (!location) {
            skipped++;
            errors.push(`Location "${locationName}" not found in store "${storeName}"`);
            continue;
          }

          let room = await prisma.room.findFirst({
            where: { locationId: location.id, name: locationName },
          });
          if (!room) {
            room = await prisma.room.create({
              data: { locationId: location.id, name: locationName, isActive: true },
            });
          }
          roomId = room.id;
        }

        if (!roomId) {
          skipped++;
          errors.push(`Location/Room is required for installed assets`);
          continue;
        }

        // Parse installation date
        let installDate = new Date();
        if (row.installationDate) {
          const parsed = new Date(row.installationDate);
          if (!isNaN(parsed.getTime())) installDate = parsed;
        }

        // Check for duplicate asset number
        if (assetNumber) {
          const existing = await prisma.assetProfile.findFirst({
            where: { assetCode: assetNumber },
          });
          if (existing) {
            skipped++;
            errors.push(`Asset number "${assetNumber}" already exists`);
            continue;
          }
        }

        // Create or update AssetInstallation
        const existingInstall = await prisma.assetInstallation.findFirst({
          where: { itemId: item.id, roomId, storeId: store.id, status: 'ACTIVE' },
        });

        if (existingInstall) {
          await prisma.assetInstallation.update({
            where: { id: existingInstall.id },
            data: { quantity: { increment: qty } },
          });
        } else {
          await prisma.assetInstallation.create({
            data: {
              itemId: item.id,
              roomId,
              storeId: store.id,
              installedDate: installDate,
              quantity: qty,
              installedBy: 'System',
              status: 'ACTIVE',
              remarks: remarks || `Opening installed asset import`,
            },
          });
        }

        // Create AssetProfile if asset number provided
        if (assetNumber) {
          await prisma.assetProfile.create({
            data: {
              assetCode: assetNumber,
              assetName: itemName || item.itemName,
              itemId: item.id,
              companyId,
              serialNumber: serialNumber || null,
              currentStoreId: store.id,
              currentRoomId: roomId,
              status: 'INSTALLED',
              condition: 'GOOD',
              installationDate: installDate,
              remarks: remarks || `Opening installed asset`,
            },
          });
        }

        imported++;
      } catch (err: any) {
        skipped++;
        errors.push(err.message);
      }
    }

    if (imported > 0) {
      await auditLog('IMPORT', 'AssetInstallation', undefined, `Imported ${imported} opening installed assets`);
    }

    return { imported, skipped, total: rows.length, errors: errors.slice(0, 20) };
  });

  // ==================== OPENING DAMAGE IMPORT ====================
  // Imports historical damaged stock. Creates DAMAGE_OUT transactions via TransactionEngine.

  ipcMain.handle('stock:opening-damage:import', async (_event, data: {
    companyId: number;
    financialYearId: number;
    rows: Array<{
      storeName?: string;
      itemCode?: string;
      itemName?: string;
      quantity?: number;
      rate?: number;
      sourceType?: string;
      remarks?: string;
    }>;
  }) => {
    const { companyId, financialYearId, rows } = data;
    requireAuth();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const fy = await prisma.financialYear.findUnique({ where: { id: financialYearId } });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Cannot import to closed financial year');

    for (const row of rows) {
      try {
        const safeStr = (val: any): string => {
          if (val === null || val === undefined) return '';
          return String(val).trim();
        };

        const storeName = safeStr(row.storeName);
        const itemCode = safeStr(row.itemCode);
        const itemName = safeStr(row.itemName);
        const qty = Number(row.quantity || 0);
        const rate = Number(row.rate || 0);
        const sourceType = safeStr(row.sourceType) || 'HISTORICAL';
        const remarks = safeStr(row.remarks);

        if (!qty || qty <= 0) {
          skipped++;
          errors.push(`Row: Invalid quantity`);
          continue;
        }

        if (!storeName) {
          skipped++;
          errors.push(`Row: Store name is required`);
          continue;
        }

        // Resolve store
        const store = await prisma.store.findFirst({
          where: { companyId, name: storeName, isActive: true },
        });
        if (!store) {
          skipped++;
          errors.push(`Store "${storeName}" not found`);
          continue;
        }

        // Resolve item
        let item = null;
        if (itemCode) {
          item = await prisma.item.findFirst({ where: { itemCode } });
        }
        if (!item && itemName) {
          item = await prisma.item.findFirst({ where: { itemName } });
        }
        if (!item) {
          skipped++;
          errors.push(`Item "${itemCode || itemName}" not found`);
          continue;
        }

        // Create damage entry through TransactionEngine
        const txInput = {
          companyId,
          financialYearId,
          movementType: 'DM' as const,
          transactionDate: fy.startDate,
          fromStoreId: store.id,
          purpose: `Opening damage stock (${sourceType})`,
          remarks: remarks || `Historical damaged stock before system implementation`,
          createdBy: 'System',
          items: [{
            itemId: item.id,
            quantity: qty,
            rate,
            condition: 'DAMAGED' as const,
            remarks: `Opening damage: ${sourceType}`,
          }],
        };

        await txEngine.createMovement(txInput);

        imported++;
      } catch (err: any) {
        skipped++;
        errors.push(err.message);
      }
    }

    if (imported > 0) {
      await auditLog('IMPORT', 'LedgerEntry', undefined, `Imported ${imported} opening damage records`);
    }

    return { imported, skipped, total: rows.length, errors: errors.slice(0, 20) };
  });

  // ==================== OPENING STOCK TEMPLATE ====================

  ipcMain.handle('stock:opening-stock:generateTemplate', async (_event, type?: string) => {
    requireAuth();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mahaveerji Inventory';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Opening Stock');

    const allStores = await prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, storeType: true },
    });

    const allUnits = await prisma.unit.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, symbol: true },
    });

    // Template with all columns
    ws.addRow(['=== MAHAVEERJI INVENTORY - OPENING STOCK IMPORT ===']);
    ws.addRow([]);
    ws.addRow(['=== INSTRUCTIONS ===']);
    ws.addRow(['1. Fill data below starting from the DATA ROW']);
    ws.addRow(['2. Store Name: Write exact store name (must exist in Store Master)']);
    ws.addRow(['3. Item Code: Write existing item code (items must exist in Item Master)']);
    ws.addRow(['4. Qty: Opening stock quantity']);
    ws.addRow(['5. Rate: Purchase rate per unit']);
    ws.addRow(['6. Date: YYYY-MM-DD format (default: financial year start date)']);
    ws.addRow(['7. Status: Available / Installed / Damaged / Repair']);
    ws.addRow([]);
    ws.addRow(['=== AVAILABLE STORES (copy exactly) ===']);
    for (const s of allStores) ws.addRow([`   ${s.name} (${s.storeType})`]);
    ws.addRow([]);
    ws.addRow(['=== AVAILABLE UNITS (copy exactly) ===']);
    for (const u of allUnits) ws.addRow([`   ${u.name}${u.symbol ? ' (' + u.symbol + ')' : ''}`]);
    ws.addRow([]);
    ws.addRow(['=== COLUMN HEADERS (DO NOT MODIFY) ===']);

    const headers = [
      'Store Name',
      'Item Code',
      'Item Name',
      'Unit',
      'Qty',
      'Rate',
      'Date',
      'Status',
      'Remarks',
    ];
    ws.addRow(headers);

    // Style header row
    const headerRowNum = ws.rowCount;
    ws.getRow(headerRowNum).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(headerRowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };

    // Add sample rows using actual data
    const sampleStore = allStores.find(s => s.storeType === 'MAIN_STORE') || allStores[0];
    const sampleUnit = allUnits.find(u => u.name === 'Pcs') || allUnits[0];
    const sampleItem = await prisma.item.findFirst({ where: { isActive: true } });

    if (sampleStore && sampleUnit) {
      ws.addRow([
        sampleStore.name,
        sampleItem?.itemCode || 'ITM-001',
        sampleItem?.itemName || 'Sample Item',
        sampleUnit.name,
        100,
        250,
        '2026-04-01',
        'Available',
        'Opening stock from last year',
      ]);
    }

    // Style
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.getColumn(1).width = 25;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 25;
    ws.getColumn(4).width = 10;
    ws.getColumn(5).width = 8;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 12;
    ws.getColumn(8).width = 12;
    ws.getColumn(9).width = 30;

    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  });

  // ==================== IMPORT HISTORY ====================

  ipcMain.handle('import-history:list', async (_event, companyId: number) => {
    requireAuth();
    const rows = await prisma.importHistory.findMany({
      where: { companyId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });
    return serialize(rows);
  });

  ipcMain.handle('import-history:create', async (_event, data: {
    fileName: string;
    importType: string;
    level?: string;
    departmentId?: number;
    departmentName?: string;
    rowCount: number;
    importedCount: number;
    companyId: number;
    financialYearId: number;
  }) => {
    requireAuth();
    const created = await prisma.importHistory.create({ data });
    await auditLog('CREATE', 'ImportHistory', created.id, `Created import history: ${data.fileName}`);
    return serialize(created);
  });

  ipcMain.handle('import-history:delete', async (_event, data: {
    id: number;
    companyId: number;
    financialYearId: number;
  }) => {
    requireAuth();
    const { id, companyId, financialYearId } = data;

    const history = await prisma.importHistory.findUnique({ where: { id } });
    if (!history) throw new Error('Import history not found');
    if (history.status === 'deleted') throw new Error('Already deleted');

    // Find related OB transactions created by import
    const importTime = history.createdAt;
    const timeWindow = 5 * 60 * 1000; // 5 minutes window

    const txHeaders = await prisma.transactionHeader.findMany({
      where: {
        companyId,
        financialYearId,
        voucherType: 'OB',
        createdAt: {
          gte: new Date(importTime.getTime() - timeWindow),
          lte: new Date(importTime.getTime() + timeWindow),
        },
      },
      select: { id: true },
    });

    const headerIds = txHeaders.map(h => h.id);

    if (headerIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.ledgerEntry.deleteMany({ where: { transactionId: { in: headerIds } } });
        await tx.transactionDetail.deleteMany({ where: { transactionId: { in: headerIds } } });
        await tx.transactionHeader.deleteMany({ where: { id: { in: headerIds } } });
      });
    }

    // Mark import history as deleted
    await prisma.importHistory.update({
      where: { id },
      data: { status: 'deleted' },
    });

    await auditLog('DELETE', 'ImportHistory', id, `Deleted import history: ${history.fileName}`);

    return { deleted: headerIds.length, message: `Deleted ${headerIds.length} transactions for "${history.fileName}"` };
  });

  // Stock Formula Validation
  ipcMain.handle('stock:validateFormula', async (_event, companyId: number, financialYearId: number, itemId: number, departmentId?: number | null, locationId?: number | null) => {
    requireAuth();
    const { StockValidationFormulaService } = await import('../../src/main/services/stockFormulaValidation.service');
    const service = new StockValidationFormulaService(prisma);
    return service.validateItemStock(companyId, financialYearId, itemId, departmentId || null, locationId || null);
  });

  ipcMain.handle('stock:validateAll', async (_event, companyId: number, financialYearId: number) => {
    requireAuth();
    const { StockValidationFormulaService } = await import('../../src/main/services/stockFormulaValidation.service');
    const service = new StockValidationFormulaService(prisma);
    return service.validateAllStock(companyId, financialYearId);
  });

  ipcMain.handle('stock:getItemSummary', async (_event, companyId: number, financialYearId: number, itemId: number) => {
    requireAuth();
    const { StockValidationFormulaService } = await import('../../src/main/services/stockFormulaValidation.service');
    const service = new StockValidationFormulaService(prisma);
    return service.getItemStockSummary(companyId, financialYearId, itemId);
  });
}
