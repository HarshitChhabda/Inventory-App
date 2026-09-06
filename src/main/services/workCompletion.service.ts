import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';

const prisma = getPrismaClient();

export class WorkCompletionService {
  // Generate verification number
  static async generateVerificationNumber(companyId: number): Promise<string> {
    const count = await prisma.workCompletionVerification.count({ where: { companyId } });
    return `WCV-${String(count + 1).padStart(5, '0')}`;
  }

  // Create work completion verification
  static async createVerification(data: {
    workOrderId: number; companyId: number; financialYearId: number;
    completedDate?: Date; workDescription?: string; locationDetails?: string;
    items: Array<{
      itemId: number; itemName: string; itemCode?: string; unitName: string;
      quantityIssued: number; quantityInstalled: number; quantityReturned: number;
      quantityDamaged: number; quantityScrap: number; serialNumber?: string;
      isReplacement?: boolean; oldItemDescription?: string;
      installationLocation?: string; remarks?: string;
    }>;
  }) {
    const verificationNumber = await this.generateVerificationNumber(data.companyId);

    const verification = await prisma.workCompletionVerification.create({
      data: {
        verificationNumber,
        workOrderId: data.workOrderId,
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        completedDate: data.completedDate,
        workDescription: data.workDescription,
        locationDetails: data.locationDetails,
        items: {
          create: data.items.map((item, idx) => ({
            lineNumber: idx + 1,
            itemId: item.itemId,
            itemName: item.itemName,
            itemCode: item.itemCode,
            unitName: item.unitName,
            quantityIssued: item.quantityIssued,
            quantityInstalled: item.quantityInstalled,
            quantityReturned: item.quantityReturned,
            quantityDamaged: item.quantityDamaged,
            quantityScrap: item.quantityScrap,
            serialNumber: item.serialNumber,
            isReplacement: item.isReplacement || false,
            oldItemDescription: item.oldItemDescription,
            installationLocation: item.installationLocation,
            remarks: item.remarks,
          })),
        },
      },
      include: { items: true },
    });

    // Update WorkOrder
    await prisma.workOrder.update({
      where: { id: data.workOrderId },
      data: {
        verificationStatus: 'COMPLETED',
        completionVerificationId: verification.id,
        completionDate: data.completedDate || new Date(),
      },
    });

    return verification;
  }

  // Add signature
  static async addSignature(verificationId: number, data: {
    signerRole: string; signerName: string; signaturePath?: string;
  }) {
    return prisma.verificationSignature.create({
      data: { verificationId, ...data },
    });
  }

  // Get verification with all details
  static async getVerification(id: number) {
    return prisma.workCompletionVerification.findUnique({
      where: { id },
      include: { items: true, signatures: true, workOrder: true },
    });
  }

  // List verifications for a company
  static async listVerifications(companyId: number, filter?: { status?: string; workOrderId?: number }) {
    return prisma.workCompletionVerification.findMany({
      where: {
        companyId,
        ...(filter?.status ? { verificationStatus: filter.status } : {}),
        ...(filter?.workOrderId ? { workOrderId: filter.workOrderId } : {}),
      },
      include: { items: true, signatures: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Record delayed entry (office operator enters from signed paper)
  static async recordDelayedEntry(verificationId: number, data: {
    completedDate: Date; workDescription: string; locationDetails?: string;
    departmentVerifiedBy?: string; departmentVerifiedRole?: string;
    managerVerifiedBy?: string; managerVerifiedRole?: string;
    supervisorVerifiedBy?: string; supervisorVerifiedRole?: string;
    overallRemarks?: string;
    items: Array<{
      workCompletionItemId: number; quantityInstalled: number;
      quantityReturned: number; quantityDamaged: number; quantityScrap: number;
      installationLocation?: string; remarks?: string;
    }>;
  }) {
    // Update verification
    const verification = await prisma.workCompletionVerification.update({
      where: { id: verificationId },
      data: {
        completedDate: data.completedDate,
        workDescription: data.workDescription,
        locationDetails: data.locationDetails,
        departmentVerifiedBy: data.departmentVerifiedBy,
        departmentVerifiedRole: data.departmentVerifiedRole,
        managerVerifiedBy: data.managerVerifiedBy,
        managerVerifiedRole: data.managerVerifiedRole,
        supervisorVerifiedBy: data.supervisorVerifiedBy,
        supervisorVerifiedRole: data.supervisorVerifiedRole,
        verificationStatus: 'VERIFIED',
        overallRemarks: data.overallRemarks,
      },
    });

    // Update items
    await Promise.all(data.items.map(item =>
      prisma.workCompletionItem.update({
        where: { id: item.workCompletionItemId },
        data: {
          quantityInstalled: item.quantityInstalled,
          quantityReturned: item.quantityReturned,
          quantityDamaged: item.quantityDamaged,
          quantityScrap: item.quantityScrap,
          installationLocation: item.installationLocation,
          remarks: item.remarks,
        },
      })
    ));

    return verification;
  }
}
