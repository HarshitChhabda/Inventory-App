import { PrismaClient } from '@prisma/client';

// ============================================================
// MOVEMENT TYPE REGISTRY
// ============================================================
// Every inventory operation is a "movement" with source → destination.
// New movement types can be added via database without code changes.

export type SourceType =
  | 'MAIN_STORE'
  | 'WAREHOUSE'
  | 'DEPARTMENT_STORE'
  | 'DHARMSHALA_STORE'
  | 'DEPARTMENT_LOCATION'
  | 'ROOM'
  | 'VENDOR'
  | 'REPAIR_CENTER'
  | 'SCRAP_YARD'
  | 'TRANSIT'
  | 'EXTERNAL';

export type DestinationType =
  | 'MAIN_STORE'
  | 'WAREHOUSE'
  | 'DEPARTMENT_STORE'
  | 'DHARMSHALA_STORE'
  | 'DEPARTMENT_LOCATION'
  | 'ROOM'
  | 'VENDOR'
  | 'REPAIR_CENTER'
  | 'SCRAP'
  | 'TRANSIT'
  | 'EXTERNAL';

export type MovementDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL' | 'INTERNAL';

export interface MovementTypeConfig {
  code: string;
  name: string;
  voucherPrefix: string;
  direction: MovementDirection;
  validSourceTypes: SourceType[];
  validDestinationTypes: DestinationType[];
  stockEffect: {
    source: 'DECREASE' | 'NONE' | 'CONDITIONAL';
    destination: 'INCREASE' | 'NONE' | 'CONDITIONAL';
  };
  requiresApproval: boolean;
  requiresSerialNumber: boolean;
  allowBackdated: boolean;
  allowPartial: boolean;
  autoGenerateVoucher: boolean;
  isActive: boolean;
  category: string;
  description: string;
}

// ============================================================
// BUILT-IN MOVEMENT TYPES
// ============================================================
// These are the default movement types. More can be added via DB.

export const BUILT_IN_MOVEMENT_TYPES: MovementTypeConfig[] = [
  // ─── RECEIPT ───────────────────────────────────
  {
    code: 'RC',
    name: 'Purchase Receipt',
    voucherPrefix: 'RC',
    direction: 'INBOUND',
    validSourceTypes: ['VENDOR', 'EXTERNAL'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'WAREHOUSE'],
    stockEffect: { source: 'NONE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'RECEIPT',
    description: 'Material received from vendor/supplier',
  },
  {
    code: 'OB',
    name: 'Opening Balance',
    voucherPrefix: 'OB',
    direction: 'INBOUND',
    validSourceTypes: ['EXTERNAL'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    stockEffect: { source: 'NONE', destination: 'INCREASE' },
    requiresApproval: true,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: false,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'RECEIPT',
    description: 'Opening balance at start of financial year',
  },

  // ─── ISSUE ─────────────────────────────────────
  {
    code: 'IC',
    name: 'Issue to Department',
    voucherPrefix: 'IC',
    direction: 'OUTBOUND',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    validDestinationTypes: ['DEPARTMENT_LOCATION', 'ROOM'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'ISSUE',
    description: 'Issue material from store to department/location',
  },

  // ─── TRANSFER ──────────────────────────────────
  {
    code: 'TC',
    name: 'Store Transfer',
    voucherPrefix: 'TR',
    direction: 'BIDIRECTIONAL',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'DHARMSHALA_STORE'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'DHARMSHALA_STORE'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'TRANSFER',
    description: 'Transfer stock between stores',
  },

  // ─── INSTALL ───────────────────────────────────
  {
    code: 'IS',
    name: 'Installation',
    voucherPrefix: 'IS',
    direction: 'OUTBOUND',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    validDestinationTypes: ['ROOM', 'DEPARTMENT_LOCATION'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'INSTALL',
    description: 'Install item in a room/location',
  },
  {
    code: 'UN',
    name: 'Uninstallation',
    voucherPrefix: 'UN',
    direction: 'INBOUND',
    validSourceTypes: ['ROOM', 'DEPARTMENT_LOCATION'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'INSTALL',
    description: 'Uninstall item from room/location back to store',
  },

  // ─── SHIFT ─────────────────────────────────────
  {
    code: 'SH',
    name: 'Room Shift',
    voucherPrefix: 'SH',
    direction: 'BIDIRECTIONAL',
    validSourceTypes: ['ROOM'],
    validDestinationTypes: ['ROOM'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'SHIFT',
    description: 'Shift installed asset between rooms',
  },
  {
    code: 'DS',
    name: 'Dharmshala Shift',
    voucherPrefix: 'DS',
    direction: 'BIDIRECTIONAL',
    validSourceTypes: ['DHARMSHALA_STORE', 'ROOM'],
    validDestinationTypes: ['DHARMSHALA_STORE', 'ROOM'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'SHIFT',
    description: 'Shift between dharmshala rooms',
  },
  {
    code: 'DP',
    name: 'Department Shift',
    voucherPrefix: 'DP',
    direction: 'BIDIRECTIONAL',
    validSourceTypes: ['DEPARTMENT_STORE', 'DEPARTMENT_LOCATION'],
    validDestinationTypes: ['DEPARTMENT_STORE', 'DEPARTMENT_LOCATION'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'SHIFT',
    description: 'Shift between departments',
  },

  // ─── DAMAGE ────────────────────────────────────
  {
    code: 'DM',
    name: 'Damage',
    voucherPrefix: 'DM',
    direction: 'OUTBOUND',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'ROOM', 'DEPARTMENT_LOCATION', 'TRANSIT', 'REPAIR_CENTER'],
    validDestinationTypes: ['SCRAP', 'EXTERNAL'],
    stockEffect: { source: 'DECREASE', destination: 'NONE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'DAMAGE',
    description: 'Record damaged item',
  },

  // ─── REPAIR ────────────────────────────────────
  {
    code: 'RO',
    name: 'Repair Out',
    voucherPrefix: 'RO',
    direction: 'OUTBOUND',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'ROOM'],
    validDestinationTypes: ['REPAIR_CENTER'],
    stockEffect: { source: 'DECREASE', destination: 'NONE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'REPAIR',
    description: 'Send item to repair center',
  },
  {
    code: 'RI',
    name: 'Repair In',
    voucherPrefix: 'RI',
    direction: 'INBOUND',
    validSourceTypes: ['REPAIR_CENTER'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    stockEffect: { source: 'NONE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'REPAIR',
    description: 'Receive repaired item back',
  },

  // ─── RETURN ────────────────────────────────────
  {
    code: 'VR',
    name: 'Vendor Return',
    voucherPrefix: 'VR',
    direction: 'OUTBOUND',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    validDestinationTypes: ['VENDOR', 'EXTERNAL'],
    stockEffect: { source: 'DECREASE', destination: 'NONE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'RETURN',
    description: 'Return material to vendor',
  },
  {
    code: 'DR',
    name: 'Department Return',
    voucherPrefix: 'DR',
    direction: 'INBOUND',
    validSourceTypes: ['DEPARTMENT_LOCATION', 'ROOM'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'RETURN',
    description: 'Return material from department to store',
  },

  // ─── REPLACEMENT ───────────────────────────────
  {
    code: 'RP',
    name: 'Replacement',
    voucherPrefix: 'RP',
    direction: 'BIDIRECTIONAL',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'ROOM'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'ROOM'],
    stockEffect: { source: 'DECREASE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'REPLACEMENT',
    description: 'Replace one item with another',
  },

  // ─── SCRAP ─────────────────────────────────────
  {
    code: 'SF',
    name: 'Scrap',
    voucherPrefix: 'SF',
    direction: 'OUTBOUND',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'ROOM', 'REPAIR_CENTER'],
    validDestinationTypes: ['SCRAP', 'EXTERNAL'],
    stockEffect: { source: 'DECREASE', destination: 'NONE' },
    requiresApproval: true,
    requiresSerialNumber: false,
    allowBackdated: true,
    allowPartial: true,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'SCRAP',
    description: 'Scrap item permanently',
  },

  // ─── ADJUSTMENT ────────────────────────────────
  {
    code: 'AD',
    name: 'Stock Adjustment',
    voucherPrefix: 'AD',
    direction: 'BIDIRECTIONAL',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'DHARMSHALA_STORE'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'DHARMSHALA_STORE'],
    stockEffect: { source: 'CONDITIONAL', destination: 'CONDITIONAL' },
    requiresApproval: true,
    requiresSerialNumber: false,
    allowBackdated: false,
    allowPartial: false,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'ADJUSTMENT',
    description: 'Physical count adjustment',
  },

  // ─── CARRY FORWARD ─────────────────────────────
  {
    code: 'CF',
    name: 'Carry Forward',
    voucherPrefix: 'CF',
    direction: 'INBOUND',
    validSourceTypes: ['EXTERNAL'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE'],
    stockEffect: { source: 'NONE', destination: 'INCREASE' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: false,
    allowPartial: false,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'FINANCIAL',
    description: 'Year-end carry forward balance',
  },

  // ─── REVERSAL ──────────────────────────────────
  {
    code: 'RV',
    name: 'Reversal',
    voucherPrefix: 'RV',
    direction: 'BIDIRECTIONAL',
    validSourceTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'DHARMSHALA_STORE', 'ROOM', 'DEPARTMENT_LOCATION'],
    validDestinationTypes: ['MAIN_STORE', 'DEPARTMENT_STORE', 'DHARMSHALA_STORE', 'ROOM', 'DEPARTMENT_LOCATION'],
    stockEffect: { source: 'CONDITIONAL', destination: 'CONDITIONAL' },
    requiresApproval: false,
    requiresSerialNumber: false,
    allowBackdated: false,
    allowPartial: false,
    autoGenerateVoucher: true,
    isActive: true,
    category: 'REVERSAL',
    description: 'Reverse a previous transaction',
  },
];

/**
 * MOVEMENT TYPE REGISTRY
 *
 * Manages all movement types. Supports:
 * - Built-in types (hardcoded)
 * - Custom types (stored in database)
 * - Runtime configuration
 *
 * New movement types can be added without code changes.
 */
export class MovementRegistry {
  private customTypes: MovementTypeConfig[] = [];
  private loaded = false;

  constructor(private prisma: PrismaClient) {}

  /**
   * Load custom movement types from database.
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    // Future: load from SystemConfiguration or a dedicated MovementType table
    this.loaded = true;
  }

  /**
   * Get all active movement types (built-in + custom).
   */
  async getAll(): Promise<MovementTypeConfig[]> {
    await this.load();
    return [...BUILT_IN_MOVEMENT_TYPES, ...this.customTypes].filter((m) => m.isActive);
  }

  /**
   * Get a movement type by code.
   */
  async getByCode(code: string): Promise<MovementTypeConfig | undefined> {
    await this.load();
    const all = [...BUILT_IN_MOVEMENT_TYPES, ...this.customTypes];
    return all.find((m) => m.code === code);
  }

  /**
   * Get all movement types for a category.
   */
  async getByCategory(category: string): Promise<MovementTypeConfig[]> {
    const all = await this.getAll();
    return all.filter((m) => m.category === category);
  }

  /**
   * Get categories.
   */
  async getCategories(): Promise<string[]> {
    const all = await this.getAll();
    return [...new Set(all.map((m) => m.category))];
  }

  /**
   * Register a custom movement type.
   */
  async register(config: MovementTypeConfig): Promise<void> {
    const existing = await this.getByCode(config.code);
    if (existing) {
      throw new Error(`Movement type ${config.code} already exists`);
    }
    this.customTypes.push(config);
    // Future: persist to database
  }

  /**
   * Check if a source type is valid for a movement.
   */
  async isValidSource(code: string, sourceType: SourceType): Promise<boolean> {
    const movement = await this.getByCode(code);
    if (!movement) return false;
    return movement.validSourceTypes.includes(sourceType);
  }

  /**
   * Check if a destination type is valid for a movement.
   */
  async isValidDestination(code: string, destType: DestinationType): Promise<boolean> {
    const movement = await this.getByCode(code);
    if (!movement) return false;
    return movement.validDestinationTypes.includes(destType);
  }

  /**
   * Check if movement requires stock validation (outbound).
   */
  async isOutbound(code: string): Promise<boolean> {
    const movement = await this.getByCode(code);
    if (!movement) return false;
    return movement.stockEffect.source === 'DECREASE';
  }
}
