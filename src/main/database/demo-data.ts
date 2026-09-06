import { PrismaClient, Prisma } from '@prisma/client';
import { TransactionEngine } from '../services/transactionEngine.service';
import { VoucherEngine } from '../services/voucherEngine.service';

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function loadDemoData(prisma: PrismaClient, companyId: number, financialYearId: number): Promise<string> {
  const logs: string[] = [];
  const txEngine = new TransactionEngine(prisma);

  const existingVendors = await prisma.vendor.count();
  if (existingVendors > 0) return 'Demo data already loaded. Use "Clear Demo Data" first.';

  // 1. Create Units
  const unitData = [
    { name: 'Pc', symbol: 'Pc' }, { name: 'Meter', symbol: 'm' },
    { name: 'Kg', symbol: 'kg' }, { name: 'Liter', symbol: 'L' },
    { name: 'Box', symbol: 'Box' }, { name: 'Set', symbol: 'Set' },
    { name: 'Roll', symbol: 'Roll' }, { name: 'Bale', symbol: 'Bale' },
  ];
  for (const u of unitData) {
    await prisma.unit.upsert({ where: { name: u.name }, update: {}, create: u });
  }
  const units = await prisma.unit.findMany();
  const unitMap = new Map(units.map(u => [u.name, u.id]));
  logs.push(`${units.length} Units`);

  // 2. Create Categories
  const catData = [
    { name: 'Electrical', prefix: 'ELC' },
    { name: 'Plumbing', prefix: 'PLB' },
    { name: 'General', prefix: 'GEN' },
    { name: 'Furniture', prefix: 'FRN' },
    { name: 'IT Equipment', prefix: 'ITE' },
  ];
  for (const c of catData) {
    const existing = await prisma.itemCategory.findFirst({ where: { name: c.name } });
    if (!existing) await prisma.itemCategory.create({ data: c });
  }
  const categories = await prisma.itemCategory.findMany();
  const catMap = new Map(categories.map(c => [c.name, c.id]));
  logs.push(`${categories.length} Categories`);

  // 3. Create Items
  const itemData = [
    { name: 'LED Bulb', cat: 'Electrical', unit: 'Pc', type: 'CONSUMABLE' },
    { name: 'LED Tube Light', cat: 'Electrical', unit: 'Pc', type: 'CONSUMABLE' },
    { name: 'Fan', cat: 'Electrical', unit: 'Pc', type: 'NON_SERIALIZED' },
    { name: 'Wire', cat: 'Electrical', unit: 'Meter', type: 'CONSUMABLE' },
    { name: 'Cable', cat: 'Electrical', unit: 'Meter', type: 'CONSUMABLE' },
    { name: 'Switch', cat: 'Electrical', unit: 'Pc', type: 'CONSUMABLE' },
    { name: 'Socket', cat: 'Electrical', unit: 'Pc', type: 'CONSUMABLE' },
    { name: 'Circuit Breaker', cat: 'Electrical', unit: 'Pc', type: 'NON_SERIALIZED' },
    { name: 'Pipe', cat: 'Plumbing', unit: 'Meter', type: 'CONSUMABLE' },
    { name: 'Valve', cat: 'Plumbing', unit: 'Pc', type: 'NON_SERIALIZED' },
    { name: 'Cement', cat: 'General', unit: 'Kg', type: 'CONSUMABLE' },
    { name: 'Paint', cat: 'General', unit: 'Liter', type: 'CONSUMABLE' },
    { name: 'Tape', cat: 'General', unit: 'Roll', type: 'CONSUMABLE' },
    { name: 'Chair', cat: 'Furniture', unit: 'Pc', type: 'ASSET' },
    { name: 'Table', cat: 'Furniture', unit: 'Pc', type: 'ASSET' },
    { name: 'Computer', cat: 'IT Equipment', unit: 'Pc', type: 'ASSET', serialized: true },
    { name: 'Printer', cat: 'IT Equipment', unit: 'Pc', type: 'ASSET', serialized: true },
    { name: 'UPS', cat: 'IT Equipment', unit: 'Pc', type: 'ASSET', serialized: true },
    { name: 'Router', cat: 'IT Equipment', unit: 'Pc', type: 'ASSET', serialized: true },
    { name: 'Projector', cat: 'IT Equipment', unit: 'Pc', type: 'ASSET', serialized: true },
  ];

  const catCounters = new Map<string, number>();
  for (const item of itemData) {
    const catId = catMap.get(item.cat) || categories[0]?.id;
    const uid = unitMap.get(item.unit) || units[0]?.id;
    if (!catId || !uid) continue;
    const prefix = categories.find(c => c.id === catId)?.prefix || 'GEN';
    const nextNo = (catCounters.get(prefix) || 0) + 1;
    catCounters.set(prefix, nextNo);
    const itemCode = `${prefix}-${String(nextNo).padStart(4, '0')}`;
    await prisma.item.upsert({
      where: { itemCode },
      update: {},
      create: {
        itemCode, itemName: item.name, categoryId: catId, unitId: uid,
        itemType: item.type, isSerialized: item.serialized || false,
        minimumStockLevel: 5, maximumStockLevel: 100,
      },
    });
  }
  const items = await prisma.item.findMany({ orderBy: { id: 'asc' } });
  logs.push(`${items.length} Items`);

  // 4. Create Stores
  const mainStore = await prisma.store.upsert({
    where: { companyId_name: { companyId, name: 'Main Store' } },
    update: {},
    create: { companyId, name: 'Main Store', storeType: 'MAIN_STORE', code: 'MS-001' },
  });

  const deptStore = await prisma.store.upsert({
    where: { companyId_name: { companyId, name: 'Department Store' } },
    update: {},
    create: { companyId, name: 'Department Store', storeType: 'DEPARTMENT_STORE', code: 'DS-001' },
  });

  const dharmStore = await prisma.store.upsert({
    where: { companyId_name: { companyId, name: 'Dharmshala Store' } },
    update: {},
    create: { companyId, name: 'Dharmshala Store', storeType: 'DHARMSHALA_STORE', code: 'DHS-001' },
  });
  logs.push('3 Stores');

  // 5. Create Locations
  const mainLoc = await prisma.location.create({
    data: { storeId: mainStore.id, name: 'Main Counter', locationType: 'StoreArea', code: 'MC-001' },
  });

  const room1 = await prisma.location.create({
    data: { storeId: dharmStore.id, name: 'Room 1', locationType: 'Room', code: 'RM-001' },
  });
  const room2 = await prisma.location.create({
    data: { storeId: dharmStore.id, name: 'Room 2', locationType: 'Room', code: 'RM-002' },
  });

  const office = await prisma.location.create({
    data: { storeId: deptStore.id, name: 'Office', locationType: 'Office', code: 'OF-001' },
  });
  logs.push('4 Locations');

  // 6. Create Rooms
  const room1Rec = await prisma.room.create({
    data: { locationId: room1.id, name: 'Room 101', code: '101' },
  });
  const room2Rec = await prisma.room.create({
    data: { locationId: room2.id, name: 'Room 102', code: '102' },
  });
  logs.push('2 Rooms');

  // 7. Create Vendors
  const vendorData = [
    { vendorName: 'Electrical Supplies Co.' },
    { vendorName: 'Plumbing Solutions' },
    { vendorName: 'General Traders' },
    { vendorName: 'IT Solutions Ltd.' },
    { vendorName: 'Furniture World' },
  ];
  for (let i = 0; i < vendorData.length; i++) {
    await prisma.vendor.create({
      data: {
        companyId: 1,
        vendorCode: `VND-${String(i + 1).padStart(5, '0')}`,
        vendorName: vendorData[i].vendorName,
      },
    });
  }
  const vendors = await prisma.vendor.findMany();
  logs.push(`${vendors.length} Vendors`);

  // 8. Create Receipt Transactions (Purchase)
  const receiptItems = items.slice(0, 10);
  for (let i = 0; i < 5; i++) {
    const itemCount = rand(2, 4);
    const selectedItems = receiptItems.slice(0, itemCount);
    await txEngine.createTransaction({
      companyId,
      financialYearId,
      voucherType: 'RC',
      transactionDate: new Date(2026, 0, rand(1, 28)),
      toStoreId: mainStore.id,
      vendorId: pick(vendors).id,
      receivedBy: pick(['Ram', 'Shyam', 'Hari']),
      remarks: `Demo receipt ${i + 1}`,
      createdBy: 'admin',
      items: selectedItems.map(item => ({
        itemId: item.id,
        quantity: rand(10, 50),
        rate: rand(50, 500),
        condition: 'GOOD',
      })),
    });
  }
  logs.push('5 Receipt Transactions');

  // 9. Create Issue Transactions
  for (let i = 0; i < 3; i++) {
    const itemCount = rand(1, 3);
    const selectedItems = items.slice(0, itemCount);
    await txEngine.createTransaction({
      companyId,
      financialYearId,
      voucherType: 'IC',
      transactionDate: new Date(2026, 1, rand(1, 28)),
      fromStoreId: mainStore.id,
      toStoreId: deptStore.id,
      issuedBy: pick(['Ram', 'Shyam']),
      purpose: 'Department use',
      remarks: `Demo issue ${i + 1}`,
      createdBy: 'admin',
      items: selectedItems.map(item => ({
        itemId: item.id,
        quantity: rand(1, 10),
        condition: 'GOOD',
      })),
    });
  }
  logs.push('3 Issue Transactions');

  // 10. Create Transfer Transactions
  for (let i = 0; i < 2; i++) {
    const selectedItems = items.slice(0, 2);
    await txEngine.createTransaction({
      companyId,
      financialYearId,
      voucherType: 'TC',
      transactionDate: new Date(2026, 2, rand(1, 28)),
      fromStoreId: mainStore.id,
      toStoreId: dharmStore.id,
      issuedBy: 'Ram',
      remarks: `Demo transfer ${i + 1}`,
      createdBy: 'admin',
      items: selectedItems.map(item => ({
        itemId: item.id,
        quantity: rand(1, 5),
        condition: 'GOOD',
      })),
    });
  }
  logs.push('2 Transfer Transactions');

  // 11. Create Install Transactions
  const installableItems = items.filter(i => i.itemType === 'ASSET');
  for (let i = 0; i < Math.min(3, installableItems.length); i++) {
    await txEngine.createTransaction({
      companyId,
      financialYearId,
      voucherType: 'IS',
      transactionDate: new Date(2026, 3, rand(1, 28)),
      fromStoreId: dharmStore.id,
      toStoreId: dharmStore.id,
      fromLocationId: room1.id,
      toLocationId: room2.id,
      issuedBy: 'Ram',
      remarks: `Demo install ${i + 1}`,
      createdBy: 'admin',
      items: [{
        itemId: installableItems[i].id,
        quantity: 1,
        condition: 'GOOD',
      }],
    });
  }
  logs.push('3 Install Transactions');

  // 12. Create Asset Installations
  for (let i = 0; i < Math.min(3, installableItems.length); i++) {
    const roomRec = i % 2 === 0 ? room1Rec : room2Rec;
    await prisma.assetInstallation.create({
      data: {
        itemId: installableItems[i].id,
        roomId: roomRec.id,
        storeId: dharmStore.id,
        quantity: 1,
        installedDate: new Date(2026, 3, 15),
        installedBy: 'Ram',
        status: 'ACTIVE',
        remarks: `Demo installation ${i + 1}`,
      },
    });
  }
  logs.push('3 Asset Installations');

  // 13. Create Serialized Items
  const serializedItems = items.filter(i => i.isSerialized);
  for (let i = 0; i < serializedItems.length; i++) {
    await prisma.serializedItem.create({
      data: {
        itemId: serializedItems[i].id,
        serialNumber: `SN-${String(i + 1).padStart(6, '0')}`,
        currentStoreId: mainStore.id,
        status: 'AVAILABLE',
        condition: 'GOOD',
        purchaseDate: new Date(2026, 0, 15),
        purchasePrice: rand(5000, 50000),
      },
    });
  }
  logs.push(`${serializedItems.length} Serialized Items`);

  logs.push('Demo data loaded successfully!');
  return logs.join('\n');
}

export async function clearDemoData(prisma: PrismaClient): Promise<string> {
  await prisma.serialMovement.deleteMany();
  await prisma.serializedItem.deleteMany();
  await prisma.assetInstallation.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.transactionDetail.deleteMany();
  await prisma.transactionHeader.deleteMany();
  await prisma.warrantyRecord.deleteMany();
  await prisma.aMCRecord.deleteMany();
  await prisma.room.deleteMany();
  await prisma.location.deleteMany();
  await prisma.store.deleteMany();
  await prisma.item.deleteMany();
  await prisma.itemSubCategory.deleteMany();
  await prisma.itemCategory.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.reasonMaster.deleteMany();
  return 'Demo data cleared successfully';
}
