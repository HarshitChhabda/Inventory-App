import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification.service';

export interface ApprovalInput {
  requisitionId: number;
  actionById: number;
  actionByName: string;
  action: string; // APPROVE, REJECT, RETURN, HOLD, CANCEL, PARTIAL, FORWARD, ESCALATE
  remarks?: string;
  quantity?: number; // for partial approval
  ipAddress?: string;
  deviceInfo?: string;
}

export interface AutoIssueInput {
  requisitionId: number;
  issuedById: number;
  issuedByName: string;
}

export class ApprovalEngine {
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notificationService = new NotificationService(prisma);
  }

  // ─── SUBMIT REQUEST → TRIGGER WORKFLOW ─────────

  async submitRequest(requisitionId: number) {
    const req = await this.prisma.requisitionHeader.findUnique({
      where: { id: requisitionId },
      include: {
        details: true,
        requestedBy: true,
        company: true,
      },
    });
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'DRAFT' && req.status !== 'SUBMITTED') {
      throw new Error(`Cannot submit requisition in status ${req.status}`);
    }

    // Check if workflow is enabled for this type
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: {
        companyId: req.companyId,
        workflowType: req.requestType,
        isEnabled: true,
      },
      include: { levels: { orderBy: { levelNumber: 'asc' }, where: { isActive: true } } },
    });

    if (!workflow || workflow.levels.length === 0) {
      // No workflow — auto-approve
      return this.autoApprove(requisitionId);
    }

    // Set workflow and start at level 1
    return this.prisma.$transaction(async (tx) => {
      await tx.requisitionHeader.update({
        where: { id: requisitionId },
        data: {
          status: 'PENDING',
          approvalWorkflowId: workflow.id,
          currentApprovalLevel: 1,
          totalApprovalLevels: workflow.levels.length,
        },
      });

      // Notify approvers at level 1
      const level1 = workflow.levels[0];
      await this.notifyApprover(tx, requisitionId, req, level1);

      return tx.requisitionHeader.findUnique({
        where: { id: requisitionId },
        include: { details: true },
      });
    });
  }

  // ─── AUTO APPROVE (no workflow) ────────────────

  private async autoApprove(requisitionId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.requisitionHeader.update({
        where: { id: requisitionId },
        data: {
          status: 'APPROVED',
          currentApprovalLevel: 0,
          totalApprovalLevels: 0,
        },
      });

      await tx.approvalAction.create({
        data: {
          requisitionHeaderId: requisitionId,
          levelNumber: 0,
          action: 'APPROVE',
          actionById: 0,
          actionByName: 'SYSTEM',
          oldStatus: 'SUBMITTED',
          newStatus: 'APPROVED',
          remarks: 'Auto-approved (no workflow configured)',
        },
      });

      return tx.requisitionHeader.findUnique({
        where: { id: requisitionId },
        include: { details: true },
      });
    });
  }

  // ─── APPROVE ───────────────────────────────────

  async approve(input: ApprovalInput) {
    return this.processAction(input, 'APPROVE');
  }

  // ─── REJECT ────────────────────────────────────

  async reject(input: ApprovalInput) {
    return this.processAction(input, 'REJECT');
  }

  // ─── RETURN FOR CORRECTION ─────────────────────

  async returnForCorrection(input: ApprovalInput) {
    return this.processAction(input, 'RETURN');
  }

  // ─── HOLD ──────────────────────────────────────

  async hold(input: ApprovalInput) {
    return this.processAction(input, 'HOLD');
  }

  // ─── CANCEL ────────────────────────────────────

  async cancel(input: ApprovalInput) {
    return this.processAction(input, 'CANCEL');
  }

  // ─── PARTIAL APPROVAL ─────────────────────────

  async partialApprove(input: ApprovalInput) {
    if (!input.quantity || input.quantity <= 0) {
      throw new Error('Quantity is required for partial approval');
    }
    return this.processAction(input, 'PARTIAL');
  }

  // ─── FORWARD ───────────────────────────────────

  async forward(input: ApprovalInput) {
    return this.processAction(input, 'FORWARD');
  }

  // ─── ESCALATE ──────────────────────────────────

  async escalate(input: ApprovalInput) {
    return this.processAction(input, 'ESCALATE');
  }

  // ─── CORE PROCESSING ──────────────────────────

  private async processAction(input: ApprovalInput, action: string) {
    const req = await this.prisma.requisitionHeader.findUnique({
      where: { id: input.requisitionId },
      include: {
        details: true,
        requestedBy: true,
        company: true,
        approvalWorkflow: { include: { levels: { orderBy: { levelNumber: 'asc' } } } },
      },
    });
    if (!req) throw new Error('Requisition not found');
    if (req.status === 'COMPLETED' || req.status === 'CLOSED') {
      throw new Error('Cannot modify completed or closed requisition');
    }

    const oldStatus = req.status;

    switch (action) {
      case 'APPROVE': return this.handleApprove(req, input, oldStatus);
      case 'REJECT': return this.handleReject(req, input, oldStatus);
      case 'RETURN': return this.handleReturn(req, input, oldStatus);
      case 'HOLD': return this.handleHold(req, input, oldStatus);
      case 'CANCEL': return this.handleCancel(req, input, oldStatus);
      case 'PARTIAL': return this.handlePartial(req, input, oldStatus);
      case 'FORWARD': return this.handleForward(req, input, oldStatus);
      case 'ESCALATE': return this.handleEscalate(req, input, oldStatus);
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  private async handleApprove(req: any, input: ApprovalInput, oldStatus: string) {
    const currentLevel = req.currentApprovalLevel || 0;
    const totalLevels = req.totalApprovalLevels || 0;
    const levels = req.approvalWorkflow?.levels || [];

    // Check auto-approve threshold
    const levelConfig = levels.find((l: any) => l.levelNumber === currentLevel);
    if (levelConfig?.autoApprove && levelConfig.autoApproveThreshold) {
      // Calculate total monetary amount from requisition details
      // Each detail may have a rate; if not available, use requestedQty as proxy
      const totalAmount = req.details.reduce((sum: number, d: any) => {
        const rate = (d as any).rate || 0;
        return sum + (d.requestedQty * rate);
      }, 0);
      if (totalAmount <= levelConfig.autoApproveThreshold) {
        // Auto-approve this level — skip to next level or finalize
      }
    }

    if (currentLevel >= totalLevels) {
      // All levels approved
      return this.prisma.$transaction(async (tx) => {
        await tx.requisitionHeader.update({
          where: { id: req.id },
          data: { status: 'APPROVED', currentApprovalLevel: currentLevel },
        });
        await this.logApproval(tx, req.id, currentLevel, input, oldStatus, 'APPROVED');
        await this.notifyRequester(tx, req, 'APPROVED');
        return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
      });
    }

    // Move to next level
    const nextLevel = currentLevel + 1;
    return this.prisma.$transaction(async (tx) => {
      await tx.requisitionHeader.update({
        where: { id: req.id },
        data: { currentApprovalLevel: nextLevel },
      });
      await this.logApproval(tx, req.id, currentLevel, input, oldStatus, 'PENDING');

      // Notify next level approver
      const nextLevelConfig = levels.find((l: any) => l.levelNumber === nextLevel);
      if (nextLevelConfig) await this.notifyApprover(tx, req.id, req, nextLevelConfig);

      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  private async handleReject(req: any, input: ApprovalInput, oldStatus: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.requisitionHeader.update({
        where: { id: req.id },
        data: { status: 'REJECTED', rejectionReason: input.remarks },
      });
      await this.logApproval(tx, req.id, req.currentApprovalLevel || 0, input, oldStatus, 'REJECTED');
      await this.notifyRequester(tx, req, 'REJECTED');
      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  private async handleReturn(req: any, input: ApprovalInput, oldStatus: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.requisitionHeader.update({
        where: { id: req.id },
        data: { status: 'DRAFT', currentApprovalLevel: 1 },
      });
      await this.logApproval(tx, req.id, req.currentApprovalLevel || 0, input, oldStatus, 'DRAFT');
      await this.notifyRequester(tx, req, 'RETURNED');
      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  private async handleHold(req: any, input: ApprovalInput, oldStatus: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.logApproval(tx, req.id, req.currentApprovalLevel || 0, input, oldStatus, 'PENDING');
      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  private async handleCancel(req: any, input: ApprovalInput, oldStatus: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.requisitionHeader.update({
        where: { id: req.id },
        data: { status: 'CANCELLED', rejectionReason: input.remarks },
      });
      await this.logApproval(tx, req.id, req.currentApprovalLevel || 0, input, oldStatus, 'CANCELLED');
      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  private async handlePartial(req: any, input: ApprovalInput, oldStatus: string) {
    if (!input.quantity) throw new Error('Quantity required for partial approval');
    const currentLevel = req.currentApprovalLevel || 0;
    const totalLevels = req.totalApprovalLevels || 0;

    return this.prisma.$transaction(async (tx) => {
      // Update detail quantities
      for (const detail of req.details) {
        const approvedQty = Math.min(input.quantity || 0, detail.requestedQty);
        const pendingQty = detail.requestedQty - approvedQty;
        await tx.requisitionDetail.update({
          where: { id: detail.id },
          data: {
            approvedQty,
            pendingQty,
            status: pendingQty > 0 ? 'PARTIALLY_APPROVED' : 'APPROVED',
          },
        });
      }

      const newStatus = currentLevel >= totalLevels ? 'PARTIALLY_APPROVED' : 'PENDING';
      await tx.requisitionHeader.update({
        where: { id: req.id },
        data: { status: newStatus },
      });

      await this.logApproval(tx, req.id, currentLevel, input, oldStatus, newStatus);
      if (newStatus === 'PARTIALLY_APPROVED') {
        await this.notifyRequester(tx, req, 'PARTIAL_APPROVAL');
      }
      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  private async handleForward(req: any, input: ApprovalInput, oldStatus: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.logApproval(tx, req.id, req.currentApprovalLevel || 0, input, oldStatus, 'PENDING');
      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  private async handleEscalate(req: any, input: ApprovalInput, oldStatus: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.logApproval(tx, req.id, req.currentApprovalLevel || 0, input, oldStatus, 'PENDING');
      // Escalate to admin
      await this.notificationService.createNotification({
        companyId: req.companyId,
        userId: 1,
        requisitionHeaderId: req.id,
        type: 'ESCALATION',
        title: `Escalation: ${req.requisitionNumber}`,
        message: `${input.actionByName} escalated request ${req.requisitionNumber}: ${input.remarks || ''}`,
      });
      return tx.requisitionHeader.findUnique({ where: { id: req.id }, include: { details: true } });
    });
  }

  // ─── HELPERS ───────────────────────────────────

  private async logApproval(tx: any, requisitionId: number, levelNumber: number, input: ApprovalInput, oldStatus: string, newStatus: string) {
    return tx.approvalAction.create({
      data: {
        requisitionHeaderId: requisitionId,
        levelNumber,
        action: input.action || 'APPROVE',
        actionById: input.actionById,
        actionByName: input.actionByName,
        oldStatus,
        newStatus,
        remarks: input.remarks,
        ipAddress: input.ipAddress,
        deviceInfo: input.deviceInfo,
        quantity: input.quantity,
      },
    });
  }

  private async notifyApprover(tx: any, requisitionId: number, req: any, level: any) {
    const userId = level.approverId || 1; // fallback to admin
    await this.notificationService.createNotification({
      companyId: req.companyId,
      userId,
      requisitionHeaderId: requisitionId,
      type: 'APPROVAL_NEEDED',
      title: `Approval Required: ${req.requisitionNumber}`,
      message: `${req.requestedByName} requested ${req.requestType} — Level ${level.levelNumber}: ${level.levelName}`,
    });
  }

  private async notifyRequester(tx: any, req: any, type: string) {
    const titleMap: Record<string, string> = {
      APPROVED: `Request Approved: ${req.requisitionNumber}`,
      REJECTED: `Request Rejected: ${req.requisitionNumber}`,
      RETURNED: `Request Returned: ${req.requisitionNumber}`,
      PARTIAL_APPROVAL: `Partial Approval: ${req.requisitionNumber}`,
    };
    await this.notificationService.createNotification({
      companyId: req.companyId,
      userId: req.requestedById,
      requisitionHeaderId: req.id,
      type,
      title: titleMap[type] || `Update: ${req.requisitionNumber}`,
      message: `Your request ${req.requisitionNumber} has been ${type.toLowerCase()}`,
    });
  }

  // ─── PENDING APPROVALS FOR USER ────────────────

  async getPendingApprovalsForUser(userId: number, companyId: number) {
    // Get workflows where user is an approver at current level
    const workflows = await this.prisma.approvalLevel.findMany({
      where: {
        isActive: true,
        workflow: { companyId, isEnabled: true },
        OR: [
          { approverType: 'USER', approverId: userId },
          { approverType: 'ADMIN' },
        ],
      },
      include: { workflow: true },
    });

    const workflowIds = workflows.map((w: any) => w.workflowId);
    const levelNumbers = workflows.map((w: any) => w.levelNumber);

    return this.prisma.requisitionHeader.findMany({
      where: {
        companyId,
        status: 'PENDING',
        approvalWorkflowId: { in: workflowIds },
        currentApprovalLevel: { in: levelNumbers },
      },
      include: { details: true, requestedBy: true, department: true },
      orderBy: [{ priority: 'asc' }, { requestDate: 'asc' }],
    });
  }

  // ─── AUTO-ISSUE AFTER APPROVAL ─────────────────

  async processAutoIssue(requisitionId: number, issuedById: number, issuedByName: string) {
    const req = await this.prisma.requisitionHeader.findUnique({
      where: { id: requisitionId },
      include: { details: true, company: true, sourceStore: true },
    });
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'APPROVED' && req.status !== 'PARTIALLY_APPROVED') {
      throw new Error('Request must be approved before issuing');
    }

    // Return the approved details for external TransactionEngine to process
    return {
      requisitionId: req.id,
      requisitionNumber: req.requisitionNumber,
      requestType: req.requestType,
      sourceStoreId: req.sourceStoreId,
      destStoreId: req.destStoreId,
      companyId: req.companyId,
      items: req.details
        .filter((d: any) => d.approvedQty > d.issuedQty)
        .map((d: any) => ({
          itemId: d.itemId,
          itemName: d.itemName,
          approvedQty: d.approvedQty,
          issuedQty: d.issuedQty,
          pendingQty: d.pendingQty,
          unitName: d.unitName,
        })),
      issuedById,
      issuedByName,
    };
  }

  // ─── UPDATE ISSUED QUANTITIES ──────────────────

  async updateIssuedQty(requisitionId: number, detailUpdates: { detailId: number; issuedQty: number }[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const update of detailUpdates) {
        const detail = await tx.requisitionDetail.findUnique({ where: { id: update.detailId } });
        if (!detail) continue;
        const newIssuedQty = detail.issuedQty + update.issuedQty;
        const newPendingQty = detail.approvedQty - newIssuedQty;
        await tx.requisitionDetail.update({
          where: { id: update.detailId },
          data: {
            issuedQty: newIssuedQty,
            pendingQty: Math.max(0, newPendingQty),
            status: newPendingQty <= 0 ? 'COMPLETED' : 'PARTIALLY_APPROVED',
          },
        });
      }

      // Check if all details are fully issued
      const header = await tx.requisitionHeader.findUnique({
        where: { id: requisitionId },
        include: { details: true },
      });
      if (header) {
        const allIssued = header.details.every((d: any) => d.issuedQty >= d.approvedQty);
        const anyIssued = header.details.some((d: any) => d.issuedQty > 0);
        if (allIssued) {
          await tx.requisitionHeader.update({
            where: { id: requisitionId },
            data: { status: 'COMPLETED', completedDate: new Date() },
          });
        } else if (anyIssued && header.status === 'APPROVED') {
          await tx.requisitionHeader.update({
            where: { id: requisitionId },
            data: { status: 'PARTIALLY_APPROVED' },
          });
        }
      }

      return tx.requisitionHeader.findUnique({ where: { id: requisitionId }, include: { details: true } });
    });
  }
}
