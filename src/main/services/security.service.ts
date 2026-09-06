import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class SecurityService {
  constructor(private prisma: PrismaClient) {}

  async getPasswordPolicy(companyId: number) {
    const defaultPolicy = {
      minPasswordLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAgeDays: 90,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 30,
      sessionTimeoutMinutes: 480,
      forceLogoutAllDevices: false,
      passwordHistoryCount: 3,
    };

    let policy = await this.prisma.passwordPolicy.findUnique({ where: { companyId } });
    if (!policy) {
      try {
        policy = await this.prisma.passwordPolicy.create({
          data: { companyId, ...defaultPolicy },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          policy = await this.prisma.passwordPolicy.findUnique({ where: { companyId } });
        }
        if (!policy) throw e;
      }
    }
    return policy;
  }

  async updatePasswordPolicy(companyId: number, data: Partial<{
    minPasswordLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAgeDays: number | null;
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
    sessionTimeoutMinutes: number;
    forceLogoutAllDevices: boolean;
    passwordHistoryCount: number;
  }>) {
    await this.getPasswordPolicy(companyId);
    return this.prisma.passwordPolicy.update({
      where: { companyId },
      data,
    });
  }

  validatePassword(password: string, policy: {
    minPasswordLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (password.length < policy.minPasswordLength) errors.push(`Password must be at least ${policy.minPasswordLength} characters`);
    if (policy.requireUppercase && !/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (policy.requireLowercase && !/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (policy.requireNumbers && !/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain at least one special character');
    return { valid: errors.length === 0, errors };
  }

  async recordFailedLogin(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const policy = await this.getPasswordPolicy(user.companyId || 1);
    const newCount = user.failedLoginAttempts + 1;
    const updateData: any = { failedLoginAttempts: newCount };
    if (newCount >= policy.maxFailedAttempts) {
      updateData.lockedUntil = new Date(Date.now() + policy.lockoutDurationMinutes * 60 * 1000);
    }
    await this.prisma.user.update({ where: { id: userId }, data: updateData });
  }

  async resetFailedLogin(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async isAccountLocked(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    if (user.lockedUntil && user.lockedUntil > new Date()) return true;
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.prisma.user.update({ where: { id: userId }, data: { lockedUntil: null, failedLoginAttempts: 0 } });
    }
    return false;
  }

  async checkPasswordExpiry(userId: number): Promise<{ expired: boolean; daysLeft?: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordExpiry) return { expired: false };
    const now = new Date();
    const daysLeft = Math.ceil((user.passwordExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { expired: daysLeft <= 0, daysLeft: Math.max(0, daysLeft) };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const locked = await this.isAccountLocked(userId);
    if (locked) throw new Error('Account is locked. Please contact administrator.');
    const [salt, hashHex] = user.passwordHash.split(':');
    const derived = crypto.scryptSync(oldPassword, salt, 64, { cost: 16384, blockSize: 8, parallelization: 1 });
    if (!crypto.timingSafeEqual(Buffer.from(hashHex, 'hex'), derived)) {
      await this.recordFailedLogin(userId);
      throw new Error('Current password is incorrect');
    }
    const policy = await this.getPasswordPolicy(user.companyId || 1);
    const validation = this.validatePassword(newPassword, policy);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = crypto.scryptSync(newPassword, newSalt, 64, { cost: 16384, blockSize: 8, parallelization: 1 });
    const newPasswordHash = `${newSalt}:${newHash.toString('hex')}`;
    const expiryDays = policy.maxAgeDays || 90;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        lastPasswordChange: new Date(),
        passwordExpiry: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    if (policy.forceLogoutAllDevices) {
      await this.prisma.session.updateMany({ where: { userId, isActive: true }, data: { isActive: false, logoutAt: new Date() } });
    }
  }

  async createSession(userId: number, ipAddress?: string, device?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const policy = await this.getPasswordPolicy(user?.companyId || 1);
    const token = crypto.randomBytes(32).toString('hex');
    const session = await this.prisma.session.create({
      data: { userId, token, ipAddress, device },
    });
    if (policy.forceLogoutAllDevices) {
      await this.prisma.session.updateMany({
        where: { userId, isActive: true, id: { not: session.id } },
        data: { isActive: false, logoutAt: new Date() },
      });
    }
    return session;
  }

  async validateSession(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || !session.isActive) return null;
    const policy = await this.getPasswordPolicy(session.user?.companyId || 1);
    const timeoutMs = policy.sessionTimeoutMinutes * 60 * 1000;
    if (Date.now() - session.lastActiveAt.getTime() > timeoutMs) {
      await this.prisma.session.update({ where: { id: session.id }, data: { isActive: false, logoutAt: new Date() } });
      return null;
    }
    await this.prisma.session.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } });
    return session;
  }

  async logoutSession(token: string) {
    await this.prisma.session.updateMany({ where: { token }, data: { isActive: false, logoutAt: new Date() } });
  }

  async forceLogoutAll(userId: number) {
    await this.prisma.session.updateMany({ where: { userId, isActive: true }, data: { isActive: false, logoutAt: new Date() } });
  }

  async getActiveSessions(userId?: number) {
    const where: any = { isActive: true };
    if (userId) where.userId = userId;
    return this.prisma.session.findMany({
      where,
      include: { user: { select: { id: true, username: true, fullName: true } } },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async getSessionStats(companyId: number) {
    const [totalActive, totalUsers, recentLogins] = await Promise.all([
      this.prisma.session.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.loginHistory.findMany({
        where: { user: { userRole: { companyId } } },
        include: { user: { select: { username: true, fullName: true } } },
        orderBy: { loginAt: 'desc' },
        take: 20,
      }),
    ]);
    return { totalActive, totalUsers, recentLogins };
  }

  async lockAccount(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
  }

  async unlockAccount(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
  }
}
