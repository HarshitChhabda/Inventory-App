import { PrismaClient } from '@prisma/client';

export interface ConfigEntry {
  key: string;
  value: string;
  category: string;
  description?: string;
  dataType: string;
}

const DEFAULT_CONFIGS: ConfigEntry[] = [
  // Stock Rules
  { key: 'STOCK.ALLOW_NEGATIVE', value: 'false', category: 'STOCK', description: 'Allow negative stock balance', dataType: 'boolean' },
  { key: 'STOCK.ALLOW_BACKDATED', value: 'true', category: 'STOCK', description: 'Allow backdated transactions', dataType: 'boolean' },
  { key: 'STOCK.REQUIRE_CONDITION', value: 'true', category: 'STOCK', description: 'Require condition field on stock entries', dataType: 'boolean' },
  { key: 'STOCK.DEFAULT_CONDITION', value: 'GOOD', category: 'STOCK', description: 'Default condition for new stock', dataType: 'string' },
  { key: 'STOCK.STOCKTAKE_ENABLED', value: 'false', category: 'STOCK', description: 'Enable stocktaking/reconciliation', dataType: 'boolean' },

  // Transfer Rules
  { key: 'TRANSFER.REQUIRE_APPROVAL', value: 'false', category: 'TRANSFER', description: 'Require approval for transfers', dataType: 'boolean' },
  { key: 'TRANSFER.ALLOW_CROSS_COMPANY', value: 'false', category: 'TRANSFER', description: 'Allow transfers between companies', dataType: 'boolean' },
  { key: 'TRANSFER.IN_TRANSIT_ENABLED', value: 'false', category: 'TRANSFER', description: 'Enable in-transit status for transfers', dataType: 'boolean' },

  // Issue Rules
  { key: 'ISSUE.REQUIRE_APPROVAL', value: 'false', category: 'TRANSFER', description: 'Require approval for issues', dataType: 'boolean' },
  { key: 'ISSUE.MAX_QUANTITY_PER_DAY', value: '0', category: 'TRANSFER', description: 'Max items issuable per day (0=unlimited)', dataType: 'number' },

  // Serial Number Rules
  { key: 'SERIAL.TRACK_SERIAL_NUMBERS', value: 'true', category: 'SERIAL', description: 'Enable serial number tracking', dataType: 'boolean' },
  { key: 'SERIAL.REQUIRE_SERIAL_ON_RECEIPT', value: 'false', category: 'SERIAL', description: 'Require serial number on receipt for serialized items', dataType: 'boolean' },

  // Approval Rules
  { key: 'APPROVAL.RECEIPT_APPROVAL', value: 'false', category: 'APPROVAL', description: 'Require approval for receipt challans', dataType: 'boolean' },
  { key: 'APPROVAL.ISSUE_APPROVAL', value: 'false', category: 'APPROVAL', description: 'Require approval for issue challans', dataType: 'boolean' },
  { key: 'APPROVAL.TRANSFER_APPROVAL', value: 'false', category: 'APPROVAL', description: 'Require approval for transfer challans', dataType: 'APPROVAL' },

  // Report Rules
  { key: 'REPORT.LOW_STOCK_THRESHOLD', value: '10', category: 'REPORT', description: 'Default low stock alert threshold', dataType: 'number' },
  { key: 'REPORT.DEAD_STOCK_DAYS', value: '90', category: 'REPORT', description: 'Days without movement to consider dead stock', dataType: 'number' },

  // General
  { key: 'GENERAL.COMPANY_NAME', value: '', category: 'GENERAL', description: 'Company name', dataType: 'string' },
  { key: 'GENERAL.FY_LOCK_ENABLED', value: 'false', category: 'GENERAL', description: 'Lock closed financial years', dataType: 'boolean' },
  { key: 'GENERAL.AUTO_BACKUP_ENABLED', value: 'false', category: 'GENERAL', description: 'Enable automatic backups', dataType: 'boolean' },
  { key: 'GENERAL.AUTO_BACKUP_INTERVAL', value: 'daily', category: 'GENERAL', description: 'Auto backup interval (daily/weekly/monthly)', dataType: 'string' },
];

export class SystemConfigurationService {
  constructor(private prisma: PrismaClient) {}

  async get(companyId: number, key: string): Promise<string | null> {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { companyId_key: { companyId, key } },
    });
    return config?.value ?? null;
  }

  async getBool(companyId: number, key: string): Promise<boolean> {
    const val = await this.get(companyId, key);
    if (val === null) return false;
    return val.toLowerCase() === 'true';
  }

  async getNumber(companyId: number, key: string): Promise<number> {
    const val = await this.get(companyId, key);
    if (val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }

  async set(companyId: number, key: string, value: string, category?: string, description?: string): Promise<void> {
    const existing = await this.prisma.systemConfiguration.findUnique({
      where: { companyId_key: { companyId, key } },
    });

    if (existing) {
      await this.prisma.systemConfiguration.update({
        where: { id: existing.id },
        data: { value, ...(category ? { category } : {}), ...(description ? { description } : {}) },
      });
    } else {
      await this.prisma.systemConfiguration.create({
        data: {
          companyId,
          key,
          value,
          category: category || 'GENERAL',
          description,
          dataType: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
        },
      });
    }
  }

  async getAll(companyId: number, category?: string): Promise<ConfigEntry[]> {
    const where = category ? { companyId, category } : { companyId };
    const configs = await this.prisma.systemConfiguration.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    return configs.map((c) => ({
      key: c.key,
      value: c.value,
      category: c.category,
      description: c.description || undefined,
      dataType: c.dataType,
    }));
  }

  async delete(companyId: number, key: string): Promise<void> {
    await this.prisma.systemConfiguration.deleteMany({
      where: { companyId, key },
    });
  }

  async initializeDefaults(companyId: number): Promise<void> {
    for (const config of DEFAULT_CONFIGS) {
      const existing = await this.prisma.systemConfiguration.findUnique({
        where: { companyId_key: { companyId, key: config.key } },
      });
      if (!existing) {
        await this.prisma.systemConfiguration.create({
          data: {
            companyId,
            key: config.key,
            value: config.value,
            category: config.category,
            description: config.description,
            dataType: config.dataType,
          },
        });
      }
    }
  }
}
