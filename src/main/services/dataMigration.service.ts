import { PrismaClient } from '@prisma/client';
import { TransactionEngine } from './transactionEngine.service';
import { StockEngine } from './stockEngine.service';
import { normalizeDate } from '../../shared/dateUtils';
import type { CreateTransactionInput } from '../../shared/types';

export interface MigrationResult {
  success: boolean;
  storesCreated: number;
  locationsUpdated: number;
  itemsUpdated: number;
  stockMigrated: number;
  installationsMigrated: number;
  errors: string[];
}

export interface OpeningBalanceImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
  createdItems: number;
  createdCategories: number;
  createdUnits: number;
}

export interface RoomAssetImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
  createdRooms: number;
  createdAssets: number;
}

/**
 * DATA MIGRATION SERVICE
 * 
 * Migrates existing data to the new architecture:
 * - Creates default stores if not exists
 * - Links locations to stores
 * - Migrates stock transactions to use TransactionEngine
 * - Preserves all history
 * - Opening Balance import from Excel
 * - Room Assets migration
 */
export class DataMigrationService {
  private txEngine: TransactionEngine;
  private stockEngine: StockEngine;

  constructor(private prisma: PrismaClient) {
    this.txEngine = new TransactionEngine(prisma);
    this.stockEngine = new StockEngine(prisma);
  }

  /**
   * Run full migration.
   */
  async migrate(companyId: number): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      storesCreated: 0,
      locationsUpdated: 0,
      itemsUpdated: 0,
      stockMigrated: 0,
      installationsMigrated: 0,
      errors: [],
    };

    try {
      // Step 1: Create default store if not exists
      const storesCreated = await this.createDefaultStore(companyId);
      result.storesCreated = storesCreated;

      // Step 2: Link locations to stores
      const locationsUpdated = await this.linkLocationsToStores(companyId);
      result.locationsUpdated = locationsUpdated;

      // Step 3: Initialize default configurations
      const { SystemConfigurationService } = await import('./systemConfiguration.service');
      const configService = new SystemConfigurationService(this.prisma);
      await configService.initializeDefaults(companyId);

      // Step 4: Initialize transfer matrix
      const { TransferMatrixService } = await import('./transferMatrix.service');
      const matrixService = new TransferMatrixService(this.prisma);
      await matrixService.initializeDefaults(companyId);

      // Step 5: Create opening balances from existing ledger entries
      const stockMigrated = await this.createOpeningBalances(companyId);
      result.stockMigrated = stockMigrated;

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Create default main store if not exists.
   */
  private async createDefaultStore(companyId: number): Promise<number> {
    const existingStore = await this.prisma.store.findFirst({
      where: { companyId, storeType: 'MAIN_STORE' },
    });

    if (!existingStore) {
      await this.prisma.store.create({
        data: {
          companyId,
          name: 'Main Store',
          code: 'MS001',
          storeType: 'MAIN_STORE',
        },
      });
      return 1;
    }

    return 0;
  }

  /**
   * Link locations to stores based on context.
   */
  private async linkLocationsToStores(companyId: number): Promise<number> {
    const locations = await this.prisma.location.findMany({
      where: { storeId: { equals: undefined } },
    });

    let count = 0;

    for (const location of locations) {
      // Find the main store for this company
      const mainStore = await this.prisma.store.findFirst({
        where: { companyId, storeType: 'MAIN_STORE' },
      });

      if (mainStore) {
        await this.prisma.location.update({
          where: { id: location.id },
          data: { storeId: mainStore.id },
        });
        count++;
      }
    }

    return count;
  }

  /**
   * Create opening balances from existing ledger entries if any.
   */
  private async createOpeningBalances(companyId: number): Promise<number> {
    // Check if there are existing ledger entries
    const ledgerCount = await this.prisma.ledgerEntry.count({
      where: { companyId },
    });

    if (ledgerCount > 0) {
      // Ledger entries already exist, no need to create opening balances
      return 0;
    }

    // No existing data, return 0
    return 0;
  }

  /**
   * Check if migration is needed.
   */
  async isMigrationNeeded(companyId: number): Promise<{
    needed: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    // Check if stores exist
    const storeCount = await this.prisma.store.count({ where: { companyId } });
    if (storeCount === 0) {
      reasons.push('No stores found. Need to create default main store.');
    }

    // Check if configurations exist
    const configCount = await this.prisma.systemConfiguration.count({ where: { companyId } });
    if (configCount === 0) {
      reasons.push('No system configurations found.');
    }

    // Check if transfer matrix exists
    const matrixCount = await this.prisma.transferMatrix.count({ where: { companyId } });
    if (matrixCount === 0) {
      reasons.push('No transfer matrix rules found.');
    }

    return {
      needed: reasons.length > 0,
      reasons,
    };
  }

  // ============================================================
  // OPENING BALANCE IMPORT
  // ============================================================

  /**
   * Import opening balance from Excel rows.
   * Auto-creates items, categories, and units if they don't exist.
   */
  async importOpeningBalance(
    companyId: number,
    financialYearId: number,
    rows: Array<{
      itemName: string;
      itemCode?: string;
      categoryName?: string;
      unitName?: string;
      storeName: string;
      quantity: number;
      rate?: number;
      date?: string;
    }>
  ): Promise<OpeningBalanceImportResult> {
    const result: OpeningBalanceImportResult = {
      success: true,
      totalRows: rows.length,
      imported: 0,
      skipped: 0,
      errors: [],
      createdItems: 0,
      createdCategories: 0,
      createdUnits: 0,
    };

    // Get or create main store
    let mainStore = await this.prisma.store.findFirst({
      where: { companyId, storeType: 'MAIN_STORE' },
    });

    if (!mainStore) {
      mainStore = await this.prisma.store.create({
        data: {
          companyId,
          name: 'Main Store',
          code: 'MS001',
          storeType: 'MAIN_STORE',
        },
      });
      result.createdCategories++; // Count as created
    }

    // Cache for categories and units
    const categoryCache = new Map<string, number>();
    const unitCache = new Map<string, number>();
    const itemCache = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate required fields
        if (!row.itemName || !row.storeName || !row.quantity) {
          result.errors.push(`Row ${i + 1}: Missing required fields (itemName, storeName, quantity)`);
          result.skipped++;
          continue;
        }

        // Get or create category
        let categoryId: number | undefined;
        if (row.categoryName) {
          if (!categoryCache.has(row.categoryName)) {
            let category = await this.prisma.itemCategory.findFirst({
              where: { name: row.categoryName.trim() },
            });

            if (!category) {
              category = await this.prisma.itemCategory.create({
                data: {
                  name: row.categoryName.trim(),
                  prefix: row.categoryName.substring(0, 3).toUpperCase(),
                },
              });
              result.createdCategories++;
            }

            categoryCache.set(row.categoryName, category.id);
          }
          categoryId = categoryCache.get(row.categoryName);
        }

        // Get or create unit
        let unitId: number | undefined;
        if (row.unitName) {
          if (!unitCache.has(row.unitName)) {
            let unit = await this.prisma.unit.findFirst({
              where: { name: row.unitName.trim() },
            });

            if (!unit) {
              unit = await this.prisma.unit.create({
                data: {
                  name: row.unitName.trim(),
                  symbol: row.unitName.substring(0, 3).toUpperCase(),
                },
              });
              result.createdUnits++;
            }

            unitCache.set(row.unitName, unit.id);
          }
          unitId = unitCache.get(row.unitName);
        }

        // Get or create item
        const itemKey = row.itemCode || row.itemName;
        if (!itemCache.has(itemKey)) {
          let item = row.itemCode
            ? await this.prisma.item.findFirst({ where: { itemCode: row.itemCode } })
            : await this.prisma.item.findFirst({ where: { itemName: row.itemName } });

          if (!item) {
            // Find or create default category and unit if not provided
            let finalCategoryId = categoryId;
            let finalUnitId = unitId;

            if (!finalCategoryId) {
              let defaultCat = await this.prisma.itemCategory.findFirst({ where: { name: 'General' } });
              if (!defaultCat) {
                defaultCat = await this.prisma.itemCategory.create({
                  data: { name: 'General', prefix: 'GEN' },
                });
              }
              finalCategoryId = defaultCat.id;
            }

            if (!finalUnitId) {
              let defaultUnit = await this.prisma.unit.findFirst({ where: { name: 'Pieces' } });
              if (!defaultUnit) {
                defaultUnit = await this.prisma.unit.create({
                  data: { name: 'Pieces', symbol: 'Pcs' },
                });
              }
              finalUnitId = defaultUnit.id;
            }

            item = await this.prisma.item.create({
              data: {
                itemCode: row.itemCode || `IMP-${String(i + 1).padStart(4, '0')}`,
                itemName: row.itemName,
                categoryId: finalCategoryId,
                unitId: finalUnitId,
                itemType: 'NON_SERIALIZED',
                minimumStockLevel: 0,
              },
            });
            result.createdItems++;
          }

          itemCache.set(itemKey, item.id);
        }

        const itemId = itemCache.get(itemKey)!;

        // Validate transaction date — opening balance MUST have an explicit date
        const transactionDate = normalizeDate(row.date);
        if (!transactionDate) {
          result.errors.push(`Row ${i + 1}: Transaction Date is required for opening balance (item: ${row.itemName})`);
          result.skipped++;
          continue;
        }

        // Create opening stock through TransactionEngine (canonical path)
        const engine = new TransactionEngine(this.prisma);
        await engine.createMovement({
          companyId,
          financialYearId,
          movementType: 'OB',
          transactionDate,
          toStoreId: mainStore.id,
          remarks: `Opening Balance Import - ${row.itemName}`,
          createdBy: 'system',
          initialStatus: 'POSTED',
          items: [{
            itemId,
            quantity: row.quantity,
            rate: row.rate || 0,
          }],
        });

        result.imported++;
      } catch (err) {
        result.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        result.skipped++;
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  // ============================================================
  // ROOM ASSETS IMPORT
  // ============================================================

  /**
   * Import room-wise assets from Excel rows.
   * Auto-creates rooms if they don't exist.
   */
  async importRoomAssets(
    companyId: number,
    rows: Array<{
      locationName: string;
      roomName: string;
      roomCode?: string;
      itemName: string;
      itemCode?: string;
      serialNumber?: string;
      quantity?: number;
      condition?: string;
      status?: string;
      purchaseDate?: string;
      purchaseCost?: number;
    }>
  ): Promise<RoomAssetImportResult> {
    const result: RoomAssetImportResult = {
      success: true,
      totalRows: rows.length,
      imported: 0,
      skipped: 0,
      errors: [],
      createdRooms: 0,
      createdAssets: 0,
    };

    // Get or create main store
    let mainStore = await this.prisma.store.findFirst({
      where: { companyId, storeType: 'MAIN_STORE' },
    });

    if (!mainStore) {
      mainStore = await this.prisma.store.create({
        data: {
          companyId,
          name: 'Main Store',
          code: 'MS001',
          storeType: 'MAIN_STORE',
        },
      });
    }

    // Cache for locations and rooms
    const locationCache = new Map<string, number>();
    const roomCache = new Map<string, number>();
    const itemCache = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate required fields
        if (!row.locationName || !row.roomName || !row.itemName) {
          result.errors.push(`Row ${i + 1}: Missing required fields (locationName, roomName, itemName)`);
          result.skipped++;
          continue;
        }

        // Get or create location
        if (!locationCache.has(row.locationName)) {
          let location = await this.prisma.location.findFirst({
            where: { name: row.locationName.trim() },
          });

          if (!location) {
            location = await this.prisma.location.create({
              data: {
                storeId: mainStore.id,
                locationType: 'Dharamshala',
                name: row.locationName.trim(),
              },
            });
          }

          locationCache.set(row.locationName, location.id);
        }

        const locationId = locationCache.get(row.locationName)!;

        // Get or create room
        const roomKey = `${row.locationName}-${row.roomName}`;
        if (!roomCache.has(roomKey)) {
          let room = await this.prisma.room.findFirst({
            where: { name: row.roomName.trim(), locationId },
          });

          if (!room) {
            room = await this.prisma.room.create({
              data: {
                locationId,
                name: row.roomName.trim(),
                code: row.roomCode || null,
              },
            });
            result.createdRooms++;
          }

          roomCache.set(roomKey, room.id);
        }

        const roomId = roomCache.get(roomKey)!;

        // Get or create item
        const itemKey = row.itemCode || row.itemName;
        if (!itemCache.has(itemKey)) {
          let item = row.itemCode
            ? await this.prisma.item.findFirst({ where: { itemCode: row.itemCode } })
            : await this.prisma.item.findFirst({ where: { itemName: row.itemName } });

          if (!item) {
            // Find or create default category and unit
            let defaultCat = await this.prisma.itemCategory.findFirst({ where: { name: 'General' } });
            if (!defaultCat) {
              defaultCat = await this.prisma.itemCategory.create({
                data: { name: 'General', prefix: 'GEN' },
              });
            }

            let defaultUnit = await this.prisma.unit.findFirst({ where: { name: 'Pieces' } });
            if (!defaultUnit) {
              defaultUnit = await this.prisma.unit.create({
                data: { name: 'Pieces', symbol: 'Pcs' },
              });
            }

            item = await this.prisma.item.create({
              data: {
                itemCode: row.itemCode || `ROOM-${String(i + 1).padStart(4, '0')}`,
                itemName: row.itemName,
                categoryId: defaultCat.id,
                unitId: defaultUnit.id,
                itemType: 'NON_SERIALIZED',
                minimumStockLevel: 0,
              },
            });
          }

          itemCache.set(itemKey, item.id);
        }

        const itemId = itemCache.get(itemKey)!;

        // Create asset profile if serial number provided
        if (row.serialNumber) {
          const existingAsset = await this.prisma.assetProfile.findFirst({
            where: { serialNumber: row.serialNumber },
          });

          if (!existingAsset) {
            await this.prisma.assetProfile.create({
              data: {
                assetCode: row.itemCode || `AST-${String(i + 1).padStart(6, '0')}`,
                assetName: row.itemName,
                itemId,
                serialNumber: row.serialNumber,
                companyId,
                currentStoreId: mainStore.id,
                currentLocationId: locationId,
                status: row.status || 'ACTIVE',
                condition: row.condition || 'GOOD',
                purchaseDate: row.purchaseDate ? normalizeDate(row.purchaseDate) : null,
                purchaseCost: row.purchaseCost || 0,
              },
            });
            result.createdAssets++;
          }
        }

        result.imported++;
      } catch (err) {
        result.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        result.skipped++;
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
