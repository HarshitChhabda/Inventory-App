import { ipcMain } from 'electron';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { getSession, PERMISSION_KEYS, hasPermission } from '../../src/main/services/auth.service';
import { serialize, requireAuth, auditLog } from './helpers';
import { validate } from './validate';
import {
  departmentSchema,
  itemCategorySchema,
  unitSchema,
  itemSchema,
  vendorSchema,
  locationSchema,
} from '../../src/shared/zod-schemas';

function requireMastersPermission() {
  const user = requireAuth();
  if (!hasPermission(user, PERMISSION_KEYS.MANAGE_MASTERS)) {
    throw new Error('Permission denied: manage_masters');
  }
  return user;
}

function requireMastersOrStoreManager() {
  const user = requireAuth();
  const isStoreManager = user.role === 'STORE_MANAGER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  if (!hasPermission(user, PERMISSION_KEYS.MANAGE_MASTERS) && !isStoreManager) {
    throw new Error('Permission denied: manage_masters or store_manager role required');
  }
  return user;
}

async function getAncestors(locationId: number): Promise<number[]> {
  const prisma = getPrismaClient();
  const ids: number[] = [];
  let current = await prisma.location.findUnique({ where: { id: locationId } });
  while (current?.parentId) {
    ids.push(current.parentId);
    current = await prisma.location.findUnique({ where: { id: current.parentId } });
  }
  return ids;
}

export function registerMasterDataIpc() {
  const prisma = getPrismaClient();

  // ─── Item Categories ────────────────────────────────────────────
  ipcMain.handle('masterData:createCategory', async (_event, data: any) => {
    requireMastersPermission();
    const validated = validate(itemCategorySchema, data);

    // Validate store exists if storeId is provided
    if (validated.storeId) {
      const store = await prisma.store.findUnique({ where: { id: validated.storeId } });
      if (!store) throw new Error('Store not found');
    }

    // Check duplicate within store scope
    const existing = await prisma.itemCategory.findFirst({
      where: { name: validated.name, storeId: validated.storeId || null },
    });
    if (existing) {
      const scope = validated.storeId ? `in this store` : `globally`;
      throw new Error(`Category "${validated.name}" already exists ${scope}`);
    }

    const result = await prisma.itemCategory.create({ data: validated });
    await auditLog('CREATE', 'ItemCategory', result.id, `Created category: ${result.name}${validated.storeId ? ' (store-specific)' : ' (global)'}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:updateCategory', async (_event, id: number, data: any) => {
    requireMastersPermission();
    const validated = validate(itemCategorySchema.partial(), data);

    // Validate store exists if storeId is being changed
    if (validated.storeId !== undefined) {
      if (validated.storeId !== null) {
        const store = await prisma.store.findUnique({ where: { id: validated.storeId } });
        if (!store) throw new Error('Store not found');
      }
    }

    // Check duplicate if name or storeId is changing
    if (validated.name || validated.storeId !== undefined) {
      const current = await prisma.itemCategory.findUnique({ where: { id } });
      if (!current) throw new Error('Category not found');
      const checkName = validated.name || current.name;
      const checkStoreId = validated.storeId !== undefined ? validated.storeId : current.storeId;
      const duplicate = await prisma.itemCategory.findFirst({
        where: { name: checkName, storeId: checkStoreId, id: { not: id } },
      });
      if (duplicate) {
        const scope = checkStoreId ? `in this store` : `globally`;
        throw new Error(`Category "${checkName}" already exists ${scope}`);
      }
    }

    const result = await prisma.itemCategory.update({ where: { id }, data: validated });
    await auditLog('UPDATE', 'ItemCategory', result.id, `Updated category: ${result.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:deleteCategory', async (_event, id: number) => {
    requireMastersPermission();

    // Check if any items reference this category
    const itemCount = await prisma.item.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      throw new Error(`Cannot delete: ${itemCount} item(s) use this category. Reassign or remove them first.`);
    }

    const result = await prisma.itemCategory.delete({ where: { id } });
    await auditLog('DELETE', 'ItemCategory', id, `Deleted category: ${result.name}`);
    return serialize(result);
  });

  // ─── Units ──────────────────────────────────────────────────────
  ipcMain.handle('masterData:createUnit', async (_event, data: any) => {
    requireMastersPermission();
    const validated = validate(unitSchema, data);
    const result = await prisma.unit.create({ data: validated });
    await auditLog('CREATE', 'Unit', result.id, `Created unit: ${result.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:updateUnit', async (_event, id: number, data: any) => {
    requireMastersPermission();
    const validated = validate(unitSchema.partial(), data);
    const result = await prisma.unit.update({ where: { id }, data: validated });
    await auditLog('UPDATE', 'Unit', result.id, `Updated unit: ${result.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:deleteUnit', async (_event, id: number) => {
    requireMastersPermission();
    const itemCount = await prisma.item.count({ where: { unitId: id } });
    if (itemCount > 0) {
      throw new Error(`Cannot delete: ${itemCount} item(s) use this unit.`);
    }
    const result = await prisma.unit.delete({ where: { id } });
    await auditLog('DELETE', 'Unit', id, `Deleted unit: ${result.name}`);
    return serialize(result);
  });

  // ─── Items ──────────────────────────────────────────────────────
  ipcMain.handle('masterData:createItem', async (_event, data: any) => {
    requireMastersPermission();
    const validated = validate(itemSchema, data);
    const result = await prisma.item.create({ data: validated });
    await auditLog('CREATE', 'Item', result.id, `Created item: ${result.itemName || result.id}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:updateItem', async (_event, id: number, data: any) => {
    requireMastersPermission();
    const validated = validate(itemSchema.partial(), data);
    const result = await prisma.item.update({ where: { id }, data: validated });
    await auditLog('UPDATE', 'Item', result.id, `Updated item: ${result.itemName || result.id}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:deleteItem', async (_event, id: number) => {
    requireMastersPermission();
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) throw new Error('Item not found');

    await prisma.$transaction(async (tx) => {
      // Delete all child models with required itemId FK (no cascade)
      await tx.workCompletionItem.deleteMany({ where: { itemId: id } });
      await tx.materialDemandItem.deleteMany({ where: { itemId: id } });
      await tx.workOrderSparePart.deleteMany({ where: { itemId: id } });
      await tx.qualityCheck.deleteMany({ where: { itemId: id } });
      await tx.goodsReceiptDetail.deleteMany({ where: { itemId: id } });
      await tx.purchaseOrderDetail.deleteMany({ where: { itemId: id } });
      await tx.requisitionDetail.deleteMany({ where: { itemId: id } });
      await tx.quotationItem.deleteMany({ where: { itemId: id } });
      await tx.itemVendorMapping.deleteMany({ where: { itemId: id } });
      await tx.purchaseHistory.deleteMany({ where: { itemId: id } });
      await tx.priceHistory.deleteMany({ where: { itemId: id } });
      await tx.transactionDetail.deleteMany({ where: { itemId: id } });
      await tx.ledgerEntry.deleteMany({ where: { itemId: id } });
      await tx.serializedItem.deleteMany({ where: { itemId: id } });
      await tx.warrantyRecord.deleteMany({ where: { itemId: id } });
      await tx.aMCRecord.deleteMany({ where: { itemId: id } });
      await tx.assetInstallation.deleteMany({ where: { itemId: id } });

      // AssetProfile and its children
      const assetProfiles = await tx.assetProfile.findMany({ where: { itemId: id }, select: { id: true } });
      const assetProfileIds = assetProfiles.map((a) => a.id);
      if (assetProfileIds.length > 0) {
        await tx.assetTimeline.deleteMany({ where: { assetId: { in: assetProfileIds } } });
        await tx.assetPhoto.deleteMany({ where: { assetId: { in: assetProfileIds } } });
        await tx.assetDocument.deleteMany({ where: { assetId: { in: assetProfileIds } } });
        await tx.assetServiceHistory.deleteMany({ where: { assetId: { in: assetProfileIds } } });
        await tx.assetMovement.deleteMany({ where: { assetId: { in: assetProfileIds } } });
        await tx.assetProfile.deleteMany({ where: { itemId: id } });
      }

      await tx.item.delete({ where: { id } });
    });

    await auditLog('DELETE', 'Item', id, `Deleted item: ${item.name}`);
    return serialize(item);
  });

  // ─── Vendors ────────────────────────────────────────────────────
  ipcMain.handle('masterData:createVendor', async (_event, data: any) => {
    requireMastersPermission();
    const validated = validate(vendorSchema, data);
    const result = await prisma.vendor.create({ data: validated });
    await auditLog('CREATE', 'Vendor', result.id, `Created vendor: ${result.vendorName}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:updateVendor', async (_event, id: number, data: any) => {
    requireMastersPermission();
    const validated = validate(vendorSchema.partial(), data);
    const result = await prisma.vendor.update({ where: { id }, data: validated });
    await auditLog('UPDATE', 'Vendor', result.id, `Updated vendor: ${result.vendorName}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:deleteVendor', async (_event, id: number) => {
    requireMastersPermission();
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new Error('Vendor not found');

    await prisma.$transaction(async (tx) => {
      // Delete child models with required vendorId FK (no cascade)
      // VendorDocument has onDelete: Cascade, so it auto-deletes
      await tx.itemVendorMapping.deleteMany({ where: { vendorId: id } });
      await tx.quotation.deleteMany({ where: { vendorId: id } });
      await tx.purchaseHistory.deleteMany({ where: { vendorId: id } });
      await tx.priceHistory.deleteMany({ where: { vendorId: id } });
      await tx.aMCAgreement.deleteMany({ where: { vendorId: id } });
      // PurchaseOrder and GoodsReceipt may also reference this vendor
      await tx.purchaseOrder.deleteMany({ where: { vendorId: id } });
      await tx.goodsReceipt.deleteMany({ where: { vendorId: id } });

      await tx.vendor.delete({ where: { id } });
    });

    await auditLog('DELETE', 'Vendor', id, `Deleted vendor: ${vendor.vendorName}`);
    return serialize(vendor);
  });

  // ─── Departments ────────────────────────────────────────────────
  ipcMain.handle('masterData:createDepartment', async (_event, data: any) => {
    requireMastersOrStoreManager();
    const validated = validate(departmentSchema, data);

    const storeTypeMap: Record<string, string> = {
      Store: 'MAIN_STORE',
      Dharamshala: 'DHARMSHALA_STORE',
      Department: 'DEPARTMENT_STORE',
    };

    // Check for duplicate Store before entering transaction
    const existingStore = await prisma.store.findFirst({
      where: { companyId: validated.companyId, name: validated.name },
    });

    // Fully atomic: Department + Store + Location in ONE transaction
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Create Department
      const dept = await tx.department.create({ data: validated });

      // Step 2: Create linked Store (all types get their own Store)
      if (!existingStore) {
        const storeType = storeTypeMap[validated.departmentType] || 'DEPARTMENT_STORE';
        const newStore = await tx.store.create({
          data: {
            companyId: validated.companyId,
            departmentId: dept.id,
            name: validated.name,
            code: validated.code || null,
            storeType,
          },
        });

        // Step 3: Auto-create Location under the newly created Store
        await tx.location.create({
          data: {
            storeId: newStore.id,
            name: validated.name,
            locationType: validated.departmentType,
            parentId: null,
          },
        });
      }

      return dept;
    });

    await auditLog('CREATE', 'Department', result.id, `Created department: ${validated.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:updateDepartment', async (_event, id: number, data: any) => {
    requireMastersPermission();
    const validated = validate(departmentSchema.partial(), data);

    // Read old values BEFORE update for Location/Store sync
    const oldDept = await prisma.department.findUnique({ where: { id } });
    if (!oldDept) throw new Error('Department not found');

    const dept = await prisma.department.update({ where: { id }, data: validated });

    const newName = validated.name || oldDept.name;
    const newType = validated.departmentType || oldDept.departmentType;

    // Sync linked Store and its auto-created Location if name or type changed
    if (validated.name || validated.departmentType) {
      // Find the auto-created Store linked to this Department
      const linkedStore = await prisma.store.findFirst({
        where: { departmentId: id, companyId: dept.companyId },
      });

      if (linkedStore) {
        // Sync Store name if changed
        if (validated.name && oldDept.name !== newName) {
          await prisma.store.update({
            where: { id: linkedStore.id },
            data: { name: newName },
          });
        }

        // Sync the auto-created Location under this Store
        // Find by storeId + name + type to only match auto-created Location
        if (newType === 'Dharamshala' || newType === 'Store' || newType === 'Department') {
          const existingLoc = await prisma.location.findFirst({
            where: {
              storeId: linkedStore.id,
              name: oldDept.name,
              locationType: oldDept.departmentType,
            },
          });
          if (existingLoc) {
            await prisma.location.update({
              where: { id: existingLoc.id },
              data: { name: newName, locationType: newType },
            });
          } else {
            // Auto-create Location if it doesn't exist
            await prisma.location.create({
              data: { storeId: linkedStore.id, name: newName, locationType: newType, parentId: null },
            });
          }
        }
      }
    }

    await auditLog('UPDATE', 'Department', dept.id, `Updated department: ${dept.name}`, dept);
    return serialize(dept);
  });

  ipcMain.handle('masterData:deleteDepartment', async (_event, id: number) => {
    requireMastersPermission();

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return serialize({ success: true, message: 'Department already deleted' });

    const txCount = await prisma.transactionHeader.count({ where: { departmentId: id } });
    if (txCount > 0) {
      throw new Error('Cannot delete department: it is used in transactions. Deactivate instead.');
    }

    const store = await prisma.store.findFirst({
      where: { departmentId: id, companyId: existing.companyId },
    });

    await prisma.$transaction(async (tx) => {
      if (store) {
        await tx.location.deleteMany({ where: { storeId: store.id } });
        await tx.store.delete({ where: { id: store.id } });
      }
      await tx.department.delete({ where: { id } });
    });

    await auditLog('DELETE', 'Department', id, `Deleted department: ${existing.name}`);
    return serialize({ success: true });
  });

  ipcMain.handle('masterData:toggleDepartment', async (_event, id: number) => {
    requireMastersPermission();
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) throw new Error('Department not found');
    const newActiveState = !dept.isActive;
    const result = await prisma.department.update({ where: { id }, data: { isActive: newActiveState } });

    // Propagate isActive to linked Store and Location
    const linkedStore = await prisma.store.findFirst({
      where: { departmentId: id, companyId: dept.companyId },
    });
    if (linkedStore) {
      await prisma.store.update({ where: { id: linkedStore.id }, data: { isActive: newActiveState } });
      // Propagate to locations under this store
      await prisma.location.updateMany({ where: { storeId: linkedStore.id }, data: { isActive: newActiveState } });
    }

    await auditLog('UPDATE', 'Department', id, `${dept.isActive ? 'Disabled' : 'Enabled'} department: ${dept.name}`, result);
    return serialize(result);
  });

  // ─── Dharmshalas ────────────────────────────────────────────────
  ipcMain.handle('masterData:createDharmshala', async (_event, data: any) => {
    requireMastersOrStoreManager();
    const { name, code, address, contactPerson, contactPhone, companyId } = data;
    if (!name) throw new Error('Dharmshala name is required');
    if (!companyId) throw new Error('Company ID is required');

    const existing = await prisma.dharmshala.findFirst({ where: { companyId, name } });
    if (existing) throw new Error(`Dharmshala "${name}" already exists`);

    const result = await prisma.dharmshala.create({
      data: { name, code: code || null, address: address || null, contactPerson: contactPerson || null, contactPhone: contactPhone || null, companyId },
    });
    await auditLog('CREATE', 'Dharmshala', result.id, `Created dharmshala: ${name}`);
    return serialize(result);
  });

  ipcMain.handle('masterData:listDharmshalas', async (_event, companyId: number) => {
    requireMastersPermission();
    const result = await prisma.dharmshala.findMany({ where: { companyId, isActive: true }, orderBy: { name: 'asc' } });
    return serialize(result);
  });

  // ─── Locations ──────────────────────────────────────────────────
  ipcMain.handle('masterData:createLocation', async (_event, data: any) => {
    requireMastersOrStoreManager();

    // Validate storeId belongs to a valid store
    if (!data.storeId) {
      throw new Error('Store is required for physical locations');
    }
    const store = await prisma.store.findUnique({ where: { id: data.storeId } });
    if (!store) throw new Error('Store not found');

    // Hierarchy: Dharamshala/Store/Department (parentId=null) → Room (parentId=Dharamshala/Store/Department)
    if (data.locationType === 'Dharamshala' || data.locationType === 'Store' || data.locationType === 'Department') {
      if (data.parentId) {
        throw new Error(`${data.locationType} cannot have a parent — it must be at root level`);
      }
    }

    if (data.locationType === 'Room') {
      if (!data.parentId) {
        throw new Error('Room must have a parent Dharamshala, Store, or Department');
      }
      const parent = await prisma.location.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new Error('Parent location not found');
      if (parent.locationType !== 'Dharamshala' && parent.locationType !== 'Store' && parent.locationType !== 'Department') {
        throw new Error('Room can only be created under a Dharamshala, Store, or Department — not under another Room');
      }
    }

    // Prevent circular: check that new parent is not a descendant of this location
    if (data.parentId) {
      const ancestors = await getAncestors(data.parentId);
      if (ancestors.includes(data.id)) {
        throw new Error('Circular reference detected: parent is a descendant of this location');
      }
    }

    const validated = validate(locationSchema, data);
    const result = await prisma.location.create({ data: validated });
    await auditLog('CREATE', 'Location', result.id, `Created location: ${result.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:updateLocation', async (_event, id: number, data: any) => {
    requireMastersPermission();
    const validated = validate(locationSchema.partial(), data);

    // Prevent self-parenting
    if (validated.parentId === id) throw new Error('Location cannot be its own parent');

    // Dharamshala/Store/Department cannot have a parent
    if ((validated.locationType === 'Dharamshala' || validated.locationType === 'Store' || validated.locationType === 'Department') && validated.parentId) {
      throw new Error(`${validated.locationType} cannot have a parent — it must be at root level`);
    }

    // Room must have Dharamshala, Store, or Department parent
    if (validated.locationType === 'Room') {
      if (!validated.parentId) {
        throw new Error('Room must have a parent Dharamshala, Store, or Department');
      }
      const parent = await prisma.location.findUnique({ where: { id: validated.parentId } });
      if (!parent) throw new Error('Parent location not found');
      if (parent.locationType !== 'Dharamshala' && parent.locationType !== 'Store' && parent.locationType !== 'Department') {
        throw new Error('Room can only be under a Dharamshala, Store, or Department — not under another Room');
      }
    }

    // Prevent circular references
    if (validated.parentId) {
      const ancestors = await getAncestors(validated.parentId);
      if (ancestors.includes(id)) {
        throw new Error('Circular reference detected: parent is a descendant of this location');
      }
    }

    const result = await prisma.location.update({ where: { id }, data: validated });
    await auditLog('UPDATE', 'Location', result.id, `Updated location: ${result.name}`, result);
    return serialize(result);
  });

  ipcMain.handle('masterData:deleteLocation', async (_event, id: number) => {
    requireMastersPermission();

    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) return serialize({ success: true, message: 'Location already deleted' });

    const blockers: string[] = [];

    // 1. Child locations
    const childCount = await prisma.location.count({ where: { parentId: id } });
    if (childCount > 0) blockers.push(`${childCount} child location(s)`);

    // 2. Ledger entries
    const ledgerCount = await prisma.ledgerEntry.count({ where: { locationId: id } });
    if (ledgerCount > 0) blockers.push(`${ledgerCount} ledger entries`);

    // 3. Transaction headers (source or destination)
    const txCount = await prisma.transactionHeader.count({
      where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
    });
    if (txCount > 0) blockers.push(`${txCount} transaction(s)`);

    // 4. Transaction details (no Prisma @relation — raw field query)
    const txDetailCount = await (prisma as any).transactionDetail.count({
      where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
    });
    if (txDetailCount > 0) blockers.push(`${txDetailCount} transaction detail(s)`);

    // 5. Rooms
    const roomCount = await prisma.room.count({ where: { locationId: id } });
    if (roomCount > 0) blockers.push(`${roomCount} room(s)`);

    // 6. Asset profiles
    const assetCount = await prisma.assetProfile.count({ where: { currentLocationId: id } });
    if (assetCount > 0) blockers.push(`${assetCount} asset(s)`);

    if (blockers.length > 0) {
      throw new Error(`Cannot delete location: has existing records (${blockers.join(', ')}). Deactivate instead.`);
    }

    const deletedLoc = await prisma.location.delete({ where: { id } });
    await auditLog('DELETE', 'Location', id, `Deleted location: ${existing.name}`);
    return serialize(deletedLoc);
  });

  // ─── Bulk Operations (for CSV import) ──────────────────────────
  const ALLOWED_BULK_MODELS = ['unit', 'itemCategory', 'item', 'vendor', 'department', 'location'];

  ipcMain.handle('masterData:bulkCreate', async (_event, model: string, rows: any[]) => {
    requireMastersPermission();
    if (!ALLOWED_BULK_MODELS.includes(model)) throw new Error(`Model "${model}" is not allowed for bulk operations`);
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Model ${model} not found`);
    const result = await delegate.createMany({ data: rows, skipDuplicates: true });
    await auditLog('IMPORT', model, undefined, `Bulk created ${result.count} ${model} records`);
    return serialize(result);
  });

  ipcMain.handle('masterData:bulkUpdate', async (_event, model: string, idField: string, rows: any[]) => {
    requireMastersPermission();
    if (!ALLOWED_BULK_MODELS.includes(model)) throw new Error(`Model "${model}" is not allowed for bulk operations`);
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Model ${model} not found`);
    const results = await Promise.all(
      rows.map((row) => {
        const id = row[idField];
        const { [idField]: _, ...data } = row;
        return delegate.update({ where: { id }, data });
      })
    );
    await auditLog('UPDATE', model, undefined, `Bulk updated ${results.length} ${model} records`);
    return serialize(results);
  });

  ipcMain.handle('masterData:bulkUpsert', async (_event, model: string, idField: string, rows: any[]) => {
    requireMastersPermission();
    if (!ALLOWED_BULK_MODELS.includes(model)) throw new Error(`Model "${model}" is not allowed for bulk operations`);
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Model ${model} not found`);
    const results = await Promise.all(
      rows.map((row) => {
        const id = row[idField];
        const { [idField]: _, ...data } = row;
        return delegate.upsert({
          where: { [idField]: id },
          create: row,
          update: data,
        });
      })
    );
    await auditLog('IMPORT', model, undefined, `Bulk upserted ${results.length} ${model} records`);
    return serialize(results);
  });
}
