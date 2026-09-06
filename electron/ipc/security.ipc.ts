import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import { SecurityService } from '../../src/main/services/security.service';
import { requireAuth, serialize } from './helpers';
import { validate } from './validate';
import { passwordPolicySchema, changePasswordSchema } from '../../src/shared/zod-schemas';
import { getSession } from '../../src/main/services/auth.service';

function requireAdmin() {
  const session = requireAuth();
  if (session.role !== 'ADMIN') throw new Error('Permission denied: admin role required');
  return session;
}

export function registerSecurityIPC(prisma: PrismaClient) {
  const svc = new SecurityService(prisma);

  ipcMain.handle('security:getPasswordPolicy', async (_e, companyId: number) => {
    requireAuth();
    return svc.getPasswordPolicy(companyId);
  });

  ipcMain.handle('security:updatePasswordPolicy', async (_e, companyId: number, data: any) => {
    requireAdmin();
    const validated = validate(passwordPolicySchema, data);
    return svc.updatePasswordPolicy(companyId, validated);
  });

  ipcMain.handle('security:validatePassword', async (_e, password: string, policy: any) => {
    requireAuth();
    return svc.validatePassword(password, policy);
  });

  ipcMain.handle('security:changePassword', async (_e, userId: number, oldPassword: string, newPassword: string) => {
    requireAuth();
    const session = getSession()!;
    // Users can only change their own password; admins can change any
    if (session.id !== userId && session.role !== 'ADMIN') {
      throw new Error('Permission denied: can only change your own password');
    }
    const validated = validate(changePasswordSchema, { currentPassword: oldPassword, newPassword });
    return svc.changePassword(userId, validated.currentPassword, validated.newPassword);
  });

  ipcMain.handle('security:checkPasswordExpiry', async (_e, userId: number) => {
    requireAuth();
    return svc.checkPasswordExpiry(userId);
  });

  ipcMain.handle('security:isAccountLocked', async (_e, userId: number) => {
    requireAuth();
    return svc.isAccountLocked(userId);
  });

  ipcMain.handle('security:lockAccount', async (_e, userId: number) => {
    requireAdmin();
    return svc.lockAccount(userId);
  });

  ipcMain.handle('security:unlockAccount', async (_e, userId: number) => {
    requireAdmin();
    return svc.unlockAccount(userId);
  });

  ipcMain.handle('security:forceLogoutAll', async (_e, userId: number) => {
    requireAdmin();
    return svc.forceLogoutAll(userId);
  });

  ipcMain.handle('security:getActiveSessions', async (_e, userId?: number) => {
    requireAuth();
    return serialize(await svc.getActiveSessions(userId));
  });

  ipcMain.handle('security:getSessionStats', async (_e, companyId: number) => {
    requireAuth();
    return serialize(await svc.getSessionStats(companyId));
  });

  ipcMain.handle('security:createSession', async (_e, userId: number, ipAddress?: string, device?: string) => {
    requireAdmin();
    return serialize(await svc.createSession(userId, ipAddress, device));
  });

  ipcMain.handle('security:logoutSession', async (_e, token: string) => {
    requireAuth();
    return svc.logoutSession(token);
  });
}
