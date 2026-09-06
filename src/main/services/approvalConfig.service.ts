import { PrismaClient } from '@prisma/client';

export interface CreateWorkflowInput {
  companyId: number;
  name: string;
  workflowType: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  description?: string;
}

export interface CreateApprovalLevelInput {
  workflowId: number;
  levelNumber: number;
  levelName: string;
  approverType: string; // USER, ROLE, DEPARTMENT_HEAD, STORE_MANAGER, ADMIN, CUSTOM
  approverId?: number;
  approverRole?: string;
  autoApprove?: boolean;
  autoApproveThreshold?: number;
  timeoutHours?: number;
}

const WORKFLOW_TYPES = [
  'ISSUE', 'TRANSFER', 'INSTALLATION', 'REPAIR', 'REPLACEMENT',
  'DAMAGE', 'ADJUSTMENT', 'PURCHASE', 'RETURN', 'SCRAP', 'FINANCIAL',
];

export class ApprovalConfigService {
  constructor(private prisma: PrismaClient) {}

  // ─── WORKFLOW CRUD ─────────────────────────────

  async createWorkflow(data: CreateWorkflowInput) {
    return this.prisma.approvalWorkflow.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        workflowType: data.workflowType,
        isEnabled: data.isEnabled ?? true,
        isDefault: data.isDefault ?? false,
        description: data.description,
      },
      include: { levels: { orderBy: { levelNumber: 'asc' } } },
    });
  }

  async getWorkflow(id: number) {
    return this.prisma.approvalWorkflow.findUnique({
      where: { id },
      include: { levels: { orderBy: { levelNumber: 'asc' } } },
    });
  }

  async getWorkflows(companyId: number, workflowType?: string) {
    const where: any = { companyId };
    if (workflowType) where.workflowType = workflowType;
    return this.prisma.approvalWorkflow.findMany({
      where,
      include: { levels: { orderBy: { levelNumber: 'asc' } } },
      orderBy: [{ workflowType: 'asc' }, { name: 'asc' }],
    });
  }

  async getActiveWorkflow(companyId: number, workflowType: string) {
    return this.prisma.approvalWorkflow.findFirst({
      where: { companyId, workflowType, isEnabled: true },
      include: { levels: { orderBy: { levelNumber: 'asc' }, where: { isActive: true } } },
    });
  }

  async updateWorkflow(id: number, data: Partial<CreateWorkflowInput>) {
    return this.prisma.approvalWorkflow.update({
      where: { id },
      data: { ...data, id: undefined },
      include: { levels: { orderBy: { levelNumber: 'asc' } } },
    });
  }

  async deleteWorkflow(id: number) {
    await this.prisma.approvalLevel.deleteMany({ where: { workflowId: id } });
    await this.prisma.approvalWorkflow.delete({ where: { id } });
    return { success: true };
  }

  async toggleWorkflow(id: number, isEnabled: boolean) {
    return this.prisma.approvalWorkflow.update({
      where: { id },
      data: { isEnabled },
    });
  }

  // ─── APPROVAL LEVELS ──────────────────────────

  async addApprovalLevel(data: CreateApprovalLevelInput) {
    return this.prisma.approvalLevel.create({
      data: {
        workflowId: data.workflowId,
        levelNumber: data.levelNumber,
        levelName: data.levelName,
        approverType: data.approverType,
        approverId: data.approverId,
        approverRole: data.approverRole,
        autoApprove: data.autoApprove ?? false,
        autoApproveThreshold: data.autoApproveThreshold,
        timeoutHours: data.timeoutHours,
      },
    });
  }

  async updateApprovalLevel(id: number, data: Partial<CreateApprovalLevelInput>) {
    return this.prisma.approvalLevel.update({
      where: { id },
      data: { ...data, id: undefined, workflowId: undefined },
    });
  }

  async deleteApprovalLevel(id: number) {
    await this.prisma.approvalLevel.delete({ where: { id } });
    return { success: true };
  }

  async getApprovalLevels(workflowId: number) {
    return this.prisma.approvalLevel.findMany({
      where: { workflowId },
      orderBy: { levelNumber: 'asc' },
    });
  }

  // ─── SEED DEFAULT WORKFLOWS ────────────────────

  async seedDefaultWorkflows(companyId: number) {
    const existing = await this.prisma.approvalWorkflow.count({ where: { companyId } });
    if (existing > 0) return { message: 'Workflows already seeded', count: existing };

    const workflows = await Promise.all(
      WORKFLOW_TYPES.map((type) =>
        this.prisma.approvalWorkflow.create({
          data: {
            companyId,
            name: `Default ${type} Workflow`,
            workflowType: type,
            isEnabled: false,
            isDefault: true,
            description: `Default approval workflow for ${type} requests`,
          },
        })
      )
    );

    return { message: `Created ${workflows.length} default workflows`, count: workflows.length };
  }

  // ─── VALIDATION ────────────────────────────────

  async isWorkflowEnabled(companyId: number, workflowType: string): Promise<boolean> {
    const workflow = await this.getActiveWorkflow(companyId, workflowType);
    return workflow !== null && workflow.isEnabled;
  }

  async getApprovalLevelsCount(companyId: number, workflowType: string): Promise<number> {
    const workflow = await this.getActiveWorkflow(companyId, workflowType);
    return workflow?.levels.length ?? 0;
  }

  getWorkflowTypes() {
    return WORKFLOW_TYPES;
  }
}
