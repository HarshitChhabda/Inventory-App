import { ipcMain } from 'electron';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import {
  verifyPassword,
  hashPassword,
  toSafeUser,
  setSession,
  getSession,
  clearSession,
  PERMISSION_KEYS,
  hasPermission,
  type PermissionKey,
} from '../../src/main/services/auth.service';
import type { SafeUser } from '../../src/main/services/auth.service';
import { SecurityService } from '../../src/main/services/security.service';
import { AuditService } from '../../src/main/services/audit.service';
import { serialize } from './helpers';
import { validate } from './validate';
import { loginSchema, userSchema } from '../../src/shared/zod-schemas';

export function registerAuthIpc() {
  const prisma = getPrismaClient();
  const securityService = new SecurityService(prisma);
  const auditService = new AuditService(prisma);

  // ─── Login ──────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    const input = validate(loginSchema, { username, password });

    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user) throw new Error('Invalid username or password');
    if (!user.isActive) throw new Error('User account is inactive');

    // Check account lockout
    const isLocked = await securityService.isAccountLocked(user.id);
    if (isLocked) throw new Error('Account is locked due to too many failed attempts. Please try again later or contact administrator.');

    const valid = verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      // Record failed login attempt
      await securityService.recordFailedLogin(user.id);
      throw new Error('Invalid username or password');
    }

    // Reset failed login attempts on successful login
    await securityService.resetFailedLogin(user.id);

    // Check password expiry
    const expiryCheck = await securityService.checkPasswordExpiry(user.id);
    const mustChangePassword = !user.lastPasswordChange;

    const safe = toSafeUser(user);
    // Merge role-based permissions from rolePermission table
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId || 0 },
      include: { permission: true },
    });
    const mergedPerms = [...new Set([...safe.permissions, ...rolePerms.map(rp => rp.permission.key)])];
    const userWithRolePerms = { ...safe, permissions: mergedPerms };
    setSession(userWithRolePerms);

    // Log the login via audit service
    await auditService.logLogin(user.id);

    return { ...serialize(userWithRolePerms), mustChangePassword, passwordExpired: expiryCheck.expired, passwordDaysLeft: expiryCheck.daysLeft };
  });

  // ─── Logout ─────────────────────────────────────────────────────
  ipcMain.handle('auth:logout', async () => {
    const session = getSession();
    if (session) {
      await auditService.logLogout(session.id);
    }
    clearSession();
    return { success: true };
  });

  // ─── Get Current Session User ───────────────────────────────────
  ipcMain.handle('auth:getCurrentUser', async () => {
    const session = getSession();
    if (!session) return null;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user || !user.isActive) {
      clearSession();
      return null;
    }

    const safe = toSafeUser(user);
    // Merge role-based permissions from rolePermission table
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId || 0 },
      include: { permission: true },
    });
    const mergedPerms = [...new Set([...safe.permissions, ...rolePerms.map(rp => rp.permission.key)])];
    const userWithRolePerms = { ...safe, permissions: mergedPerms };
    const expiryCheck = await securityService.checkPasswordExpiry(user.id);
    const mustChangePassword = !user.lastPasswordChange;

    return { ...serialize(userWithRolePerms), mustChangePassword, passwordExpired: expiryCheck.expired, passwordDaysLeft: expiryCheck.daysLeft };
  });

  // ─── Change Own Password ────────────────────────────────────────
  ipcMain.handle('auth:changePassword', async (_event, currentPassword: string, newPassword: string) => {
    const session = getSession();
    if (!session) throw new Error('Not logged in');

    // Delegate to SecurityService which enforces password policy
    await securityService.changePassword(session.id, currentPassword, newPassword);

    // Audit log
    await auditService.log({
      userId: session.id,
      action: 'UPDATE',
      tableName: 'User',
      recordId: session.id,
      description: 'Password changed',
    });

    return { success: true };
  });

  // ─── Check Permission (for frontend to query) ──────────────────
  ipcMain.handle('auth:hasPermission', async (_event, permissionKey: string) => {
    const session = getSession();
    if (!session) return false;
    return hasPermission(session, permissionKey);
  });

  // ─── Get All Permission Keys (for Admin UI) ────────────────────
  ipcMain.handle('auth:getPermissionKeys', async () => {
    requireAuth();
    return Object.values(PERMISSION_KEYS);
  });

  // ─── List Users (Admin only) ───────────────────────────────────
  ipcMain.handle('auth:listUsers', async () => {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      throw new Error('Permission denied: admin role required');
    }

    const users = await prisma.user.findMany({
      where: session.companyId ? { companyId: session.companyId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return serialize(users.map(toSafeUser));
  });

  // ─── Create User (Admin only) ──────────────────────────────────
  ipcMain.handle('auth:createUser', async (_event, data: {
    username: string;
    password: string;
    fullName: string;
    role?: string;
    permissions?: string[];
  }) => {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      throw new Error('Permission denied: admin role required');
    }

    const input = validate(userSchema, data);

    // Check username uniqueness
    const existing = await prisma.user.findUnique({ where: { username: input.username } });
    if (existing) {
      throw new Error('Username already taken');
    }

    // Look up the RBAC role by name for this company
    let roleId: number | undefined;
    if (input.role) {
      const role = await prisma.role.findFirst({
        where: { name: input.role, companyId: input.companyId || session.companyId || 1 },
      });
      if (role) roleId = role.id;
    }

    const user = await prisma.user.create({
      data: {
        username: input.username,
        passwordHash: hashPassword(input.password),
        fullName: input.fullName,
        role: input.role,
        roleId: roleId || undefined,
        permissions: JSON.stringify(input.permissions || []),
        lastPasswordChange: new Date(),
        passwordExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    // Audit log
    await auditService.log({
      userId: session.id,
      action: 'CREATE',
      tableName: 'User',
      recordId: user.id,
      description: `User "${input.username}" created with role ${input.role}`,
    });

    return serialize(toSafeUser(user));
  });

  // ─── Update User (Admin only) ──────────────────────────────────
  ipcMain.handle('auth:updateUser', async (_event, userId: number, data: {
    fullName?: string;
    role?: string;
    permissions?: string[];
    isActive?: boolean;
  }) => {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      throw new Error('Permission denied: admin role required');
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error('User not found');

    // Prevent admin from deactivating themselves
    if (target.id === session.id && data.isActive === false) {
      throw new Error('Cannot deactivate your own account');
    }

    // Prevent changing own role from ADMIN (safety)
    if (target.id === session.id && data.role && data.role !== 'ADMIN') {
      throw new Error('Cannot change your own role');
    }

    const updateData: any = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.role !== undefined) {
      const allowedRoles = ['ADMIN', 'STORE_MANAGER', 'DEPARTMENT_MANAGER', 'PURCHASE_MANAGER', 'VIEWER'];
      if (!allowedRoles.includes(data.role)) {
        throw new Error('Invalid role');
      }
      updateData.role = data.role;
      // Also update roleId from RBAC system
      const role = await prisma.role.findFirst({
        where: { name: data.role, companyId: session.companyId || 1 },
      });
      if (role) updateData.roleId = role.id;
    }
    if (data.permissions !== undefined) {
      updateData.permissions = JSON.stringify(data.permissions);
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // If admin updated their own record, refresh session
    if (userId === session.id) {
      setSession(toSafeUser(user));
    }

    // Audit log
    await auditService.log({
      userId: session.id,
      action: 'UPDATE',
      tableName: 'User',
      recordId: userId,
      description: `User "${target.username}" updated`,
      oldValues: { fullName: target.fullName, role: target.role, isActive: target.isActive },
      newValues: updateData,
    });

    return serialize(toSafeUser(user));
  });

  // ─── Admin Reset Any User's Password ───────────────────────────
  ipcMain.handle('auth:adminResetPassword', async (_event, userId: number, newPassword: string) => {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      throw new Error('Permission denied: admin role required');
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error('User not found');

    // Enforce password policy instead of hardcoded 6-char minimum
    const policy = await securityService.getPasswordPolicy(session.companyId || 1);
    const validation = securityService.validatePassword(newPassword, policy);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    const expiryDays = policy.maxAgeDays || 90;
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(newPassword),
        lastPasswordChange: new Date(),
        passwordExpiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Audit log
    await auditService.log({
      userId: session.id,
      action: 'UPDATE',
      tableName: 'User',
      recordId: userId,
      description: `Admin reset password for user "${target.username}"`,
    });

    return { success: true };
  });

  // ─── Delete User (Admin only) ──────────────────────────────────
  ipcMain.handle('auth:deleteUser', async (_event, userId: number) => {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      throw new Error('Permission denied: admin role required');
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error('User not found');

    // Prevent admin from deleting themselves
    if (target.id === session.id) {
      throw new Error('Cannot delete your own account');
    }

    // Prevent deleting the last admin
    if (target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last active admin user');
      }
    }

    await prisma.user.delete({ where: { id: userId } });

    // Audit log
    await auditService.log({
      userId: session.id,
      action: 'DELETE',
      tableName: 'User',
      recordId: userId,
      description: `User "${target.username}" deleted`,
    });

    return { success: true };
  });
}
