import { PrismaClient } from '@prisma/client';

const SYSTEM_ROLES = [
  { name: 'SUPER_ADMIN', displayName: 'Super Admin', description: 'Full system access', isSystem: true },
  { name: 'ADMIN', displayName: 'Admin', description: 'Administrative access', isSystem: true },
  { name: 'STORE_MANAGER', displayName: 'Store Manager', description: 'Store operations management', isSystem: true },
  { name: 'DEPARTMENT_MANAGER', displayName: 'Department Manager', description: 'Department inventory management', isSystem: true },
  { name: 'DHARMSHALA_MANAGER', displayName: 'Dharmshala Manager', description: 'Dharmshala inventory management', isSystem: true },
  { name: 'PURCHASE_MANAGER', displayName: 'Purchase Manager', description: 'Purchase and procurement management', isSystem: true },
  { name: 'MAINTENANCE_MANAGER', displayName: 'Maintenance Manager', description: 'Asset maintenance management', isSystem: true },
  { name: 'AUDITOR', displayName: 'Auditor', description: 'Read-only audit access', isSystem: true },
  { name: 'READ_ONLY', displayName: 'Read Only', description: 'View-only access', isSystem: true },
];

const DEFAULT_PERMISSIONS = [
  // ITEM
  { key: 'item:create', module: 'ITEM', action: 'CREATE', description: 'Create items' },
  { key: 'item:view', module: 'ITEM', action: 'VIEW', description: 'View items' },
  { key: 'item:edit', module: 'ITEM', action: 'EDIT', description: 'Edit items' },
  { key: 'item:delete', module: 'ITEM', action: 'DELETE', description: 'Delete items' },
  { key: 'item:import', module: 'ITEM', action: 'IMPORT', description: 'Import items' },
  { key: 'item:export', module: 'ITEM', action: 'EXPORT', description: 'Export items' },
  // TRANSACTION
  { key: 'transaction:create', module: 'TRANSACTION', action: 'CREATE', description: 'Create transactions' },
  { key: 'transaction:view', module: 'TRANSACTION', action: 'VIEW', description: 'View transactions' },
  { key: 'transaction:approve', module: 'TRANSACTION', action: 'APPROVE', description: 'Approve transactions' },
  { key: 'transaction:reject', module: 'TRANSACTION', action: 'REJECT', description: 'Reject transactions' },
  // ASSET
  { key: 'asset:create', module: 'ASSET', action: 'CREATE', description: 'Create assets' },
  { key: 'asset:view', module: 'ASSET', action: 'VIEW', description: 'View assets' },
  { key: 'asset:edit', module: 'ASSET', action: 'EDIT', description: 'Edit assets' },
  { key: 'asset:delete', module: 'ASSET', action: 'DELETE', description: 'Delete assets' },
  // PURCHASE
  { key: 'purchase:create', module: 'PURCHASE', action: 'CREATE', description: 'Create purchase orders' },
  { key: 'purchase:view', module: 'PURCHASE', action: 'VIEW', description: 'View purchases' },
  { key: 'purchase:approve', module: 'PURCHASE', action: 'APPROVE', description: 'Approve purchases' },
  // MAINTENANCE
  { key: 'maintenance:create', module: 'MAINTENANCE', action: 'CREATE', description: 'Create maintenance requests' },
  { key: 'maintenance:view', module: 'MAINTENANCE', action: 'VIEW', description: 'View maintenance' },
  { key: 'maintenance:approve', module: 'MAINTENANCE', action: 'APPROVE', description: 'Approve maintenance' },
  // REQUISITION
  { key: 'requisition:create', module: 'REQUISITION', action: 'CREATE', description: 'Create requisitions' },
  { key: 'requisition:view', module: 'REQUISITION', action: 'VIEW', description: 'View requisitions' },
  { key: 'requisition:approve', module: 'REQUISITION', action: 'APPROVE', description: 'Approve requisitions' },
  // REPORT
  { key: 'report:view', module: 'REPORT', action: 'VIEW', description: 'View reports' },
  { key: 'report:export', module: 'REPORT', action: 'EXPORT', description: 'Export reports' },
  { key: 'report:print', module: 'REPORT', action: 'PRINT', description: 'Print reports' },
  // SETTINGS
  { key: 'settings:view', module: 'SETTINGS', action: 'VIEW', description: 'View settings' },
  { key: 'settings:edit', module: 'SETTINGS', action: 'EDIT', description: 'Edit settings' },
  // USER
  { key: 'user:create', module: 'USER', action: 'CREATE', description: 'Create users' },
  { key: 'user:view', module: 'USER', action: 'VIEW', description: 'View users' },
  { key: 'user:edit', module: 'USER', action: 'EDIT', description: 'Edit users' },
  { key: 'user:delete', module: 'USER', action: 'DELETE', description: 'Delete users' },
  // AUDIT
  { key: 'audit:view', module: 'AUDIT', action: 'VIEW', description: 'View audit logs' },
  // FINANCIAL YEAR
  { key: 'financial_year:view', module: 'FINANCIAL_YEAR', action: 'VIEW', description: 'View financial years' },
  { key: 'financial_year:closing', module: 'FINANCIAL_YEAR', action: 'CLOSING', description: 'Close financial years' },
  // BACKUP
  { key: 'backup:create', module: 'BACKUP', action: 'CREATE', description: 'Create backups' },
  { key: 'backup:restore', module: 'BACKUP', action: 'RESTORE', description: 'Restore backups' },
];

export class RBACService {
  constructor(private prisma: PrismaClient) {}

  async seedPermissions() {
    for (const p of DEFAULT_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { key: p.key },
        update: { description: p.description },
        create: p,
      });
    }
  }

  async seedRoles(companyId: number) {
    for (const r of SYSTEM_ROLES) {
      await this.prisma.role.upsert({
        where: { companyId_name: { companyId, name: r.name } },
        update: { displayName: r.displayName },
        create: { companyId, ...r },
      });
    }
    // Assign default permissions to system roles
    await this.seedRolePermissions(companyId);
  }

  private async seedRolePermissions(companyId: number) {
    const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
      STORE_MANAGER: ['manage_masters', 'manage_users', 'user:create', 'item:create', 'item:view', 'item:edit', 'transaction:create', 'transaction:view'],
      DEPARTMENT_MANAGER: ['item:view', 'transaction:create', 'transaction:view', 'requisition:create', 'requisition:view'],
      PURCHASE_MANAGER: ['purchase:create', 'purchase:view', 'purchase:approve', 'item:view'],
      MAINTENANCE_MANAGER: ['maintenance:create', 'maintenance:view', 'maintenance:approve', 'asset:view'],
    };

    for (const [roleName, permKeys] of Object.entries(ROLE_DEFAULT_PERMISSIONS)) {
      const role = await this.prisma.role.findFirst({ where: { companyId, name: roleName } });
      if (!role) continue;
      const perms = await this.prisma.permission.findMany({ where: { key: { in: permKeys } } });
      if (perms.length === 0) continue;
      for (const perm of perms) {
        await this.prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  async createRole(data: { companyId: number; name: string; displayName: string; description?: string; permissionIds?: number[] }) {
    const existing = await this.prisma.role.findUnique({
      where: { companyId_name: { companyId: data.companyId, name: data.name } },
    });
    if (existing) throw new Error(`Role "${data.name}" already exists`);
    return this.prisma.role.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        isSystem: false,
        rolePermissions: data.permissionIds?.length
          ? { create: data.permissionIds.map((pid) => ({ permissionId: pid })) }
          : undefined,
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async updateRole(id: number, data: { displayName?: string; description?: string; permissionIds?: number[] }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot modify system roles');
    if (data.permissionIds !== undefined) {
      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        ...(data.permissionIds.length > 0
          ? [this.prisma.rolePermission.createMany({
              data: data.permissionIds.map((pid) => ({ roleId: id, permissionId: pid })),
            })]
          : []),
      ]);
    }
    return this.prisma.role.update({
      where: { id },
      data: { displayName: data.displayName, description: data.description },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async deleteRole(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { users: true } });
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot delete system roles');
    if (role.users.length > 0) throw new Error('Cannot delete role with assigned users');
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return this.prisma.role.delete({ where: { id } });
  }

  async findAll(companyId: number) {
    return this.prisma.role.findMany({
      where: { companyId },
      include: { _count: { select: { users: true } }, rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number) {
    return this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } }, users: { select: { id: true, username: true, fullName: true } } },
    });
  }

  async getPermissions() {
    return this.prisma.permission.findMany({ where: { isActive: true }, orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  }

  async getPermissionsByModule() {
    const perms = await this.prisma.permission.findMany({ where: { isActive: true }, orderBy: [{ module: 'asc' }, { action: 'asc' }] });
    const grouped: Record<string, typeof perms> = {};
    for (const p of perms) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  }

  async assignRoleToUser(userId: number, roleId: number) {
    const [role, user] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!role) throw new Error('Role not found');
    if (!user) throw new Error('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { roleId, role: role.name },
    });
  }

  async getUserPermissions(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRole: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!user) throw new Error('User not found');
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      return this.prisma.permission.findMany({ where: { isActive: true } });
    }
    const jsonPerms = (() => { try { return JSON.parse(user.permissions); } catch { return []; } })();
    if (user.userRole?.rolePermissions) {
      const rolePerms = user.userRole.rolePermissions.map((rp) => rp.permission.key);
      return this.prisma.permission.findMany({ where: { key: { in: [...jsonPerms, ...rolePerms] }, isActive: true } });
    }
    return this.prisma.permission.findMany({ where: { key: { in: jsonPerms }, isActive: true } });
  }

  async hasPermission(userId: number, permissionKey: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRole: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!user || !user.isActive) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    const jsonPerms = (() => { try { return JSON.parse(user.permissions); } catch { return []; } })();
    if (jsonPerms.includes(permissionKey)) return true;
    if (user.userRole?.rolePermissions) {
      return user.userRole.rolePermissions.some((rp) => rp.permission.key === permissionKey);
    }
    return false;
  }
}
