import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma.client';
import { formatDateDDMMYYYY } from '../../shared/dateUtils';

export interface SearchResult {
  type: string;
  id: number;
  code: string;
  name: string;
  subtitle: string;
  route: string;
}

export class GlobalSearchService {
  private static get prisma(): PrismaClient {
    return getPrismaClient();
  }

  static async search(companyId: number, query: string, limit: number = 50): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // Get store IDs for this company
    const storeIds = (await this.prisma.store.findMany({ where: { companyId }, select: { id: true } })).map(s => s.id);
    const locationIds = (await this.prisma.location.findMany({ where: { storeId: { in: storeIds } }, select: { id: true } })).map(l => l.id);
    const roomIds = (await this.prisma.room.findMany({ where: { locationId: { in: locationIds } }, select: { id: true } })).map(r => r.id);

    const [items, assets, stores, departments, locations, rooms, vendors, transactions, serviceRequests, purchaseOrders] = await Promise.all([
      this.prisma.item.findMany({
        where: { OR: [{ itemName: { contains: q } }, { itemCode: { contains: q } }, { barcode: { contains: q } }] },
        take: limit,
      }),
      this.prisma.assetProfile.findMany({
        where: { companyId, OR: [{ assetName: { contains: q } }, { assetCode: { contains: q } }, { serialNumber: { contains: q } }, { barcode: { contains: q } }] },
        take: limit,
      }),
      this.prisma.store.findMany({
        where: { companyId, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
        take: limit,
      }),
      this.prisma.department.findMany({
        where: { companyId, name: { contains: q } },
        take: limit,
      }),
      this.prisma.location.findMany({
        where: { storeId: { in: storeIds }, name: { contains: q } },
        take: limit,
      }),
      this.prisma.room.findMany({
        where: { locationId: { in: locationIds }, name: { contains: q } },
        take: limit,
      }),
      this.prisma.vendor.findMany({
        where: { companyId, OR: [{ vendorName: { contains: q } }, { vendorCode: { contains: q } }] },
        take: limit,
      }),
      this.prisma.transactionHeader.findMany({
        where: { companyId, OR: [{ voucherNo: { contains: q } }, { remarks: { contains: q } }] },
        take: limit,
      }),
      this.prisma.serviceRequest.findMany({
        where: { companyId, OR: [{ requestNumber: { contains: q } }, { issueDescription: { contains: q } }] },
        take: limit,
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId, OR: [{ poNumber: { contains: q } }] },
        take: limit,
      }),
    ]);

    for (const i of items) results.push({ type: 'Item', id: i.id, code: i.itemCode, name: i.itemName, subtitle: i.itemCode, route: '/items' });
    for (const a of assets) results.push({ type: 'Asset', id: a.id, code: a.assetCode, name: a.assetName, subtitle: `${a.assetCode} | ${a.status}`, route: '/assets/registry' });
    for (const s of stores) results.push({ type: 'Store', id: s.id, code: (s as any).code || '', name: (s as any).name, subtitle: (s as any).code || '', route: '/enterprise/stores' });
    for (const d of departments) results.push({ type: 'Department', id: d.id, code: '', name: d.name, subtitle: 'Department', route: '/enterprise/stores' });
    for (const l of locations) results.push({ type: 'Dharmshala', id: l.id, code: '', name: l.name, subtitle: 'Location', route: '/enterprise/stores' });
    for (const r of rooms) results.push({ type: 'Room', id: r.id, code: '', name: r.name, subtitle: (r as any).code || '', route: '/assets/installations' });
    for (const v of vendors) results.push({ type: 'Vendor', id: v.id, code: v.vendorCode, name: v.vendorName, subtitle: v.vendorCode || '', route: '/procurement/vendors' });
    for (const t of transactions) results.push({ type: 'Transaction', id: t.id, code: t.voucherNo, name: t.voucherNo, subtitle: `${t.voucherType} | ${formatDateDDMMYYYY(t.transactionDate)}`, route: '/challans/issue' });
    for (const sr of serviceRequests) results.push({ type: 'Service Request', id: sr.id, code: sr.requestNumber, name: sr.requestNumber, subtitle: `${sr.serviceType} | ${sr.status}`, route: '/maintenance/requests' });
    for (const po of purchaseOrders) results.push({ type: 'Purchase Order', id: po.id, code: po.poNumber, name: po.poNumber, subtitle: `${po.status}`, route: '/procurement/po' });

    return results.slice(0, limit);
  }
}
