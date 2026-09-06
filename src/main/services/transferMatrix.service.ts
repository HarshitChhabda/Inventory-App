import { PrismaClient } from '@prisma/client';

export interface TransferMatrixRule {
  companyId: number;
  fromStoreType: string;
  toStoreType: string;
  isAllowed: boolean;
  requiresApproval: boolean;
}

export class TransferMatrixService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Initialize default transfer matrix for a company.
   */
  async initializeDefaults(companyId: number): Promise<void> {
    const storeTypes = ['MAIN_STORE', 'DEPARTMENT_STORE', 'DHARMSHALA_STORE'];
    const rules: TransferMatrixRule[] = [];

    for (const from of storeTypes) {
      for (const to of storeTypes) {
        rules.push({
          companyId,
          fromStoreType: from,
          toStoreType: to,
          isAllowed: true,
          requiresApproval: from === 'MAIN_STORE' && to === 'DHARMSHALA_STORE',
        });
      }
    }

    for (const rule of rules) {
      await this.prisma.transferMatrix.upsert({
        where: {
          companyId_fromStoreType_toStoreType: {
            companyId: rule.companyId,
            fromStoreType: rule.fromStoreType,
            toStoreType: rule.toStoreType,
          },
        },
        update: { isAllowed: rule.isAllowed, requiresApproval: rule.requiresApproval },
        create: rule,
      });
    }
  }

  /**
   * Check if a transfer is allowed between two store types.
   */
  async isTransferAllowed(companyId: number, fromStoreType: string, toStoreType: string): Promise<{ allowed: boolean; requiresApproval: boolean }> {
    const rule = await this.prisma.transferMatrix.findUnique({
      where: {
        companyId_fromStoreType_toStoreType: {
          companyId,
          fromStoreType,
          toStoreType,
        },
      },
    });

    if (!rule) {
      return { allowed: false, requiresApproval: false };
    }

    return { allowed: rule.isAllowed, requiresApproval: rule.requiresApproval };
  }

  /**
   * Update a transfer matrix rule.
   */
  async updateRule(companyId: number, fromStoreType: string, toStoreType: string, isAllowed: boolean, requiresApproval: boolean) {
    return this.prisma.transferMatrix.upsert({
      where: {
        companyId_fromStoreType_toStoreType: {
          companyId,
          fromStoreType,
          toStoreType,
        },
      },
      update: { isAllowed, requiresApproval },
      create: { companyId, fromStoreType, toStoreType, isAllowed, requiresApproval },
    });
  }

  /**
   * Get all rules for a company.
   */
  async getRules(companyId: number) {
    return this.prisma.transferMatrix.findMany({
      where: { companyId },
      orderBy: [{ fromStoreType: 'asc' }, { toStoreType: 'asc' }],
    });
  }

  /**
   * Validate a transfer against the matrix.
   */
  async validateTransfer(companyId: number, fromStoreId: number, toStoreId: number): Promise<{ valid: boolean; message: string }> {
    const fromStore = await this.prisma.store.findUnique({ where: { id: fromStoreId } });
    const toStore = await this.prisma.store.findUnique({ where: { id: toStoreId } });

    if (!fromStore || !toStore) {
      return { valid: false, message: 'Store not found' };
    }

    if (fromStore.companyId !== companyId || toStore.companyId !== companyId) {
      return { valid: false, message: 'Stores must be in the same company' };
    }

    const { allowed, requiresApproval } = await this.isTransferAllowed(companyId, fromStore.storeType, toStore.storeType);

    if (!allowed) {
      return { valid: false, message: `Transfer from ${fromStore.storeType} to ${toStore.storeType} is not allowed` };
    }

    if (requiresApproval) {
      return { valid: true, message: 'Transfer allowed but requires approval' };
    }

    return { valid: true, message: 'Transfer allowed' };
  }
}
