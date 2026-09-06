import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { RBACService } from '../../src/main/services/rbac.service';
import { requireAuth } from './helpers';
import { validate } from './validate';
import { roleSchema } from '../../src/shared/zod-schemas';
import { getSession, hasPermission, PERMISSION_KEYS } from '../../src/main/services/auth.service';

function requireAdmin() {
  const user = requireAuth();
  const allowed = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STORE_MANAGER';
  if (!allowed && !hasPermission(user, PERMISSION_KEYS.MANAGE_USERS)) {
    throw new Error('Permission denied: admin or store_manager role required');
  }
  return user;
}

export function registerRBACIPC(prisma: PrismaClient) {
  const svc = new RBACService(prisma);

  ipcMain.handle('rbac:seedPermissions', async () => {
    requireAdmin();
    return svc.seedPermissions();
  });

  ipcMain.handle('rbac:seedRoles', async (_e, companyId: number) => {
    requireAdmin();
    return svc.seedRoles(companyId);
  });

  ipcMain.handle('rbac:createRole', async (_e, data: any) => {
    requireAdmin();
    const validated = validate(roleSchema, data);
    return svc.createRole(validated);
  });

  ipcMain.handle('rbac:updateRole', async (_e, id: number, data: any) => {
    requireAdmin();
    const validated = validate(roleSchema.partial(), data);
    return svc.updateRole(id, validated);
  });

  ipcMain.handle('rbac:deleteRole', async (_e, id: number) => {
    requireAdmin();
    return svc.deleteRole(id);
  });

  ipcMain.handle('rbac:findAll', async (_e, companyId: number) => {
    requireAuth();
    return svc.findAll(companyId);
  });

  ipcMain.handle('rbac:findById', async (_e, id: number) => {
    requireAuth();
    return svc.findById(id);
  });

  ipcMain.handle('rbac:getPermissions', async () => {
    requireAuth();
    return svc.getPermissions();
  });

  ipcMain.handle('rbac:getPermissionsByModule', async () => {
    requireAuth();
    return svc.getPermissionsByModule();
  });

  ipcMain.handle('rbac:assignRoleToUser', async (_e, userId: number, roleId: number) => {
    requireAdmin();
    return svc.assignRoleToUser(userId, roleId);
  });

  ipcMain.handle('rbac:getUserPermissions', async (_e, userId: number) => {
    requireAuth();
    return svc.getUserPermissions(userId);
  });

  ipcMain.handle('rbac:hasPermission', async (_e, userId: number, permissionKey: string) => {
    requireAuth();
    return svc.hasPermission(userId, permissionKey);
  });
}
