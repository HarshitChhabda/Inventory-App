import { ipcMain } from 'electron';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { getSession, PERMISSION_KEYS, hasPermission } from '../../src/main/services/auth.service';
import { serialize, requireAuth, auditLog } from './helpers';
import { validate } from './validate';
import { companySchema, financialYearSchema } from '../../src/shared/zod-schemas';
import { FinancialYearService } from '../../src/main/services/financialYear.service';

export function registerSettingsIpc() {
  const prisma = getPrismaClient();

  // ─── Company ────────────────────────────────────────────────────
  ipcMain.handle('settings:createCompany', async (_event, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    const validated = validate(companySchema, data);
    const result = await prisma.company.create({ data: validated });

    // Auto-create all existing FYs for the new company
    const existingFys = await prisma.financialYear.findMany({
      distinct: ['label'],
      select: { label: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    });
    const createdFys: string[] = [];
    for (const fy of existingFys) {
      const exists = await prisma.financialYear.findUnique({
        where: { companyId_label: { companyId: result.id, label: fy.label } },
      });
      if (!exists) {
        await prisma.financialYear.create({
          data: {
            companyId: result.id,
            label: fy.label,
            startDate: fy.startDate,
            endDate: fy.endDate,
          },
        });
        createdFys.push(fy.label);
      }
    }

    await auditLog('CREATE', 'Company', result.id, `Created company: ${result.name}${createdFys.length > 0 ? `. Auto-created ${createdFys.length} financial year(s): ${createdFys.join(', ')}` : ''}`, result, result.id);
    return serialize({ ...result, _createdFYs: createdFys });
  });

  ipcMain.handle('settings:updateCompany', async (_event, id: number, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    const validated = validate(companySchema.partial(), data);
    const result = await prisma.company.update({ where: { id }, data: validated });
    await auditLog('UPDATE', 'Company', result.id, `Updated company: ${result.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('settings:deleteCompany', async (_event, id: number) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    // Check if company has data
    const fyCount = await prisma.financialYear.count({ where: { companyId: id } });
    if (fyCount > 0) {
      throw new Error('Cannot delete company: it has financial years. Remove them first.');
    }
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new Error('Company not found');
    const result = await prisma.company.delete({ where: { id } });
    await auditLog('DELETE', 'Company', id, `Deleted company: ${company.name}`);
    return serialize(result);
  });

  ipcMain.handle('settings:toggleCompany', async (_event, id: number) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new Error('Company not found');
    const result = await prisma.company.update({ where: { id }, data: { isActive: !company.isActive } });
    await auditLog('UPDATE', 'Company', id, `${company.isActive ? 'Disabled' : 'Enabled'} company: ${company.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('settings:getCompanyDeletionDependencyInfo', async (_event, id: number) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new Error('Company not found');

    const [fyCount, transactionCount, ledgerCount, requisitionCount, poCount, grnCount, assetCount, storeCount, vendorCount, departmentCount, employeeCount, workOrderCount, serviceRequestCount, roleCount, userCount, quotationCount, amcAgreementCount, approvalWorkflowCount, breakdownHistoryCount, maintenanceHistoryCount, warrantyClaimCount, serviceScheduleCount, completionCount, auditLogCount, importHistoryCount, notificationCount, priceHistoryCount, purchaseHistoryCount, systemConfigCount, passwordPolicyCount, voucherSequenceCount] = await Promise.all([
      prisma.financialYear.count({ where: { companyId: id } }),
      prisma.transactionHeader.count({ where: { companyId: id } }),
      prisma.ledgerEntry.count({ where: { companyId: id } }),
      prisma.requisitionHeader.count({ where: { companyId: id } }),
      prisma.purchaseOrder.count({ where: { companyId: id } }),
      prisma.goodsReceipt.count({ where: { companyId: id } }),
      prisma.assetProfile.count({ where: { companyId: id } }),
      prisma.store.count({ where: { companyId: id } }),
      prisma.vendor.count({ where: { companyId: id } }),
      prisma.department.count({ where: { companyId: id } }),
      prisma.employee.count({ where: { companyId: id } }),
      prisma.workOrder.count({ where: { companyId: id } }),
      prisma.serviceRequest.count({ where: { companyId: id } }),
      prisma.role.count({ where: { companyId: id } }),
      prisma.user.count({ where: { userRole: { companyId: id } } }),
      prisma.quotation.count({ where: { companyId: id } }),
      prisma.aMCAgreement.count({ where: { companyId: id } }),
      prisma.approvalWorkflow.count({ where: { companyId: id } }),
      prisma.breakdownHistory.count({ where: { companyId: id } }),
      prisma.maintenanceHistory.count({ where: { companyId: id } }),
      prisma.warrantyClaim.count({ where: { companyId: id } }),
      prisma.serviceSchedule.count({ where: { companyId: id } }),
      prisma.workCompletionVerification.count({ where: { companyId: id } }),
      prisma.auditLog.count({ where: { companyId: id } }),
      prisma.importHistory.count({ where: { companyId: id } }),
      prisma.notification.count({ where: { companyId: id } }),
      prisma.priceHistory.count({ where: { companyId: id } }),
      prisma.purchaseHistory.count({ where: { companyId: id } }),
      prisma.systemConfiguration.count({ where: { companyId: id } }),
      prisma.passwordPolicy.count({ where: { companyId: id } }),
      prisma.voucherSequence.count({ where: { companyId: id } }),
    ]);

    return serialize({
      companyName: company.name,
      financialYears: fyCount,
      transactions: transactionCount,
      ledgerEntries: ledgerCount,
      requisitions: requisitionCount,
      purchaseOrders: poCount,
      goodsReceipts: grnCount,
      assets: assetCount,
      stores: storeCount,
      vendors: vendorCount,
      departments: departmentCount,
      employees: employeeCount,
      workOrders: workOrderCount,
      serviceRequests: serviceRequestCount,
      roles: roleCount,
      users: userCount,
      quotations: quotationCount,
      amcAgreements: amcAgreementCount,
      approvalWorkflows: approvalWorkflowCount,
      breakdownHistory: breakdownHistoryCount,
      maintenanceHistory: maintenanceHistoryCount,
      warrantyClaims: warrantyClaimCount,
      serviceSchedules: serviceScheduleCount,
      workCompletionVerifications: completionCount,
      auditLogs: auditLogCount,
      importHistories: importHistoryCount,
      notifications: notificationCount,
      priceHistory: priceHistoryCount,
      purchaseHistory: purchaseHistoryCount,
      systemConfigurations: systemConfigCount,
      passwordPolicies: passwordPolicyCount,
      voucherSequences: voucherSequenceCount,
    });
  });

  ipcMain.handle('settings:permanentDeleteCompany', async (_event, id: number, confirmName: string) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_COMPANY)) {
      throw new Error('Permission denied: manage_company');
    }
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new Error('Company not found');
    if (confirmName !== company.name) {
      throw new Error(`Confirmation failed: expected "${company.name}" but got "${confirmName}"`);
    }

    await prisma.$transaction(async (tx) => {
      // ── Phase 1: Non-companyId child models (must be deleted before parents) ──

      // AssetTimeline → AssetProfile
      await tx.assetTimeline.deleteMany({ where: { asset: { companyId: id } } });
      // AssetPhoto → AssetProfile
      await tx.assetPhoto.deleteMany({ where: { asset: { companyId: id } } });
      // AssetDocument → AssetProfile
      await tx.assetDocument.deleteMany({ where: { asset: { companyId: id } } });
      // AssetServiceHistory → AssetProfile
      await tx.assetServiceHistory.deleteMany({ where: { asset: { companyId: id } } });
      // AssetMovement → AssetProfile
      await tx.assetMovement.deleteMany({ where: { asset: { companyId: id } } });

      // TransactionDetail → TransactionHeader
      await tx.transactionDetail.deleteMany({ where: { transaction: { companyId: id } } });

      // WorkCompletionItem → WorkCompletionVerification
      await tx.workCompletionItem.deleteMany({ where: { verification: { companyId: id } } });
      // VerificationSignature → WorkCompletionVerification
      await tx.verificationSignature.deleteMany({ where: { verification: { companyId: id } } });

      // MaterialDemandItem → ServiceRequest
      await tx.materialDemandItem.deleteMany({ where: { serviceRequest: { companyId: id } } });

      // ItemVendorMapping → Vendor
      await tx.itemVendorMapping.deleteMany({ where: { vendor: { companyId: id } } });

      // AssetInstallation → Store
      await tx.assetInstallation.deleteMany({ where: { store: { companyId: id } } });
      // Room → Location → Store
      await tx.room.deleteMany({ where: { location: { store: { companyId: id } } } });
      // Location → Store
      await tx.location.deleteMany({ where: { store: { companyId: id } } });
      // ItemCategory → Store
      await tx.itemCategory.deleteMany({ where: { store: { companyId: id } } });
      // SerializedItem → Store
      await tx.serializedItem.deleteMany({ where: { currentStore: { companyId: id } } });

      // ── Phase 2: companyId models (correct dependency order) ──

      await tx.ledgerEntry.deleteMany({ where: { companyId: id } });
      await tx.transactionHeader.deleteMany({ where: { companyId: id } });
      await tx.notification.deleteMany({ where: { companyId: id } });
      await tx.auditLog.deleteMany({ where: { companyId: id } });
      await tx.importHistory.deleteMany({ where: { companyId: id } });

      // WorkCompletionVerification (children already deleted in Phase 1, must be before FinancialYear)
      await tx.workCompletionVerification.deleteMany({ where: { companyId: id } });

      // RequisitionHeader (cascades: ApprovalAction, RequisitionDetail)
      await tx.requisitionHeader.deleteMany({ where: { companyId: id } });
      // PurchaseOrder (cascades: PurchaseOrderDetail)
      await tx.purchaseOrder.deleteMany({ where: { companyId: id } });
      // GoodsReceipt (cascades: GoodsReceiptDetail, QualityCheck)
      await tx.goodsReceipt.deleteMany({ where: { companyId: id } });
      // WorkOrder (cascades: WorkOrderSparePart, ServiceCost, MaintenancePhoto, MaintenanceDocument)
      await tx.workOrder.deleteMany({ where: { companyId: id } });
      // ServiceRequest (children deleted, cascades: ServiceChecklist)
      await tx.serviceRequest.deleteMany({ where: { companyId: id } });

      // AMCAgreement (cascades: AMCDocument)
      await tx.aMCAgreement.deleteMany({ where: { companyId: id } });
      await tx.breakdownHistory.deleteMany({ where: { companyId: id } });
      await tx.maintenanceHistory.deleteMany({ where: { companyId: id } });
      await tx.warrantyClaim.deleteMany({ where: { companyId: id } });
      await tx.serviceSchedule.deleteMany({ where: { companyId: id } });

      // AssetProfile (all children already deleted in Phase 1)
      await tx.assetProfile.deleteMany({ where: { companyId: id } });

      // VoucherSequence must be deleted before FinancialYear (foreign key)
      await tx.voucherSequence.deleteMany({ where: { companyId: id } });
      await tx.financialYear.deleteMany({ where: { companyId: id } });
      await tx.store.deleteMany({ where: { companyId: id } });
      await tx.department.deleteMany({ where: { companyId: id } });

      // Models with required vendorId must be deleted before Vendor
      await tx.quotation.deleteMany({ where: { companyId: id } });
      await tx.priceHistory.deleteMany({ where: { companyId: id } });
      await tx.purchaseHistory.deleteMany({ where: { companyId: id } });
      await tx.vendor.deleteMany({ where: { companyId: id } });

      await tx.employee.deleteMany({ where: { companyId: id } });
      await tx.systemConfiguration.deleteMany({ where: { companyId: id } });
      await tx.passwordPolicy.deleteMany({ where: { companyId: id } });

      // Unlink users from roles before deleting roles (User.roleId has no cascade)
      const companyRoleIds = (await tx.role.findMany({ where: { companyId: id }, select: { id: true } })).map(r => r.id);
      if (companyRoleIds.length > 0) {
        await tx.user.updateMany({ where: { roleId: { in: companyRoleIds } }, data: { roleId: null } });
      }

      // Role (cascades: RolePermission)
      await tx.role.deleteMany({ where: { companyId: id } });
      // ApprovalWorkflow (cascades: ApprovalLevel)
      await tx.approvalWorkflow.deleteMany({ where: { companyId: id } });

      // The company itself
      await tx.company.delete({ where: { id } });
    });

    return serialize({ success: true, deletedCompany: company.name });
  });

  // ─── Financial Year ─────────────────────────────────────────────
  ipcMain.handle('settings:createFinancialYear', async (_event, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }
    const validated = validate(financialYearSchema, data);
    const fyService = new FinancialYearService(prisma);
    const result = await fyService.create({
      companyId: validated.companyId,
      label: validated.label,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
    });
    await auditLog('CREATE', 'FinancialYear', result.id, `Created financial year: ${result.label}`, result, result.companyId);
    return serialize(result);
  });

  ipcMain.handle('settings:updateFinancialYear', async (_event, id: number, data: any) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }
    const validated = validate(financialYearSchema.partial(), data);
    const fyService = new FinancialYearService(prisma);
    const result = await fyService.update(id, validated);
    await auditLog('UPDATE', 'FinancialYear', id, `Updated financial year: ${result.label}`, result);
    return serialize(result);
  });

  // ─── Financial Year — Company-aware deletion ────────────────────
  ipcMain.handle('settings:getFYCompanyInfo', async (_event, fyLabel: string) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }
    const companies = await prisma.company.findMany({
      where: {
        financialYears: { some: { label: fyLabel } },
      },
      include: {
        financialYears: {
          where: { label: fyLabel },
          select: { id: true, label: true, isClosed: true, _count: { select: { transactions: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return serialize(companies.map(c => ({
      companyId: c.id,
      companyName: c.name,
      fyId: c.financialYears[0]?.id,
      isClosed: c.financialYears[0]?.isClosed || false,
      transactionCount: c.financialYears[0]?._count?.transactions || 0,
    })));
  });

  ipcMain.handle('settings:deleteFYFromCompanies', async (_event, fyLabel: string, companyIds: number[]) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }
    const results: { companyName: string; deleted: boolean; error?: string }[] = [];
    for (const companyId of companyIds) {
      try {
        const fy = await prisma.financialYear.findUnique({
          where: { companyId_label: { companyId, label: fyLabel } },
          include: { company: true },
        });
        if (!fy) {
          results.push({ companyName: `Company #${companyId}`, deleted: false, error: 'FY not found' });
          continue;
        }
        const txCount = await prisma.transactionHeader.count({ where: { financialYearId: fy.id } });
        if (txCount > 0) {
          results.push({ companyName: fy.company.name, deleted: false, error: `Has ${txCount} transaction(s)` });
          continue;
        }
        await prisma.$transaction(async (tx) => {
          await tx.voucherSequence.deleteMany({ where: { financialYearId: fy.id } });
          await tx.financialYear.delete({ where: { id: fy.id } });
          await tx.auditLog.create({
            data: {
              companyId, userId: user.id, action: 'DELETE',
              tableName: 'FinancialYear', recordId: fy.id, recordUuid: fy.uuid,
              description: `Deleted financial year ${fyLabel} from ${fy.company.name}`,
            },
          });
        });
        results.push({ companyName: fy.company.name, deleted: true });
      } catch (err: any) {
        results.push({ companyName: `Company #${companyId}`, deleted: false, error: err.message });
      }
    }
    return serialize(results);
  });

  ipcMain.handle('settings:closeFinancialYear', async (_event, fyId: number) => {
    const user = requireAuth();
    if (!hasPermission(user, PERMISSION_KEYS.MANAGE_FINANCIAL_YEAR)) {
      throw new Error('Permission denied: manage_financial_year');
    }

    const fyService = new FinancialYearService(prisma);
    const nextFy = await fyService.closeFinancialYear(fyId, user.id);

    return { success: true, nextFy };
  });
}
