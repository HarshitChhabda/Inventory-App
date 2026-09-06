import { PrismaClient } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { getPrismaClient } from '../database/prisma.client';

export interface IssueSparePartInput {
  companyId: number;
  financialYearId: number;
  workOrderId: number;
  itemId: number;
  itemName: string;
  itemCode?: string;
  quantity: number;
  unitName?: string;
  rate?: number;
  storeId: number;
  issuedById: number;
  issuedByName: string;
  remarks?: string;
}

export class SparePartsService {
  private static get prisma(): PrismaClient {
    return getPrismaClient();
  }

  static async issueSparePart(input: IssueSparePartInput) {
    const prisma = this.prisma;
    const transactionEngine = new TransactionEngine(prisma);

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: input.workOrderId },
      include: { asset: true, serviceRequest: true },
    });
    if (!workOrder) throw new Error('Work order not found');
    if (workOrder.status !== 'IN_PROGRESS') throw new Error('Work order must be IN_PROGRESS to issue parts');

    const woItems = await prisma.workOrderSparePart.findMany({ where: { workOrderId: input.workOrderId } });
    const lineNumber = woItems.length + 1;
    const rate = input.rate || 0;
    const amount = rate * input.quantity;

    const woSparePart = await prisma.workOrderSparePart.create({
      data: {
        workOrderId: input.workOrderId,
        lineNumber,
        itemId: input.itemId,
        itemName: input.itemName,
        itemCode: input.itemCode,
        quantity: input.quantity,
        unitName: input.unitName,
        rate,
        amount,
        remarks: input.remarks,
      },
    });

    const transaction = await transactionEngine.createMovement({
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      movementType: 'ISSUE',
      fromStoreId: input.storeId,
      transactionDate: new Date(),
      remarks: `Spare parts for WO-${workOrder.workOrderNumber}`,
      createdBy: input.issuedByName,
      items: [{
        itemId: input.itemId,
        quantity: input.quantity,
        rate,
      }],
    });

    await prisma.workOrderSparePart.update({
      where: { id: woSparePart.id },
      data: { transactionHeaderId: transaction.transactionId },
    });

    return { sparePart: woSparePart, transaction };
  }

  static async returnSparePart(workOrderId: number, sparePartId: number, quantity: number) {
    const prisma = this.prisma;

    const sparePart = await prisma.workOrderSparePart.findUnique({ where: { id: sparePartId } });
    if (!sparePart) throw new Error('Spare part not found');
    if (sparePart.workOrderId !== workOrderId) throw new Error('Spare part does not belong to this work order');

    const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder) throw new Error('Work order not found');

    if (quantity > sparePart.quantity) throw new Error('Return quantity cannot exceed issued quantity');

    const woItems = await prisma.workOrderSparePart.findMany({ where: { workOrderId } });
    const lineNumber = woItems.length + 1;

    const returned = await prisma.workOrderSparePart.create({
      data: {
        workOrderId,
        lineNumber,
        itemId: sparePart.itemId,
        itemName: sparePart.itemName,
        itemCode: sparePart.itemCode,
        quantity: -quantity,
        unitName: sparePart.unitName,
        rate: sparePart.rate,
        amount: -(sparePart.rate * quantity),
        remarks: `Returned from WO-${workOrder.workOrderNumber}`,
      },
    });

    return returned;
  }

  static async getSpareParts(workOrderId: number) {
    return this.prisma.workOrderSparePart.findMany({
      where: { workOrderId },
      include: { item: true },
      orderBy: { lineNumber: 'asc' },
    });
  }

  static async getWorkOrderCostSummary(workOrderId: number) {
    const prisma = this.prisma;
    const spareParts = await prisma.workOrderSparePart.findMany({ where: { workOrderId } });
    const costs = await prisma.serviceCost.findMany({ where: { workOrderId } });

    const partsTotal = spareParts.reduce((sum, sp) => sum + sp.amount, 0);
    const costByType = (type: string) =>
      costs.filter(c => c.costType === type).reduce((sum, c) => sum + c.amount, 0);

    const materialCost = costByType('MATERIAL');
    const labourCost = costByType('LABOUR');
    const vendorCost = costByType('VENDOR');
    const travelCost = costByType('TRAVEL');
    const miscCost = costByType('MISC');

    return {
      partsTotal,
      materialCost,
      labourCost,
      vendorCost,
      travelCost,
      miscCost,
      totalCost: partsTotal + materialCost + labourCost + vendorCost + travelCost + miscCost,
    };
  }
}
