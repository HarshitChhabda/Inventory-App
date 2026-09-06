import { ipcMain } from 'electron';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { RequisitionService } from '../../src/main/services/requisition.service';
import { ApprovalConfigService } from '../../src/main/services/approvalConfig.service';
import { ApprovalEngine } from '../../src/main/services/approvalEngine.service';
import { RequestConversionService } from '../../src/main/services/requestConversion.service';
import { NotificationService } from '../../src/main/services/notification.service';
import { serialize, requireAuth } from './helpers';

export function registerRequisitionIpc() {
  const prisma = getPrismaClient();
  const requisitionService = new RequisitionService(prisma);
  const approvalConfig = new ApprovalConfigService(prisma);
  const approvalEngine = new ApprovalEngine(prisma);
  const requestConversion = new RequestConversionService(prisma);
  const notificationService = new NotificationService(prisma);

  // ─── REQUISITION CRUD ──────────────────────────

  ipcMain.handle('req:create', async (_event, data: any) => {
    requireAuth();
    return serialize(await requisitionService.createRequisition(data));
  });

  ipcMain.handle('req:get', async (_event, id: number) => {
    return serialize(await requisitionService.getRequisition(id));
  });

  ipcMain.handle('req:getByNumber', async (_event, number: string) => {
    return serialize(await requisitionService.getRequisitionByNumber(number));
  });

  ipcMain.handle('req:search', async (_event, filters: any) => {
    return serialize(await requisitionService.searchRequisitions(filters));
  });

  ipcMain.handle('req:update', async (_event, id: number, data: any) => {
    requireAuth();
    return serialize(await requisitionService.updateRequisition(id, data));
  });

  ipcMain.handle('req:submit', async (_event, id: number) => {
    requireAuth();
    return serialize(await approvalEngine.submitRequest(id));
  });

  ipcMain.handle('req:cancel', async (_event, id: number, reason?: string) => {
    requireAuth();
    return serialize(await requisitionService.cancelRequisition(id, reason));
  });

  ipcMain.handle('req:close', async (_event, id: number) => {
    requireAuth();
    return serialize(await requisitionService.closeRequisition(id));
  });

  ipcMain.handle('req:reopen', async (_event, id: number) => {
    requireAuth();
    return serialize(await requisitionService.reopenRequisition(id));
  });

  // ─── APPROVAL ACTIONS ──────────────────────────

  ipcMain.handle('req:approve', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalEngine.approve(data));
  });

  ipcMain.handle('req:reject', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalEngine.reject(data));
  });

  ipcMain.handle('req:return', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalEngine.returnForCorrection(data));
  });

  ipcMain.handle('req:hold', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalEngine.hold(data));
  });

  ipcMain.handle('req:partialApprove', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalEngine.partialApprove(data));
  });

  ipcMain.handle('req:forward', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalEngine.forward(data));
  });

  ipcMain.handle('req:escalate', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalEngine.escalate(data));
  });

  // ─── PENDING APPROVALS ─────────────────────────

  ipcMain.handle('req:pendingApprovals', async (_event, userId: number, companyId: number) => {
    return serialize(await approvalEngine.getPendingApprovalsForUser(userId, companyId));
  });

  // ─── CONVERSION ────────────────────────────────

  ipcMain.handle('req:convert', async (_event, data: any) => {
    requireAuth();
    return serialize(await requestConversion.convertToTransaction(data));
  });

  ipcMain.handle('req:bulkConvert', async (_event, requisitionIds: number[], companyId: number, financialYearId: number, issuedById: number, issuedByName: string, postedById: string) => {
    requireAuth();
    return serialize(await requestConversion.bulkConvert(requisitionIds, companyId, financialYearId, issuedById, issuedByName, postedById));
  });

  ipcMain.handle('req:checkStock', async (_event, requisitionId: number) => {
    return serialize(await requestConversion.checkStockAvailability(requisitionId));
  });

  // ─── WORKFLOW CONFIG ───────────────────────────

  ipcMain.handle('req:createWorkflow', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalConfig.createWorkflow(data));
  });

  ipcMain.handle('req:getWorkflow', async (_event, id: number) => {
    return serialize(await approvalConfig.getWorkflow(id));
  });

  ipcMain.handle('req:getWorkflows', async (_event, companyId: number, workflowType?: string) => {
    return serialize(await approvalConfig.getWorkflows(companyId, workflowType));
  });

  ipcMain.handle('req:getActiveWorkflow', async (_event, companyId: number, workflowType: string) => {
    return serialize(await approvalConfig.getActiveWorkflow(companyId, workflowType));
  });

  ipcMain.handle('req:updateWorkflow', async (_event, id: number, data: any) => {
    requireAuth();
    return serialize(await approvalConfig.updateWorkflow(id, data));
  });

  ipcMain.handle('req:deleteWorkflow', async (_event, id: number) => {
    requireAuth();
    await approvalConfig.deleteWorkflow(id);
    return { success: true };
  });

  ipcMain.handle('req:toggleWorkflow', async (_event, id: number, isEnabled: boolean) => {
    requireAuth();
    return serialize(await approvalConfig.toggleWorkflow(id, isEnabled));
  });

  ipcMain.handle('req:seedWorkflows', async (_event, companyId: number) => {
    requireAuth();
    return serialize(await approvalConfig.seedDefaultWorkflows(companyId));
  });

  ipcMain.handle('req:isWorkflowEnabled', async (_event, companyId: number, workflowType: string) => {
    return serialize({ enabled: await approvalConfig.isWorkflowEnabled(companyId, workflowType) });
  });

  ipcMain.handle('req:getWorkflowTypes', async () => {
    return serialize(approvalConfig.getWorkflowTypes());
  });

  // ─── APPROVAL LEVELS ───────────────────────────

  ipcMain.handle('req:addApprovalLevel', async (_event, data: any) => {
    requireAuth();
    return serialize(await approvalConfig.addApprovalLevel(data));
  });

  ipcMain.handle('req:updateApprovalLevel', async (_event, id: number, data: any) => {
    requireAuth();
    return serialize(await approvalConfig.updateApprovalLevel(id, data));
  });

  ipcMain.handle('req:deleteApprovalLevel', async (_event, id: number) => {
    requireAuth();
    await approvalConfig.deleteApprovalLevel(id);
    return { success: true };
  });

  ipcMain.handle('req:getApprovalLevels', async (_event, workflowId: number) => {
    return serialize(await approvalConfig.getApprovalLevels(workflowId));
  });

  // ─── DASHBOARD & REPORTS ───────────────────────

  ipcMain.handle('req:dashboard', async (_event, companyId: number) => {
    return serialize(await requisitionService.getDashboard(companyId));
  });

  ipcMain.handle('req:report:register', async (_event, companyId: number, dateFrom?: Date, dateTo?: Date) => {
    return serialize(await requisitionService.getRequisitionRegister(companyId, dateFrom, dateTo));
  });

  ipcMain.handle('req:report:approvalRegister', async (_event, companyId: number) => {
    return serialize(await requisitionService.getApprovalRegister(companyId));
  });

  ipcMain.handle('req:report:pending', async (_event, companyId: number) => {
    return serialize(await requisitionService.getPendingRequests(companyId));
  });

  ipcMain.handle('req:report:rejected', async (_event, companyId: number) => {
    return serialize(await requisitionService.getRejectedRequests(companyId));
  });

  ipcMain.handle('req:report:userWise', async (_event, companyId: number, userId: number) => {
    return serialize(await requisitionService.getUserWiseRequests(companyId, userId));
  });

  ipcMain.handle('req:report:departmentWise', async (_event, companyId: number) => {
    return serialize(await requisitionService.getDepartmentWiseRequests(companyId));
  });

  ipcMain.handle('req:report:issuedAgainst', async (_event, companyId: number) => {
    return serialize(await requisitionService.getIssuedAgainstRequest(companyId));
  });

  // ─── NOTIFICATIONS ─────────────────────────────

  ipcMain.handle('req:notifications', async (_event, userId: number, options?: any) => {
    return serialize(await notificationService.getNotifications(userId, options));
  });

  ipcMain.handle('req:markRead', async (_event, notificationId: number) => {
    return serialize(await notificationService.markAsRead(notificationId));
  });

  ipcMain.handle('req:markAllRead', async (_event, userId: number) => {
    return serialize(await notificationService.markAllAsRead(userId));
  });

  ipcMain.handle('req:unreadCount', async (_event, userId: number) => {
    return serialize({ count: await notificationService.getUnreadCount(userId) });
  });

  ipcMain.handle('req:notificationStats', async (_event, companyId: number) => {
    return serialize(await notificationService.getNotificationStats(companyId));
  });
}
