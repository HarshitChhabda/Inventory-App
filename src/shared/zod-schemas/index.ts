import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  logoPath: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const financialYearSchema = z.object({
  companyId: z.number().int().positive(),
  label: z.string().min(1, 'Label is required'),
  startDate: z.date(),
  endDate: z.date(),
});

export const departmentSchema = z.object({
  companyId: z.number().int().positive(),
  name: z.string().min(1, 'Department name is required'),
  code: z.string().optional(),
  departmentType: z.enum(['Dharamshala', 'Store', 'Department']).default('Department'),
  isActive: z.boolean().default(true),
});

export const itemCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  prefix: z.string().min(1, 'Prefix is required'),
  storeId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const unitSchema = z.object({
  name: z.string().min(1, 'Unit name is required'),
  symbol: z.string().optional(),
});

export const itemSchema = z.object({
  itemCode: z.string().min(1, 'Item code is required'),
  itemName: z.string().min(1, 'Item name is required'),
  categoryId: z.number().int().positive(),
  unitId: z.number().int().positive(),
  minimumStockLevel: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const vendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const PHYSICAL_LOCATION_TYPES = ['Room', 'Office', 'Hall', 'Workshop', 'StoreArea'] as const;
export const MASTER_LOCATION_TYPES = ['Dharamshala', 'Store', 'Department'] as const;
export const ALL_LOCATION_TYPES = [...PHYSICAL_LOCATION_TYPES, ...MASTER_LOCATION_TYPES] as const;

export const locationSchema = z.object({
  storeId: z.number().int().positive('Store is required'),
  locationType: z.enum(['Room', 'Office', 'Hall', 'Workshop', 'StoreArea', 'Dharamshala', 'Store', 'Department']),
  name: z.string().min(1, 'Location name is required'),
  parentId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const physicalLocationSchema = z.object({
  storeId: z.number().int().positive('Store is required'),
  locationType: z.enum(['Room', 'Office', 'Hall', 'Workshop', 'StoreArea']),
  name: z.string().min(1, 'Location name is required'),
  parentId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const receiptChallanItemSchema = z.object({
  itemId: z.number().int().positive(),
  unitId: z.number().int().positive(),
  quantity: z.number().positive('Quantity must be positive'),
  rate: z.number().min(0).default(0),
  amount: z.number().min(0).default(0),
  remarks: z.string().optional(),
});

export const receiptChallanSchema = z.object({
  companyId: z.number().int().positive(),
  financialYearId: z.number().int().positive(),
  date: z.date(),
  sourceType: z.enum(['Vendor', 'JaipurOffice', 'OtherBranch', 'Donation', 'Transfer', 'DepartmentReturn']),
  vendorId: z.number().int().positive().nullable().optional(),
  sourceName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.date().nullable().optional(),
  vehicleNumber: z.string().optional(),
  receivedBy: z.string().min(1, 'Received by is required'),
  departmentId: z.number().int().positive().nullable().optional(),
  remarks: z.string().optional(),
  items: z.array(receiptChallanItemSchema).min(1, 'At least one item is required'),
});

export const issueChallanItemSchema = z.object({
  itemId: z.number().int().positive(),
  unitId: z.number().int().positive(),
  quantity: z.number().positive('Quantity must be positive'),
  locationId: z.number().int().positive().nullable().optional(),
  usedAt: z.string().optional(),
  purpose: z.string().optional(),
  remarks: z.string().optional(),
});

export const issueChallanSchema = z.object({
  companyId: z.number().int().positive(),
  financialYearId: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  date: z.date(),
  issuedBy: z.string().min(1, 'Issued by is required'),
  approvedBy: z.string().optional(),
  purpose: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(issueChallanItemSchema).min(1, 'At least one item is required'),
});

export const damageEntrySchema = z.object({
  companyId: z.number().int().positive().nullable().optional(),
  itemId: z.number().int().positive(),
  locationId: z.number().int().positive().nullable().optional(),
  assetInstallationId: z.number().int().positive().nullable().optional(),
  date: z.date(),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.enum(['Damaged', 'Lost', 'Broken', 'Scrap', 'Expired']),
  reportedBy: z.string().min(1, 'Reported by is required'),
  remarks: z.string().optional(),
});

export const openingStockSchema = z.object({
  financialYearId: z.number().int().positive(),
  itemId: z.number().int().positive(),
  quantity: z.number().min(0),
  rate: z.number().min(0).default(0),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const userSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(3),
  fullName: z.string().min(1),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'DEPARTMENT_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  companyId: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

export const passwordPolicySchema = z.object({
  minPasswordLength: z.number().int().min(6).max(128).default(8),
  requireUppercase: z.boolean().default(true),
  requireLowercase: z.boolean().default(true),
  requireNumbers: z.boolean().default(true),
  requireSpecialChars: z.boolean().default(false),
  maxAgeDays: z.number().int().min(0).max(365).default(90),
  maxFailedAttempts: z.number().int().min(1).max(100).default(5),
  lockoutDurationMinutes: z.number().int().min(1).max(1440).default(30),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).default(60),
  forceLogoutAllDevices: z.boolean().default(false),
  passwordHistoryCount: z.number().int().min(0).max(20).default(5),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const roleSchema = z.object({
  companyId: z.number().int().positive(),
  name: z.string().min(1, 'Role name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  permissionIds: z.array(z.number()).optional(),
  permissions: z.array(z.string()).default([]),
});

export const transferChallanSchema = z.object({
  companyId: z.number().int().positive(),
  financialYearId: z.number().int().positive(),
  date: z.date(),
  fromStoreId: z.number().int().positive(),
  toStoreId: z.number().int().positive(),
  transferredBy: z.string().min(1),
  remarks: z.string().optional(),
  items: z.array(z.object({
    itemId: z.number().int().positive(),
    quantity: z.number().positive(),
  })).min(1, 'At least one item is required'),
});

export const stockAdjustmentSchema = z.object({
  companyId: z.number().int().positive(),
  financialYearId: z.number().int().positive(),
  itemId: z.number().int().positive(),
  adjustmentType: z.enum(['Addition', 'Subtraction', 'Correction']),
  quantity: z.number().positive(),
  reason: z.string().min(1, 'Reason is required'),
  adjustedBy: z.string().min(1),
  date: z.date(),
  remarks: z.string().optional(),
});

export const damageEntryFormSchema = z.object({
  companyId: z.number().int().positive().nullable().optional(),
  itemId: z.number().int().positive(),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.enum(['Damaged', 'Lost', 'Broken', 'Scrap', 'Expired']),
  reportedBy: z.string().min(1, 'Reported by is required'),
  financialYearId: z.number().int().positive().nullable().optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  storeId: z.number().int().positive().nullable().optional(),
  date: z.date(),
  remarks: z.string().optional(),
});
