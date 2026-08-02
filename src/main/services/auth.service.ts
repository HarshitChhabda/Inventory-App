import crypto from 'crypto';
import { getPrismaClient } from '../database/prisma.client';

// ─── Permission Keys ────────────────────────────────────────────────
// Every restricted action maps to a key. ADMIN always passes.
// USER starts with zero extra permissions; Admin toggles these per-user.

export const PERMISSION_KEYS = {
  CANCEL_CHALLAN: 'cancel_challan',
  DELETE_CHALLAN: 'delete_challan',
  MANAGE_MASTERS: 'manage_masters',
  MANAGE_FINANCIAL_YEAR: 'manage_financial_year',
  MANAGE_BACKUP: 'manage_backup',
  MANAGE_USERS: 'manage_users',
  VIEW_AUDIT_LOG: 'view_audit_log',
  MANAGE_COMPANY: 'manage_company',
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

// ─── Password Hashing (scrypt — native Node, zero extra deps) ───────

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string): string {
  const salt = generateSalt();
  const derived = crypto.scryptSync(
    password,
    salt,
    SCRYPT_KEYLEN,
    { cost: SCRYPT_COST, blockSize: SCRYPT_BLOCK_SIZE, parallelization: SCRYPT_PARALLELIZATION },
  );
  return `${salt}:${derived.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;
  const derived = crypto.scryptSync(
    password,
    salt,
    SCRYPT_KEYLEN,
    { cost: SCRYPT_COST, blockSize: SCRYPT_BLOCK_SIZE, parallelization: SCRYPT_PARALLELIZATION },
  );
  return crypto.timingSafeEqual(Buffer.from(hashHex, 'hex'), derived);
}

// ─── Permission Checking ────────────────────────────────────────────

/**
 * Parse the JSON permissions column safely.
 */
function parsePermissions(permissionsJson: string): string[] {
  try {
    const parsed = JSON.parse(permissionsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Check whether a user has a specific permission.
 * ADMIN always gets everything. USER gets only what's in their permissions[].
 */
export function hasPermission(user: { role: string; permissions: string }, permissionKey: string): boolean {
  if (user.role === 'ADMIN') return true;
  const granted = parsePermissions(user.permissions);
  return granted.includes(permissionKey);
}

/**
 * Throw if the user lacks the given permission. Use inside IPC handlers.
 * Fetches the user from DB, so call this with just the userId.
 */
export async function requirePermission(userId: number, permissionKey: PermissionKey): Promise<void> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (!user.isActive) throw new Error('User account is inactive');
  if (!hasPermission(user, permissionKey)) {
    throw new Error(`Permission denied: ${permissionKey}`);
  }
}

/**
 * Require ADMIN role specifically. Use for operations that are ADMIN-only
 * regardless of permission overrides (e.g. granting permissions).
 */
export async function requireAdmin(userId: number): Promise<void> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (!user.isActive) throw new Error('User account is inactive');
  if (user.role !== 'ADMIN') throw new Error('Permission denied: admin role required');
}

// ─── Safe User Serialization ────────────────────────────────────────

export interface SafeUser {
  id: number;
  uuid: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
}

export function toSafeUser(user: {
  id: number;
  uuid: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string;
  isActive: boolean;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    uuid: user.uuid,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    permissions: parsePermissions(user.permissions),
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

// ─── In-Memory Session (single desktop instance) ────────────────────

let currentSessionUser: SafeUser | null = null;

export function setSession(user: SafeUser): void {
  currentSessionUser = user;
}

export function getSession(): SafeUser | null {
  return currentSessionUser;
}

export function clearSession(): void {
  currentSessionUser = null;
}
