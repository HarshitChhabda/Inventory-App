import { PrismaClient } from '@prisma/client';
import { DEMO_DHARAMSHALAS } from './demo-data-rooms';
import { hashPassword } from '../services/auth.service';

const DEFAULT_CATEGORIES = [
  { name: 'बिजली स्टोर', prefix: 'BL' },
  { name: 'इमारत स्टोर', prefix: 'IM' },
  { name: 'जर्नल स्टोर', prefix: 'JS' },
  { name: 'सामान्य', prefix: 'GEN' },
];

const DEFAULT_DEPARTMENTS = [
  { name: 'बिजली स्टोर', departmentType: 'Store' },
  { name: 'इमारत स्टोर', departmentType: 'Store' },
  { name: 'जर्नल स्टोर', departmentType: 'Store' },
  { name: 'लाला उमराव सिह जैन', departmentType: 'Dharamshala' },
  { name: 'श्री दिगंबर जैन अतिशय क्षेत्र', departmentType: 'Dharamshala' },
  { name: 'अतिवीर अतिथि गृह', departmentType: 'Dharamshala' },
  { name: 'अतिवीर गेस्ट हाउस', departmentType: 'Dharamshala' },
  { name: 'कटला उत्तरी विंग', departmentType: 'Dharamshala' },
  { name: 'कटला चांदनी', departmentType: 'Dharamshala' },
  { name: 'कटला दक्षिण विंग', departmentType: 'Dharamshala' },
  { name: 'कटला पश्चिम विंग', departmentType: 'Dharamshala' },
  { name: 'कटला पूर्वी विंग', departmentType: 'Dharamshala' },
  { name: 'कटला रथखाना', departmentType: 'Dharamshala' },
  { name: 'कुन्द कुन्द निलय', departmentType: 'Dharamshala' },
  { name: 'चरण चिन्ह्', departmentType: 'Dharamshala' },
  { name: 'बाजार बी ब्लाक', departmentType: 'Dharamshala' },
  { name: 'राष्ट्रपति भवन', departmentType: 'Dharamshala' },
  { name: 'वर्धमान', departmentType: 'Dharamshala' },
  { name: 'वर्धमान गेस्ट हाउस', departmentType: 'Dharamshala' },
  { name: 'वैशाली यात्री निवास', departmentType: 'Dharamshala' },
  { name: 'सन्मति', departmentType: 'Dharamshala' },
  { name: 'मंदिर', departmentType: 'Dharamshala' },
  { name: 'धर्मशाला', departmentType: 'Dharamshala' },
  { name: 'भोजनशाला', departmentType: 'Dharamshala' },
  { name: 'जल प्लांट', departmentType: 'Dharamshala' },
];

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  const existingCompany = await prisma.company.findFirst();
  if (existingCompany) {
    console.log('[seed] Database already seeded, skipping.');
    return;
  }

  console.log('[seed] Seeding database...');

  const company = await prisma.company.create({
    data: { name: 'श्री महावीरजी' },
  });

  const now = new Date();
  const fyStart = new Date(now.getFullYear(), 3, 1);
  if (now.getMonth() < 3) fyStart.setFullYear(fyStart.getFullYear() - 1);
  const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31);
  const fyLabel = `${fyStart.getFullYear()}-${String(fyStart.getFullYear() + 1).slice(-2)}`;

  await prisma.financialYear.create({
    data: { companyId: company.id, label: fyLabel, startDate: fyStart, endDate: fyEnd },
  });

  for (const c of DEFAULT_CATEGORIES) {
    await prisma.itemCategory.upsert({
      where: { name: c.name },
      update: { prefix: c.prefix },
      create: { name: c.name, prefix: c.prefix },
    });
  }

  for (const d of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name: d.name } },
      update: {},
      create: { name: d.name, companyId: company.id, departmentType: d.departmentType },
    });
  }

  // Seed Locations (Dharamshalas + Rooms) - permanent, not cleared with demo data
  const existingLocations = await prisma.location.count();
  if (existingLocations === 0) {
    let roomCount = 0;
    for (const dh of DEMO_DHARAMSHALAS) {
      if (!dh) continue;
      const dhLoc = await prisma.location.create({
        data: { locationType: 'Dharamshala', locationName: dh.name, isActive: true },
      });
      for (const room of dh.rooms) {
        if (!room) continue;
        await prisma.location.create({
          data: {
            locationType: 'Room', locationName: room.name,
            floor: room.floor, category: room.category,
            parentId: dhLoc.id, isActive: true,
          },
        });
        roomCount++;
      }
    }
    console.log(`[seed] Seeded: ${DEMO_DHARAMSHALAS.length} Dharamshalas + ${roomCount} Rooms`);
  }

  // Seed default Admin user (change password on first login!)
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        fullName: 'Administrator',
        role: 'ADMIN',
        permissions: '[]',
        isActive: true,
      },
    });
    console.log('[seed] Created default admin user (username: admin, password: admin123 — CHANGE ON FIRST LOGIN)');
  }

  console.log(`[seed] Seeded: 1 company, 1 FY (${fyLabel}), ${DEFAULT_CATEGORIES.length} categories, ${DEFAULT_DEPARTMENTS.length} departments.`);
}
