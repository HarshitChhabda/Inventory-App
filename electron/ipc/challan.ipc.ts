import { ipcMain } from 'electron';
import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { TransactionEngine, CreateMovementInput } from '../../src/main/services/transactionEngine.service';
import { ShiftChallanService } from '../../src/main/services/shiftChallan.service';
import { DamageService } from '../../src/main/services/damage.service';
import { getSession, requirePermission, PERMISSION_KEYS } from '../../src/main/services/auth.service';
import { serialize as _serialize, requireAuth, auditLog } from './helpers';
import { normalizeDate, convertDates } from '../../src/shared/dateUtils';

function parseAndValidateDate(val: any) {
  const d = normalizeDate(val);
  if (!d) throw new Error("Valid transaction date is required");
  return d;
}

function mapDetailsToItems(obj: any): any {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(mapDetailsToItems);
  if (typeof obj === 'object') {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      if (k === 'details') {
        out.items = mapDetailsToItems(obj.details);
      } else {
        out[k] = typeof obj[k] === 'object' && obj[k] !== null && !(obj[k] instanceof Date) ? mapDetailsToItems(obj[k]) : obj[k];
      }
    }
    return out;
  }
  return obj;
}

const serialize = (obj: any) => _serialize(mapDetailsToItems(obj));

let engineInstance: TransactionEngine | null = null;
function getEngine(prisma: PrismaClient): TransactionEngine {
  if (!engineInstance) engineInstance = new TransactionEngine(prisma);
  return engineInstance;
}

export function registerChallanIpc() {
  const prisma = getPrismaClient();
  const engine = getEngine(prisma);
  const shiftService = new ShiftChallanService(prisma);
  const damageService = new DamageService(prisma);

  // Use shared convertDates from src/shared/dateUtils.ts
  const convertPayloadDates = convertDates;

  // ==================== RECEIPT CHALLAN ====================

  ipcMain.handle('challan:receipt:list', async (_event, params) => {
    requireAuth();
    const { companyId, financialYearId, page, pageSize, search, status, vendorId, startDate, endDate } = params;
    const where: any = { companyId, financialYearId, voucherType: 'RC' };
    if (search) {
      where.OR = [
        { voucherNo: { contains: search } },
        { referenceNo: { contains: search } },
        { remarks: { contains: search } },
      ];
    }
    if (status) where.approvalStatus = status;
    if (vendorId) where.vendorId = vendorId;
    if (startDate && endDate) where.transactionDate = { gte: new Date(startDate), lte: new Date(endDate) };

    const [data, total] = await Promise.all([
      prisma.transactionHeader.findMany({
        where,
        include: {
          vendor: true,
          details: { include: { item: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.transactionHeader.count({ where }),
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
    requireAuth();
    return serialize(await prisma.transactionHeader.findUnique({
      where: { id },
      include: {
        company: true,
        financialYear: true,
        vendor: true,
        details: {
          include: { item: { include: { category: true, unit: true } } },
        },
      },
    }));
  });

  ipcMain.handle('challan:receipt:create', async (_event, data) => {
    requireAuth();
    data = convertPayloadDates(data);
    const invoiceDateVal = data.invoiceDate ? parseAndValidateDate(data.invoiceDate) : null;
    const result = await engine.createMovement({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      movementType: 'RC',
      transactionDate: parseAndValidateDate(data.date),
      toStoreId: data.storeId || null,
      vendorId: data.vendorId || null,
      receivedBy: data.receivedBy,
      referenceNo: data.invoiceNumber,
      vehicleNumber: data.vehicleNumber,
      remarks: `Source: ${data.sourceType || 'Direct'}. ${data.remarks || ''}`,
      createdBy: data.receivedBy || 'system',
      initialStatus: data.status === 'Draft' ? 'DRAFT' : 'POSTED',
      invoiceDate: invoiceDateVal,
      items: (data.items || []).map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
        unitId: item.unitId || null,
        remarks: item.remarks || null,
      })),
    });

    return serialize(await prisma.transactionHeader.findUnique({
      where: { id: result.transactionId },
      include: { vendor: true, details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:receipt:update', async (_event, id: number, data: any) => {
    requireAuth();
    const existing = await prisma.transactionHeader.findUnique({ where: { id } });
    if (!existing) throw new Error('Receipt challan not found');
    if (existing.approvalStatus !== 'DRAFT') throw new Error('Cannot edit a posted/cancelled challan');

    await prisma.transactionHeader.update({
      where: { id },
      data: {
        transactionDate: parseAndValidateDate(data.date),
        invoiceDate: data.invoiceDate ? parseAndValidateDate(data.invoiceDate) : null,
        toStoreId: data.storeId || null,
        vendorId: data.vendorId || null,
        receivedBy: data.receivedBy,
        referenceNo: data.invoiceNumber,
        vehicleNumber: data.vehicleNumber,
        remarks: `Source: ${data.sourceType || 'Direct'}. ${data.remarks || ''}`,
      },
    });

    await prisma.transactionDetail.deleteMany({ where: { transactionId: id } });
    if (data.items?.length) {
      await prisma.transactionDetail.createMany({
        data: data.items.map((item: any) => ({
          transactionId: id,
          itemId: item.itemId,
          quantity: new Prisma.Decimal(item.quantity),
          rate: new Prisma.Decimal(item.rate || 0),
          serialNumber: item.serialNumber || null,
          amount: new Prisma.Decimal((item.quantity || 0) * (item.rate || 0)),
          remarks: item.remarks || null,
        })),
      });
    }

    await auditLog('UPDATE', 'TransactionHeader', id, 'Updated receipt challan');
    return serialize(await prisma.transactionHeader.findUnique({
      where: { id },
      include: { vendor: true, details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:receipt:save', async (_event, payload: any, items: any[], isEdit: boolean, id?: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    payload = convertPayloadDates(payload);

    if (isEdit && id) {
      const existing = await prisma.transactionHeader.findUnique({ where: { id } });
      if (!existing) throw new Error('Receipt challan not found');
      if (existing.approvalStatus !== 'DRAFT') throw new Error('Only draft challans can be edited');

      if (!payload.storeId) throw new Error('Store is required');
      if (!items || items.length === 0) throw new Error('At least one item is required');
      const store = await prisma.store.findUnique({ where: { id: payload.storeId } });
      if (!store || !store.isActive) throw new Error('Invalid or inactive store');

      for (const item of items) {
        if (!item.itemId) throw new Error('Item ID is required for all rows');
        const itemMaster = await prisma.item.findUnique({ where: { id: item.itemId } });
        if (!itemMaster || !itemMaster.isActive) throw new Error(`Invalid or inactive item: ${item.itemId}`);
        if (!item.quantity || Number(item.quantity) <= 0) throw new Error(`Quantity must be positive for item ${item.itemId}`);
      }

      const { SystemConfigurationService } = await import('../../src/main/services/systemConfiguration.service');
      const configService = new SystemConfigurationService(prisma);
      const defaultCondition = await configService.get(existing.companyId, 'STOCK.DEFAULT_CONDITION') || 'GOOD';

      await prisma.$transaction(async (tx) => {
        await tx.transactionHeader.update({
          where: { id },
          data: {
            transactionDate: parseAndValidateDate(payload.date),
            invoiceDate: payload.invoiceDate ? parseAndValidateDate(payload.invoiceDate) : null,
            toStoreId: payload.storeId || null,
            vendorId: payload.vendorId || null,
            receivedBy: payload.receivedBy,
            referenceNo: payload.invoiceNumber,
            vehicleNumber: payload.vehicleNumber,
            remarks: payload.remarks,
          },
        });
        await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
        await tx.ledgerEntry.deleteMany({ where: { transactionId: id } });

        if (items?.length) {
          await tx.transactionDetail.createMany({
            data: items.map((item: any) => ({
              transactionId: id,
              itemId: item.itemId,
              quantity: new Prisma.Decimal(item.quantity),
              rate: new Prisma.Decimal(item.rate || 0),
              serialNumber: item.serialNumber || null,
              amount: new Prisma.Decimal((item.quantity || 0) * (item.rate || 0)),
              remarks: item.remarks || null,
            })),
          });

          const voucherNo = existing.voucherNo;
          const ledgerEntries: any[] = [];
          for (const item of items) {
            ledgerEntries.push({
              companyId: existing.companyId,
              financialYearId: existing.financialYearId,
              transactionId: id,
              itemId: item.itemId,
              storeId: payload.storeId,
              locationId: item.toLocationId || null,
              voucherNo,
              voucherType: 'RC',
              movementType: 'PURCHASE_RECEIPT',
              quantityIn: new Prisma.Decimal(Number(item.quantity)),
              quantityOut: new Prisma.Decimal(0),
              balanceQty: new Prisma.Decimal(0),
              rate: new Prisma.Decimal(item.rate || 0),
              condition: item.condition || defaultCondition,
              serialNumber: item.serialNumber || null,
              transactionDate: parseAndValidateDate(payload.date),
              createdBy: session.username,
            });
          }
          await tx.ledgerEntry.createMany({ data: ledgerEntries });

          const affectedPairs = [...new Map(ledgerEntries.map((e) => [`${e.itemId}-${e.storeId}`, { itemId: e.itemId, storeId: e.storeId }])).values()];
          for (const pair of affectedPairs) {
            const allEntries = await tx.ledgerEntry.findMany({
              where: { companyId: existing.companyId, financialYearId: existing.financialYearId, itemId: pair.itemId, storeId: pair.storeId },
              orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
              select: { id: true, quantityIn: true, quantityOut: true },
            });
            let runningBalance = 0;
            for (const entry of allEntries) {
              runningBalance += Number(entry.quantityIn) - Number(entry.quantityOut);
              await tx.ledgerEntry.update({ where: { id: entry.id }, data: { balanceQty: new Prisma.Decimal(runningBalance) } });
            }
          }
        }
      });
      await auditLog('UPDATE', 'TransactionHeader', id, 'Saved receipt challan');
      return serialize(await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } }));
    }

    const invoiceDateVal = payload.invoiceDate ? parseAndValidateDate(payload.invoiceDate) : null;
    const result = await engine.createMovement({
      companyId: payload.companyId,
      financialYearId: payload.financialYearId,
      movementType: 'RC',
      transactionDate: parseAndValidateDate(payload.date),
      toStoreId: payload.storeId || null,
      vendorId: payload.vendorId || null,
      receivedBy: payload.receivedBy,
      referenceNo: payload.invoiceNumber,
      vehicleNumber: payload.vehicleNumber,
      remarks: payload.remarks,
      createdBy: session.username,
      initialStatus: 'DRAFT',
      invoiceDate: invoiceDateVal,
      items: (items || []).map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        condition: item.condition || 'GOOD',
        unitId: item.unitId || null,
        serialNumber: item.serialNumber || null,
        remarks: item.remarks || null,
      })),
    });

    return serialize(await prisma.transactionHeader.findUnique({ where: { id: result.transactionId }, include: { details: true } }));
  });

  ipcMain.handle('challan:receipt:post', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    const header = await prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: true },
    });
    if (!header) throw new Error('Receipt challan not found');
    if (header.approvalStatus !== 'DRAFT') throw new Error('Challan is not in Draft status');

    await prisma.transactionHeader.update({
      where: { id },
      data: {
        approvalStatus: 'POSTED',
        postedBy: session.fullName,
        postedAt: new Date(),
      },
    });

    await auditLog('UPDATE', 'TransactionHeader', id, 'Posted receipt challan');
    return serialize(await prisma.transactionHeader.findUnique({
      where: { id },
      include: { vendor: true, details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:receipt:cancel', async (_event, id: number, cancelReason: string) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.CANCEL_CHALLAN);
    const header = await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } });
    if (!header) throw new Error('Receipt challan not found');
    if (header.approvalStatus !== 'POSTED') throw new Error('Only posted challans can be cancelled');
    if (header.voucherType === 'RV') throw new Error('Cannot cancel a reversal transaction');

    const result = await engine.reverseAndCancel({
      companyId: header.companyId,
      financialYearId: header.financialYearId,
      transactionDate: new Date(),
      fromStoreId: header.toStoreId,
      remarks: `Reversal for cancelled ${header.voucherNo}: ${cancelReason}`,
      createdBy: session.username,
      items: header.details.map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
      })),
    }, id, cancelReason);

    return serialize(await prisma.transactionHeader.findUnique({ where: { id } }));
  });

  ipcMain.handle('challan:receipt:delete', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.DELETE_CHALLAN);
    const existing = await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } });
    if (!existing) throw new Error('Receipt challan not found');
    if (existing.approvalStatus === 'POSTED') throw new Error('Cannot delete a posted challan. Cancel it first.');
    if (existing.approvalStatus === 'REVERSED') throw new Error('Cannot delete a reversed challan.');
    if (existing.approvalStatus === 'CANCELLED') throw new Error('Cannot delete a cancelled challan.');

    await prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({ where: { transactionId: id } });
      await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
      await tx.transactionHeader.delete({ where: { id } });
    });
    await auditLog('DELETE', 'TransactionHeader', id, `Deleted receipt challan ${existing.voucherNo}`);
    return { success: true };
  });

  // ==================== ISSUE CHALLAN ====================

  ipcMain.handle('challan:issue:list', async (_event, params) => {
    requireAuth();
    const { companyId, financialYearId, page, pageSize, search, status, departmentId, startDate, endDate } = params;
    const where: any = { companyId, financialYearId, voucherType: 'IC' };
    if (search) {
      where.OR = [
        { voucherNo: { contains: search } },
        { purpose: { contains: search } },
        { remarks: { contains: search } },
      ];
    }
    if (status) where.approvalStatus = status;
    if (departmentId) where.departmentId = departmentId;
    if (startDate && endDate) where.transactionDate = { gte: new Date(startDate), lte: new Date(endDate) };

    const [data, total] = await Promise.all([
      prisma.transactionHeader.findMany({
        where,
        include: {
          details: { include: { item: true } },
          demandAllocations: {
            include: {
              materialDemandItem: {
                include: { serviceRequest: { select: { id: true, requestNumber: true } } },
              },
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.transactionHeader.count({ where }),
    ]);

    return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });

  ipcMain.handle('challan:issue:save', async (_event, payload: any, items: any[], isEdit: boolean, id?: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    payload = convertPayloadDates(payload);

    if (isEdit && id) {
      // Verify DRAFT status
      const existing = await prisma.transactionHeader.findUnique({ where: { id } });
      if (!existing) throw new Error('Issue challan not found');
      if (existing.approvalStatus !== 'DRAFT') throw new Error('Only draft challans can be edited');

      // Validate room requirement
      if (payload.destinationStoreId) {
        const roomLocations = await prisma.location.findMany({
          where: { storeId: payload.destinationStoreId, locationType: 'Room', isActive: true },
          select: { id: true },
        });
        if (roomLocations.length > 0) {
          const itemsWithoutRoom = items.filter((i: any) => !i.locationId);
          if (itemsWithoutRoom.length > 0) {
            throw new Error('Room/Location is required for items when destination store has rooms');
          }
        }
      }

      // Validate stock availability
      const itemIds = [...new Set(items.map((i: any) => i.itemId))];
      const balances = await prisma.ledgerEntry.groupBy({
        by: ['itemId'],
        where: {
          companyId: payload.companyId,
          financialYearId: payload.financialYearId,
          itemId: { in: itemIds },
          storeId: payload.sourceStoreId,
        },
        _sum: { quantityIn: true, quantityOut: true },
      });
      const balanceMap = new Map(balances.map((r) => [r.itemId, Number(r._sum.quantityIn || 0) - Number(r._sum.quantityOut || 0)]));
      for (const item of items) {
        const balance = balanceMap.get(item.itemId) || 0;
        if (Number(item.quantity) > balance) {
          throw new Error(`Insufficient stock for item ${item.itemId}: available ${balance}, requested ${item.quantity}`);
        }
      }

      // Get default condition
      const { SystemConfigurationService } = await import('../../src/main/services/systemConfiguration.service');
      const configService = new SystemConfigurationService(prisma);
      const defaultCondition = await configService.get(payload.companyId, 'STOCK.DEFAULT_CONDITION') || 'GOOD';

      await prisma.$transaction(async (tx) => {
        // Update header
        await tx.transactionHeader.update({
          where: { id },
          data: {
            transactionDate: parseAndValidateDate(payload.date),
            referenceNo: payload.referenceNo || null,
            fromStoreId: payload.sourceStoreId || null,
            toStoreId: payload.destinationStoreId || payload.departmentId || null,
            departmentId: payload.departmentId || null,
            issuedBy: payload.issuedBy,
            purpose: payload.purpose,
            remarks: payload.remarks,
          },
        });

        // Delete old details and ledger entries
        await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
        await tx.ledgerEntry.deleteMany({ where: { transactionId: id } });

        // Create new details
        if (items?.length) {
          await tx.transactionDetail.createMany({
            data: items.map((item: any) => ({
              transactionId: id,
              itemId: item.itemId,
              quantity: new Prisma.Decimal(item.quantity),
              rate: new Prisma.Decimal(0),
              serialNumber: item.serialNumber || null,
              remarks: item.remarks || item.purpose || null,
              toLocationId: item.locationId || null,
              condition: item.condition || defaultCondition,
            })),
          });
        }

        // Recreate ledger entries with proper balance calculation
        if (items?.length && payload.sourceStoreId) {
          const voucherNo = existing.voucherNo;
          const ledgerEntries: any[] = [];

          // Source entries (ISSUE_OUT)
          for (const item of items) {
            ledgerEntries.push({
              companyId: payload.companyId,
              financialYearId: payload.financialYearId,
              transactionId: id,
              itemId: item.itemId,
              storeId: payload.sourceStoreId,
              voucherNo,
              voucherType: 'IC',
              movementType: 'ISSUE_OUT',
              quantityIn: new Prisma.Decimal(0),
              quantityOut: new Prisma.Decimal(Number(item.quantity)),
              balanceQty: new Prisma.Decimal(0),
              rate: new Prisma.Decimal(0),
              condition: item.condition || defaultCondition,
              serialNumber: item.serialNumber || null,
              transactionDate: parseAndValidateDate(payload.date),
              createdBy: session.username,
            });
          }

          // Destination entries (ISSUE_IN)
          if (payload.destinationStoreId) {
            for (const item of items) {
              ledgerEntries.push({
                companyId: payload.companyId,
                financialYearId: payload.financialYearId,
                transactionId: id,
                itemId: item.itemId,
                storeId: payload.destinationStoreId,
                locationId: item.locationId || null,
                voucherNo,
                voucherType: 'IC',
                movementType: 'ISSUE_IN',
                quantityIn: new Prisma.Decimal(Number(item.quantity)),
                quantityOut: new Prisma.Decimal(0),
                balanceQty: new Prisma.Decimal(0),
                rate: new Prisma.Decimal(0),
                condition: item.condition || defaultCondition,
                serialNumber: item.serialNumber || null,
                transactionDate: parseAndValidateDate(payload.date),
                createdBy: session.username,
              });
            }
          }

          await tx.ledgerEntry.createMany({ data: ledgerEntries });

          // Recalculate running balances for affected item+store pairs
          const affectedPairs = [...new Map(ledgerEntries.map((e) => [`${e.itemId}-${e.storeId}`, { itemId: e.itemId, storeId: e.storeId }])).values()];
          for (const pair of affectedPairs) {
            const allEntries = await tx.ledgerEntry.findMany({
              where: { companyId: payload.companyId, financialYearId: payload.financialYearId, itemId: pair.itemId, storeId: pair.storeId },
              orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
              select: { id: true, quantityIn: true, quantityOut: true },
            });
            let runningBalance = 0;
            for (const entry of allEntries) {
              runningBalance += Number(entry.quantityIn) - Number(entry.quantityOut);
              await tx.ledgerEntry.update({ where: { id: entry.id }, data: { balanceQty: new Prisma.Decimal(runningBalance) } });
            }
          }
        }
      });
      await auditLog('UPDATE', 'TransactionHeader', id, 'Saved issue challan');

      if (payload.demandData?.serviceRequestId && payload.demandData.demandAllocations && payload.demandData.demandAllocations.length > 0) {
        const { MaterialDemandService } = await import('../../src/main/services/materialDemand.service');
        await MaterialDemandService.reverseAllocationsForTransaction(id);
        for (const alloc of payload.demandData.demandAllocations) {
          const demandItem = await prisma.materialDemandItem.findUnique({ where: { id: alloc.demandItemId } });
          if (!demandItem) throw new Error(`Demand item ${alloc.demandItemId} not found`);
          const remaining = Number(demandItem.quantityRequested) - Number(demandItem.quantityIssued) + Number(demandItem.quantityReturned);
          if (Number(alloc.quantityAllocated) > remaining) {
            throw new Error(`Issue quantity ${alloc.quantityAllocated} exceeds demand remaining ${remaining} for item "${demandItem.itemName}"`);
          }
        }
        await MaterialDemandService.createAllocations(
          payload.demandData.serviceRequestId,
          id,
          payload.demandData.demandAllocations,
        );
      }

      return serialize(await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } }));
    }

    const result = await engine.createMovement({
      companyId: payload.companyId,
      financialYearId: payload.financialYearId,
      movementType: 'IC',
      transactionDate: parseAndValidateDate(payload.date),
      fromStoreId: payload.sourceStoreId || null,
      toStoreId: payload.destinationStoreId || payload.departmentId || null,
      departmentId: payload.departmentId || null,
      referenceNo: payload.referenceNo || null,
      issuedBy: payload.issuedBy,
      purpose: payload.purpose,
      remarks: payload.remarks,
      createdBy: session.username,
      initialStatus: 'DRAFT',
      items: (items || []).map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: 0,
        serialNumber: item.serialNumber || null,
        condition: item.condition || 'GOOD',
        unitId: item.unitId || null,
        toLocationId: item.locationId || null,
        remarks: item.remarks || item.purpose || null,
      })),
    });

    if (payload.demandData?.serviceRequestId && payload.demandData.demandAllocations && payload.demandData.demandAllocations.length > 0) {
      const { MaterialDemandService } = await import('../../src/main/services/materialDemand.service');
      for (const alloc of payload.demandData.demandAllocations) {
        const demandItem = await prisma.materialDemandItem.findUnique({ where: { id: alloc.demandItemId } });
        if (!demandItem) throw new Error(`Demand item ${alloc.demandItemId} not found`);
        const remaining = Number(demandItem.quantityRequested) - Number(demandItem.quantityIssued) + Number(demandItem.quantityReturned);
        if (Number(alloc.quantityAllocated) > remaining) {
          throw new Error(`Issue quantity ${alloc.quantityAllocated} exceeds demand remaining ${remaining} for item "${demandItem.itemName}"`);
        }
      }
      await MaterialDemandService.createAllocations(
        payload.demandData.serviceRequestId,
        result.transactionId,
        payload.demandData.demandAllocations,
      );
    }

    return serialize(await prisma.transactionHeader.findUnique({ where: { id: result.transactionId }, include: { details: true } }));
  });

  ipcMain.handle('challan:issue:post', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await engine.postTransaction(id);
    await auditLog('UPDATE', 'TransactionHeader', id, 'Posted issue challan');
    return serialize(await prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:issue:cancel', async (_event, id: number, cancelReason: string) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.CANCEL_CHALLAN);
    const header = await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } });
    if (!header) throw new Error('Issue challan not found');
    if (header.approvalStatus !== 'POSTED') throw new Error('Only posted challans can be cancelled');
    if (header.voucherType === 'RV') throw new Error('Cannot cancel a reversal transaction');

    const existingConsumption = await prisma.materialConsumptionItem.findFirst({
      where: { transactionHeaderId: id },
    });
    if (existingConsumption) {
      throw new Error('Cannot cancel this Store Issue because material has already been consumed. Reverse the Consumption first.');
    }

    const existingInstallation = await prisma.materialInstallationItem.findFirst({
      where: { transactionHeaderId: id },
    });
    if (existingInstallation) {
      throw new Error('Cannot cancel this Store Issue because material has already been installed. Reverse the Installation first.');
    }

    const result = await engine.reverseAndCancel({
      companyId: header.companyId,
      financialYearId: header.financialYearId,
      transactionDate: new Date(),
      fromStoreId: header.fromStoreId,
      toStoreId: header.fromStoreId,
      remarks: `Reversal for cancelled ${header.voucherNo}: ${cancelReason}`,
      createdBy: session.username,
      items: header.details.map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
      })),
    }, id, cancelReason);

    const { MaterialDemandService } = await import('../../src/main/services/materialDemand.service');
    await MaterialDemandService.reverseAllocationsForTransaction(id);

    return serialize(await prisma.transactionHeader.findUnique({ where: { id } }));
  });

  ipcMain.handle('challan:issue:delete', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.DELETE_CHALLAN);
    const existing = await prisma.transactionHeader.findUnique({ where: { id } });
    if (!existing) throw new Error('Issue challan not found');
    if (existing.approvalStatus === 'POSTED') throw new Error('Cannot delete a posted challan. Cancel it first.');
    if (existing.approvalStatus === 'REVERSED') throw new Error('Cannot delete a reversed challan.');
    if (existing.approvalStatus === 'CANCELLED') throw new Error('Cannot delete a cancelled challan.');

    await prisma.$transaction(async (tx) => {
      await tx.demandAllocation.deleteMany({ where: { transactionHeaderId: id } });
      await tx.ledgerEntry.deleteMany({ where: { transactionId: id } });
      await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
      await tx.transactionHeader.delete({ where: { id } });
    });
    await auditLog('DELETE', 'TransactionHeader', id, `Deleted issue challan ${existing.voucherNo}`);
    return { success: true };
  });

  // ==================== TRANSFER CHALLAN ====================

  ipcMain.handle('challan:transfer:list', async (_event, params) => {
    requireAuth();
    const { companyId, financialYearId, page, pageSize, search, status, startDate, endDate } = params;
    const where: any = { companyId, financialYearId, voucherType: 'TC' };
    if (search) {
      where.OR = [
        { voucherNo: { contains: search } },
        { remarks: { contains: search } },
      ];
    }
    if (status) where.approvalStatus = status;
    if (startDate && endDate) where.transactionDate = { gte: new Date(startDate), lte: new Date(endDate) };

    const [data, total] = await Promise.all([
      prisma.transactionHeader.findMany({
        where,
        include: { details: { include: { item: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.transactionHeader.count({ where }),
    ]);

    return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });

  ipcMain.handle('challan:transfer:create', async (_event, data) => {
    requireAuth();
    data = convertPayloadDates(data);
    const result = await engine.createMovement({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      movementType: 'TC',
      transactionDate: parseAndValidateDate(data.date),
      fromStoreId: data.fromDepartmentId || data.fromStoreId || null,
      toStoreId: data.toDepartmentId || data.toStoreId || null,
      issuedBy: data.transferredBy,
      remarks: data.remarks,
      createdBy: data.transferredBy || 'system',
      initialStatus: data.status === 'Draft' ? 'DRAFT' : 'POSTED',
      items: (data.items || []).map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        fromLocationId: item.locationId || null,
        toLocationId: item.toLocationId || null,
        remarks: item.remarks || null,
      })),
    });

    return serialize(await prisma.transactionHeader.findUnique({
      where: { id: result.transactionId },
      include: { details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:transfer:update', async (_event, id: number, data: any) => {
    requireAuth();
    const existing = await prisma.transactionHeader.findUnique({ where: { id } });
    if (!existing) throw new Error('Transfer challan not found');
    if (existing.approvalStatus !== 'DRAFT') throw new Error('Cannot edit a posted/cancelled challan');

    await prisma.transactionHeader.update({
      where: { id },
      data: {
        transactionDate: parseAndValidateDate(data.date),
        fromStoreId: data.fromDepartmentId || data.fromStoreId || null,
        toStoreId: data.toDepartmentId || data.toStoreId || null,
        issuedBy: data.transferredBy,
        remarks: data.remarks,
      },
    });

    await prisma.transactionDetail.deleteMany({ where: { transactionId: id } });
    if (data.items?.length) {
      await prisma.transactionDetail.createMany({
        data: data.items.map((item: any) => ({
          transactionId: id,
          itemId: item.itemId,
          quantity: new Prisma.Decimal(item.quantity),
          rate: new Prisma.Decimal(item.rate || 0),
          serialNumber: item.serialNumber || null,
          fromLocationId: item.locationId || null,
          toLocationId: item.toLocationId || null,
          remarks: item.remarks || null,
        })),
      });
    }

    await auditLog('UPDATE', 'TransactionHeader', id, 'Updated transfer challan');
    return serialize(await prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:transfer:save', async (_event, payload: any, items: any[], isEdit: boolean, id?: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    payload = convertPayloadDates(payload);

    if (isEdit && id) {
      const existing = await prisma.transactionHeader.findUnique({ where: { id } });
      if (!existing) throw new Error('Transfer challan not found');
      if (existing.approvalStatus !== 'DRAFT') throw new Error('Only draft challans can be edited');

      const fromStoreId = payload.fromDepartmentId || payload.fromStoreId;
      const toStoreId = payload.toDepartmentId || payload.toStoreId;
      if (!fromStoreId) throw new Error('Source store is required');
      if (!toStoreId) throw new Error('Destination store is required');
      if (!items || items.length === 0) throw new Error('At least one item is required');

      const [srcStore, dstStore] = await Promise.all([
        prisma.store.findUnique({ where: { id: fromStoreId } }),
        prisma.store.findUnique({ where: { id: toStoreId } }),
      ]);
      if (!srcStore || !srcStore.isActive) throw new Error('Invalid or inactive source store');
      if (!dstStore || !dstStore.isActive) throw new Error('Invalid or inactive destination store');

      const roomLocations = await prisma.location.findMany({
        where: { storeId: toStoreId, locationType: 'Room', isActive: true },
        select: { id: true },
      });
      if (roomLocations.length > 0) {
        const itemsWithoutRoom = items.filter((i: any) => !i.toLocationId);
        if (itemsWithoutRoom.length > 0) {
          throw new Error('Room/Location is required for items when destination store has rooms');
        }
      }

      const itemIds = [...new Set(items.map((i: any) => i.itemId))];
      const balances = await prisma.ledgerEntry.groupBy({
        by: ['itemId'],
        where: {
          companyId: existing.companyId,
          financialYearId: existing.financialYearId,
          itemId: { in: itemIds },
          storeId: fromStoreId,
        },
        _sum: { quantityIn: true, quantityOut: true },
      });
      const balanceMap = new Map(balances.map((r) => [r.itemId, Number(r._sum.quantityIn || 0) - Number(r._sum.quantityOut || 0)]));
      for (const item of items) {
        const balance = balanceMap.get(item.itemId) || 0;
        if (Number(item.quantity) > balance) {
          throw new Error(`Insufficient stock for item ${item.itemId}: available ${balance}, requested ${item.quantity}`);
        }
      }

      const { SystemConfigurationService } = await import('../../src/main/services/systemConfiguration.service');
      const configService = new SystemConfigurationService(prisma);
      const defaultCondition = await configService.get(existing.companyId, 'STOCK.DEFAULT_CONDITION') || 'GOOD';

      await prisma.$transaction(async (tx) => {
        await tx.transactionHeader.update({
          where: { id },
          data: {
            transactionDate: parseAndValidateDate(payload.date),
            fromStoreId,
            toStoreId,
            issuedBy: payload.transferredBy,
            remarks: payload.remarks,
          },
        });
        await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
        await tx.ledgerEntry.deleteMany({ where: { transactionId: id } });

        if (items?.length) {
          await tx.transactionDetail.createMany({
            data: items.map((item: any) => ({
              transactionId: id,
              itemId: item.itemId,
              quantity: new Prisma.Decimal(item.quantity),
              rate: new Prisma.Decimal(item.rate || 0),
              serialNumber: item.serialNumber || null,
              fromLocationId: item.fromLocationId || null,
              toLocationId: item.toLocationId || null,
              remarks: item.remarks || null,
            })),
          });

          const voucherNo = existing.voucherNo;
          const ledgerEntries: any[] = [];
          for (const item of items) {
            ledgerEntries.push({
              companyId: existing.companyId,
              financialYearId: existing.financialYearId,
              transactionId: id,
              itemId: item.itemId,
              storeId: fromStoreId,
              locationId: item.fromLocationId || null,
              voucherNo,
              voucherType: 'TC',
              movementType: 'TRANSFER_OUT',
              quantityIn: new Prisma.Decimal(0),
              quantityOut: new Prisma.Decimal(Number(item.quantity)),
              balanceQty: new Prisma.Decimal(0),
              rate: new Prisma.Decimal(item.rate || 0),
              condition: item.condition || defaultCondition,
              serialNumber: item.serialNumber || null,
              transactionDate: parseAndValidateDate(payload.date),
              createdBy: session.username,
            });
            ledgerEntries.push({
              companyId: existing.companyId,
              financialYearId: existing.financialYearId,
              transactionId: id,
              itemId: item.itemId,
              storeId: toStoreId,
              locationId: item.toLocationId || null,
              voucherNo,
              voucherType: 'TC',
              movementType: 'TRANSFER_IN',
              quantityIn: new Prisma.Decimal(Number(item.quantity)),
              quantityOut: new Prisma.Decimal(0),
              balanceQty: new Prisma.Decimal(0),
              rate: new Prisma.Decimal(item.rate || 0),
              condition: item.condition || defaultCondition,
              serialNumber: item.serialNumber || null,
              transactionDate: parseAndValidateDate(payload.date),
              createdBy: session.username,
            });
          }
          await tx.ledgerEntry.createMany({ data: ledgerEntries });

          const affectedPairs = [...new Map(ledgerEntries.map((e) => [`${e.itemId}-${e.storeId}`, { itemId: e.itemId, storeId: e.storeId }])).values()];
          for (const pair of affectedPairs) {
            const allEntries = await tx.ledgerEntry.findMany({
              where: { companyId: existing.companyId, financialYearId: existing.financialYearId, itemId: pair.itemId, storeId: pair.storeId },
              orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
              select: { id: true, quantityIn: true, quantityOut: true },
            });
            let runningBalance = 0;
            for (const entry of allEntries) {
              runningBalance += Number(entry.quantityIn) - Number(entry.quantityOut);
              await tx.ledgerEntry.update({ where: { id: entry.id }, data: { balanceQty: new Prisma.Decimal(runningBalance) } });
            }
          }
        }
      });
      await auditLog('UPDATE', 'TransactionHeader', id, 'Saved transfer challan');
      return serialize(await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } }));
    }

    const result = await engine.createMovement({
      companyId: payload.companyId,
      financialYearId: payload.financialYearId,
      movementType: 'TC',
      transactionDate: parseAndValidateDate(payload.date),
      fromStoreId: payload.fromDepartmentId || payload.fromStoreId || null,
      toStoreId: payload.toDepartmentId || payload.toStoreId || null,
      issuedBy: payload.transferredBy,
      remarks: payload.remarks,
      createdBy: session.username,
      initialStatus: 'DRAFT',
      items: (items || []).map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
        condition: item.condition || 'GOOD',
        remarks: item.remarks || null,
      })),
    });

    return serialize(await prisma.transactionHeader.findUnique({ where: { id: result.transactionId }, include: { details: true } }));
  });

  ipcMain.handle('challan:transfer:post', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    const header = await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } });
    if (!header) throw new Error('Transfer challan not found');
    if (header.approvalStatus !== 'DRAFT') throw new Error('Challan is not in Draft status');

    await prisma.transactionHeader.update({
      where: { id },
      data: {
        approvalStatus: 'POSTED',
        postedBy: session.fullName,
        postedAt: new Date(),
      },
    });

    await auditLog('UPDATE', 'TransactionHeader', id, 'Posted transfer challan');
    return serialize(await prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:transfer:cancel', async (_event, id: number, cancelReason: string) => {
    if (!cancelReason || cancelReason.trim().length === 0) throw new Error('Cancel reason is required');
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.CANCEL_CHALLAN);
    const header = await prisma.transactionHeader.findUnique({ where: { id }, include: { details: true } });
    if (!header) throw new Error('Transfer challan not found');
    if (header.approvalStatus !== 'POSTED') throw new Error('Only posted challans can be cancelled');
    if (header.voucherType === 'RV') throw new Error('Cannot cancel a reversal transaction');

    const result = await engine.reverseAndCancel({
      companyId: header.companyId,
      financialYearId: header.financialYearId,
      transactionDate: new Date(),
      fromStoreId: header.toStoreId,
      toStoreId: header.fromStoreId,
      remarks: `Reversal for cancelled ${header.voucherNo}: ${cancelReason}`,
      createdBy: session.username,
      items: header.details.map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
        fromLocationId: item.fromLocationId || null,
        toLocationId: item.toLocationId || null,
      })),
    }, id, cancelReason);

    return serialize(await prisma.transactionHeader.findUnique({ where: { id } }));
  });

  ipcMain.handle('challan:transfer:delete', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.DELETE_CHALLAN);
    const existing = await prisma.transactionHeader.findUnique({ where: { id } });
    if (!existing) throw new Error('Transfer challan not found');
    if (existing.approvalStatus === 'POSTED') throw new Error('Cannot delete a posted challan. Cancel it first.');
    if (existing.approvalStatus === 'REVERSED') throw new Error('Cannot delete a reversed challan.');
    if (existing.approvalStatus === 'CANCELLED') throw new Error('Cannot delete a cancelled challan.');

    await prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.deleteMany({ where: { transactionId: id } });
      await tx.transactionDetail.deleteMany({ where: { transactionId: id } });
      await tx.transactionHeader.delete({ where: { id } });
    });
    await auditLog('DELETE', 'TransactionHeader', id, `Deleted transfer challan ${existing.voucherNo}`);
    return { success: true };
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

    const result = await engine.createMovement({
      companyId: data.companyId,
      financialYearId: data.financialYearId || 1,
      movementType: 'DM',
      transactionDate: parseAndValidateDate(data.date),
      fromStoreId: data.storeId || null,
      remarks: `Damage: ${data.reason}. ${data.remarks || ''}`,
      createdBy: data.reportedBy,
      initialStatus: 'POSTED',
      items: [{
        itemId: data.itemId,
        quantity: Number(data.quantity),
        rate: 0,
        serialNumber: data.serialNumber || null,
        condition: 'DAMAGED',
      }],
    });

    return serialize(await prisma.transactionHeader.findUnique({
      where: { id: result.transactionId },
      include: { details: { include: { item: true } } },
    }));
  });

  // ==================== REPAIR WORKFLOW ====================

  ipcMain.handle('challan:repair:send', async (_event, data: any) => {
    requireAuth();
    data = convertPayloadDates(data);
    if (!data.companyId) throw new Error('Company ID is required');
    if (!data.financialYearId) throw new Error('Financial Year ID is required');
    if (!data.itemId) throw new Error('Item ID is required');
    if (!data.storeId) throw new Error('Store ID is required');
    if (!data.quantity || data.quantity <= 0) throw new Error('Quantity must be positive');
    if (!data.sentBy) throw new Error('Sent by is required');
    if (!data.transactionDate) throw new Error('Transaction date is required');

    return serialize(await damageService.sendToRepair({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      itemId: data.itemId,
      storeId: data.storeId,
      quantity: Number(data.quantity),
      sentBy: data.sentBy,
      remarks: data.remarks,
      transactionDate: parseAndValidateDate(data.transactionDate),
    }));
  });

  ipcMain.handle('challan:repair:receive', async (_event, data: any) => {
    requireAuth();
    data = convertPayloadDates(data);
    if (!data.companyId) throw new Error('Company ID is required');
    if (!data.financialYearId) throw new Error('Financial Year ID is required');
    if (!data.itemId) throw new Error('Item ID is required');
    if (!data.storeId) throw new Error('Store ID is required');
    if (!data.quantity || data.quantity <= 0) throw new Error('Quantity must be positive');
    if (!data.receivedBy) throw new Error('Received by is required');
    if (!data.transactionDate) throw new Error('Transaction date is required');

    return serialize(await damageService.receiveFromRepair({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      itemId: data.itemId,
      storeId: data.storeId,
      quantity: Number(data.quantity),
      receivedBy: data.receivedBy,
      remarks: data.remarks,
      transactionDate: parseAndValidateDate(data.transactionDate),
    }));
  });

  // ==================== SCRAP WORKFLOW ====================

  ipcMain.handle('challan:scrap:create', async (_event, data: any) => {
    requireAuth();
    data = convertPayloadDates(data);
    if (!data.companyId) throw new Error('Company ID is required');
    if (!data.itemId) throw new Error('Item ID is required');
    if (!data.storeId) throw new Error('Store ID is required');
    if (!data.quantity || data.quantity <= 0) throw new Error('Quantity must be positive');
    if (!data.reason) throw new Error('Reason is required');
    if (!data.reportedBy) throw new Error('Reported by is required');
    if (!data.transactionDate) throw new Error('Transaction date is required');

    const fy = data.financialYearId
      ? data.financialYearId
      : (await prisma.financialYear.findFirst({
          where: { companyId: data.companyId, startDate: { lte: parseAndValidateDate(data.transactionDate) }, endDate: { gte: parseAndValidateDate(data.transactionDate) }, isClosed: false },
        }))?.id;

    if (!fy) throw new Error('No open financial year found for this date');

    return serialize(await damageService.create({
      companyId: data.companyId,
      financialYearId: fy,
      itemId: data.itemId,
      storeId: data.storeId,
      date: parseAndValidateDate(data.transactionDate),
      quantity: Number(data.quantity),
      reason: data.reason,
      reportedBy: data.reportedBy,
      remarks: data.remarks,
      damageType: 'SCRAP',
    }));
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

    const movementType = data.adjustmentType === 'INCREASE' ? 'AD' : 'SF';
    const result = await engine.createMovement({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      movementType,
      transactionDate: parseAndValidateDate(data.date),
      fromStoreId: data.storeId || null,
      toStoreId: data.storeId || null,
      remarks: `Adjustment (${data.adjustmentType}): ${data.reason}. ${data.remarks || ''}`,
      createdBy: data.adjustedBy,
      initialStatus: 'POSTED',
      items: [{
        itemId: data.itemId,
        quantity: Number(data.quantity),
        rate: 0,
        serialNumber: data.serialNumber || null,
      }],
    });

    return serialize(await prisma.transactionHeader.findUnique({
      where: { id: result.transactionId },
      include: { details: { include: { item: true } } },
    }));
  });

  // ==================== VENDOR RETURN ====================

  ipcMain.handle('challan:vendorReturn:create', async (_event, data: any) => {
    requireAuth();
    data = convertPayloadDates(data);
    if (!data.companyId) throw new Error('Company ID is required');
    if (!data.financialYearId) throw new Error('Financial Year ID is required');
    if (!data.vendorId) throw new Error('Vendor ID is required');
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required');

    const result = await engine.createMovement({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      movementType: 'VR',
      transactionDate: parseAndValidateDate(data.date),
      fromStoreId: data.storeId || null,
      vendorId: data.vendorId,
      remarks: `Vendor return: ${data.reason || ''}. ${data.remarks || ''}`,
      createdBy: data.returnedBy || 'system',
      initialStatus: 'DRAFT',
      items: (data.items || []).map((item: any) => ({
        itemId: item.itemId,
        quantity: Number(item.quantity),
        rate: Number(item.rate || 0),
        serialNumber: item.serialNumber || null,
        condition: 'DAMAGED',
      })),
    });

    return serialize(await prisma.transactionHeader.findUnique({
      where: { id: result.transactionId },
      include: { details: { include: { item: true } } },
    }));
  });

  ipcMain.handle('challan:vendorReturn:post', async (_event, id: number, departmentId?: number | null) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    const header = await prisma.transactionHeader.findUnique({
      where: { id },
      include: { details: true },
    });
    if (!header) throw new Error('Vendor return challan not found');
    if (header.approvalStatus !== 'DRAFT') throw new Error('Challan is not in Draft status');

    const updateData: any = {
      approvalStatus: 'POSTED',
      postedBy: session.fullName,
      postedAt: new Date(),
    };
    if (departmentId) {
      updateData.departmentId = departmentId;
    }

    await prisma.transactionHeader.update({
      where: { id },
      data: updateData,
    });

    await auditLog('UPDATE', 'TransactionHeader', id, 'Posted vendor return challan');
    return serialize(await prisma.transactionHeader.findUnique({
      where: { id },
      include: { vendor: true, details: { include: { item: true } } },
    }));
  });

  // ==================== SHIFT CHALLAN ====================

  ipcMain.handle('challan:shift:list', async (_event, params) => {
    requireAuth();
    const { companyId, financialYearId, shiftType } = params;
    return serialize(await shiftService.findAll(companyId, financialYearId, shiftType));
  });

  ipcMain.handle('challan:shift:getById', async (_event, id: number) => {
    requireAuth();
    return serialize(await shiftService.findById(id));
  });

  ipcMain.handle('challan:shift:create', async (_event, data) => {
    requireAuth();
    data = convertPayloadDates(data);
    return serialize(await shiftService.create({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      shiftType: data.shiftType,
      date: parseAndValidateDate(data.date),
      fromStoreId: data.fromStoreId,
      toStoreId: data.toStoreId,
      shiftedBy: data.shiftedBy,
      approvedBy: data.approvedBy,
      remarks: data.remarks,
      items: (data.items || []).map((item: any) => ({ ...item, serialNumber: item.serialNumber || null })),
    }));
  });

  ipcMain.handle('challan:shift:save', async (_event, payload: any, items: any[], shiftType: string, isEdit: boolean, id?: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    payload = convertPayloadDates(payload);
    payload.shiftType = shiftType;

    if (isEdit && id) {
      return serialize(await shiftService.update(id, {
        companyId: payload.companyId,
        financialYearId: payload.financialYearId,
        shiftType,
        date: parseAndValidateDate(payload.date),
        fromStoreId: payload.fromStoreId,
        toStoreId: payload.toStoreId,
        shiftedBy: payload.shiftedBy,
        approvedBy: payload.approvedBy,
        remarks: payload.remarks,
        items: (items || []).map((item: any) => ({ ...item, serialNumber: item.serialNumber || null })),
      }));
    }

    return serialize(await shiftService.create({
      companyId: payload.companyId,
      financialYearId: payload.financialYearId,
      shiftType,
      date: parseAndValidateDate(payload.date),
      fromStoreId: payload.fromStoreId,
      toStoreId: payload.toStoreId,
      shiftedBy: payload.shiftedBy,
      approvedBy: payload.approvedBy,
      remarks: payload.remarks,
      items: (items || []).map((item: any) => ({ ...item, serialNumber: item.serialNumber || null })),
    }));
  });

  ipcMain.handle('challan:shift:post', async (_event, id: number) => {
    requireAuth();
    return serialize(await shiftService.post(id));
  });

  ipcMain.handle('challan:shift:cancel', async (_event, id: number, reason: string) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    return serialize(await shiftService.cancel(id, reason, session.username));
  });

  ipcMain.handle('challan:shift:delete', async (_event, id: number) => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    await requirePermission(session.id, PERMISSION_KEYS.DELETE_CHALLAN);
    return serialize(await shiftService.delete(id));
  });
}
