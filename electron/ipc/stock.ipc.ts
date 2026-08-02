import { ipcMain } from 'electron';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { getLatestBalance, recalculateBalancesAfterInsert, recalculateBalancesAfterDelete } from '../../src/main/services/stockValidation.service';
import { requireAuth } from './helpers';
import ExcelJS from 'exceljs';

export function registerStockIpc() {
  const prisma = getPrismaClient();

  // FIX: Drill-down for Issued qty — shows where items went (by department/location)
  ipcMain.handle('stock:getIssueBreakdown', async (_event, companyId: number, financialYearId: number, itemId: number) => {
    requireAuth();
    // Get all ISSUE-type transactions for this item with department + location info
    const transactions = await prisma.stockTransaction.findMany({
      where: {
        companyId,
        financialYearId,
        itemId,
        transactionType: 'ISSUE',
      },
      include: {
        department: true,
        location: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    // Group by department + location
    const breakdown: Record<string, any> = {};
    for (const txn of transactions) {
      const deptName = txn.department?.name || 'Unknown Department';
      const locName = txn.location
        ? `${txn.location.locationType} - ${txn.location.locationName}`
        : 'Unknown Location';
      const key = `${txn.departmentId || 'none'}-${txn.locationId || 'none'}`;

      if (!breakdown[key]) {
        breakdown[key] = {
          departmentId: txn.departmentId,
          departmentName: deptName,
          locationId: txn.locationId,
          locationName: locName,
          totalQty: 0,
          transactions: [],
        };
      }
      breakdown[key].totalQty += Number(txn.quantityOut || 0);
      breakdown[key].transactions.push({
        id: txn.id,
        date: txn.transactionDate,
        quantity: Number(txn.quantityOut || 0),
        challanNo: txn.referenceNo,
        balanceAfter: Number(txn.balanceQty || 0),
        remarks: txn.remarks,
      });
    }

    return Object.values(breakdown).sort((a: any, b: any) => b.totalQty - a.totalQty);
  });

  // ==================== ROOM-TO-ROOM SHIFT ====================

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
  }) => {
    const { companyId, financialYearId, dharamshalaId, fromRoomId, toRoomId, itemId, quantity, rate, date, createdBy, remarks } = data;
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

    if (!dharamshala || !dharamshala.isActive || dharamshala.departmentType !== 'Dharamshala') {
      throw new Error(`Department #${dharamshalaId} is not a valid active Dharamshala`);
    }
    if (!fromRoom || fromRoom.locationType !== 'Room' || !fromRoom.parentId) {
      throw new Error(`Location #${fromRoomId} is not a valid Room`);
    }
    if (!toRoom || toRoom.locationType !== 'Room' || !toRoom.parentId) {
      throw new Error(`Location #${toRoomId} is not a valid Room`);
    }
    if (!item || !item.isActive) throw new Error(`Item #${itemId} not found or inactive`);

    const qty = Number(quantity);
    const itemRate = Number(rate) || 0;
    const txDate = new Date(date);
    const refTransferId = `SHIFT-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      // --- Validate sufficient stock at source room ---
      const srcBalance = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, fromRoomId);
      if (qty > srcBalance) {
        throw new Error(`Insufficient stock in source room: ${item.itemName} has ${srcBalance}, requested ${qty}`);
      }

      const stockTransactions: any[] = [];

      // ROW 1: Source Room — TRANSFER_OUT
      const srcNewBal = srcBalance - qty;
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: dharamshalaId, locationId: fromRoomId,
        transactionType: 'TRANSFER_OUT', transactionDate: txDate,
        quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(qty),
        rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(srcNewBal),
        refTransferId, condition: 'GOOD',
        referenceType: 'RoomShift', referenceId: null, referenceNo: refTransferId,
        remarks: remarks || `Room shift: ${fromRoom.locationName} → ${toRoom.locationName}`,
        createdBy,
      });

      // ROW 2: Destination Room — TRANSFER_IN
      const dstBalance = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, toRoomId);
      const dstNewBal = dstBalance + qty;
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: dharamshalaId, locationId: toRoomId,
        transactionType: 'TRANSFER_IN', transactionDate: txDate,
        quantityIn: new Prisma.Decimal(qty), quantityOut: new Prisma.Decimal(0),
        rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(dstNewBal),
        refTransferId, condition: 'GOOD',
        referenceType: 'RoomShift', referenceId: null, referenceNo: refTransferId,
        remarks: remarks || `Room shift: ${fromRoom.locationName} → ${toRoom.locationName}`,
        createdBy,
      });

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // --- Update AssetInstallation: move from source to dest room ---
      const srcInstall = await tx.assetInstallation.findFirst({
        where: { itemId, locationId: fromRoomId, status: 'Active' },
      });
      if (srcInstall) {
        if (Number(srcInstall.quantity) <= qty) {
          // Full move — repoint to destination
          await tx.assetInstallation.update({
            where: { id: srcInstall.id },
            data: { locationId: toRoomId, remarks: `Moved via shift ${refTransferId}` },
          });
        } else {
          // Partial move — reduce source, create/update dest
          await tx.assetInstallation.update({
            where: { id: srcInstall.id },
            data: { quantity: new Prisma.Decimal(Number(srcInstall.quantity) - qty) },
          });
          const dstInstall = await tx.assetInstallation.findFirst({
            where: { itemId, locationId: toRoomId, status: 'Active' },
          });
          if (dstInstall) {
            await tx.assetInstallation.update({
              where: { id: dstInstall.id },
              data: { quantity: { increment: qty } },
            });
          } else {
            await tx.assetInstallation.create({
              data: {
                itemId, locationId: toRoomId, issueChallanId: null,
                installedDate: txDate, quantity: new Prisma.Decimal(qty),
                installedBy: createdBy, status: 'Active',
                remarks: `Shifted from ${fromRoom.locationName} via ${refTransferId}`,
              },
            });
          }
        }
      }

      // --- Recalculate balances if backdated ---
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, dharamshalaId, fromRoomId, txDate);
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, dharamshalaId, toRoomId, txDate);

      await tx.auditLog.create({
        data: {
          companyId, action: 'CREATE', tableName: 'StockTransaction', recordId: null,
          description: `Room shift: ${item.itemName} × ${qty} from ${fromRoom.locationName} to ${toRoom.locationName}`,
          newValues: JSON.stringify({ refTransferId, fromRoomId, toRoomId, itemId, quantity: qty }),
        },
      });

      return { success: true, transactionCount: stockTransactions.length, refTransferId };
    });

    return JSON.parse(JSON.stringify(result));
  });

  // ==================== RETURN TO STORE ====================

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
      prisma.department.findUnique({ where: { id: targetStoreId } }),
      prisma.item.findUnique({ where: { id: itemId } }),
    ]);

    if (!dharamshala || !dharamshala.isActive || dharamshala.departmentType !== 'Dharamshala') {
      throw new Error(`Department #${dharamshalaId} is not a valid active Dharamshala`);
    }
    if (!store || !store.isActive || store.departmentType !== 'Store') {
      throw new Error(`Department #${targetStoreId} is not a valid active Store`);
    }
    if (!item || !item.isActive) throw new Error(`Item #${itemId} not found or inactive`);

    if (fromRoomId) {
      const room = await prisma.location.findUnique({ where: { id: fromRoomId } });
      if (!room || room.locationType !== 'Room') throw new Error(`Location #${fromRoomId} is not a valid Room`);
    }

    const qty = Number(quantity);
    const itemRate = Number(rate) || 0;
    const txDate = new Date(date);
    const refTransferId = `RET-${Date.now()}`;
    const sourceDeptId = dharamshalaId;

    const result = await prisma.$transaction(async (tx) => {
      // --- Validate sufficient stock at source ---
      const srcBalance = await getLatestBalance(tx, companyId, financialYearId, itemId, sourceDeptId, fromRoomId || null);
      if (qty > srcBalance) {
        const srcName = fromRoomId ? `room #${fromRoomId}` : 'dharamshala pool';
        throw new Error(`Insufficient stock at ${srcName}: ${item.itemName} has ${srcBalance}, requested ${qty}`);
      }

      const stockTransactions: any[] = [];

      if (fromRoomId) {
        // FROM ROOM: 4-row chain (Room → Pool → Store)

        // ROW 1: Room — RETURN_OUT (stock leaves room)
        const roomBal = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, fromRoomId);
        stockTransactions.push({
          companyId, financialYearId, itemId,
          departmentId: dharamshalaId, locationId: fromRoomId,
          transactionType: 'RETURN_OUT', transactionDate: txDate,
          quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(qty),
          rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(roomBal - qty),
          refTransferId, condition: 'GOOD',
          referenceType: 'ReturnToStore', referenceId: null, referenceNo: refTransferId,
          remarks: remarks || `Return from room to store`, createdBy,
        });

        // ROW 2: Pool — RETURN_IN (stock transits through pool)
        const poolBal = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, null);
        stockTransactions.push({
          companyId, financialYearId, itemId,
          departmentId: dharamshalaId, locationId: null,
          transactionType: 'RETURN_IN', transactionDate: txDate,
          quantityIn: new Prisma.Decimal(qty), quantityOut: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(poolBal + qty),
          refTransferId, condition: 'GOOD',
          referenceType: 'ReturnToStore', referenceId: null, referenceNo: refTransferId,
          remarks: remarks || `Return transit through dharamshala pool`, createdBy,
        });

        // ROW 3: Pool — RETURN_OUT (stock leaves pool towards store)
        const poolBal2 = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, null);
        stockTransactions.push({
          companyId, financialYearId, itemId,
          departmentId: dharamshalaId, locationId: null,
          transactionType: 'RETURN_OUT', transactionDate: txDate,
          quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(qty),
          rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(poolBal2 - qty),
          refTransferId, condition: 'GOOD',
          referenceType: 'ReturnToStore', referenceId: null, referenceNo: refTransferId,
          remarks: remarks || `Return from dharamshala to store`, createdBy,
        });
      } else {
        // FROM DHARAMSHALA POOL: 2-row chain (Pool → Store)

        // ROW 1: Pool — RETURN_OUT (stock leaves pool)
        const poolBal = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, null);
        stockTransactions.push({
          companyId, financialYearId, itemId,
          departmentId: dharamshalaId, locationId: null,
          transactionType: 'RETURN_OUT', transactionDate: txDate,
          quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(qty),
          rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(poolBal - qty),
          refTransferId, condition: 'GOOD',
          referenceType: 'ReturnToStore', referenceId: null, referenceNo: refTransferId,
          remarks: remarks || `Return from dharamshala pool to store`, createdBy,
        });
      }

      // ROW (final): Store — RETURN_IN (stock arrives at store)
      const storeBal = await getLatestBalance(tx, companyId, financialYearId, itemId, targetStoreId, null);
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: targetStoreId, locationId: null,
        transactionType: 'RETURN_IN', transactionDate: txDate,
        quantityIn: new Prisma.Decimal(qty), quantityOut: new Prisma.Decimal(0),
        rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(storeBal + qty),
        refTransferId, condition: 'GOOD',
        referenceType: 'ReturnToStore', referenceId: null, referenceNo: refTransferId,
        remarks: remarks || `Return received at store`, createdBy,
      });

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // --- Deactivate/reduce AssetInstallation if returning from room ---
      if (fromRoomId) {
        const srcInstall = await tx.assetInstallation.findFirst({
          where: { itemId, locationId: fromRoomId, status: 'Active' },
        });
        if (srcInstall) {
          if (Number(srcInstall.quantity) <= qty) {
            await tx.assetInstallation.update({
              where: { id: srcInstall.id },
              data: { status: 'Inactive', remarks: `Returned to store via ${refTransferId}` },
            });
          } else {
            await tx.assetInstallation.update({
              where: { id: srcInstall.id },
              data: { quantity: new Prisma.Decimal(Number(srcInstall.quantity) - qty) },
            });
          }
        }
      }

      // --- Recalculate balances if backdated ---
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, dharamshalaId, fromRoomId || null, txDate);
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, dharamshalaId, null, txDate);
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, targetStoreId, null, txDate);

      await tx.auditLog.create({
        data: {
          companyId, action: 'CREATE', tableName: 'StockTransaction', recordId: null,
          description: `Return to store: ${item.itemName} × ${qty} from ${dharamshala.name}${fromRoomId ? `/room#${fromRoomId}` : ''} to ${store.name}`,
          newValues: JSON.stringify({ refTransferId, dharamshalaId, targetStoreId, fromRoomId, itemId, quantity: qty }),
        },
      });

      return { success: true, transactionCount: stockTransactions.length, refTransferId };
    });

    return JSON.parse(JSON.stringify(result));
  });

  // ==================== BULK OPENING STOCK IMPORT ====================

  ipcMain.handle('stock:opening-stock:bulk-import', async (_event, data: {
    companyId: number;
    financialYearId: number;
    rows: Array<{
      dharamshalaDept?: string;
      roomLocation?: string;
      category?: string;
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
    const prismaTx = prisma;
    requireAuth();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        // Trim all string fields (handle Date objects from Excel)
        const safeStr = (val: any): string => {
          if (val === null || val === undefined) return '';
          if (val instanceof Date) return val.toISOString().split('T')[0];
          return String(val).trim();
        };

        const dharamshalaDept = safeStr(row.dharamshalaDept);
        const roomLocation = safeStr(row.roomLocation);
        const categoryName = safeStr(row.category);
        const itemCode = safeStr(row.itemCode);
        const itemName = safeStr(row.itemName);
        const unitName = safeStr(row.unit);
        const qty = Number(row.quantity || 0);
        const rate = Number(row.rate || 0);
        const status = safeStr(row.status) || 'Available';
        const remarks = safeStr(row.remarks);
        const dateStr = safeStr(row.date);

        if (!qty || qty <= 0) {
          skipped++;
          errors.push(`Row: Invalid quantity`);
          continue;
        }

        // 1. Find or create Category
        let category = null;
        if (categoryName) {
          category = await prismaTx.itemCategory.findFirst({ where: { name: categoryName } });
          if (!category) {
            // Auto-create category
            const prefix = categoryName.substring(0, 2).toUpperCase();
            category = await prismaTx.itemCategory.create({
              data: { name: categoryName, prefix, isActive: true },
            });
          }
        }

        // 2. Find or create Unit
        let unit = null;
        if (unitName) {
          unit = await prismaTx.unit.findFirst({ where: { name: unitName } });
          if (!unit) {
            unit = await prismaTx.unit.create({ data: { name: unitName } });
          }
        }

        // 3. Find or create Item
        let item = null;
        if (itemCode) {
          item = await prismaTx.item.findFirst({ where: { itemCode } });
          // Update unit/rate if provided
          if (item && unit) {
            await prismaTx.item.update({ where: { id: item.id }, data: { unitId: unit.id } });
          }
        }
        if (!item && itemName) {
          // Try exact name
          item = await prismaTx.item.findFirst({ where: { itemName } });
        }
        if (!item && itemName) {
          // Try contains match
          item = await prismaTx.item.findFirst({ where: { itemName: { contains: itemName } } });
        }
        if (!item && itemCode) {
          // If code provided but not found, skip (don't auto-create without name)
          skipped++;
          errors.push(`Item "${itemCode}" not found in database`);
          continue;
        }
        if (!item) {
          // Auto-create item (need category and unit)
          if (!category || !unit) {
            skipped++;
            errors.push(`"${itemName || itemCode}" not found. Need Category + Unit to auto-create.`);
            continue;
          }
          // Generate itemCode
          const lastItem = await prismaTx.item.findFirst({
            where: { itemCode: { startsWith: category.prefix + '-' } },
            orderBy: { itemCode: 'desc' },
          });
          let nextNum = 1;
          if (lastItem) {
            const numPart = lastItem.itemCode.replace(category.prefix + '-', '');
            nextNum = parseInt(numPart, 10) + 1;
          }
          const newItemCode = `${category.prefix}-${String(nextNum).padStart(3, '0')}`;

          item = await prismaTx.item.create({
            data: {
              itemCode: newItemCode,
              itemName: itemName || newItemCode,
              categoryId: category.id,
              unitId: unit.id,
              minimumStockLevel: 0,
              isActive: true,
            },
          });
        }

        // 4. Find Location
        let departmentId: number | null = null;
        let locationId: number | null = null;

        // Try to find room/location
        if (roomLocation) {
          let location = await prismaTx.location.findFirst({
            where: { locationName: roomLocation, isActive: true },
          });
          if (!location) {
            location = await prismaTx.location.findFirst({
              where: { locationName: { contains: roomLocation }, isActive: true },
            });
          }
          if (location) {
            locationId = location.id;
            // Find parent department
            if (location.parentId) {
              const parent = await prismaTx.location.findUnique({ where: { id: location.parentId } });
              if (parent) {
                const dept = await prismaTx.department.findFirst({
                  where: { name: parent.locationName, isActive: true },
                });
                departmentId = dept?.id || null;
              }
            }

            // Validate: if dharamshalaDept is provided, check it matches
            if (dharamshalaDept && departmentId) {
              const expectedDept = await prismaTx.department.findFirst({
                where: { name: dharamshalaDept, isActive: true },
              });
              if (expectedDept && expectedDept.id !== departmentId) {
                // Room belongs to different department — skip with warning
                skipped++;
                errors.push(`"${roomLocation}" belongs to a different department than "${dharamshalaDept}"`);
                continue;
              }
            }
          } else {
            skipped++;
            errors.push(`Room/Location "${roomLocation}" not found`);
            continue;
          }
        }

        // If no room found, try department name
        if (!departmentId && dharamshalaDept) {
          const dept = await prismaTx.department.findFirst({
            where: { name: dharamshalaDept, isActive: true },
          });
          if (dept) {
            departmentId = dept.id;
          }
        }

        if (!departmentId && !locationId) {
          skipped++;
          errors.push(`Location "${dharamshalaDept}" / "${roomLocation}" not found`);
          continue;
        }

        // 5. Calculate cumulative balance at this location
        const isInstalled = status.toLowerCase() === 'installed';

        // Get existing balance at this (item, location) combination
        const existingTx = await prismaTx.stockTransaction.findFirst({
          where: {
            itemId: item.id,
            departmentId,
            locationId,
            companyId,
            financialYearId,
          },
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const existingBalance = existingTx ? Number(existingTx.balanceQty) : 0;
        const balanceQty = isInstalled ? 0 : existingBalance + qty;

        // 6. Parse date (handle YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY formats)
        let txDate = new Date();
        if (dateStr) {
          let parsed: Date | null = null;
          // Try YYYY-MM-DD first (ISO format)
          if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            parsed = new Date(dateStr);
          }
          // Try DD-MM-YYYY or DD/MM/YYYY
          else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateStr)) {
            const parts = dateStr.split(/[-/]/);
            parsed = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
          // Try MM/DD/YYYY (US format)
          else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const parts = dateStr.split('/');
            parsed = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          }
          else {
            parsed = new Date(dateStr);
          }

          if (parsed && !isNaN(parsed.getTime())) {
            txDate = parsed;
          }
        }

        // 7. Insert stock record
        await prismaTx.stockTransaction.create({
          data: {
            companyId,
            financialYearId,
            itemId: item.id,
            departmentId,
            locationId,
            transactionType: 'IMPORT',
            transactionDate: txDate,
            quantityIn: qty,
            quantityOut: 0,
            rate: rate,
            balanceQty: balanceQty,
            condition: 'GOOD',
            remarks: remarks || `Import: ${status} | ${dharamshalaDept}${roomLocation ? ' / ' + roomLocation : ''}`,
            createdBy: 'System',
          },
        });

        imported++;
      } catch (err: any) {
        skipped++;
        errors.push(err.message);
      }
    }

    // Recalculate balances for all affected items after import
    if (imported > 0) {
      try {
        // Find all items that were imported in this batch
        const importedItems = await prisma.stockTransaction.findMany({
          where: { companyId, financialYearId, transactionType: 'IMPORT', createdBy: 'System' },
          select: { itemId: true, departmentId: true, locationId: true },
          orderBy: { id: 'desc' },
          take: imported * 2, // approximate
        });
        const itemLocMap = new Map<string, { itemId: number; departmentId: number | null; locationId: number | null }>();
        for (const txn of importedItems) {
          const key = `${txn.itemId}-${txn.departmentId}-${txn.locationId}`;
          if (!itemLocMap.has(key)) {
            itemLocMap.set(key, { itemId: txn.itemId, departmentId: txn.departmentId, locationId: txn.locationId });
          }
        }
        const itemLocations = Array.from(itemLocMap.values());
        if (itemLocations.length > 0) {
          await recalculateBalancesAfterInsert(prisma, companyId, financialYearId, itemLocations);
        }
      } catch (recalcErr: any) {
        errors.push(`Balance recalculation warning: ${recalcErr.message}`);
      }
    }

    return { imported, skipped, total: rows.length, errors: errors.slice(0, 20) };
  });

  // ==================== UNDO OPENING STOCK IMPORT ====================

  ipcMain.handle('stock:opening-stock:undoImport', async (_event, data: {
    companyId: number;
    financialYearId: number;
    departmentId?: number; // undo by store/dharamshala
    minutes?: number;      // undo by time window (last N minutes)
  }) => {
    requireAuth();
    const { companyId, financialYearId, departmentId, minutes } = data;

    if (!departmentId && !minutes) {
      throw new Error('Provide departmentId (undo by store) or minutes (undo by time window)');
    }

    const whereClause: any = {
      companyId, financialYearId,
      transactionType: 'IMPORT',
    };

    if (minutes) {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      whereClause.createdAt = { gte: cutoff };
    }
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    const txns = await prisma.stockTransaction.findMany({
      where: whereClause,
      select: { id: true, itemId: true, departmentId: true, locationId: true, quantityIn: true, transactionDate: true },
    });

    if (txns.length === 0) {
      throw new Error('No import transactions found to undo');
    }

    // Delete and recalculate in transaction
    const deleted = await prisma.$transaction(async (tx) => {
      const del = await tx.stockTransaction.deleteMany({ where: whereClause });

      // Recalculate balances for all affected items
      const itemLocMap = new Map<string, { itemId: number; departmentId: number | null; locationId: number | null }>();
      for (const txn of txns) {
        const key = `${txn.itemId}-${txn.departmentId}-${txn.locationId}`;
        if (!itemLocMap.has(key)) {
          itemLocMap.set(key, { itemId: txn.itemId, departmentId: txn.departmentId, locationId: txn.locationId });
        }
      }
      const itemLocations = Array.from(itemLocMap.values());
      await recalculateBalancesAfterDelete(tx, companyId, financialYearId, itemLocations);

      return del;
    });

    // Delete related AssetInstallation records (room-level only)
    if (!minutes) {
      const roomTxns = txns.filter(t => t.locationId);
      for (const rt of roomTxns) {
        await prisma.assetInstallation.deleteMany({
          where: { itemId: rt.itemId, locationId: rt.locationId, status: 'Active' },
        });
      }
    }

    return { deleted: deleted.count, message: `Deleted ${deleted.count} import transactions and recalculated balances` };
  });

  // ==================== OPENING STOCK TEMPLATE ====================

  ipcMain.handle('stock:opening-stock:generateTemplate', async (_event, type?: string) => {
    requireAuth();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mahaveerji Inventory';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Opening Stock');

    // Get all data for reference
    const allLocations = await prisma.location.findMany({
      where: { isActive: true },
      orderBy: { locationName: 'asc' },
      select: { id: true, locationName: true, locationType: true, parentId: true },
    });

    const allCategories = await prisma.itemCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, prefix: true },
    });

    const allUnits = await prisma.unit.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, symbol: true },
    });

    // Build location list with hierarchy
    const locationList = allLocations.map(loc => {
      const parent = allLocations.find(p => p.id === loc.parentId);
      return `${loc.locationName} (${loc.locationType}${parent ? ' under ' + parent.locationName : ''})`;
    });

    // Template with all columns
    ws.addRow(['=== MAHAVEERJI INVENTORY - STOCK IMPORT ===']);
    ws.addRow([]);
    ws.addRow(['=== INSTRUCTIONS ===']);
    ws.addRow(['1. Fill data below starting from row 6']);
    ws.addRow(['2. Dharamshala/Department: Write exact name (e.g., इमारत स्टोर, चरण चिन्ह्)']);
    ws.addRow(['3. Room/Location: Write exact room name (e.g., Room 109 - A.C. ROOM 2 BED)']);
    ws.addRow(['4. Category: Write exact category name (e.g., बिजली स्टोर, इमारत स्टोर)']);
    ws.addRow(['5. Item Code: If empty, system auto-generates from Category prefix']);
    ws.addRow(['6. Unit: If available, write exact unit name (e.g., नग)']);
    ws.addRow(['7. Rate: If available, write purchase rate per unit']);
    ws.addRow(['8. Date: If available, write YYYY-MM-DD format']);
    ws.addRow(['9. Status: "Available" = in stock, "Installed" = fixed/consumed']);
    ws.addRow(['10. After import, you can update Unit and Rate anytime']);
    ws.addRow([]);
    ws.addRow(['=== AVAILABLE DHARAMSHALA/DEPARTMENTS (copy exactly) ===']);
    const depts = await prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    for (const d of depts) ws.addRow([`   ${d.name} (${d.departmentType})`]);
    ws.addRow([]);
    ws.addRow(['=== AVAILABLE CATEGORIES (copy exactly) ===']);
    for (const c of allCategories) ws.addRow([`   ${c.name} (prefix: ${c.prefix})`]);
    ws.addRow([]);
    ws.addRow(['=== AVAILABLE UNITS (copy exactly) ===']);
    for (const u of allUnits) ws.addRow([`   ${u.name}${u.symbol ? ' (' + u.symbol + ')' : ''}`]);
    ws.addRow([]);
    ws.addRow(['=== COLUMN HEADERS (DO NOT MODIFY) ===']);
    
    const headers = [
      'Dharamshala/Department',
      'Room/Location',
      'Category',
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
    const sampleDept = depts.find(d => d.departmentType === 'Store') || depts[0];
    const sampleRoom = allLocations.find(l => l.locationType === 'Room');
    const sampleCat = allCategories[0];
    const sampleUnit = allUnits.find(u => u.name === 'नग') || allUnits[0];
    const sampleItem = await prisma.item.findFirst({ where: { isActive: true } });

    if (sampleDept && sampleRoom && sampleCat && sampleUnit) {
      ws.addRow([
        sampleDept.name,
        sampleRoom.locationName,
        sampleCat.name,
        sampleItem?.itemCode || '',
        sampleItem?.itemName || 'New Item Example',
        sampleUnit.name,
        10,
        2500,
        '2026-07-06',
        'Available',
        'Physical verification',
      ]);
      ws.addRow([
        sampleDept.name,
        sampleRoom.locationName,
        sampleCat.name,
        '',
        'Another New Item',
        sampleUnit.name,
        5,
        0,
        '',
        'Installed',
        'Fixed in room',
      ]);
    }

    // Style
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 18;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 25;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 8;
    ws.getColumn(8).width = 10;
    ws.getColumn(9).width = 12;
    ws.getColumn(10).width = 12;
    ws.getColumn(11).width = 20;

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
    return prisma.importHistory.findMany({
      where: { companyId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });
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
    return prisma.importHistory.create({ data });
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

    // Delete related stock transactions (OPENING_STOCK, ISSUE, TRANSFER_OUT, TRANSFER_IN)
    // with remarks containing the filename or createdAt near the import time
    const importTime = history.createdAt;
    const timeWindow = 5 * 60 * 1000; // 5 minutes window

    const whereClause: any = {
      companyId,
      financialYearId,
      transactionType: { in: ['OPENING_STOCK', 'ISSUE', 'TRANSFER_OUT', 'TRANSFER_IN', 'IMPORT'] },
      createdAt: {
        gte: new Date(importTime.getTime() - timeWindow),
        lte: new Date(importTime.getTime() + timeWindow),
      },
    };

    if (history.departmentId) {
      whereClause.departmentId = history.departmentId;
    }

    // Find related transactions
    const txns = await prisma.stockTransaction.findMany({
      where: whereClause,
      select: { id: true, itemId: true, locationId: true },
    });

    // Delete AssetInstallation records for room-level imports
    if (history.level === 'room') {
      const roomTxns = txns.filter(t => t.locationId);
      for (const rt of roomTxns) {
        await prisma.assetInstallation.deleteMany({
          where: { itemId: rt.itemId, locationId: rt.locationId, status: 'Active' },
        });
      }
    }

    // Delete transactions
    const deleted = await prisma.stockTransaction.deleteMany({ where: whereClause });

    // Mark import history as deleted
    await prisma.importHistory.update({
      where: { id },
      data: { status: 'deleted', deletedAt: new Date() },
    });

    return { deleted: deleted.count, message: `Deleted ${deleted.count} transactions for "${history.fileName}"` };
  });
}
