import { PrismaClient, Prisma } from '@prisma/client';
import { DEMO_DHARAMSHALAS } from './demo-data-rooms';



// Random helper for realistic data
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function loadDemoData(prisma: PrismaClient, companyId: number, financialYearId: number): Promise<string> {
  const logs: string[] = [];

  const existingVendors = await prisma.vendor.count();
  if (existingVendors > 0) {
    return 'Demo data already loaded. Use "Clear Demo Data" first.';
  }

  const departments = await prisma.department.findMany({ where: { companyId } });
  const storeDepts = departments.filter(d => d.departmentType === 'Store');
  const dharamshalaDepts = departments.filter(d => d.departmentType === 'Dharamshala');

  if (storeDepts.length === 0) return 'No store departments found. Add stores first.';
  if (dharamshalaDepts.length === 0) return 'No dharamshala departments found.';

  // Create units if none exist
  const existingUnits = await prisma.unit.count();
  if (existingUnits === 0) {
    const demoUnits = [
      { name: 'पीस', symbol: 'Pc' }, { name: 'मीटर', symbol: 'm' },
      { name: 'पाइप', symbol: 'Pipe' }, { name: 'बैल', symbol: 'Bale' },
      { name: 'फाइल', symbol: 'File' }, { name: 'किलो', symbol: 'kg' },
      { name: 'लीटर', symbol: 'L' }, { name: 'डिब्बा', symbol: 'Box' },
      { name: 'रोल', symbol: 'Roll' }, { name: 'सेट', symbol: 'Set' },
    ];
    for (const u of demoUnits) await prisma.unit.upsert({ where: { name: u.name }, update: {}, create: u });
    logs.push(`${demoUnits.length} Units`);
  }

  const units = await prisma.unit.findMany();

  // Create items if none exist
  const existingItems = await prisma.item.count();
  if (existingItems === 0) {
    const categories = await prisma.itemCategory.findMany();
    const catMap = new Map(categories.map(c => [c.name, c.id]));
    const catPrefixMap = new Map(categories.map(c => [c.name, c.prefix]));
    const unitMap = new Map(units.map(u => [u.name, u.id]));
    const defaultUnitId = unitMap.get('पीस') || units[0]?.id;
    const demoItems = [
      { sr: 1, name: 'डक्ट टेप (पैकिंग टेप)', unit: 'पीस', category: 'सामान्य' },
      { sr: 2, name: 'डीप फ्रीजर पंखा', unit: 'पीस', category: 'बिजली स्टोर' },
      { sr: 3, name: 'सफेद तार लू-पी-टी', unit: 'मीटर', category: 'बिजली स्टोर' },
      { sr: 4, name: 'स्टीलकट', unit: 'पीस', category: 'इमारत स्टोर' },
      { sr: 5, name: 'वैरियर छोटा', unit: 'पीस', category: 'इमारत स्टोर' },
      { sr: 6, name: 'पाइप काटने की मशीन', unit: 'पीस', category: 'इमारत स्टोर' },
      { sr: 7, name: 'फाइल 18 एएस 8', unit: 'फाइल', category: 'जर्नल स्टोर' },
      { sr: 8, name: 'स्टील पाइप इंक 3/4 बैल', unit: 'बैल', category: 'इमारत स्टोर' },
      { sr: 9, name: 'एलईडी बल्ब', unit: 'पीस', category: 'बिजली स्टोर' },
      { sr: 10, name: 'एलईडी ट्यूब लाइट', unit: 'पीस', category: 'बिजली स्टोर' },
      { sr: 11, name: 'सर्किट ब्रेकर', unit: 'पीस', category: 'बिजली स्टोर' },
      { sr: 12, name: 'पंखा', unit: 'पीस', category: 'बिजली स्टोर' },
      { sr: 13, name: 'सीमेंट', unit: 'पीस', category: 'इमारत स्टोर' },
      { sr: 14, name: 'रेत', unit: 'पीस', category: 'इमारत स्टोर' },
      { sr: 15, name: 'पेंट', unit: 'लीटर', category: 'इमारत स्टोर' },
      { sr: 16, name: 'तार', unit: 'मीटर', category: 'बिजली स्टोर' },
      { sr: 17, name: 'केबल', unit: 'मीटर', category: 'बिजली स्टोर' },
      { sr: 18, name: 'स्विच', unit: 'पीस', category: 'बिजली स्टोर' },
      { sr: 19, name: 'सॉकेट', unit: 'पीस', category: 'बिजली स्टोर' },
      { sr: 20, name: 'पेपर', unit: 'पीस', category: 'जर्नल स्टोर' },
    ];

    // Group items by category to generate sequential codes per category
    const categoryCounters = new Map<string, number>();
    for (const item of demoItems) {
      const catId = catMap.get(item.category) || catMap.get('सामान्य') || categories[0]?.id;
      const prefix = catPrefixMap.get(item.category) || catPrefixMap.get('सामान्य') || 'GEN';
      const uid = unitMap.get(item.unit) || defaultUnitId;
      if (catId && uid) {
        const currentNo = categoryCounters.get(prefix) || 0;
        const nextNo = currentNo + 1;
        categoryCounters.set(prefix, nextNo);
        const itemCode = `${prefix}-${String(nextNo).padStart(4, '0')}`;
        await prisma.item.upsert({
          where: { itemCode },
          update: {},
          create: { itemCode, itemName: item.name, categoryId: catId, unitId: uid, minimumStockLevel: 0 },
        });
      }
    }
    logs.push(`${demoItems.length} Items`);
  }

  const items = await prisma.item.findMany({ orderBy: { id: 'asc' } });

  let rcSeq = 0, icSeq = 0, tcSeq = 0, vrcSeq = 0;
  const nextRC = () => { rcSeq++; return `RC-${String(rcSeq).padStart(5, '0')}`; };
  const nextIC = () => { icSeq++; return `IC-${String(icSeq).padStart(5, '0')}`; };
  const nextTC = () => { tcSeq++; return `TC-${String(tcSeq).padStart(5, '0')}`; };
  const nextVRC = () => { vrcSeq++; return `VRC-${String(vrcSeq).padStart(5, '0')}`; };

  const deptBalance = new Map<string, number>();
  const getBalKey = (itemId: number, deptId: number) => `${itemId}-${deptId}`;

  // ===== 1. CREATE VENDORS =====
  const vendorData = [
    { name: 'à¤¶à¥à¤°à¥€ à¤°à¤¾à¤§à¤¾ à¤•à¥ƒà¤·à¥à¤£ à¤‡à¤²à¥‡à¤•à¥à¤Ÿà¥à¤°à¤¿à¤•à¤²à¥à¤¸', contactPerson: 'à¤°à¤¾à¤®à¤šà¤‚à¤¦à¥à¤° à¤¶à¤°à¥à¤®à¤¾', phone: '9829012345', address: 'à¤œà¤¯à¤ªà¥à¤°, à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨', gstNumber: '08AABCS1234F1Z5' },
    { name: 'à¤®à¤¹à¤¾à¤µà¥€à¤° à¤¸à¥à¤Ÿà¥€à¤² à¤à¤‚à¤¡ à¤ªà¤¾à¤‡à¤ªà¥à¤¸', contactPerson: 'à¤®à¤¹à¥‡à¤¶ à¤œà¥ˆà¤¨', phone: '9829054321', address: 'à¤•à¥‹à¤Ÿà¤¾, à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨', gstNumber: '08BBCMS5678G1Z3' },
    { name: 'à¤¬à¤¿à¤¹à¤¾à¤°à¥€ à¤²à¤¾à¤² à¤à¤‚à¤¡ à¤¸à¤‚à¤¸', contactPerson: 'à¤¬à¤¿à¤¹à¤¾à¤°à¥€ à¤²à¤¾à¤² à¤…à¤—à¥à¤°à¤µà¤¾à¤²', phone: '9414011111', address: 'à¤­à¤°à¤¤à¤ªà¥à¤°, à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨', gstNumber: '08CCCBS9012H1Z1' },
    { name: 'à¤œà¥ˆà¤¨ à¤Ÿà¥à¤°à¥‡à¤¡à¤¿à¤‚à¤— à¤•à¤‚à¤ªà¤¨à¥€', contactPerson: 'à¤¸à¥à¤¨à¥€à¤² à¤œà¥ˆà¤¨', phone: '9828022222', address: 'à¤‰à¤¦à¤¯à¤ªà¥à¤°, à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨', gstNumber: '08DDDCT3456J1Z7' },
    { name: 'à¤¶à¥à¤°à¥€ à¤—à¤£à¥‡à¤¶ à¤‡à¤²à¥‡à¤•à¥à¤Ÿà¥à¤°à¤¿à¤•à¤²à¥à¤¸', contactPerson: 'à¤—à¤£à¥‡à¤¶ à¤²à¤¾à¤²', phone: '9799033333', address: 'à¤œà¥‹à¤§à¤ªà¥à¤°, à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨', gstNumber: '08EEECG7890K1Z5' },
    { name: 'à¤¶à¥à¤°à¥€ à¤•à¥ƒà¤·à¥à¤£ à¤¬à¤¿à¤²à¥à¤¡à¤¿à¤‚à¤— à¤®à¤Ÿà¥‡à¤°à¤¿à¤¯à¤²à¥à¤¸', contactPerson: 'à¤•à¥ƒà¤·à¥à¤£ à¤•à¥à¤®à¤¾à¤°', phone: '9829066666', address: 'à¤…à¤œà¤®à¥‡à¤°, à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨', gstNumber: '08FFFCR1122L1Z9' },
    { name: 'à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨ à¤‡à¤²à¥‡à¤•à¥à¤Ÿà¥à¤°à¤¿à¤•à¤² à¤•à¥‰à¤°à¥à¤ªà¥‹à¤°à¥‡à¤¶à¤¨', contactPerson: 'à¤µà¤¿à¤¨à¥‹à¤¦ à¤¶à¤°à¥à¤®à¤¾', phone: '9414077777', address: 'à¤¬à¥€à¤•à¤¾à¤¨à¥‡à¤°, à¤°à¤¾à¤œà¤¸à¥à¤¥à¤¾à¤¨', gstNumber: '08GGGCI3344M1Z3' },
  ];

  const vendors = [];
  for (const v of vendorData) {
    const vendor = await prisma.vendor.create({ data: v });
    vendors.push(vendor);
  }
  logs.push(`${vendors.length} Vendors`);

  // ===== 2. CREATE 28 RECEIPT CHALLANS (Purchase into Stores) =====
  // Spread across FY 2025-26 (Apr 2025 - Mar 2026)
  const receiptDates = [
    // April 2025 (4 receipts)
    new Date('2025-04-03'), new Date('2025-04-10'), new Date('2025-04-18'), new Date('2025-04-25'),
    // May 2025 (3)
    new Date('2025-05-05'), new Date('2025-05-15'), new Date('2025-05-28'),
    // June 2025 (3)
    new Date('2025-06-06'), new Date('2025-06-18'), new Date('2025-06-28'),
    // July 2025 (2)
    new Date('2025-07-08'), new Date('2025-07-22'),
    // August 2025 (3)
    new Date('2025-08-04'), new Date('2025-08-16'), new Date('2025-08-28'),
    // September 2025 (2)
    new Date('2025-09-08'), new Date('2025-09-22'),
    // October 2025 (2)
    new Date('2025-10-06'), new Date('2025-10-20'),
    // November 2025 (2)
    new Date('2025-11-05'), new Date('2025-11-18'),
    // December 2025 (2)
    new Date('2025-12-04'), new Date('2025-12-19'),
    // January 2026 (2)
    new Date('2026-01-08'), new Date('2026-01-22'),
    // February 2026 (2)
    new Date('2026-02-05'), new Date('2026-02-19'),
    // March 2026 (2)
    new Date('2026-03-05'), new Date('2026-03-20'),
  ];

  // Track receipt numbers per store for realistic invoice numbering
  const storeInvoiceCounters = new Map<number, number>();

  for (let i = 0; i < 28; i++) {
    const storeDept = storeDepts[i % storeDepts.length];
    const vendor = vendors[i % vendors.length];
    const challanNo = nextRC();
    const date = receiptDates[i];

    // Per-store invoice counter
    const invCount = (storeInvoiceCounters.get(storeDept.id) || 0) + 1;
    storeInvoiceCounters.set(storeDept.id, invCount);

    // Pick items with good variety - rotate through items, ensuring category match
    const storeCategoryId = storeDept.id;
    const categoryItems = items.filter((it: any) => it.category?.departmentId === storeCategoryId);
    const otherItems = items.filter((it: any) => it.category?.departmentId !== storeCategoryId);
    // Mix 70% from store category, 30% from others
    const itemCount = rand(3, 6);
    const mainCount = Math.ceil(itemCount * 0.7);
    const otherCount = itemCount - mainCount;
    const mainItems = categoryItems.slice((i * 2) % Math.max(categoryItems.length, 1), ((i * 2) % Math.max(categoryItems.length, 1)) + mainCount).filter(Boolean);
    const otherItemsPicked = otherItems.slice((i * 3) % Math.max(otherItems.length, 1), ((i * 3) % Math.max(otherItems.length, 1)) + otherCount).filter(Boolean);
    const rcItems = [...mainItems, ...otherItemsPicked].slice(0, itemCount);
    if (rcItems.length === 0) continue;

    const rateRanges: Record<string, [number, number]> = {
      'बिजली स्टोर': [80, 800],
      'इमारत स्टोर': [50, 600],
      'जनरल स्टोर': [20, 300],
      'सामान्य': [30, 400],
    };
    const [minRate, maxRate] = rateRanges[storeDept.name] || [50, 500];

    const receiptItems = rcItems.map((item, idx) => {
      const qty = rand(5, 50);
      const rate = rand(minRate, maxRate);
      return {
        itemId: item.id,
        unitId: item.unitId,
        quantity: new Prisma.Decimal(qty),
        rate: new Prisma.Decimal(rate),
        amount: new Prisma.Decimal(qty * rate),
        remarks: `${storeDept.name} à¤¹à¥‡à¤¤à¥ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤à¤¿`,
      };
    });

    const rc = await prisma.receiptChallan.create({
      data: {
        challanNo, companyId, financialYearId, date,
        sourceType: 'Vendor', vendorId: vendor.id, sourceName: vendor.name,
        invoiceNumber: `INV-${date.getFullYear()}${String(invCount).padStart(3, '0')}`,
        invoiceDate: date,
        vehicleNumber: `RJ${14 + (i % 5)}${String.fromCharCode(65 + (i % 26))}${1000 + i}`,
        receivedBy: pick(['à¤°à¤¾à¤®à¤šà¤‚à¤¦à¥à¤° à¤œà¥€', 'à¤¸à¥à¤°à¥‡à¤¶ à¤œà¥€', 'à¤•à¤®à¤²à¥‡à¤¶ à¤œà¥€', 'à¤°à¤®à¥‡à¤¶ à¤œà¥€']),
        departmentId: storeDept.id,
        remarks: `${vendor.name} à¤¸à¥‡ ${storeDept.name} à¤¹à¥‡à¤¤à¥ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤à¤¿`,
        items: { create: receiptItems },
      },
    });

    // Post: create stock transactions
    const stockTxns = receiptItems.map((ri) => {
      const qty = Number(ri.quantity);
      const key = getBalKey(ri.itemId, storeDept.id);
      const prevBalance = deptBalance.get(key) || 0;
      const newBalance = prevBalance + qty;
      deptBalance.set(key, newBalance);

      return {
        companyId, financialYearId, itemId: ri.itemId, departmentId: storeDept.id,
        transactionType: 'RECEIPT', transactionDate: date,
        quantityIn: ri.quantity, quantityOut: new Prisma.Decimal(0),
        rate: ri.rate, balanceQty: new Prisma.Decimal(newBalance),
        referenceType: 'ReceiptChallan', referenceId: rc.id, referenceNo: challanNo,
        remarks: `${challanNo} à¤¸à¥‡ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤à¤¿ - ${vendor.name}`, createdBy: 'Demo',
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.stockTransaction.createMany({ data: stockTxns });
      await tx.receiptChallan.update({
        where: { id: rc.id },
        data: { status: 'Posted', postedAt: date, postedBy: 'Demo' },
      });
    });
    logs.push(`Receipt ${challanNo}: ${rcItems.length} items â†’ ${storeDept.name} (${date.toLocaleDateString('en-IN')})`);
  }

  // ===== 4. CREATE 18 ISSUE CHALLANS (Store â†’ Dharamshala Room) =====
  const issueDates = [
    // April 2025 (2)
    new Date('2025-04-12'), new Date('2025-04-28'),
    // May 2025 (2)
    new Date('2025-05-10'), new Date('2025-05-25'),
    // June 2025 (2)
    new Date('2025-06-08'), new Date('2025-06-22'),
    // July 2025 (2)
    new Date('2025-07-05'), new Date('2025-07-20'),
    // August 2025 (2)
    new Date('2025-08-08'), new Date('2025-08-22'),
    // September 2025 (2)
    new Date('2025-09-05'), new Date('2025-09-20'),
    // October 2025 (2)
    new Date('2025-10-10'), new Date('2025-10-25'),
    // November 2025 (2)
    new Date('2025-11-08'), new Date('2025-11-22'),
    // December 2025 (1)
    new Date('2025-12-10'),
    // January 2026 (1)
    new Date('2026-01-15'),
  ];

  const dhLocMap = new Map<number, number>();
  for (const dept of dharamshalaDepts) {
    const loc = await prisma.location.findFirst({
      where: { locationType: 'Dharamshala', locationName: dept.name },
    });
    if (loc) dhLocMap.set(dept.id, loc.id);
  }

  const purposes = [
    'à¤°à¤–à¤°à¤–à¤¾à¤µ à¤à¤µà¤‚ à¤®à¤°à¤®à¥à¤®à¤¤', 'à¤¨à¤µà¥€à¤¨à¥€à¤•à¤°à¤£ à¤•à¤¾à¤°à¥à¤¯', 'à¤¤à¥à¤¯à¥‹à¤¹à¤¾à¤° à¤•à¥€ à¤¤à¥ˆà¤¯à¤¾à¤°à¥€',
    'à¤…à¤¤à¤¿à¤¥à¤¿ à¤•à¤•à¥à¤· à¤•à¥€ à¤¸à¤œà¤¾à¤µà¤Ÿ', 'à¤¬à¤¿à¤œà¤²à¥€ à¤•à¥€ à¤®à¤°à¤®à¥à¤®à¤¤', 'à¤ªà¥à¤²à¤‚à¤¬à¤¿à¤‚à¤— à¤•à¤¾à¤°à¥à¤¯',
    'à¤ªà¥‡à¤‚à¤Ÿà¤¿à¤‚à¤— à¤à¤µà¤‚ à¤¸à¤œà¤¾à¤µà¤Ÿ', 'à¤¨à¤ à¤•à¤®à¤°à¥‡ à¤•à¤¾ à¤‰à¤ªà¤•à¤°à¤£', 'à¤®à¤‚à¤¦à¤¿à¤° à¤°à¤–à¤°à¤–à¤¾à¤µ',
  ];

  for (let i = 0; i < 18; i++) {
    const storeDept = storeDepts[i % storeDepts.length];
    const dhDept = dharamshalaDepts[i % dharamshalaDepts.length];
    const challanNo = nextIC();
    const date = issueDates[i];

    const dhLocId = dhLocMap.get(dhDept.id);
    let roomLocId: number | null = null;
    if (dhLocId) {
      const rooms = await prisma.location.findMany({
        where: { parentId: dhLocId, locationType: 'Room' },
      });
      if (rooms.length > 0) roomLocId = rooms[i % rooms.length].id;
    }

    // Pick items that have stock in this store
    const availableItems = items.filter(item => {
      const key = getBalKey(item.id, storeDept.id);
      return (deptBalance.get(key) || 0) > 0;
    });

    if (availableItems.length === 0) continue;

    const itemCount = Math.min(rand(2, 4), availableItems.length);
    // Pick random items from available
    const shuffled = [...availableItems].sort(() => Math.random() - 0.5);
    const icItems = shuffled.slice(0, itemCount);

    const issueItems = icItems.map((item, idx) => {
      const key = getBalKey(item.id, storeDept.id);
      const available = deptBalance.get(key) || 0;
      const qty = Math.min(rand(1, Math.min(8, available)), available);
      return {
        itemId: item.id, unitId: item.unitId,
        quantity: new Prisma.Decimal(qty),
        locationId: roomLocId,
        usedAt: roomLocId ? `${dhDept.name} - Room` : dhDept.name,
        purpose: pick(purposes),
        remarks: `${dhDept.name} à¤¹à¥‡à¤¤à¥ à¤µà¤¿à¤¤à¤°à¤£`,
      };
    });

    const ic = await prisma.issueChallan.create({
      data: {
        challanNo, companyId, financialYearId, departmentId: dhDept.id,
        sourceStoreId: storeDept.id,
        date, issuedBy: pick(['à¤¸à¥à¤°à¥‡à¤¶ à¤œà¥€', 'à¤°à¤®à¥‡à¤¶ à¤œà¥€', 'à¤•à¤®à¤²à¥‡à¤¶ à¤œà¥€']),
        approvedBy: 'à¤ªà¥à¤°à¤¬à¤‚à¤§à¤• à¤œà¥€',
        purpose: pick(purposes),
        remarks: `${dhDept.name} à¤®à¥‡à¤‚ ${storeDept.name} à¤¸à¥‡ à¤µà¤¿à¤¤à¤°à¤£`,
        items: { create: issueItems },
      },
    });

    const stockTxns = issueItems.map((ii) => {
      const qty = Number(ii.quantity);
      const key = getBalKey(ii.itemId, storeDept.id);
      const prevBalance = deptBalance.get(key) || 0;
      const newBalance = prevBalance - qty;
      deptBalance.set(key, newBalance);

      return {
        companyId, financialYearId, itemId: ii.itemId, departmentId: dhDept.id,
        transactionType: 'ISSUE', transactionDate: date,
        quantityIn: new Prisma.Decimal(0), quantityOut: ii.quantity,
        rate: new Prisma.Decimal(0), balanceQty: new Prisma.Decimal(newBalance),
        referenceType: 'IssueChallan', referenceId: ic.id, referenceNo: challanNo,
        remarks: `${challanNo} à¤¸à¥‡ à¤µà¤¿à¤¤à¤°à¤£ - ${dhDept.name}`, createdBy: 'Demo',
        locationId: roomLocId || undefined,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.stockTransaction.createMany({ data: stockTxns });
      await tx.issueChallan.update({
        where: { id: ic.id },
        data: { status: 'Posted', postedAt: date, postedBy: 'Demo' },
      });
    });
    logs.push(`Issue ${challanNo}: ${icItems.length} items â†’ ${dhDept.name}${roomLocId ? ' (Room)' : ''} (${date.toLocaleDateString('en-IN')})`);
  }

  // ===== 5. CREATE ASSET INSTALLATIONS =====
  const installDates = [
    new Date('2025-04-15'), new Date('2025-05-12'), new Date('2025-06-01'),
    new Date('2025-06-25'), new Date('2025-07-15'), new Date('2025-08-10'),
    new Date('2025-09-05'),
  ];

  const installableItems = items.filter(i =>
    ['à¤ªà¤‚à¤–à¤¾', 'à¤¬à¤²à¥à¤¬', 'à¤à¤²à¤ˆà¤¡à¥€ à¤¬à¤²à¥à¤¬', 'à¤à¤²à¤ˆà¤¡à¥€ à¤Ÿà¥à¤¯à¥‚à¤¬ à¤²à¤¾à¤‡à¤Ÿ', 'à¤¸à¥à¤µà¤¿à¤š à¤¬à¥‹à¤°à¥à¤¡', 'à¤¸à¤°à¥à¤•à¤¿à¤Ÿ à¤¬à¥à¤°à¥‡à¤•à¤°', 'à¤à¤®à¤¸à¥€à¤¬à¥€', 'à¤¸à¥€à¤¸à¥€à¤Ÿà¥€à¤µà¥€ à¤•à¥ˆà¤®à¤°à¤¾', 'à¤°à¤¾à¤‰à¤Ÿà¤°', 'à¤µà¥‰à¤Ÿà¤° à¤ªà¥à¤¯à¥‚à¤°à¥€à¤«à¤¾à¤¯à¤°'].includes(i.itemName)
  );

  const roomLocations = await prisma.location.findMany({ where: { locationType: 'Room' } });
  const roomLocationIds = roomLocations.map(r => r.id);

  if (installableItems.length > 0 && roomLocationIds.length > 0) {
    for (let i = 0; i < Math.min(7, installableItems.length); i++) {
      const item = installableItems[i];
      const roomLocId = roomLocationIds[i % roomLocationIds.length];

      await prisma.assetInstallation.create({
        data: {
          itemId: item.id, locationId: roomLocId,
          installedDate: installDates[i],
          quantity: new Prisma.Decimal(rand(1, 4)),
          installedBy: pick(['à¤°à¤¾à¤®à¤šà¤‚à¤¦à¥à¤° à¤œà¥€', 'à¤¸à¥à¤°à¥‡à¤¶ à¤œà¥€']),
          status: i < 5 ? 'Active' : 'Inactive',
          remarks: `à¤¡à¥‡à¤®à¥‹ à¤¸à¥à¤¥à¤¾à¤ªà¤¨à¤¾ - ${item.itemName}`,
        },
      });
    }
    logs.push(`${Math.min(7, installableItems.length)} Asset Installations`);
  }

  // ===== 6. CREATE DAMAGE ENTRIES =====
  const damageDates = [
    new Date('2025-05-05'), new Date('2025-06-10'), new Date('2025-07-05'),
    new Date('2025-08-12'), new Date('2025-09-15'),
  ];
  const reasons = ['à¤Ÿà¥‚à¤Ÿ à¤—à¤¯à¤¾', 'à¤–à¤°à¤¾à¤¬ à¤¹à¥‹ à¤—à¤¯à¤¾', 'à¤ªà¥à¤°à¤¾à¤¨à¤¾ à¤¹à¥‹ à¤—à¤¯à¤¾', 'à¤ªà¤¾à¤¨à¥€ à¤¸à¥‡ à¤–à¤°à¤¾à¤¬', 'à¤¬à¤¿à¤œà¤²à¥€ à¤•à¤¾ à¤à¤Ÿà¤•à¤¾'];
  const damageableItems = items.filter(i =>
    ['à¤ªà¤‚à¤–à¤¾', 'à¤¬à¤²à¥à¤¬', 'à¤à¤²à¤ˆà¤¡à¥€ à¤¬à¤²à¥à¤¬', 'à¤¸à¥à¤µà¤¿à¤š', 'à¤¸à¥‰à¤•à¥‡à¤Ÿ', 'à¤¤à¤¾à¤°', 'à¤•à¥‡à¤¬à¤²', 'à¤¸à¥€à¤®à¥‡à¤‚à¤Ÿ', 'à¤Ÿà¤¾à¤‡à¤²', 'à¤ªà¥‡à¤‚à¤Ÿ'].includes(i.itemName)
  );

  for (let i = 0; i < Math.min(5, damageableItems.length); i++) {
    const item = damageableItems[i];
    const roomLocId = roomLocationIds[i % roomLocationIds.length];

    await prisma.damageEntry.create({
      data: {
        companyId, itemId: item.id, locationId: roomLocId,
        date: damageDates[i],
        quantity: new Prisma.Decimal(rand(1, 3)),
        reason: reasons[i], reportedBy: pick(['à¤•à¤®à¤²à¥‡à¤¶ à¤œà¥€', 'à¤°à¤®à¥‡à¤¶ à¤œà¥€', 'à¤¸à¥à¤°à¥‡à¤¶ à¤œà¥€']),
        remarks: `à¤¡à¥‡à¤®à¥‹ à¤•à¥à¤·à¤¤à¤¿ - ${reasons[i]}`, status: 'Posted',
      },
    });
  }
  logs.push(`${Math.min(5, damageableItems.length)} Damage Entries`);

  // ===== 7. CREATE 6 TRANSFER CHALLANS =====
  const transferDates = [
    new Date('2025-05-15'), new Date('2025-06-20'), new Date('2025-07-30'),
    new Date('2025-08-20'), new Date('2025-10-15'), new Date('2025-12-05'),
  ];

  for (let i = 0; i < 6; i++) {
    const fromDept = storeDepts[i % storeDepts.length];
    const toDept = departments[(i + 3) % departments.length];
    if (fromDept.id === toDept.id) continue;

    const challanNo = nextTC();
    const tcStartIdx = (i * 3) % items.length;
    const tcItemCount = rand(2, 3);
    const tcItems = [];
    for (let j = 0; j < tcItemCount; j++) {
      tcItems.push(items[(tcStartIdx + j) % items.length]);
    }
    const transferItems = tcItems.map((item) => ({
      itemId: item.id, quantity: new Prisma.Decimal(rand(2, 8)),
      rate: new Prisma.Decimal(rand(100, 350)), remarks: 'à¤¡à¥‡à¤®à¥‹ à¤¸à¥à¤¥à¤¾à¤¨à¤¾à¤‚à¤¤à¤°à¤£',
    }));

    const tc = await prisma.transferChallan.create({
      data: {
        challanNo, companyId, financialYearId, date: transferDates[i],
        fromDepartmentId: fromDept.id, toDepartmentId: toDept.id,
        transferredBy: pick(['à¤°à¤®à¥‡à¤¶ à¤œà¥€', 'à¤¸à¥à¤°à¥‡à¤¶ à¤œà¥€']),
        approvedBy: 'à¤ªà¥à¤°à¤¬à¤‚à¤§à¤• à¤œà¥€',
        remarks: `${fromDept.name} â†’ ${toDept.name} à¤¸à¥à¤¥à¤¾à¤¨à¤¾à¤‚à¤¤à¤°à¤£`,
        items: { create: transferItems },
      },
    });

    const tcStockTxns: any[] = [];
    for (const ti of transferItems) {
      const qty = Number(ti.quantity);
      const fromKey = getBalKey(ti.itemId, fromDept.id);
      const prevFromBalance = deptBalance.get(fromKey) || 0;
      const newFromBalance = prevFromBalance - qty;
      deptBalance.set(fromKey, newFromBalance);

      const toKey = getBalKey(ti.itemId, toDept.id);
      const prevToBalance = deptBalance.get(toKey) || 0;
      const newToBalance = prevToBalance + qty;
      deptBalance.set(toKey, newToBalance);

      tcStockTxns.push(
        {
          companyId, financialYearId, itemId: ti.itemId, departmentId: fromDept.id,
          transactionType: 'TRANSFER_OUT', transactionDate: transferDates[i],
          quantityIn: new Prisma.Decimal(0), quantityOut: ti.quantity,
          rate: ti.rate, balanceQty: new Prisma.Decimal(newFromBalance),
          referenceType: 'TransferChallan', referenceId: tc.id, referenceNo: challanNo,
          remarks: `${challanNo} à¤¸à¥à¤¥à¤¾à¤¨à¤¾à¤‚à¤¤à¤°à¤£ - ${fromDept.name} à¤¸à¥‡ à¤­à¥‡à¤œà¤¾`, createdBy: 'Demo',
        },
        {
          companyId, financialYearId, itemId: ti.itemId, departmentId: toDept.id,
          transactionType: 'TRANSFER_IN', transactionDate: transferDates[i],
          quantityIn: ti.quantity, quantityOut: new Prisma.Decimal(0),
          rate: ti.rate, balanceQty: new Prisma.Decimal(newToBalance),
          referenceType: 'TransferChallan', referenceId: tc.id, referenceNo: challanNo,
          remarks: `${challanNo} à¤¸à¥à¤¥à¤¾à¤¨à¤¾à¤‚à¤¤à¤°à¤£ - ${toDept.name} à¤®à¥‡à¤‚ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤`, createdBy: 'Demo',
        }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTransaction.createMany({ data: tcStockTxns });
      await tx.transferChallan.update({
        where: { id: tc.id },
        data: { status: 'Posted', postedAt: transferDates[i], postedBy: 'Demo' },
      });
    });
    logs.push(`Transfer ${challanNo}: ${transferItems.length} items ${fromDept.name} â†’ ${toDept.name}`);
  }

  // ===== 8. CREATE 4 VENDOR RETURNS =====
  const returnDates = [
    new Date('2025-06-25'), new Date('2025-08-15'),
    new Date('2025-10-10'), new Date('2025-12-20'),
  ];

  for (let i = 0; i < 4; i++) {
    const vendor = vendors[i % vendors.length];
    const challanNo = nextVRC();
    const vrcStartIdx = (i * 4) % items.length;
    const vrcItemCount = rand(1, 3);
    const vrcItems = [];
    for (let j = 0; j < vrcItemCount; j++) {
      vrcItems.push(items[(vrcStartIdx + j) % items.length]);
    }
    const returnItems = vrcItems.map((item) => ({
      itemId: item.id, quantity: new Prisma.Decimal(rand(1, 5)),
      rate: new Prisma.Decimal(rand(80, 300)),
    }));

    const vrc = await prisma.vendorReturnChallan.create({
      data: {
        challanNo, companyId, financialYearId, vendorId: vendor.id,
        date: returnDates[i], reason: pick(['à¤–à¤°à¤¾à¤¬ à¤®à¤¾à¤² à¤µà¤¾à¤ªà¤¸à¥€', 'à¤…à¤¤à¤¿à¤°à¤¿à¤•à¥à¤¤ à¤®à¤¾à¤² à¤µà¤¾à¤ªà¤¸à¥€', 'à¤—à¤²à¤¤ à¤®à¤¾à¤² à¤µà¤¾à¤ªà¤¸à¥€']),
        returnedBy: pick(['à¤¸à¥à¤°à¥‡à¤¶ à¤œà¥€', 'à¤°à¤®à¥‡à¤¶ à¤œà¥€']),
        remarks: `${vendor.name} à¤•à¥‹ à¤µà¤¾à¤ªà¤¸à¥€`,
        items: { create: returnItems },
      },
    });

    const stockTxns = returnItems.map((ri) => {
      const key = getBalKey(ri.itemId, storeDepts[0].id);
      const prevBalance = deptBalance.get(key) || 0;
      const newBalance = prevBalance - Number(ri.quantity);
      deptBalance.set(key, newBalance);
      return {
        companyId, financialYearId, itemId: ri.itemId, departmentId: storeDepts[0].id,
        transactionType: 'VENDOR_RETURN', transactionDate: returnDates[i],
        quantityIn: new Prisma.Decimal(0), quantityOut: ri.quantity,
        rate: ri.rate, balanceQty: new Prisma.Decimal(newBalance),
        referenceType: 'VendorReturnChallan', referenceId: vrc.id, referenceNo: challanNo,
        remarks: `à¤µà¤¿à¤•à¥à¤°à¥‡à¤¤à¤¾ à¤•à¥‹ à¤µà¤¾à¤ªà¤¸à¥€ - ${challanNo}`, createdBy: 'Demo',
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.stockTransaction.createMany({ data: stockTxns });
      await tx.vendorReturnChallan.update({
        where: { id: vrc.id },
        data: { status: 'Posted', postedAt: returnDates[i], postedBy: 'Demo' },
      });
    });
    logs.push(`Vendor Return ${challanNo} â†’ ${vendor.name}`);
  }

  // ===== 9. CREATE 6 STOCK ADJUSTMENTS =====
  const adjustmentDates = [
    new Date('2025-06-05'), new Date('2025-07-12'), new Date('2025-08-10'),
    new Date('2025-09-08'), new Date('2025-11-10'), new Date('2026-01-20'),
  ];
  const adjustmentReasons = ['à¤­à¥Œà¤¤à¤¿à¤• à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨', 'à¤¸à¥à¤§à¤¾à¤°', 'à¤¨à¥à¤•à¤¸à¤¾à¤¨ à¤²à¥‡à¤–à¤¨', 'à¤…à¤¤à¤¿à¤°à¤¿à¤•à¥à¤¤ à¤®à¤¿à¤²à¤¾', 'à¤ªà¥à¤°à¤¾à¤¨à¤¾ à¤¸à¥à¤Ÿà¥‰à¤• à¤¹à¤Ÿà¤¾à¤¯à¤¾', 'à¤—à¤£à¤¨à¤¾ à¤®à¥‡à¤‚ à¤¸à¥à¤§à¤¾à¤°'];
  const adjustmentTypes = ['INCREASE', 'DECREASE', 'DECREASE', 'INCREASE', 'DECREASE', 'INCREASE'];

  for (let i = 0; i < 6; i++) {
    const item = items[i % items.length];
    const dept = storeDepts[i % storeDepts.length];

    await prisma.stockAdjustment.create({
      data: {
        companyId, financialYearId, itemId: item.id,
        date: adjustmentDates[i],
        adjustmentType: adjustmentTypes[i],
        quantity: new Prisma.Decimal(rand(1, 8)),
        reason: adjustmentReasons[i],
        adjustedBy: pick(['à¤•à¤®à¤²à¥‡à¤¶ à¤œà¥€', 'à¤°à¤®à¥‡à¤¶ à¤œà¥€', 'à¤¸à¥à¤°à¥‡à¤¶ à¤œà¥€']),
        approvedBy: 'à¤ªà¥à¤°à¤¬à¤‚à¤§à¤• à¤œà¥€',
        remarks: `à¤¡à¥‡à¤®à¥‹ à¤¸à¤®à¤¾à¤¯à¥‹à¤œà¤¨ - ${item.itemName}`,
        status: 'Posted',
      },
    });

    const qty = rand(1, 8);
    const key = getBalKey(item.id, dept.id);
    const prevBalance = deptBalance.get(key) || 0;
    const isIncrease = adjustmentTypes[i] === 'INCREASE';
    const newBalance = isIncrease ? prevBalance + qty : prevBalance - qty;
    deptBalance.set(key, newBalance);

    await prisma.stockTransaction.create({
      data: {
        companyId, financialYearId, itemId: item.id, departmentId: dept.id,
        transactionType: isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        transactionDate: adjustmentDates[i],
        quantityIn: isIncrease ? new Prisma.Decimal(qty) : new Prisma.Decimal(0),
        quantityOut: isIncrease ? new Prisma.Decimal(0) : new Prisma.Decimal(qty),
        rate: new Prisma.Decimal(0),
        balanceQty: new Prisma.Decimal(newBalance),
        referenceType: 'StockAdjustment', referenceId: i + 1, referenceNo: `ADJ-${String(i + 1).padStart(3, '0')}`,
        remarks: `à¤¡à¥‡à¤®à¥‹ à¤¸à¤®à¤¾à¤¯à¥‹à¤œà¤¨ - ${adjustmentReasons[i]}`, createdBy: 'Demo',
      },
    });
  }
  logs.push(`6 Stock Adjustments`);

  return `Demo data loaded successfully!\n\n${logs.join('\n')}`;
}

// ===== CLEAR DEMO DATA =====
export async function clearDemoData(prisma: PrismaClient): Promise<string> {
  const logs: string[] = [];

  // Only delete records marked as Demo (postedBy/createdBy = 'Demo')
  // This preserves all user-created production data

  // 1. Delete demo StockTransactions (created by demo loader)
  const stDeleted = await prisma.stockTransaction.deleteMany({ where: { createdBy: 'Demo' } });
  logs.push(`${stDeleted.count} Stock Transactions`);

  // 2. Delete demo AuditLogs FIRST (before deleting challans, so we can find their IDs)
  const demoRcIds = (await prisma.receiptChallan.findMany({ where: { postedBy: 'Demo' }, select: { id: true } })).map(r => r.id);
  const demoIcIds = (await prisma.issueChallan.findMany({ where: { postedBy: 'Demo' }, select: { id: true } })).map(r => r.id);
  const demoTcIds = (await prisma.transferChallan.findMany({ where: { postedBy: 'Demo' }, select: { id: true } })).map(r => r.id);

  const auditDeleted = (demoRcIds.length + demoIcIds.length + demoTcIds.length) > 0
    ? await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { tableName: 'ReceiptChallan', recordId: { in: demoRcIds } },
            { tableName: 'IssueChallan', recordId: { in: demoIcIds } },
            { tableName: 'TransferChallan', recordId: { in: demoTcIds } },
          ],
        },
      })
    : { count: 0 };
  logs.push(`${auditDeleted.count} Audit Logs`);

  // 3. Delete demo VendorReturnChallans and their items
  const vrcItems = await prisma.vendorReturnChallanItem.deleteMany({
    where: { vendorReturnChallan: { postedBy: 'Demo' } },
  });
  logs.push(`${vrcItems.count} Vendor Return Items`);
  const vrcDeleted = await prisma.vendorReturnChallan.deleteMany({ where: { postedBy: 'Demo' } });
  logs.push(`${vrcDeleted.count} Vendor Return Challans`);

  // 3. Delete demo TransferChallans and their items
  const tcItems = await prisma.transferChallanItem.deleteMany({
    where: { transferChallan: { postedBy: 'Demo' } },
  });
  logs.push(`${tcItems.count} Transfer Items`);
  const tcDeleted = await prisma.transferChallan.deleteMany({ where: { postedBy: 'Demo' } });
  logs.push(`${tcDeleted.count} Transfer Challans`);

  // 4. Delete demo IssueChallans and their items
  const icItems = await prisma.issueChallanItem.deleteMany({
    where: { issueChallan: { postedBy: 'Demo' } },
  });
  logs.push(`${icItems.count} Issue Items`);
  const icDeleted = await prisma.issueChallan.deleteMany({ where: { postedBy: 'Demo' } });
  logs.push(`${icDeleted.count} Issue Challans`);

  // 5. Delete demo ReceiptChallans and their items
  const rcItems = await prisma.receiptChallanItem.deleteMany({
    where: { receiptChallan: { postedBy: 'Demo' } },
  });
  logs.push(`${rcItems.count} Receipt Items`);
  const rcDeleted = await prisma.receiptChallan.deleteMany({ where: { postedBy: 'Demo' } });
  logs.push(`${rcDeleted.count} Receipt Challans`);

  // 6. Delete demo AssetInstallations (installed by demo loader)
  const installDeleted = await prisma.assetInstallation.deleteMany({ where: { installedBy: 'Demo' } });
  logs.push(`${installDeleted.count} Asset Installations`);

  // 7. DamageEntries — no createdBy marker, skip to preserve user data
  //    (their StockTransactions are already deleted above)
  logs.push('0 Damage Entries (skipped — no demo marker)');

  // 8. StockAdjustments — no createdBy marker, skip to preserve user data
  //    (their StockTransactions are already deleted above)
  logs.push('0 Stock Adjustments (skipped — no demo marker)');

  // 9. Delete demo Vendors (only if ALL vendors are demo — skip if user has real vendors)
  // Vendors don't have a createdBy marker, so we only delete if they were created by demo
  // Check: if the vendor count matches the demo vendor count (7), delete all
  // Otherwise, skip vendor deletion to be safe
  const vendorCount = await prisma.vendor.count();
  if (vendorCount <= 7) {
    // Likely all demo vendors — check if any have real-looking names
    const vendors = await prisma.vendor.findMany({ select: { name: true } });
    const demoNames = ['राज ट्रेडर्स', 'श्री गणेश एंटरप्राइजेज', 'महावीर सप्लाईज', 'जैन ट्रेडिंग कंपनी', 'अग्रवाल स्टोर्स', 'बंसल एंड कंपनी', 'गोयल ट्रेडर्स'];
    const allDemo = vendors.every(v => demoNames.includes(v.name));
    if (allDemo) {
      const vendorDeleted = await prisma.vendor.deleteMany();
      logs.push(`${vendorDeleted.count} Vendors`);
    } else {
      logs.push('0 Vendors (skipped — contains non-demo vendors)');
    }
  } else {
    logs.push('0 Vendors (skipped — more than 7 vendors found)');
  }

  return `Demo data cleared!\n\n${logs.join('\n')}`;
}
