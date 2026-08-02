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
  isActive: z.boolean().default(true),
});

export const itemCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  prefix: z.string().min(1, 'Prefix is required'),
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
  name: z.string().min(1, 'Vendor name is required'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const locationSchema = z.object({
  locationType: z.enum(['Room', 'Dharamshala', 'Store', 'Department']),
  locationName: z.string().min(1, 'Location name is required'),
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
  password: z.string().min(6),
  fullName: z.string().min(1),
  role: z.enum(['Admin', 'StoreManager', 'Viewer']),
  isActive: z.boolean().default(true),
});
