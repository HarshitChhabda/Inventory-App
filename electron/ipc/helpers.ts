import { getSession } from '../../src/main/services/auth.service';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { AuditService } from '../../src/main/services/audit.service';

let auditService: AuditService | null = null;
let activeCompanyId: number | null = null;

function getAuditService(): AuditService {
  if (!auditService) {
    auditService = new AuditService(getPrismaClient());
  }
  return auditService;
}

export function setActiveCompanyId(id: number | null) {
  activeCompanyId = id;
}

export function getActiveCompanyId(): number | null {
  return activeCompanyId;
}

export function serialize(obj: any) {
  function serializePrimitives(v: any): any {
    if (v === null || v === undefined) return v;
    if (typeof v === 'bigint') return v.toString();
    // Duck-type Date check (instanceof fails across Electron realms)
    if (typeof v.getTime === 'function' && typeof v.toISOString === 'function' && !isNaN(v.getTime())) {
      try { return v.toISOString(); } catch { return null; }
    }
    if (typeof v === 'object') {
      // Prisma Decimal: has s (sign), e (exponent), d (digits) internal structure
      if (typeof v.s === 'number' && typeof v.e === 'number' && ('d' in v)) {
        try {
          const num = Number(v.toString());
          if (isFinite(num)) return num;
        } catch { /* fall through to manual compute */ }
        try {
          const sign = v.s === 1 ? 1 : -1;
          const digits = Array.isArray(v.d) ? v.d.join('') : String(v.d);
          return sign * parseFloat(digits + 'e' + (v.e - (digits.length - 1)));
        } catch { return 0; }
      }
      if (Array.isArray(v)) return v.map(serializePrimitives);
      const out: any = {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = serializePrimitives(val);
      }
      return out;
    }
    return v;
  }
  const serialized = serializePrimitives(obj);
  return JSON.parse(JSON.stringify(serialized));
}

export function requireAuth() {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export async function auditLog(
  action: string,
  tableName: string,
  recordId?: number,
  description?: string,
  newValues?: any,
  companyIdOverride?: number,
) {
  try {
    const session = getSession();
    if (!session) return;
    const service = getAuditService();
    const companyId = companyIdOverride || activeCompanyId || null;
    await service.log({
      userId: session.id,
      companyId,
      action,
      tableName,
      recordId,
      description,
      newValues,
    });
  } catch {
    // Audit logging should never crash the main operation
  }
}
