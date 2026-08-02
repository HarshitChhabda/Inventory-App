import { ipcMain } from 'electron';
import { getPrismaClient } from '../../src/main/database/prisma.client';
import { getSession, PERMISSION_KEYS, hasPermission } from '../../src/main/services/auth.service';
import { serialize, requireAuth } from './helpers';

function requireMastersPermission() {
  const user = requireAuth();
  if (!hasPermission(user, PERMISSION_KEYS.MANAGE_MASTERS)) {
    throw new Error('Permission denied: manage_masters');
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
    return serialize(await prisma.itemCategory.create({ data }));
  });

  ipcMain.handle('masterData:updateCategory', async (_event, id: number, data: any) => {
    requireMastersPermission();
    return serialize(await prisma.itemCategory.update({ where: { id }, data }));
  });

  ipcMain.handle('masterData:deleteCategory', async (_event, id: number) => {
    requireMastersPermission();
    return serialize(await prisma.itemCategory.delete({ where: { id } }));
  });

  // ─── Units ──────────────────────────────────────────────────────
  ipcMain.handle('masterData:createUnit', async (_event, data: any) => {
    requireMastersPermission();
    return serialize(await prisma.unit.create({ data }));
  });

  ipcMain.handle('masterData:updateUnit', async (_event, id: number, data: any) => {
    requireMastersPermission();
    return serialize(await prisma.unit.update({ where: { id }, data }));
  });

  ipcMain.handle('masterData:deleteUnit', async (_event, id: number) => {
    requireMastersPermission();
    return serialize(await prisma.unit.delete({ where: { id } }));
  });

  // ─── Items ──────────────────────────────────────────────────────
  ipcMain.handle('masterData:createItem', async (_event, data: any) => {
    requireMastersPermission();
    return serialize(await prisma.item.create({ data }));
  });

  ipcMain.handle('masterData:updateItem', async (_event, id: number, data: any) => {
    requireMastersPermission();
    return serialize(await prisma.item.update({ where: { id }, data }));
  });

  ipcMain.handle('masterData:deleteItem', async (_event, id: number) => {
    requireMastersPermission();
    return serialize(await prisma.item.delete({ where: { id } }));
  });

  // ─── Vendors ────────────────────────────────────────────────────
  ipcMain.handle('masterData:createVendor', async (_event, data: any) => {
    requireMastersPermission();
    return serialize(await prisma.vendor.create({ data }));
  });

  ipcMain.handle('masterData:updateVendor', async (_event, id: number, data: any) => {
    requireMastersPermission();
    return serialize(await prisma.vendor.update({ where: { id }, data }));
  });

  ipcMain.handle('masterData:deleteVendor', async (_event, id: number) => {
    requireMastersPermission();
    return serialize(await prisma.vendor.delete({ where: { id } }));
  });

  // ─── Departments ────────────────────────────────────────────────
  ipcMain.handle('masterData:createDepartment', async (_event, data: any) => {
    requireMastersPermission();
    const dept = await prisma.department.create({ data });

    // Auto-create matching Location for Dharamshala/Store/Department types
    if (data.departmentType === 'Dharamshala' || data.departmentType === 'Store' || data.departmentType === 'Department') {
      const existing = await prisma.location.findFirst({
        where: { locationName: data.name, locationType: data.departmentType },
      });
      if (!existing) {
        await prisma.location.create({
          data: { locationType: data.departmentType, locationName: data.name, parentId: null },
        });
      }
    }

    return serialize(dept);
  });

  ipcMain.handle('masterData:updateDepartment', async (_event, id: number, data: any) => {
    requireMastersPermission();
    const dept = await prisma.department.update({ where: { id }, data });

    // Sync corresponding Location if name or type changed
    if (data.name || data.departmentType) {
      const oldDept = await prisma.department.findUnique({ where: { id } });
      const newType = data.departmentType || oldDept?.departmentType;
      const newName = data.name || oldDept?.name;

      if (newType === 'Dharamshala' || newType === 'Store' || newType === 'Department') {
        // Find existing location by old name + old type
        const oldType = oldDept?.departmentType;
        const existingLoc = await prisma.location.findFirst({
          where: { locationName: oldDept?.name, locationType: oldType },
        });
        if (existingLoc) {
          await prisma.location.update({
            where: { id: existingLoc.id },
            data: { locationName: newName, locationType: newType },
          });
        } else {
          // Location doesn't exist yet — create it
          await prisma.location.create({
            data: { locationType: newType, locationName: newName, parentId: null },
          });
        }
      }
    }

    return serialize(dept);
  });

  ipcMain.handle('masterData:deleteDepartment', async (_event, id: number) => {
    requireMastersPermission();

    // Check if department exists
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return serialize({ success: true, message: 'Department already deleted' });

    // Check for related records — prevent orphaning stock/transaction data
    const [stockTxCount, issueCount, receiptCount, transferCount, adjustmentCount, categoryCount] = await Promise.all([
      prisma.stockTransaction.count({ where: { departmentId: id } }),
      prisma.issueChallan.count({ where: { departmentId: id } }),
      prisma.receiptChallan.count({ where: { departmentId: id } }),
      prisma.transferChallan.count({ where: { OR: [{ fromDepartmentId: id }, { toDepartmentId: id }] } }),
      prisma.stockAdjustment.count({ where: { departmentId: id } }),
      prisma.itemCategory.count({ where: { departmentId: id } }),
    ]);

    const blockers: string[] = [];
    if (stockTxCount > 0) blockers.push(`${stockTxCount} stock transactions`);
    if (issueCount > 0) blockers.push(`${issueCount} issue challans`);
    if (receiptCount > 0) blockers.push(`${receiptCount} receipt challans`);
    if (transferCount > 0) blockers.push(`${transferCount} transfer challans`);
    if (adjustmentCount > 0) blockers.push(`${adjustmentCount} stock adjustments`);
    if (categoryCount > 0) blockers.push(`${categoryCount} item categories`);

    if (blockers.length > 0) {
      throw new Error(`Cannot delete department: has existing records (${blockers.join(', ')}). Deactivate instead.`);
    }

    // Also delete corresponding Location if it exists
    const dept = await prisma.department.findUnique({ where: { id } });
    if (dept && (dept.departmentType === 'Dharamshala' || dept.departmentType === 'Store' || dept.departmentType === 'Department')) {
      const loc = await prisma.location.findFirst({
        where: { locationName: dept.name, locationType: dept.departmentType },
      });
      if (loc) {
        // Check if location itself has transactions
        const locTxCount = await prisma.stockTransaction.count({ where: { locationId: loc.id } });
        if (locTxCount === 0) {
          // Get all child locations
          const childIds = await prisma.location.findMany({ where: { parentId: loc.id }, select: { id: true } });
          // Delete children that have no transactions
          for (const child of childIds) {
            const childTxCount = await prisma.stockTransaction.count({ where: { locationId: child.id } });
            if (childTxCount === 0) {
              await prisma.location.delete({ where: { id: child.id } });
            }
          }
          // Re-check children — if any remain (with transactions), can't delete parent
          const remainingChildren = await prisma.location.count({ where: { parentId: loc.id } });
          if (remainingChildren === 0) {
            await prisma.location.delete({ where: { id: loc.id } });
          }
        }
      }
    }

    return serialize(await prisma.department.delete({ where: { id } }));
  });

  // ─── Locations ──────────────────────────────────────────────────
  ipcMain.handle('masterData:createLocation', async (_event, data: any) => {
    requireMastersPermission();

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

    return serialize(await prisma.location.create({ data }));
  });

  ipcMain.handle('masterData:updateLocation', async (_event, id: number, data: any) => {
    requireMastersPermission();

    // Prevent self-parenting
    if (data.parentId === id) throw new Error('Location cannot be its own parent');

    // Dharamshala/Store/Department cannot have a parent
    if ((data.locationType === 'Dharamshala' || data.locationType === 'Store' || data.locationType === 'Department') && data.parentId) {
      throw new Error(`${data.locationType} cannot have a parent — it must be at root level`);
    }

    // Room must have Dharamshala, Store, or Department parent
    if (data.locationType === 'Room') {
      if (!data.parentId) {
        throw new Error('Room must have a parent Dharamshala, Store, or Department');
      }
      const parent = await prisma.location.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new Error('Parent location not found');
      if (parent.locationType !== 'Dharamshala' && parent.locationType !== 'Store' && parent.locationType !== 'Department') {
        throw new Error('Room can only be under a Dharamshala, Store, or Department — not under another Room');
      }
    }

    // Prevent circular references
    if (data.parentId) {
      const ancestors = await getAncestors(data.parentId);
      if (ancestors.includes(id)) {
        throw new Error('Circular reference detected: parent is a descendant of this location');
      }
    }

    return serialize(await prisma.location.update({ where: { id }, data }));
  });

  ipcMain.handle('masterData:deleteLocation', async (_event, id: number) => {
    requireMastersPermission();

    // Check if location exists
    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) return serialize({ success: true, message: 'Location already deleted' });

    // Check for related records — prevent orphaning data
    const [childCount, stockTxCount, issueCount, receiptCount, assetCount, damageCount, adjustmentCount, transferCount] = await Promise.all([
      prisma.location.count({ where: { parentId: id } }),
      prisma.stockTransaction.count({ where: { locationId: id } }),
      prisma.issueChallanItem.count({ where: { locationId: id } }),
      prisma.receiptChallanItem.count({ where: { locationId: id } }),
      prisma.assetInstallation.count({ where: { locationId: id } }),
      prisma.damageEntry.count({ where: { locationId: id } }),
      prisma.stockAdjustment.count({ where: { locationId: id } }),
      prisma.transferChallanItem.count({ where: { OR: [{ locationId: id }, { toLocationId: id }] } }),
    ]);

    const blockers: string[] = [];
    if (childCount > 0) blockers.push(`${childCount} child locations`);
    if (stockTxCount > 0) blockers.push(`${stockTxCount} stock transactions`);
    if (issueCount > 0) blockers.push(`${issueCount} issue challan items`);
    if (receiptCount > 0) blockers.push(`${receiptCount} receipt challan items`);
    if (assetCount > 0) blockers.push(`${assetCount} asset installations`);
    if (damageCount > 0) blockers.push(`${damageCount} damage entries`);
    if (adjustmentCount > 0) blockers.push(`${adjustmentCount} stock adjustments`);
    if (transferCount > 0) blockers.push(`${transferCount} transfer challan items`);

    if (blockers.length > 0) {
      throw new Error(`Cannot delete location: has existing records (${blockers.join(', ')}). Deactivate instead.`);
    }

    return serialize(await prisma.location.delete({ where: { id } }));
  });

  // ─── Bulk Operations (for CSV import) ──────────────────────────
  ipcMain.handle('masterData:bulkCreate', async (_event, model: string, rows: any[]) => {
    requireMastersPermission();
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Model ${model} not found`);
    return serialize(await delegate.createMany({ data: rows, skipDuplicates: true }));
  });

  ipcMain.handle('masterData:bulkUpdate', async (_event, model: string, idField: string, rows: any[]) => {
    requireMastersPermission();
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Model ${model} not found`);
    const results = await Promise.all(
      rows.map((row) => {
        const id = row[idField];
        const { [idField]: _, ...data } = row;
        return delegate.update({ where: { id }, data });
      })
    );
    return serialize(results);
  });

  ipcMain.handle('masterData:bulkUpsert', async (_event, model: string, idField: string, rows: any[]) => {
    requireMastersPermission();
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
    return serialize(results);
  });
}
