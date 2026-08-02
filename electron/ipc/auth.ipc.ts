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
import { serialize } from './helpers';

export function registerAuthIpc() {
  const prisma = getPrismaClient();

  // ─── Login ──────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new Error('Invalid username or password');
    if (!user.isActive) throw new Error('User account is inactive');

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) throw new Error('Invalid username or password');

    const safe = toSafeUser(user);
    setSession(safe);

    // Log the login
    await prisma.loginHistory.create({
      data: { userId: user.id },
    });

    return serialize(safe);
  });

  // ─── Logout ─────────────────────────────────────────────────────
  ipcMain.handle('auth:logout', async () => {
    const session = getSession();
    if (session) {
      const prisma = getPrismaClient();
      // Update the most recent login record with logout time
      const lastLogin = await prisma.loginHistory.findFirst({
        where: { userId: session.id, logoutAt: null },
        orderBy: { loginAt: 'desc' },
      });
      if (lastLogin) {
        await prisma.loginHistory.update({
          where: { id: lastLogin.id },
          data: { logoutAt: new Date() },
        });
      }
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

    return serialize(toSafeUser(user));
  });

  // ─── Change Own Password ────────────────────────────────────────
  ipcMain.handle('auth:changePassword', async (_event, currentPassword: string, newPassword: string) => {
    const session = getSession();
    if (!session) throw new Error('Not logged in');

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) throw new Error('User not found');

    const valid = verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: hashPassword(newPassword) },
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
    return Object.values(PERMISSION_KEYS);
  });

  // ─── List Users (Admin only) ───────────────────────────────────
  ipcMain.handle('auth:listUsers', async () => {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      throw new Error('Permission denied: admin role required');
    }

    const users = await prisma.user.findMany({
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

    if (!data.username || data.username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (!data.fullName) {
      throw new Error('Full name is required');
    }

    const role = data.role || 'USER';
    if (role !== 'ADMIN' && role !== 'USER') {
      throw new Error('Role must be ADMIN or USER');
    }

    // Check username uniqueness
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
      throw new Error(`Username "${data.username}" already exists`);
    }

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: hashPassword(data.password),
        fullName: data.fullName,
        role,
        permissions: JSON.stringify(data.permissions || []),
      },
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
      if (data.role !== 'ADMIN' && data.role !== 'USER') {
        throw new Error('Role must be ADMIN or USER');
      }
      updateData.role = data.role;
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

    return serialize(toSafeUser(user));
  });

  // ─── Admin Reset Any User's Password ───────────────────────────
  ipcMain.handle('auth:adminResetPassword', async (_event, userId: number, newPassword: string) => {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      throw new Error('Permission denied: admin role required');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error('User not found');

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword) },
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
    return { success: true };
  });
}
