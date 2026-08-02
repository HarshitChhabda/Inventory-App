import { ipcMain } from 'electron';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { recalculateBalancesAfterDelete, recalculateBalancesAfterInsert, getLatestBalance } from '../../src/main/services/stockValidation.service';
import { getSession, requirePermission, PERMISSION_KEYS } from '../../src/main/services/auth.service';
import { serialize, requireAuth } from './helpers';

export function registerChallanIpc() {
  const prisma = getPrismaClient();

  const DATE_KEYS = ['date', 'invoiceDate', 'postedAt', 'createdAt', 'updatedAt', 'transactionDate', 'financialYearStart', 'financialYearEnd'];
  function convertPayloadDates(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(convertPayloadDates);
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (DATE_KEYS.includes(k) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        out[k] = new Date(v);
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        out[k] = convertPayloadDates(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  ipcMain.handle('challan:receipt:list', async (_event, params) => {
    const { companyId, financialYearId, page, pageSize, search, status, vendorId, startDate, endDate } = params;
    const where: any = { companyId, financialYearId };
    if (search) {
      where.OR = [
        { challanNo: { contains: search } },
        { invoiceNumber: { contains: search } },
        { sourceName: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (startDate && endDate) where.date = { gte: new Date(startDate), lte: new Date(endDate) };

    const [data, total] = await Promise.all([
      prisma.receiptChallan.findMany({
        where,
        include: {
          vendor: true,
          items: { include: { item: true, unit: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
      prisma.receiptChallan.count({ where }),
    ]);

    return serialize({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  ipcMain.handle('challan:receipt:getById', async (_event, id: number) => {
    return serialize(await prisma.receiptChallan.findUnique({
      where: { id },
      include: {
        company: true,
        financialYear: true,
        vendor: true,
        items: {
          include: { item: { include: { category: true, unit: true } }, unit: true },
        },
      },
    }));
  });

  ipcMain.handle('challan:receipt:create', async (_event, data) => {
    requireAuth();
    data = convertPayloadDates(data);
    const sequence = await prisma.challanSequence.upsert({
      where: {
        companyId_financialYearId_challanType: {
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          challanType: 'RC',
        },
      },
      update: { lastNumber: { increment: 1 } },
      create: {
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        challanType: 'RC',
        lastNumber: 1,
      },
    });

    const challanNo = `RC-${String(sequence.lastNumber).padStart(5, '0')}`;

    return serialize(await prisma.receiptChallan.create({
      data: {
        challanNo,
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        date: new Date(data.date),
        sourceType: data.sourceType,
        vendorId: data.vendorId || null,
        sourceName: data.sourceName,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        vehicleNumber: data.vehicleNumber,
        receivedBy: data.receivedBy,
        departmentId: data.departmentId || null,
        remarks: data.remarks,
        items: {
          create: data.items.map((item: any) => ({
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            rate: item.rate || 0,
            amount: (item.quantity || 0) * (item.rate || 0),
            remarks: item.remarks,
          })),
        },
      },
      include: {
        vendor: true,
        items: { include: { item: true, unit: true } },
      },
    }));
  });

  ipcMain.handle('challan:receipt:update', async (_event, id: number, data: any) => {
    requireAuth();
    const existing = await prisma.receiptChallan.findUnique({ where: { id } });
    if (!existing) throw new Error('Receipt challan not found');
    if (existing.status !== 'Draft') throw new Error('Cannot edit a posted/cancelled challan');

    return serialize(await prisma.receiptChallan.update({
      where: { id },
      data: {
        date: new Date(data.date),
        sourceType: data.sourceType,
        vendorId: data.vendorId || null,
        sourceName: data.sourceName,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        vehicleNumber: data.vehicleNumber,
        receivedBy: data.receivedBy,
        departmentId: data.departmentId || null,
        remarks: data.remarks,
        items: {
          deleteMany: {},
          create: data.items.map((item: any) => ({
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            rate: item.rate || 0,
            amount: (item.quantity || 0) * (item.rate || 0),
            remarks: item.remarks,
          })),
        },
      },
      include: {
        vendor: true,
        items: { include: { item: true, unit: true } },
      },
    }));
  });

  ipcMain.handle('challan:receipt:post', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    const postedBy = session.fullName;
    const rc = await prisma.receiptChallan.findUnique({
      where: { id },
      include: { items: true, company: true },
    });
    if (!rc) throw new Error('Receipt challan not found');
    if (rc.status !== 'Draft') throw new Error('Challan is not in Draft status');

    const stockTransactions = await prisma.$transaction(async (tx) => {
      const balanceMap = new Map<string, number>();
      for (const item of rc.items) {
        const locationId = (item as any).locationId || null;
        const key = `${item.itemId}-${locationId ?? 'null'}`;
        if (!balanceMap.has(key)) {
          balanceMap.set(key, await getLatestBalance(tx, rc.companyId, rc.financialYearId, item.itemId, rc.departmentId || null, locationId));
        }
      }

      const txns = rc.items.map((item) => {
        const locationId = (item as any).locationId || null;
        const key = `${item.itemId}-${locationId ?? 'null'}`;
        const prevBalance = balanceMap.get(key) || 0;
        const newBalance = prevBalance + Number(item.quantity);
        balanceMap.set(key, newBalance);

        return {
          companyId: rc.companyId,
          financialYearId: rc.financialYearId,
          itemId: item.itemId,
          departmentId: rc.departmentId,
          locationId,
          transactionType: 'PURCHASE',
          transactionDate: rc.date,
          quantityIn: new Prisma.Decimal(item.quantity),
          quantityOut: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(item.rate),
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'ReceiptChallan',
          referenceId: id,
          referenceNo: rc.challanNo,
          remarks: `From ${rc.challanNo}`,
          createdBy: postedBy,
        };
      });

      await tx.stockTransaction.createMany({ data: txns });
      await tx.receiptChallan.update({
        where: { id },
        data: { status: 'Posted', postedAt: new Date(), postedBy },
      });
      await tx.auditLog.create({
        data: {
          companyId: rc.companyId,
          action: 'POST',
          tableName: 'ReceiptChallan',
          recordId: id,
          recordUuid: rc.uuid,
          description: `Receipt Challan ${rc.challanNo} posted with ${rc.items.length} items`,
          newValues: JSON.stringify({ status: 'Posted', postedAt: new Date() }),
        },
      });

      // Recalculate balances for backdated transactions
      const itemLocations = rc.items.map(item => ({
        itemId: item.itemId,
        departmentId: rc.departmentId || null,
        locationId: (item as any).locationId || null,
      }));
      await recalculateBalancesAfterInsert(tx, rc.companyId, rc.financialYearId, itemLocations);

      return txns;
    });

    return serialize(await prisma.receiptChallan.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: { include: { item: true, unit: true } },
      },
    }));
  });

  ipcMain.handle('challan:receipt:cancel', async (_event, id: number, cancelReason: string) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.CANCEL_CHALLAN);
    const cancelledBy = session.fullName;
    const rc = await prisma.receiptChallan.findUnique({ where: { id }, include: { items: true } });
    if (!rc) throw new Error('Receipt challan not found');
    if (rc.status !== 'Posted') throw new Error('Only posted challans can be cancelled');

    await prisma.$transaction(async (tx) => {
      // Downstream dependency check: items from this receipt may have been issued/transferred
      const downstreamChecks: Array<{ itemName: string; required: number; available: number }> = [];
      for (const item of rc.items) {
        // Check if stock at this location has been reduced below what we need to reverse
        const currentBalance = await getLatestBalance(tx, rc.companyId, rc.financialYearId, item.itemId, rc.departmentId || null, (item as any).locationId || null);
        const reversalQty = Number(item.quantity);
        // If balance is negative or less than reversal qty, stock has moved further
        if (currentBalance < reversalQty) {
          const itemDetail = await tx.item.findUnique({ where: { id: item.itemId } });
          downstreamChecks.push({ itemName: itemDetail?.itemName || 'Unknown', required: reversalQty, available: currentBalance });
        }
      }
      if (downstreamChecks.length > 0) {
        throw new Error(`Cannot cancel — stock moved further. ${downstreamChecks.map(d => `${d.itemName}: needs ${d.required}, only ${d.available} available`).join('; ')}`);
      }

      const reversalEntries: any[] = [];
      // Build cumulative balance map to avoid stale reads
      const balanceMap = new Map<string, number>();
      const getMapBalance = (itemId: number, deptId: number | null, locId: number | null) => {
        const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
        return balanceMap.get(key) || 0;
      };
      const setMapBalance = (itemId: number, deptId: number | null, locId: number | null, bal: number) => {
        const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
        balanceMap.set(key, bal);
      };
      // Seed map from DB
      for (const item of rc.items) {
        const locationId = (item as any).locationId || null;
        const b = await getLatestBalance(tx, rc.companyId, rc.financialYearId, item.itemId, rc.departmentId || null, locationId);
        setMapBalance(item.itemId, rc.departmentId, locationId, b);
      }

      for (let i = 0; i < rc.items.length; i++) {
        const item = rc.items[i];
        const locationId = (item as any).locationId || null;
        const currentBalance = getMapBalance(item.itemId, rc.departmentId, locationId);
        const reversalQty = Number(item.quantity);
        const newBalance = currentBalance - reversalQty;
        setMapBalance(item.itemId, rc.departmentId, locationId, newBalance);

        reversalEntries.push({
          companyId: rc.companyId,
          financialYearId: rc.financialYearId,
          itemId: item.itemId,
          departmentId: rc.departmentId,
          locationId,
          transactionType: 'REVERSAL',
          transactionDate: new Date(),
          quantityIn: new Prisma.Decimal(0),
          quantityOut: new Prisma.Decimal(reversalQty),
          rate: new Prisma.Decimal(item.rate),
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'ReceiptChallan',
          referenceId: id,
          referenceNo: rc.challanNo,
          remarks: `Reversal for cancelled ${rc.challanNo}`,
          createdBy: cancelledBy,
        });
      }

      if (reversalEntries.length > 0) {
        await tx.stockTransaction.createMany({ data: reversalEntries });
      }
      await tx.receiptChallan.update({
        where: { id },
        data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason },
      });
      await tx.auditLog.create({
        data: {
          companyId: rc.companyId,
          action: 'CANCEL',
          tableName: 'ReceiptChallan',
          recordId: id,
          recordUuid: rc.uuid,
          description: `Receipt Challan ${rc.challanNo} cancelled: ${cancelReason}`,
          oldValues: JSON.stringify({ status: 'Posted' }),
          newValues: JSON.stringify({ status: 'Cancelled', cancelReason }),
        },
      });
    });

    return serialize(await prisma.receiptChallan.findUnique({ where: { id } }));
  });

  // ==================== ISSUE CHALLAN ====================

  ipcMain.handle('challan:issue:list', async (_event, params) => {
    requireAuth();
    const { companyId, financialYearId, page, pageSize, search, status, departmentId, startDate, endDate } = params;
    const where: any = { companyId, financialYearId };
    if (search) {
      where.OR = [
        { challanNo: { contains: search } },
        { purpose: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (startDate && endDate) where.date = { gte: new Date(startDate), lte: new Date(endDate) };

    const [data, total] = await Promise.all([
      prisma.issueChallan.findMany({
        where,
        include: {
          department: true,
          items: { include: { item: true, unit: true, location: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
      prisma.issueChallan.count({ where }),
    ]);

    return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });

  ipcMain.handle('challan:issue:post', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    const postedBy = session.fullName;
    const ic = await prisma.issueChallan.findUnique({
      where: { id },
      include: { items: true, company: true, department: true, sourceStore: true },
    });
    if (!ic) throw new Error('Issue challan not found');
    if (ic.status !== 'Draft') throw new Error('Challan is not in Draft status');

    await prisma.$transaction(async (tx) => {
      // --- Validate sufficient stock at source store (aggregate per item) ---
      const balanceChecks: Array<{ itemName: string; requested: number; available: number }> = [];
      const qtyPerItem = new Map<number, number>();
      for (const item of ic.items) {
        qtyPerItem.set(item.itemId, (qtyPerItem.get(item.itemId) || 0) + Number(item.quantity));
      }
      for (const [itemId, totalRequested] of qtyPerItem) {
        const available = await getLatestBalance(tx, ic.companyId, ic.financialYearId, itemId, ic.sourceStoreId || null, null);
        if (totalRequested > available) {
          const itemDetail = await prisma.item.findUnique({ where: { id: itemId } });
          balanceChecks.push({ itemName: itemDetail?.itemName || 'Unknown', requested: totalRequested, available });
        }
      }
      if (balanceChecks.length > 0) {
        throw new Error(`Insufficient stock: ${balanceChecks.map((b) => `${b.itemName}: requested ${b.requested}, available ${b.available}`).join('; ')}`);
      }

      // --- Build balance maps (source store + destination dharamshala pool + room) ---
      const srcBalanceMap = new Map<string, number>();
      const poolBalanceMap = new Map<string, number>();
      const roomBalanceMap = new Map<string, number>();

      for (const item of ic.items) {
        const key = `${item.itemId}`;
        if (!srcBalanceMap.has(key)) {
          srcBalanceMap.set(key, await getLatestBalance(tx, ic.companyId, ic.financialYearId, item.itemId, ic.sourceStoreId || null, null));
        }
        if (!poolBalanceMap.has(key)) {
          poolBalanceMap.set(key, await getLatestBalance(tx, ic.companyId, ic.financialYearId, item.itemId, ic.departmentId, null));
        }
        if (item.locationId) {
          const rKey = `${item.itemId}-${item.locationId}`;
          if (!roomBalanceMap.has(rKey)) {
            roomBalanceMap.set(rKey, await getLatestBalance(tx, ic.companyId, ic.financialYearId, item.itemId, ic.departmentId, item.locationId));
          }
        }
      }

      // --- Create linked StockTransaction chain ---
      const stockTransactions: any[] = [];
      const refTransferId = `TRF-${ic.challanNo}`;

      for (const item of ic.items) {
        const itemRate = Number((item as any).rate) || 0;
        const qty = Number(item.quantity);
        const hasRoom = !!item.locationId;

        // ROW 1: Store — ISSUE OUT (stock leaves store)
        const srcKey = `${item.itemId}`;
        const srcPrev = srcBalanceMap.get(srcKey) || 0;
        const srcNew = srcPrev - qty;
        srcBalanceMap.set(srcKey, srcNew);
        stockTransactions.push({
          companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
          departmentId: ic.sourceStoreId || null, locationId: null,
          transactionType: 'ISSUE', transactionDate: ic.date,
          quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(qty),
          rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(srcNew),
          referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
          remarks: `${ic.challanNo} — store → dharamshala`, createdBy: postedBy,
        });

        if (hasRoom) {
          // ROW 2: Dharamshala pool — ISSUE IN (stock arrives at dharamshala)
          const poolKey = `${item.itemId}`;
          const poolPrev = poolBalanceMap.get(poolKey) || 0;
          const poolAfterIn = poolPrev + qty;
          poolBalanceMap.set(poolKey, poolAfterIn);
          stockTransactions.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: null,
            transactionType: 'ISSUE', transactionDate: ic.date,
            quantityIn: new Prisma.Decimal(qty), quantityOut: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(poolAfterIn),
            referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            refTransferId,
            remarks: `${ic.challanNo} — dharamshala pool received`, createdBy: postedBy,
          });

          // ROW 3: Dharamshala pool — TRANSFER_OUT (immediately allocated to room)
          const poolAfterOut = poolAfterIn - qty;
          poolBalanceMap.set(poolKey, poolAfterOut);
          stockTransactions.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: null,
            transactionType: 'TRANSFER_OUT', transactionDate: ic.date,
            quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(qty),
            rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(poolAfterOut),
            referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            refTransferId, condition: 'GOOD',
            remarks: `${ic.challanNo} — pool → room ${item.locationId}`, createdBy: postedBy,
          });

          // ROW 4: Room — TRANSFER_IN (stock arrives at room)
          const rKey = `${item.itemId}-${item.locationId}`;
          const roomPrev = roomBalanceMap.get(rKey) || 0;
          const roomNew = roomPrev + qty;
          roomBalanceMap.set(rKey, roomNew);
          stockTransactions.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: item.locationId,
            transactionType: 'TRANSFER_IN', transactionDate: ic.date,
            quantityIn: new Prisma.Decimal(qty), quantityOut: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(roomNew),
            referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            refTransferId, condition: 'GOOD',
            remarks: `${ic.challanNo} — received at room`, createdBy: postedBy,
          });
        } else {
          // No room specified — dharamshala-level only (2-row chain)
          const poolKey = `${item.itemId}`;
          const poolPrev = poolBalanceMap.get(poolKey) || 0;
          const poolNew = poolPrev + qty;
          poolBalanceMap.set(poolKey, poolNew);
          stockTransactions.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: null,
            transactionType: 'ISSUE', transactionDate: ic.date,
            quantityIn: new Prisma.Decimal(qty), quantityOut: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(itemRate), balanceQty: new Prisma.Decimal(poolNew),
            referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            remarks: `${ic.challanNo} — dharamshala pool received`, createdBy: postedBy,
          });
        }
      }

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // --- AssetInstallation: create/update for room-level items ---
      for (const item of ic.items) {
        if (item.locationId) {
          const existing = await tx.assetInstallation.findFirst({
            where: { itemId: item.itemId, locationId: item.locationId, status: 'Active' },
          });
          if (existing) {
            await tx.assetInstallation.update({ where: { id: existing.id }, data: { quantity: { increment: item.quantity } } });
          } else {
            await tx.assetInstallation.create({
              data: {
                itemId: item.itemId, locationId: item.locationId, issueChallanId: id,
                installedDate: ic.date, quantity: item.quantity, installedBy: postedBy,
                status: 'Active', remarks: item.usedAt || item.purpose,
              },
            });
          }
        }
      }

      await tx.issueChallan.update({ where: { id }, data: { status: 'Posted', postedAt: new Date(), postedBy } });
      await tx.auditLog.create({
        data: {
          companyId: ic.companyId, action: 'POST', tableName: 'IssueChallan', recordId: id, recordUuid: ic.uuid,
          description: `Issue Challan ${ic.challanNo} posted to ${ic.department.name} with ${ic.items.length} items`,
          newValues: JSON.stringify({ status: 'Posted', postedAt: new Date() }),
        },
      });
    });

    return serialize(await prisma.issueChallan.findUnique({
      where: { id },
      include: { department: true, items: { include: { item: true, unit: true, location: true } } },
    }));
  });

  ipcMain.handle('challan:issue:cancel', async (_event, id: number, cancelReason: string) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.CANCEL_CHALLAN);
    const cancelledBy = session.fullName;
    const ic = await prisma.issueChallan.findUnique({ where: { id }, include: { items: true } });
    if (!ic) throw new Error('Issue challan not found');
    if (ic.status !== 'Posted') throw new Error('Only posted challans can be cancelled');

    await prisma.$transaction(async (tx) => {
      // --- Downstream stock check: verify destination has enough to reverse ---
      const downstreamChecks: Array<{ itemName: string; required: number; available: number }> = [];
      for (const item of ic.items) {
        if (item.locationId) {
          // Room-level: check room balance
          const roomBalance = await getLatestBalance(tx, ic.companyId, ic.financialYearId, item.itemId, ic.departmentId || null, item.locationId);
          if (roomBalance < Number(item.quantity)) {
            const itemDetail = await prisma.item.findUnique({ where: { id: item.itemId } });
            downstreamChecks.push({ itemName: itemDetail?.itemName || 'Unknown', required: Number(item.quantity), available: roomBalance });
          }
        } else {
          // Department-level: check pool balance
          const poolBalance = await getLatestBalance(tx, ic.companyId, ic.financialYearId, item.itemId, ic.departmentId || null, null);
          if (poolBalance < Number(item.quantity)) {
            const itemDetail = await prisma.item.findUnique({ where: { id: item.itemId } });
            downstreamChecks.push({ itemName: itemDetail?.itemName || 'Unknown', required: Number(item.quantity), available: poolBalance });
          }
        }
      }
      if (downstreamChecks.length > 0) {
        throw new Error(`Cannot cancel — stock moved further. ${downstreamChecks.map(d => `${d.itemName}: needs ${d.required}, only ${d.available} available`).join('; ')}`);
      }

      // --- Reverse the linked chain (4 rows if room, 2 rows if pool-only) ---
      const reversalEntries: any[] = [];
      const refTransferId = `TRF-${ic.challanNo}`;
      // Build cumulative balance map (like post handler) to avoid stale reads
      const balanceMap = new Map<string, number>();
      const getMapBalance = (itemId: number, deptId: number | null, locId: number | null) => {
        const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
        return balanceMap.get(key) || 0;
      };
      const setMapBalance = (itemId: number, deptId: number | null, locId: number | null, bal: number) => {
        const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
        balanceMap.set(key, bal);
      };
      // Seed map from DB
      for (const item of ic.items) {
        const hasRoom = !!item.locationId;
        // Room balance
        if (hasRoom) {
          const rb = await getLatestBalance(tx, ic.companyId, ic.financialYearId, item.itemId, ic.departmentId || null, item.locationId);
          setMapBalance(item.itemId, ic.departmentId, item.locationId, rb);
        }
        // Pool balance (always)
        const pb = await getLatestBalance(tx, ic.companyId, ic.financialYearId, item.itemId, ic.departmentId || null, null);
        setMapBalance(item.itemId, ic.departmentId, null, pb);
      }
      // Store balance
      const storeItems = [...new Set(ic.items.map(i => i.itemId))];
      for (const itemId of storeItems) {
        const sb = await getLatestBalance(tx, ic.companyId, ic.financialYearId, itemId, ic.sourceStoreId || null, null);
        setMapBalance(itemId, ic.sourceStoreId, null, sb);
      }

      for (const item of ic.items) {
        const reversalQty = Number(item.quantity);
        const hasRoom = !!item.locationId;

        if (hasRoom) {
          // Reverse ROW 4: Room — REVERSAL of TRANSFER_IN (stock leaves room)
          const roomBalance = getMapBalance(item.itemId, ic.departmentId, item.locationId);
          const newRoomBal = roomBalance - reversalQty;
          setMapBalance(item.itemId, ic.departmentId, item.locationId, newRoomBal);
          reversalEntries.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: item.locationId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(reversalQty),
            rate: new Prisma.Decimal(0), balanceQty: new Prisma.Decimal(newRoomBal),
            refTransferId, referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            remarks: `Reversal for cancelled ${ic.challanNo} — room stock removed`, createdBy: cancelledBy,
          });

          // Reverse ROW 3: Pool — REVERSAL of TRANSFER_OUT (stock returns to pool)
          const poolBalance = getMapBalance(item.itemId, ic.departmentId, null);
          const newPoolBal = poolBalance + reversalQty;
          setMapBalance(item.itemId, ic.departmentId, null, newPoolBal);
          reversalEntries.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: null,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(reversalQty), quantityOut: new Prisma.Decimal(0),
            rate: new Prisma.Decimal(0), balanceQty: new Prisma.Decimal(newPoolBal),
            refTransferId, referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            remarks: `Reversal for cancelled ${ic.challanNo} — pool allocation reversed`, createdBy: cancelledBy,
          });

          // Reverse ROW 2: Pool — REVERSAL of ISSUE IN (stock leaves pool)
          const poolBalance2 = getMapBalance(item.itemId, ic.departmentId, null);
          const newPoolBal2 = poolBalance2 - reversalQty;
          setMapBalance(item.itemId, ic.departmentId, null, newPoolBal2);
          reversalEntries.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: null,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(reversalQty),
            rate: new Prisma.Decimal(0), balanceQty: new Prisma.Decimal(newPoolBal2),
            referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            remarks: `Reversal for cancelled ${ic.challanNo} — dharamshala receipt reversed`, createdBy: cancelledBy,
          });
        } else {
          // Pool-only: Reverse ROW 2 — ISSUE IN reversed
          const poolBalance = getMapBalance(item.itemId, ic.departmentId, null);
          const newPoolBal = poolBalance - reversalQty;
          setMapBalance(item.itemId, ic.departmentId, null, newPoolBal);
          reversalEntries.push({
            companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
            departmentId: ic.departmentId, locationId: null,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(reversalQty),
            rate: new Prisma.Decimal(0), balanceQty: new Prisma.Decimal(newPoolBal),
            referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
            remarks: `Reversal for cancelled ${ic.challanNo} — destination`, createdBy: cancelledBy,
          });
        }

        // Reverse ROW 1: Store — REVERSAL of ISSUE OUT (stock returns to store)
        const srcBalance = getMapBalance(item.itemId, ic.sourceStoreId, null);
        const newSrcBal = srcBalance + reversalQty;
        setMapBalance(item.itemId, ic.sourceStoreId, null, newSrcBal);
        reversalEntries.push({
          companyId: ic.companyId, financialYearId: ic.financialYearId, itemId: item.itemId,
          departmentId: ic.sourceStoreId || null, locationId: null,
          transactionType: 'REVERSAL', transactionDate: new Date(),
          quantityIn: new Prisma.Decimal(reversalQty), quantityOut: new Prisma.Decimal(0),
          rate: new Prisma.Decimal(0), balanceQty: new Prisma.Decimal(newSrcBal),
          referenceType: 'IssueChallan', referenceId: id, referenceNo: ic.challanNo,
          remarks: `Reversal for cancelled ${ic.challanNo} — store stock restored`, createdBy: cancelledBy,
        });
      }

      if (reversalEntries.length > 0) {
        await tx.stockTransaction.createMany({ data: reversalEntries });
      }

      // --- Deactivate AssetInstallation records ---
      for (const item of ic.items) {
        if (item.locationId) {
          const installations = await tx.assetInstallation.findMany({
            where: { issueChallanId: id, itemId: item.itemId, status: 'Active' },
          });
          for (const inst of installations) {
            await tx.assetInstallation.update({
              where: { id: inst.id },
              data: { status: 'Inactive', remarks: `Issue challan ${ic.challanNo} cancelled` },
            });
          }
        }
      }

      await tx.issueChallan.update({ where: { id }, data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason } });
      await tx.auditLog.create({
        data: {
          companyId: ic.companyId,
          action: 'CANCEL',
          tableName: 'IssueChallan',
          recordId: id,
          recordUuid: ic.uuid,
          description: `Issue Challan ${ic.challanNo} cancelled: ${cancelReason}`,
          oldValues: JSON.stringify({ status: 'Posted' }),
          newValues: JSON.stringify({ status: 'Cancelled', cancelReason }),
        },
      });
    });

    return serialize(await prisma.issueChallan.findUnique({ where: { id } }));
  });

  ipcMain.handle('challan:receipt:delete', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.DELETE_CHALLAN);
    const existing = await prisma.receiptChallan.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new Error('Receipt challan not found');
    if (existing.status === 'Cancelled') throw new Error('Cannot delete a cancelled challan');

    await prisma.$transaction(async (tx) => {
      if (existing.status === 'Posted') {
        await tx.stockTransaction.deleteMany({
          where: { referenceType: 'ReceiptChallan', referenceId: id },
        });
        await recalculateBalancesAfterDelete(tx, existing.companyId, existing.financialYearId,
          existing.items.map(item => ({ itemId: item.itemId, departmentId: existing.departmentId || null, locationId: (item as any).locationId || null }))
        );
      }
      await tx.receiptChallanItem.deleteMany({ where: { receiptChallanId: id } });
      await tx.receiptChallan.delete({ where: { id } });
    });
    return { success: true };
  });

  ipcMain.handle('challan:issue:delete', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.DELETE_CHALLAN);
    const existing = await prisma.issueChallan.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new Error('Issue challan not found');
    if (existing.status === 'Cancelled') throw new Error('Cannot delete a cancelled challan');

    await prisma.$transaction(async (tx) => {
      if (existing.status === 'Posted') {
        await tx.stockTransaction.deleteMany({
          where: { referenceType: 'IssueChallan', referenceId: id },
        });
        for (const item of existing.items) {
          if (item.locationId) {
            const installations = await tx.assetInstallation.findMany({
              where: { issueChallanId: id, itemId: item.itemId, status: 'Active' },
            });
            for (const inst of installations) {
              await tx.assetInstallation.update({
                where: { id: inst.id },
                data: { status: 'Inactive', remarks: `Issue challan ${existing.challanNo} deleted` },
              });
            }
          }
        }
        // Recalculate balances for all affected levels: store, pool, and room
        const itemLocations: Array<{ itemId: number; departmentId: number | null; locationId: number | null }> = [];
        for (const item of existing.items) {
          itemLocations.push({ itemId: item.itemId, departmentId: existing.sourceStoreId || null, locationId: null });
          itemLocations.push({ itemId: item.itemId, departmentId: existing.departmentId, locationId: null });
          if (item.locationId) {
            itemLocations.push({ itemId: item.itemId, departmentId: existing.departmentId, locationId: item.locationId });
          }
        }
        await recalculateBalancesAfterDelete(tx, existing.companyId, existing.financialYearId, itemLocations);
      }
      await tx.issueChallanItem.deleteMany({ where: { issueChallanId: id } });
      await tx.issueChallan.delete({ where: { id } });
    });
    return { success: true };
  });

  // ==================== TRANSFER CHALLAN ====================

  ipcMain.handle('challan:transfer:create', async (_event, data) => {
    requireAuth();
    const sequence = await prisma.challanSequence.upsert({
      where: { companyId_financialYearId_challanType: { companyId: data.companyId, financialYearId: data.financialYearId, challanType: 'TC' } },
      update: { lastNumber: { increment: 1 } },
      create: { companyId: data.companyId, financialYearId: data.financialYearId, challanType: 'TC', lastNumber: 1 },
    });
    const challanNo = `TC-${String(sequence.lastNumber).padStart(5, '0')}`;
    return serialize(await prisma.transferChallan.create({
      data: {
        challanNo, companyId: data.companyId, financialYearId: data.financialYearId,
        date: new Date(data.date), fromDepartmentId: data.fromDepartmentId, toDepartmentId: data.toDepartmentId,
        transferredBy: data.transferredBy, approvedBy: data.approvedBy, remarks: data.remarks,
        items: { create: data.items.map((item: any) => ({ itemId: item.itemId, quantity: item.quantity, rate: item.rate || 0, locationId: item.locationId || null, toLocationId: item.toLocationId || null, remarks: item.remarks })) },
      },
      include: { fromDepartment: true, toDepartment: true, items: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:transfer:update', async (_event, id: number, data: any) => {
    requireAuth();
    const existing = await prisma.transferChallan.findUnique({ where: { id } });
    if (!existing) throw new Error('Transfer challan not found');
    if (existing.status !== 'Draft') throw new Error('Cannot edit a posted/cancelled challan');
    return serialize(await prisma.transferChallan.update({
      where: { id },
      data: {
        date: new Date(data.date), fromDepartmentId: data.fromDepartmentId, toDepartmentId: data.toDepartmentId,
        transferredBy: data.transferredBy, approvedBy: data.approvedBy, remarks: data.remarks,
        items: { deleteMany: {}, create: data.items.map((item: any) => ({ itemId: item.itemId, quantity: item.quantity, rate: item.rate || 0, locationId: item.locationId || null, toLocationId: item.toLocationId || null, remarks: item.remarks })) },
      },
      include: { fromDepartment: true, toDepartment: true, items: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:transfer:delete', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.DELETE_CHALLAN);
    const existing = await prisma.transferChallan.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new Error('Transfer challan not found');
    if (existing.status === 'Cancelled') throw new Error('Cannot delete a cancelled challan');

    await prisma.$transaction(async (tx) => {
      if (existing.status === 'Posted') {
        await tx.stockTransaction.deleteMany({
          where: { referenceType: 'TransferChallan', referenceId: id },
        });
        const itemLocations: Array<{ itemId: number; departmentId: number | null; locationId: number | null }> = [];
        const isSameDept = existing.fromDepartmentId === existing.toDepartmentId;
        for (const item of existing.items) {
          itemLocations.push({ itemId: item.itemId, departmentId: existing.fromDepartmentId, locationId: (item as any).locationId || null });
          if (isSameDept) {
            itemLocations.push({ itemId: item.itemId, departmentId: existing.fromDepartmentId, locationId: (item as any).toLocationId || null });
          } else {
            itemLocations.push({ itemId: item.itemId, departmentId: existing.toDepartmentId, locationId: (item as any).locationId || null });
          }
        }
        await recalculateBalancesAfterDelete(tx, existing.companyId, existing.financialYearId, itemLocations);
      }
      await tx.transferChallanItem.deleteMany({ where: { transferChallanId: id } });
      await tx.transferChallan.delete({ where: { id } });
    });
    return { success: true };
  });

  ipcMain.handle('challan:transfer:post', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    const postedBy = session.fullName;
    const tc = await prisma.transferChallan.findUnique({ where: { id }, include: { items: true, company: true } });
    if (!tc) throw new Error('Transfer challan not found');
    if (tc.status !== 'Draft') throw new Error('Challan is not in Draft status');

    // Validate: same room to same room transfer not allowed
    const isSameDept = tc.fromDepartmentId === tc.toDepartmentId;
    if (isSameDept) {
      for (const item of tc.items) {
        const srcLocId = (item as any).locationId || null;
        const dstLocId = (item as any).toLocationId || null;
        if (srcLocId && dstLocId && srcLocId === dstLocId) {
          const itemDetail = await prisma.item.findUnique({ where: { id: item.itemId } });
          throw new Error(`Cannot transfer ${itemDetail?.itemName || 'item'} to the same room`);
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Stock validation for BOTH same-dept and cross-dept transfers
      const balanceChecks: Array<{ itemName: string; requested: number; available: number }> = [];
      for (const item of tc.items) {
        const srcLocId = (item as any).locationId || null;
        const available = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.fromDepartmentId, srcLocId);
        if (Number(item.quantity) > available) {
          const itemDetail = await prisma.item.findUnique({ where: { id: item.itemId } });
          balanceChecks.push({ itemName: itemDetail?.itemName || 'Unknown', requested: Number(item.quantity), available });
        }
      }
      if (balanceChecks.length > 0) {
        throw new Error(`Insufficient stock: ${balanceChecks.map(b => `${b.itemName}: requested ${b.requested}, available ${b.available}`).join('; ')}`);
      }

      const stockTransactions: any[] = [];
      const refTransferId = `TRF-${tc.challanNo}`;

      if (isSameDept) {
        // Build cumulative balance map to avoid stale reads
        const balanceMap = new Map<string, number>();
        const getMapBalance = (itemId: number, deptId: number | null, locId: number | null) => {
          const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
          return balanceMap.get(key) || 0;
        };
        const setMapBalance = (itemId: number, deptId: number | null, locId: number | null, bal: number) => {
          const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
          balanceMap.set(key, bal);
        };
        // Seed map from DB
        for (const item of tc.items) {
          const srcLocId = (item as any).locationId || null;
          const dstLocId = (item as any).toLocationId || null;
          const srcBal = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.fromDepartmentId, srcLocId);
          setMapBalance(item.itemId, tc.fromDepartmentId, srcLocId, srcBal);
          const dstBal = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.fromDepartmentId, dstLocId);
          setMapBalance(item.itemId, tc.fromDepartmentId, dstLocId, dstBal);
        }

        for (const item of tc.items) {
          const srcLocId = (item as any).locationId || null;
          const dstLocId = (item as any).toLocationId || null;
          const qty = Number(item.quantity);

          const srcBal = getMapBalance(item.itemId, tc.fromDepartmentId, srcLocId);
          const srcNewBal = srcBal - qty;
          setMapBalance(item.itemId, tc.fromDepartmentId, srcLocId, srcNewBal);

          stockTransactions.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.fromDepartmentId, locationId: srcLocId,
            transactionType: 'TRANSFER_OUT', transactionDate: tc.date,
            quantityIn: new Prisma.Decimal(0), quantityOut: item.quantity, rate: item.rate,
            balanceQty: new Prisma.Decimal(srcNewBal), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Room transfer out ${tc.challanNo}: ${srcLocId || 'dept'} → ${dstLocId || 'dept'}`, createdBy: postedBy,
          });

          const dstBal = getMapBalance(item.itemId, tc.fromDepartmentId, dstLocId);
          const dstNewBal = dstBal + qty;
          setMapBalance(item.itemId, tc.fromDepartmentId, dstLocId, dstNewBal);

          stockTransactions.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.fromDepartmentId, locationId: dstLocId,
            transactionType: 'TRANSFER_IN', transactionDate: tc.date,
            quantityIn: item.quantity, quantityOut: new Prisma.Decimal(0), rate: item.rate,
            balanceQty: new Prisma.Decimal(dstNewBal), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Room transfer in ${tc.challanNo}: ${srcLocId || 'dept'} → ${dstLocId || 'dept'}`, createdBy: postedBy,
          });
        }
      } else {
        const lastEntries = await tx.$queryRaw<{ itemId: number; locationId: number | null; balanceQty: number }[]>`
          SELECT itemId, locationId, balanceQty FROM StockTransaction
          WHERE companyId = ${tc.companyId} AND financialYearId = ${tc.financialYearId} AND departmentId = ${tc.fromDepartmentId}
          AND id = (SELECT se2.id FROM StockTransaction se2 WHERE se2.itemId = StockTransaction.itemId
          AND ((se2.locationId = StockTransaction.locationId) OR (se2.locationId IS NULL AND StockTransaction.locationId IS NULL))
          AND se2.companyId = ${tc.companyId} AND se2.financialYearId = ${tc.financialYearId} AND se2.departmentId = ${tc.fromDepartmentId}
          ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1)
        `;
        const balanceMap = new Map<string, number>();
        for (const e of lastEntries) balanceMap.set(`${e.itemId}-${e.locationId ?? 'null'}`, Number(e.balanceQty));

        for (const item of tc.items) {
          const key = `${item.itemId}-${(item as any).locationId ?? 'null'}`;
          const prevBalance = balanceMap.get(key) || 0;
          const newBalance = prevBalance - Number(item.quantity);
          balanceMap.set(key, newBalance);
          stockTransactions.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.fromDepartmentId, locationId: (item as any).locationId || null,
            transactionType: 'TRANSFER_OUT', transactionDate: tc.date,
            quantityIn: new Prisma.Decimal(0), quantityOut: item.quantity, rate: item.rate,
            balanceQty: new Prisma.Decimal(newBalance), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Transfer out ${tc.challanNo}`, createdBy: postedBy,
          });
        }

        const toBalanceEntries = await tx.$queryRaw<{ itemId: number; locationId: number | null; balanceQty: number }[]>`
          SELECT itemId, locationId, balanceQty FROM StockTransaction
          WHERE companyId = ${tc.companyId} AND financialYearId = ${tc.financialYearId} AND departmentId = ${tc.toDepartmentId}
          AND id = (SELECT se2.id FROM StockTransaction se2 WHERE se2.itemId = StockTransaction.itemId
          AND ((se2.locationId = StockTransaction.locationId) OR (se2.locationId IS NULL AND StockTransaction.locationId IS NULL))
          AND se2.companyId = ${tc.companyId} AND se2.financialYearId = ${tc.financialYearId} AND se2.departmentId = ${tc.toDepartmentId}
          ORDER BY se2.transactionDate DESC, se2.id DESC LIMIT 1)
        `;
        const toBalanceMap = new Map<string, number>();
        for (const e of toBalanceEntries) toBalanceMap.set(`${e.itemId}-${e.locationId ?? 'null'}`, Number(e.balanceQty));

        for (const item of tc.items) {
          const toLocId = (item as any).toLocationId || null;
          const key = `${item.itemId}-${toLocId ?? 'null'}`;
          const prevBalance = toBalanceMap.get(key) || 0;
          const newBalance = prevBalance + Number(item.quantity);
          toBalanceMap.set(key, newBalance);
          stockTransactions.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.toDepartmentId, locationId: toLocId,
            transactionType: 'TRANSFER_IN', transactionDate: tc.date,
            quantityIn: item.quantity, quantityOut: new Prisma.Decimal(0), rate: item.rate,
            balanceQty: new Prisma.Decimal(newBalance), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Transfer in ${tc.challanNo}`, createdBy: postedBy,
          });
        }
      }

      await tx.stockTransaction.createMany({ data: stockTransactions });

      for (const item of tc.items) {
        if (isSameDept) {
          const fromLocId = (item as any).locationId;
          const toLocId = (item as any).toLocationId;
          if (fromLocId && toLocId) {
            const existing = await tx.assetInstallation.findFirst({
              where: { itemId: item.itemId, locationId: fromLocId, status: 'Active' },
            });
            if (existing) {
              await tx.assetInstallation.update({
                where: { id: existing.id },
                data: { locationId: toLocId, remarks: `Moved via ${tc.challanNo}` },
              });
            }
          }
        } else {
          const locationId = (item as any).locationId;
          if (locationId) {
            const activeInstallations = await tx.assetInstallation.findMany({ where: { itemId: item.itemId, locationId, status: 'Active' } });
            for (const installation of activeInstallations) {
              await tx.assetInstallation.update({ where: { id: installation.id }, data: { status: 'Inactive', remarks: `Stock transferred via ${tc.challanNo}` } });
            }
          }
        }
      }

      await tx.auditLog.create({
        data: {
          companyId: tc.companyId, action: 'POST', tableName: 'TransferChallan', recordId: id, recordUuid: tc.uuid,
          description: isSameDept
            ? `Room Transfer ${tc.challanNo} — ${tc.items.length} items moved within department`
            : `Transfer Challan ${tc.challanNo} posted with ${tc.items.length} items`,
          newValues: JSON.stringify({ status: 'Posted', refTransferId }),
        },
      });
      await tx.transferChallan.update({ where: { id }, data: { status: 'Posted', postedAt: new Date(), postedBy } });
    });

    return serialize(await prisma.transferChallan.findUnique({ where: { id }, include: { fromDepartment: true, toDepartment: true, items: { include: { item: true } } } }));
  });

  ipcMain.handle('challan:transfer:cancel', async (_event, id: number, cancelReason: string) => {
    if (!cancelReason || cancelReason.trim().length === 0) throw new Error('Cancel reason is required');
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.CANCEL_CHALLAN);
    const cancelledBy = session.fullName;
    const tc = await prisma.transferChallan.findUnique({ where: { id }, include: { items: true, company: true } });
    if (!tc) throw new Error('Transfer challan not found');
    if (tc.status !== 'Posted') throw new Error('Only posted challans can be cancelled');

    const isSameDept = tc.fromDepartmentId === tc.toDepartmentId;

    await prisma.$transaction(async (tx) => {
      if (!isSameDept) {
        const downstreamChecks: Array<{ itemName: string; required: number; available: number }> = [];
        for (const item of tc.items) {
          const destBalance = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.toDepartmentId || null, (item as any).locationId || null);
          if (destBalance < Number(item.quantity)) {
            const itemDetail = await prisma.item.findUnique({ where: { id: item.itemId } });
            downstreamChecks.push({ itemName: itemDetail?.itemName || 'Unknown', required: Number(item.quantity), available: destBalance });
          }
        }
        if (downstreamChecks.length > 0) {
          throw new Error(`Cannot cancel — stock moved further. ${downstreamChecks.map(d => `${d.itemName}: needs ${d.required}, only ${d.available} available`).join('; ')}`);
        }
      }

      const linkedTxns = await tx.stockTransaction.findMany({ where: { referenceType: 'TransferChallan', referenceId: id }, select: { refTransferId: true } });
      const refTransferId = linkedTxns[0]?.refTransferId;

      const reversalEntries: any[] = [];
      // Build cumulative balance map to avoid stale reads
      const balanceMap = new Map<string, number>();
      const getMapBalance = (itemId: number, deptId: number | null, locId: number | null) => {
        const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
        return balanceMap.get(key) || 0;
      };
      const setMapBalance = (itemId: number, deptId: number | null, locId: number | null, bal: number) => {
        const key = `${itemId}-${deptId ?? 'null'}-${locId ?? 'null'}`;
        balanceMap.set(key, bal);
      };
      // Seed map from DB
      for (const item of tc.items) {
        const srcLocId = (item as any).locationId || null;
        const dstLocId = (item as any).toLocationId || null;
        if (isSameDept) {
          const srcB = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.fromDepartmentId, srcLocId);
          setMapBalance(item.itemId, tc.fromDepartmentId, srcLocId, srcB);
          const dstB = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.fromDepartmentId, dstLocId);
          setMapBalance(item.itemId, tc.fromDepartmentId, dstLocId, dstB);
        } else {
          const srcB = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.fromDepartmentId || null, srcLocId);
          setMapBalance(item.itemId, tc.fromDepartmentId, srcLocId, srcB);
          const dstB = await getLatestBalance(tx, tc.companyId, tc.financialYearId, item.itemId, tc.toDepartmentId || null, dstLocId);
          setMapBalance(item.itemId, tc.toDepartmentId, dstLocId, dstB);
        }
      }

      if (isSameDept) {
        for (const item of tc.items) {
          const srcLocId = (item as any).locationId || null;
          const dstLocId = (item as any).toLocationId || null;
          const qty = Number(item.quantity);

          const destBalance = getMapBalance(item.itemId, tc.fromDepartmentId, dstLocId);
          const newDestBal = destBalance - qty;
          setMapBalance(item.itemId, tc.fromDepartmentId, dstLocId, newDestBal);
          reversalEntries.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.fromDepartmentId, locationId: dstLocId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(0), quantityOut: item.quantity, rate: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(newDestBal), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Reversal for cancelled room transfer ${tc.challanNo} — dest room restored`, createdBy: cancelledBy,
          });

          const sourceBalance = getMapBalance(item.itemId, tc.fromDepartmentId, srcLocId);
          const newSrcBal = sourceBalance + qty;
          setMapBalance(item.itemId, tc.fromDepartmentId, srcLocId, newSrcBal);
          reversalEntries.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId,
            departmentId: tc.fromDepartmentId, locationId: srcLocId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: item.quantity, quantityOut: new Prisma.Decimal(0), rate: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(newSrcBal), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Reversal for cancelled room transfer ${tc.challanNo} — source room restored`, createdBy: cancelledBy,
          });
        }
      } else {
        for (const item of tc.items) {
          const locationId = (item as any).locationId || null;
          const qty = Number(item.quantity);

          const sourceBalance = getMapBalance(item.itemId, tc.fromDepartmentId, locationId);
          const newSrcBal = sourceBalance + qty;
          setMapBalance(item.itemId, tc.fromDepartmentId, locationId, newSrcBal);
          reversalEntries.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId, departmentId: tc.fromDepartmentId, locationId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(qty), quantityOut: new Prisma.Decimal(0), rate: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(newSrcBal), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Reversal for cancelled ${tc.challanNo} — source restored`, createdBy: cancelledBy,
          });

          const destBalance = getMapBalance(item.itemId, tc.toDepartmentId, locationId);
          const newDstBal = destBalance - qty;
          setMapBalance(item.itemId, tc.toDepartmentId, locationId, newDstBal);
          reversalEntries.push({
            companyId: tc.companyId, financialYearId: tc.financialYearId, itemId: item.itemId, departmentId: tc.toDepartmentId, locationId,
            transactionType: 'REVERSAL', transactionDate: new Date(),
            quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(qty), rate: new Prisma.Decimal(0),
            balanceQty: new Prisma.Decimal(newDstBal), refTransferId, condition: 'GOOD',
            referenceType: 'TransferChallan', referenceId: id, referenceNo: tc.challanNo,
            remarks: `Reversal for cancelled ${tc.challanNo} — destination restored`, createdBy: cancelledBy,
          });
        }
      }

      await tx.stockTransaction.createMany({ data: reversalEntries });

      if (isSameDept) {
        for (const item of tc.items) {
          const toLocId = (item as any).toLocationId;
          if (toLocId) {
            const moved = await tx.assetInstallation.findFirst({
              where: { itemId: item.itemId, locationId: toLocId, status: 'Active', remarks: { contains: tc.challanNo } },
            });
            if (moved) {
              const fromLocId = (item as any).locationId;
              await tx.assetInstallation.update({
                where: { id: moved.id },
                data: { locationId: fromLocId || moved.locationId, remarks: `Reversed from cancelled ${tc.challanNo}` },
              });
            }
          }
        }
      }

      await tx.auditLog.create({
        data: {
          companyId: tc.companyId, action: 'CANCEL', tableName: 'TransferChallan', recordId: id, recordUuid: tc.uuid,
          description: `Transfer Challan ${tc.challanNo} cancelled: ${cancelReason}`,
          oldValues: JSON.stringify({ status: 'Posted' }), newValues: JSON.stringify({ status: 'Cancelled', cancelReason }),
        },
      });
      await tx.transferChallan.update({ where: { id }, data: { status: 'Cancelled', cancelledAt: new Date(), cancelReason } });
    });

    return serialize(await prisma.transferChallan.findUnique({ where: { id } }));
  });

  // ==================== DAMAGE ENTRY ====================

  ipcMain.handle('challan:damage:create', async (_event, data: any) => {
    requireAuth();
    data = convertPayloadDates(data);
    if (!data.companyId) throw new Error('Company ID is required');
    if (!data.itemId) throw new Error('Item ID is required');
    if (!data.quantity || data.quantity <= 0) throw new Error('Quantity must be positive');
    if (!data.reason) throw new Error('Reason is required');
    if (!data.reportedBy) throw new Error('Reported by is required');

    const item = await prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw new Error('Item not found');

    const damageEntry = await prisma.$transaction(async (tx) => {
      // FIX: Resolve financialYearId from the damage date, not from last transaction
      let financialYearId = data.financialYearId;
      if (!financialYearId) {
        const matchingFY = await tx.financialYear.findFirst({
          where: {
            companyId: data.companyId,
            startDate: { lte: new Date(data.date) },
            endDate: { gte: new Date(data.date) },
            isClosed: false,
          },
        });
        if (!matchingFY) throw new Error(`No open financial year found for date ${data.date}`);
        financialYearId = matchingFY.id;
      } else {
        const fy = await tx.financialYear.findUnique({ where: { id: financialYearId } });
        if (!fy) throw new Error(`Financial year #${financialYearId} not found`);
        if (new Date(data.date) < fy.startDate || new Date(data.date) > fy.endDate) {
          throw new Error(`Damage date falls outside financial year "${fy.label}"`);
        }
        if (fy.isClosed) throw new Error(`Financial year "${fy.label}" is closed`);
      }

      // Atomic stock validation
      const departmentId = data.departmentId || null;
      const locationId = data.locationId || null;
      const whereClause: any = { companyId: data.companyId, financialYearId, itemId: data.itemId };
      if (departmentId) whereClause.departmentId = departmentId;
      if (locationId) whereClause.locationId = locationId;

      const lastEntry = await tx.stockTransaction.findFirst({
        where: whereClause,
        orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        select: { balanceQty: true },
      });
      const available = lastEntry ? Number(lastEntry.balanceQty) : 0;
      if (data.quantity > available) {
        throw new Error(`Insufficient stock for damage. Available: ${available}, Damage: ${data.quantity}`);
      }

      const newBalance = available - data.quantity;

      let originalPurchaseDate: Date | undefined;
      let originalVendorName: string | undefined;
      let originalInvoiceNumber: string | undefined;
      let originalRate: Prisma.Decimal | undefined;

      const firstPurchase = await tx.stockTransaction.findFirst({
        where: { itemId: data.itemId, transactionType: 'PURCHASE', companyId: data.companyId, financialYearId },
        orderBy: { transactionDate: 'asc' },
        select: { referenceId: true, referenceType: true, rate: true, transactionDate: true },
      });

      if (firstPurchase?.referenceType === 'ReceiptChallan' && firstPurchase.referenceId) {
        const rc = await tx.receiptChallan.findUnique({ where: { id: firstPurchase.referenceId }, include: { vendor: true } });
        if (rc) {
          originalPurchaseDate = rc.date;
          originalVendorName = rc.vendor?.name || rc.sourceName || undefined;
          originalInvoiceNumber = rc.invoiceNumber || undefined;
        }
      }
      originalRate = firstPurchase?.rate;

      const rateForDamage = originalRate ?? new Prisma.Decimal(0);
      if (!originalRate || Number(originalRate) === 0) {
        console.warn(`[DAMAGE] rate fallback for itemId=${data.itemId}: no purchase record found, using rate=0`);
      }

      const entry = await tx.damageEntry.create({
        data: {
          companyId: data.companyId, itemId: data.itemId,
          locationId: data.locationId, assetInstallationId: data.assetInstallationId,
          date: new Date(data.date), quantity: data.quantity, reason: data.reason,
          reportedBy: data.reportedBy, remarks: data.remarks,
          originalPurchaseDate, originalVendorName, originalInvoiceNumber, originalRate,
          status: 'Posted',
        },
        include: { item: true, location: true },
      });

      await tx.stockTransaction.create({
        data: {
          companyId: data.companyId, financialYearId, itemId: data.itemId,
          departmentId, locationId,
          transactionType: 'DAMAGE', transactionDate: new Date(data.date),
          quantityIn: new Prisma.Decimal(0), quantityOut: new Prisma.Decimal(data.quantity),
          rate: rateForDamage, balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'DamageEntry', referenceId: entry.id, referenceNo: `DMG-${entry.id}`,
          condition: 'GOOD', remarks: `Damage: ${data.reason}`, createdBy: data.reportedBy,
        },
      });

      // Recalculate if backdated
      const allTxns = await tx.stockTransaction.findMany({
        where: whereClause,
        orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
        select: { id: true, quantityIn: true, quantityOut: true, transactionDate: true },
      });
      const startIdx = allTxns.findIndex(t => t.transactionDate >= new Date(data.date));
      if (startIdx !== -1) {
        let runningBalance = 0;
        for (let i = 0; i < startIdx; i++) {
          runningBalance += Number(allTxns[i].quantityIn) - Number(allTxns[i].quantityOut);
        }
        for (let i = startIdx; i < allTxns.length; i++) {
          runningBalance += Number(allTxns[i].quantityIn) - Number(allTxns[i].quantityOut);
          await tx.stockTransaction.update({
            where: { id: allTxns[i].id },
            data: { balanceQty: new Prisma.Decimal(runningBalance) },
          });
        }
      }

      if (data.locationId) {
        const activeInstallations = await tx.assetInstallation.findMany({
          where: { itemId: data.itemId, locationId: data.locationId, status: 'Active' },
        });
        for (const installation of activeInstallations) {
          await tx.assetInstallation.update({
            where: { id: installation.id },
            data: { status: 'Inactive', remarks: `Item damaged: ${data.reason} (closed on ${data.date} by ${data.reportedBy})` },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          companyId: data.companyId, action: 'CREATE', tableName: 'DamageEntry',
          recordId: entry.id, recordUuid: entry.uuid,
          description: `Damage entry created: ${data.quantity} x ${item.itemName} (${data.reason})`,
          oldValues: JSON.stringify({ departmentId, locationId, available }),
          newValues: JSON.stringify({ ...data, newBalance, financialYearId }),
        },
      });

      return entry;
    });

    return serialize(damageEntry);
  });

  // ==================== STOCK ADJUSTMENT ====================

  ipcMain.handle('challan:adjustment:create', async (_event, data: any) => {
    requireAuth();
    data = convertPayloadDates(data);
    if (!data.companyId) throw new Error('Company ID is required');
    if (!data.financialYearId) throw new Error('Financial Year ID is required');
    if (!data.itemId) throw new Error('Item ID is required');
    if (!data.adjustmentType || !['INCREASE', 'DECREASE'].includes(data.adjustmentType)) {
      throw new Error('Adjustment type must be INCREASE or DECREASE');
    }
    if (!data.quantity || data.quantity <= 0) throw new Error('Quantity must be positive');
    if (!data.reason) throw new Error('Reason is required');
    if (!data.adjustedBy) throw new Error('Adjusted by is required');

    const adjustment = await prisma.$transaction(async (tx) => {
      const isIncrease = data.adjustmentType === 'INCREASE';
      const departmentId = data.departmentId || null;
      const locationId = data.locationId || null;

      // FIX: Scope validation to departmentId + locationId
      if (!isIncrease) {
        const whereClause: any = { companyId: data.companyId, financialYearId: data.financialYearId, itemId: data.itemId };
        if (departmentId) whereClause.departmentId = departmentId;
        if (locationId) whereClause.locationId = locationId;

        const lastEntry = await tx.stockTransaction.findFirst({
          where: whereClause,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const available = lastEntry ? Number(lastEntry.balanceQty) : 0;
        if (data.quantity > available) {
          throw new Error(`Insufficient stock for adjustment. Available: ${available}, Decrease: ${data.quantity}`);
        }
      }

      const whereClause: any = { companyId: data.companyId, financialYearId: data.financialYearId, itemId: data.itemId };
      if (departmentId) whereClause.departmentId = departmentId;
      if (locationId) whereClause.locationId = locationId;

      const lastEntry = await tx.stockTransaction.findFirst({
        where: whereClause,
        orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        select: { balanceQty: true },
      });
      const prevBalance = lastEntry ? Number(lastEntry.balanceQty) : 0;
      const newBalance = isIncrease ? prevBalance + data.quantity : prevBalance - data.quantity;

      const adj = await tx.stockAdjustment.create({
        data: {
          companyId: data.companyId, financialYearId: data.financialYearId, itemId: data.itemId,
          adjustmentType: data.adjustmentType, quantity: data.quantity, date: new Date(data.date),
          reason: data.reason, adjustedBy: data.adjustedBy, approvedBy: data.approvedBy, remarks: data.remarks,
        },
      });

      await tx.stockTransaction.create({
        data: {
          companyId: data.companyId, financialYearId: data.financialYearId, itemId: data.itemId,
          departmentId, locationId,
          transactionType: isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          transactionDate: new Date(data.date),
          quantityIn: isIncrease ? new Prisma.Decimal(data.quantity) : new Prisma.Decimal(0),
          quantityOut: isIncrease ? new Prisma.Decimal(0) : new Prisma.Decimal(data.quantity),
          balanceQty: new Prisma.Decimal(newBalance),
          referenceType: 'StockAdjustment', referenceId: adj.id, referenceNo: `ADJ-${adj.id}`,
          remarks: `Adjustment: ${data.reason}`, createdBy: data.adjustedBy,
        },
      });

      // FIX: Recalculate if backdated
      const allTxns = await tx.stockTransaction.findMany({
        where: whereClause,
        orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
        select: { id: true, quantityIn: true, quantityOut: true, transactionDate: true },
      });
      const startIdx = allTxns.findIndex(t => t.transactionDate >= new Date(data.date));
      if (startIdx !== -1) {
        let runningBalance = 0;
        for (let i = 0; i < startIdx; i++) {
          runningBalance += Number(allTxns[i].quantityIn) - Number(allTxns[i].quantityOut);
        }
        for (let i = startIdx; i < allTxns.length; i++) {
          runningBalance += Number(allTxns[i].quantityIn) - Number(allTxns[i].quantityOut);
          await tx.stockTransaction.update({
            where: { id: allTxns[i].id },
            data: { balanceQty: new Prisma.Decimal(runningBalance) },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          companyId: data.companyId, action: 'CREATE', tableName: 'StockAdjustment',
          recordId: adj.id, recordUuid: adj.uuid,
          description: `Stock adjustment: ${data.adjustmentType} ${data.quantity} of item ${data.itemId}`,
          oldValues: JSON.stringify({ departmentId, locationId, prevBalance }),
          newValues: JSON.stringify({ ...data, newBalance }),
        },
      });

      return adj;
    });

    return serialize(adjustment);
  });

  // ==================== VENDOR RETURN ====================

  ipcMain.handle('challan:vendorReturn:create', async (_event, data: any) => {
    requireAuth();
    data = convertPayloadDates(data);
    if (!data.companyId) throw new Error('Company ID is required');
    if (!data.financialYearId) throw new Error('Financial Year ID is required');
    if (!data.vendorId) throw new Error('Vendor ID is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    const sequence = await prisma.challanSequence.upsert({
      where: { companyId_financialYearId_challanType: { companyId: data.companyId, financialYearId: data.financialYearId, challanType: 'VRC' } },
      update: { lastNumber: { increment: 1 } },
      create: { companyId: data.companyId, financialYearId: data.financialYearId, challanType: 'VRC', lastNumber: 1 },
    });
    const challanNo = `VRC-${String(sequence.lastNumber).padStart(5, '0')}`;

    return serialize(await prisma.vendorReturnChallan.create({
      data: {
        challanNo, companyId: data.companyId, financialYearId: data.financialYearId,
        vendorId: data.vendorId, originalReceiptId: data.originalReceiptId || null,
        date: new Date(data.date), reason: data.reason, returnedBy: data.returnedBy, remarks: data.remarks,
        items: { create: data.items.map((item: any) => ({ itemId: item.itemId, quantity: item.quantity, rate: item.rate || 0, locationId: item.locationId || null })) },
      },
      include: { vendor: true, items: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:vendorReturn:post', async (_event, id: number, manualDepartmentId?: number | null) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    const postedBy = session.fullName;
    const vrc = await prisma.vendorReturnChallan.findUnique({ where: { id }, include: { items: true, company: true } });
    if (!vrc) throw new Error('Vendor return challan not found');
    if (vrc.status !== 'Draft') throw new Error('Challan is not in Draft status');

    await prisma.$transaction(async (tx) => {
      let sourceDepartmentId: number | null = null;
      if (vrc.originalReceiptId) {
        const originalReceipt = await tx.receiptChallan.findUnique({
          where: { id: vrc.originalReceiptId }, select: { departmentId: true },
        });
        sourceDepartmentId = originalReceipt?.departmentId || null;
      }
      // Fallback: use manually selected department from form
      if (!sourceDepartmentId && manualDepartmentId) {
        sourceDepartmentId = manualDepartmentId;
      }

      // FIX: Validate DAMAGED condition stock specifically
      const balanceChecks: Array<{ itemName: string; requested: number; damagedAvailable: number }> = [];
      for (const item of vrc.items) {
        const locationId = (item as any).locationId || null;

        // Check DAMAGED balance
        const damagedWhere: any = { companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId, condition: 'DAMAGED' };
        if (sourceDepartmentId) damagedWhere.departmentId = sourceDepartmentId;
        if (locationId) damagedWhere.locationId = locationId;
        const lastDamaged = await tx.stockTransaction.findFirst({
          where: damagedWhere,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const damagedAvailable = lastDamaged ? Number(lastDamaged.balanceQty) : 0;

        if (Number(item.quantity) > damagedAvailable) {
          const itemDetail = await prisma.item.findUnique({ where: { id: item.itemId } });
          balanceChecks.push({ itemName: itemDetail?.itemName || 'Unknown', requested: Number(item.quantity), damagedAvailable });
        }
      }
      if (balanceChecks.length > 0) {
        throw new Error(
          `Vendor return only allows DAMAGED condition stock. ` +
          balanceChecks.map(b => `${b.itemName}: requested ${b.requested}, damaged available ${b.damagedAvailable}`).join('; ')
        );
      }

      // Build stock transactions — deduct from DAMAGED condition
      const stockTransactions: any[] = [];
      for (const item of vrc.items) {
        const locationId = (item as any).locationId || null;

        // Get current DAMAGED balance
        const damagedWhere: any = { companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId, condition: 'DAMAGED' };
        if (sourceDepartmentId) damagedWhere.departmentId = sourceDepartmentId;
        if (locationId) damagedWhere.locationId = locationId;
        const lastDamaged = await tx.stockTransaction.findFirst({
          where: damagedWhere,
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { balanceQty: true },
        });
        const currentBalance = lastDamaged ? Number(lastDamaged.balanceQty) : 0;
        const newBalance = currentBalance - Number(item.quantity);

        stockTransactions.push({
          companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId,
          departmentId: sourceDepartmentId || undefined, locationId,
          transactionType: 'VENDOR_RETURN', transactionDate: vrc.date,
          quantityIn: new Prisma.Decimal(0), quantityOut: item.quantity, rate: item.rate,
          balanceQty: new Prisma.Decimal(newBalance),
          condition: 'DAMAGED',
          referenceType: 'VendorReturnChallan', referenceId: id, referenceNo: vrc.challanNo,
          remarks: `Vendor return ${vrc.challanNo}: ${vrc.reason}`, createdBy: postedBy,
        });
      }

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // Recalculate DAMAGED balances for each item
      for (const item of vrc.items) {
        const locationId = (item as any).locationId || null;
        const whereClause: any = { companyId: vrc.companyId, financialYearId: vrc.financialYearId, itemId: item.itemId, condition: 'DAMAGED' };
        if (sourceDepartmentId) whereClause.departmentId = sourceDepartmentId;
        if (locationId) whereClause.locationId = locationId;

        const allTxns = await tx.stockTransaction.findMany({
          where: whereClause,
          orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
          select: { id: true, quantityIn: true, quantityOut: true },
        });
        let runningBalance = 0;
        for (const txn of allTxns) {
          runningBalance += Number(txn.quantityIn) - Number(txn.quantityOut);
          await tx.stockTransaction.update({
            where: { id: txn.id },
            data: { balanceQty: new Prisma.Decimal(runningBalance) },
          });
        }
      }

      await tx.vendorReturnChallan.update({ where: { id }, data: { status: 'Posted', postedAt: new Date(), postedBy } });
      await tx.auditLog.create({
        data: {
          companyId: vrc.companyId, action: 'POST', tableName: 'VendorReturnChallan', recordId: id, recordUuid: vrc.uuid,
          description: `Vendor Return ${vrc.challanNo} posted with ${vrc.items.length} items (DAMAGED condition)`,
          newValues: JSON.stringify({ status: 'Posted', condition: 'DAMAGED', sourceDepartmentId }),
        },
      });
    });

    return serialize(await prisma.vendorReturnChallan.findUnique({ where: { id }, include: { vendor: true, items: { include: { item: true } } } }));
  });

  // ==================== HISTORICAL ROOM-LEVEL OPENING STOCK ====================

  ipcMain.handle('stock:opening-stock:create-room-level', async (_event, data: {
    companyId: number;
    financialYearId: number;
    storeId: number;
    dharamshalaId: number;
    roomId: number;
    itemId: number;
    quantity: number;
    rate: number;
    date: string;
    createdBy: string;
    remarks?: string;
  }) => {
    requireAuth();
    const { companyId, financialYearId, storeId, dharamshalaId, roomId, itemId, quantity, rate, date, createdBy, remarks } = data;

    if (!companyId || !financialYearId || !storeId || !dharamshalaId || !roomId || !itemId || !quantity || quantity <= 0) {
      throw new Error('Invalid input: companyId, financialYearId, storeId, dharamshalaId, roomId, itemId, and positive quantity are required');
    }

    // --- Idempotency check: prevent duplicate opening stock ---
    const existingOpening = await prisma.stockTransaction.findFirst({
      where: {
        companyId, financialYearId, itemId,
        departmentId: dharamshalaId, locationId: roomId,
        transactionType: 'OPENING_STOCK',
      },
    });
    if (existingOpening) {
      throw new Error('Opening stock already exists for this item in this room. Cannot create duplicate.');
    }

    // --- Validation ---
    const [store, dharamshala, room, item] = await Promise.all([
      prisma.department.findUnique({ where: { id: storeId } }),
      prisma.department.findUnique({ where: { id: dharamshalaId } }),
      prisma.location.findUnique({ where: { id: roomId } }),
      prisma.item.findUnique({ where: { id: itemId } }),
    ]);

    if (!store || !store.isActive) throw new Error(`Store department #${storeId} not found or inactive`);
    if (store.departmentType !== 'Store') throw new Error(`Department #${storeId} is not a Store (type: ${store.departmentType})`);
    if (!dharamshala || !dharamshala.isActive) throw new Error(`Dharamshala department #${dharamshalaId} not found or inactive`);
    if (dharamshala.departmentType !== 'Dharamshala') throw new Error(`Department #${dharamshalaId} is not a Dharamshala (type: ${dharamshala.departmentType})`);
    if (!room) throw new Error(`Room location #${roomId} not found`);
    if (room.locationType !== 'Room') throw new Error(`Location #${roomId} is not a Room (type: ${room.locationType})`);
    if (!room.parentId) throw new Error(`Room #${roomId} has no parent Dharamshala/Store location`);
    const parentLocation = await prisma.location.findUnique({ where: { id: room.parentId } });
    if (!parentLocation || (parentLocation.locationType !== 'Dharamshala' && parentLocation.locationType !== 'Store')) {
      throw new Error(`Room #${roomId} parent is not a Dharamshala or Store location`);
    }
    if (!item || !item.isActive) throw new Error(`Item #${itemId} not found or inactive`);

    const qty = Number(quantity);
    const itemRate = Number(rate) || 0;
    const txDate = new Date(date);
    const refTag = `OS-${Date.now()}`;
    const transferRefId = `TRF-${refTag}`;

    const result = await prisma.$transaction(async (tx) => {
      const stockTransactions: any[] = [];

      // ===== LEVEL 1: STORE (2 rows) =====
      // Row 1: OPENING_STOCK IN — store received historically
      const storePrev = await getLatestBalance(tx, companyId, financialYearId, itemId, storeId, null);
      const storeAfterIn = storePrev + qty;
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: storeId, locationId: null,
        transactionType: 'OPENING_STOCK',
        transactionDate: txDate,
        quantityIn: new Prisma.Decimal(qty),
        quantityOut: new Prisma.Decimal(0),
        rate: new Prisma.Decimal(itemRate),
        balanceQty: new Prisma.Decimal(storeAfterIn),
        referenceType: 'OpeningStock',
        referenceId: null,
        referenceNo: refTag,
        condition: 'GOOD',
        remarks: remarks || 'Historical opening stock — received at store',
        createdBy,
      });

      // Row 2: ISSUE OUT — immediately passed to dharamshala
      const storeAfterOut = storeAfterIn - qty;
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: storeId, locationId: null,
        transactionType: 'ISSUE',
        transactionDate: txDate,
        quantityIn: new Prisma.Decimal(0),
        quantityOut: new Prisma.Decimal(qty),
        rate: new Prisma.Decimal(itemRate),
        balanceQty: new Prisma.Decimal(storeAfterOut),
        referenceType: 'OpeningStock',
        referenceId: null,
        referenceNo: refTag,
        condition: 'GOOD',
        remarks: remarks || 'Historical opening stock — issued to dharamshala',
        createdBy,
      });

      // ===== LEVEL 2: DHARAMSHALA POOL (2 rows) =====
      // Row 3: ISSUE IN — dharamshala pool received
      const poolPrev = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, null);
      const poolAfterIn = poolPrev + qty;
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: dharamshalaId, locationId: null,
        transactionType: 'ISSUE',
        transactionDate: txDate,
        quantityIn: new Prisma.Decimal(qty),
        quantityOut: new Prisma.Decimal(0),
        rate: new Prisma.Decimal(itemRate),
        balanceQty: new Prisma.Decimal(poolAfterIn),
        referenceType: 'OpeningStock',
        referenceId: null,
        referenceNo: refTag,
        refTransferId: transferRefId,
        condition: 'GOOD',
        remarks: remarks || 'Historical opening stock — received at dharamshala pool',
        createdBy,
      });

      // Row 4: TRANSFER_OUT — moved from pool to room
      const poolAfterOut = poolAfterIn - qty;
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: dharamshalaId, locationId: null,
        transactionType: 'TRANSFER_OUT',
        transactionDate: txDate,
        quantityIn: new Prisma.Decimal(0),
        quantityOut: new Prisma.Decimal(qty),
        rate: new Prisma.Decimal(itemRate),
        balanceQty: new Prisma.Decimal(poolAfterOut),
        referenceType: 'OpeningStock',
        referenceId: null,
        referenceNo: refTag,
        refTransferId: transferRefId,
        condition: 'GOOD',
        remarks: remarks || 'Historical opening stock — transferred from pool to room',
        createdBy,
      });

      // ===== LEVEL 3: ROOM (1 row) =====
      // Row 5: TRANSFER_IN — room received
      const roomPrev = await getLatestBalance(tx, companyId, financialYearId, itemId, dharamshalaId, roomId);
      const roomAfterIn = roomPrev + qty;
      stockTransactions.push({
        companyId, financialYearId, itemId,
        departmentId: dharamshalaId, locationId: roomId,
        transactionType: 'TRANSFER_IN',
        transactionDate: txDate,
        quantityIn: new Prisma.Decimal(qty),
        quantityOut: new Prisma.Decimal(0),
        rate: new Prisma.Decimal(itemRate),
        balanceQty: new Prisma.Decimal(roomAfterIn),
        referenceType: 'OpeningStock',
        referenceId: null,
        referenceNo: refTag,
        refTransferId: transferRefId,
        condition: 'GOOD',
        remarks: remarks || 'Historical opening stock — received at room',
        createdBy,
      });

      await tx.stockTransaction.createMany({ data: stockTransactions });

      // ===== AssetInstallation for room =====
      const existingInstall = await tx.assetInstallation.findFirst({
        where: { itemId, locationId: roomId, status: 'Active' },
      });
      if (existingInstall) {
        await tx.assetInstallation.update({
          where: { id: existingInstall.id },
          data: { quantity: { increment: qty } },
        });
      } else {
        await tx.assetInstallation.create({
          data: {
            itemId,
            locationId: roomId,
            issueChallanId: null,
            installedDate: txDate,
            quantity: new Prisma.Decimal(qty),
            installedBy: createdBy,
            status: 'Active',
            remarks: 'Historical opening stock — pre-software',
          },
        });
      }

      // ===== Recalculate balances if backdated =====
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, storeId, null, txDate);
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, dharamshalaId, null, txDate);
      await recalculateBalancesAfterInsert(tx, companyId, financialYearId, itemId, dharamshalaId, roomId, txDate);

      // ===== Audit Log =====
      await tx.auditLog.create({
        data: {
          companyId,
          action: 'CREATE',
          tableName: 'StockTransaction',
          recordId: null,
          description: `Historical room-level opening stock created: ${item.itemName} × ${qty} → ${dharamshala.name}/${room.locationName} from ${store.name}`,
          newValues: JSON.stringify({ refTag, storeId, dharamshalaId, roomId, itemId, quantity: qty, rate: itemRate, date }),
        },
      });

      return { success: true, transactionCount: stockTransactions.length, refTag };
    });

    return serialize(result);
  });

  // ─── Challan Draft Save (create/update with nested items) ───────
  ipcMain.handle('challan:receipt:save', async (_event, payload: any, items: any[], isEdit: boolean, id?: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    payload = convertPayloadDates(payload);
    let result;
    if (isEdit && id) {
      result = await prisma.receiptChallan.update({
        where: { id },
        data: { ...payload, items: { deleteMany: {}, create: items } },
        include: { items: true },
      });
    } else {
      // Generate challan number server-side to avoid race conditions
      if (!payload.challanNo) {
        const lastChallan = await prisma.receiptChallan.findFirst({
          where: { companyId: payload.companyId, financialYearId: payload.financialYearId },
          orderBy: { id: 'desc' },
          select: { challanNo: true },
        });
        const lastNo = lastChallan ? parseInt(lastChallan.challanNo.replace('RC-', '')) + 1 : 1;
        payload.challanNo = `RC-${String(lastNo).padStart(5, '0')}`;
      }
      result = await prisma.receiptChallan.create({
        data: { ...payload, items: { create: items } },
        include: { items: true },
      });
    }
    return serialize(result);
  });

  ipcMain.handle('challan:issue:save', async (_event, payload: any, items: any[], isEdit: boolean, id?: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    payload = convertPayloadDates(payload);
    let result;
    if (isEdit && id) {
      result = await prisma.issueChallan.update({
        where: { id },
        data: { ...payload, items: { deleteMany: {}, create: items } },
        include: { items: true },
      });
    } else {
      // Generate challan number server-side to avoid race conditions
      if (!payload.challanNo) {
        const lastChallan = await prisma.issueChallan.findFirst({
          where: { companyId: payload.companyId, financialYearId: payload.financialYearId },
          orderBy: { id: 'desc' },
          select: { challanNo: true },
        });
        const lastNo = lastChallan ? parseInt(lastChallan.challanNo.replace('IC-', '')) + 1 : 1;
        payload.challanNo = `IC-${String(lastNo).padStart(5, '0')}`;
      }
      result = await prisma.issueChallan.create({
        data: { ...payload, items: { create: items } },
        include: { items: true },
      });
    }
    return serialize(result);
  });

  ipcMain.handle('challan:transfer:save', async (_event, payload: any, items: any[], isEdit: boolean, id?: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    payload = convertPayloadDates(payload);
    let result;
    if (isEdit && id) {
      result = await prisma.transferChallan.update({
        where: { id },
        data: { ...payload, items: { deleteMany: {}, create: items } },
        include: { items: true },
      });
    } else {
      // Generate challan number server-side to avoid race conditions
      if (!payload.challanNo) {
        const lastChallan = await prisma.transferChallan.findFirst({
          where: { companyId: payload.companyId, financialYearId: payload.financialYearId },
          orderBy: { id: 'desc' },
          select: { challanNo: true },
        });
        const lastNo = lastChallan ? parseInt(lastChallan.challanNo.replace('TC-', '')) + 1 : 1;
        payload.challanNo = `TC-${String(lastNo).padStart(5, '0')}`;
      }
      result = await prisma.transferChallan.create({
        data: { ...payload, items: { create: items } },
        include: { items: true },
      });
    }
    return serialize(result);
  });

  // ─── Challan CSV Import (simple create without nested items) ───
  ipcMain.handle('challan:receipt:createImport', async (_event, data: any) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    return serialize(await prisma.receiptChallan.create({ data }));
  });

  ipcMain.handle('challan:issue:createImport', async (_event, data: any) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    return serialize(await prisma.issueChallan.create({ data }));
  });

  ipcMain.handle('challan:transfer:createImport', async (_event, data: any) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    return serialize(await prisma.transferChallan.create({ data }));
  });
}
