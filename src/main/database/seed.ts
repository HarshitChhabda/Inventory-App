import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../services/auth.service';
import { getLogger } from '../services/monitoring/logger.service';

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // Only create default admin user if no users exist
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    getLogger().info('[seed] Users already exist, skipping seed.', 'seed');
    return;
  }

  getLogger().info('[seed] Creating default admin user with default password...', 'seed');

  const initialPassword = 'admin123';

  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: hashPassword(initialPassword),
      fullName: 'Administrator',
      role: 'ADMIN',
      permissions: '[]',
      isActive: true,
      lastPasswordChange: null,
      passwordExpiry: null,
    },
  });

  getLogger().info(`[seed] Created default admin user (username: admin, initial password: ${initialPassword})`, 'seed');
  getLogger().info('[seed] IMPORTANT: Change the admin password on first login!', 'seed');
}
