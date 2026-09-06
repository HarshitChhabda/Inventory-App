import { safeNumber } from '../../utils/numberUtils';
import { formatDateDDMMYYYY, toISODateIST } from '../../utils/dateUtils';

interface ReportQueryParams {
  activeReport: string;
  companyId: number;
  financialYearId: number;
  startDate?: string;
  endDate?: string;
  selectedItemId?: number | null;
  selectedCategoryId?: number | null;
  selectedDepartment?: string;
  selectedVendor?: string;
  selectedLocation?: string;
  selectedTxType?: string;
  selectedAdjustmentType?: string;
  selectedStatus?: string;
  selectedAuditAction?: string;
  selectedAuditTable?: string;
  searchText?: string;
  lowStockOnly?: boolean;
  selectedStoreId?: number | null;
}

function buildDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  // Create IST-boundary dates by parsing YYYY-MM-DD and creating Date objects at IST midnight
  const sd = startDate ? (() => { const [y, m, d] = startDate.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000)); })() : undefined;
  const ed = endDate ? (() => { const [y, m, d] = endDate.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000)); })() : undefined;
  return { sd, ed };
}

export async function fetchReportData(params: ReportQueryParams): Promise<any[]> {
  const api = window.electronAPI;
  const {
    activeReport, companyId, financialYearId, selectedItemId, selectedCategoryId,
    selectedDepartment, selectedVendor, selectedLocation, selectedTxType,
    selectedAdjustmentType, selectedStatus, selectedAuditAction, selectedAuditTable,
    searchText, lowStockOnly, selectedStoreId,
  } = params;

  const dateRange = buildDateRange(params.startDate, params.endDate);
  const sd = dateRange?.sd;
  const ed = dateRange?.ed;
  const q = searchText?.toLowerCase();

  // Helper: build date filter for LedgerEntry
  function dateFilter(field = 'transactionDate') {
    if (!sd && !ed) return {};
    const f: any = {};
    if (sd) f.gte = sd;
    if (ed) f.lte = ed;
    return { [field]: f };
  }

  // Helper: build date filter for TransactionHeader
  function txDateFilter() {
    return dateFilter('transactionDate');
  }

  switch (activeReport) {
    // ==================== PURCHASE REPORTS ====================
    case 'receipt_register': {
      const where: any = { companyId, financialYearId, voucherType: 'RC', approvalStatus: 'POSTED', ...txDateFilter() };
      if (selectedVendor) where.vendorId = Number(selectedVendor);
      if (selectedStatus) where.approvalStatus = selectedStatus;
      if (selectedStoreId) where.toStoreId = selectedStoreId;
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, vendor: true, fromStore: true, toStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 2000,
      });
      const result: any[] = [];
      for (const r of data as any[]) {
        const items = r.details || [];
        if (items.length === 0) {
          result.push({
            challanNo: r.voucherNo, date: r.transactionDate, sourceType: 'Vendor',
            sourceName: r.vendor?.vendorName || '', vehicleNumber: r.vehicleNumber,
            receivedBy: r.receivedBy, remarks: r.remarks, status: r.approvalStatus,
            itemName: '', itemCode: '', quantity: 0, rate: 0, amount: 0, unitName: '',
            storeName: r.toStore?.name || '',
          });
        } else {
          for (const item of items) {
            result.push({
              challanNo: r.voucherNo, date: r.transactionDate, sourceType: 'Vendor',
              sourceName: r.vendor?.vendorName || '', vehicleNumber: r.vehicleNumber,
              receivedBy: r.receivedBy, remarks: r.remarks, status: r.approvalStatus,
              itemName: item.item?.itemName || '', itemCode: item.item?.itemCode || '',
              quantity: Number(item.quantity || 0), rate: Number(item.rate || 0),
              amount: Number(item.amount || 0), unitName: '',
              storeName: r.toStore?.name || '',
            });
          }
        }
      }
      if (q) return result.filter((r: any) => r.challanNo?.toLowerCase().includes(q) || r.sourceName?.toLowerCase().includes(q) || r.itemName?.toLowerCase().includes(q));
      return result;
    }

    case 'vendor_purchase': {
      const where: any = { companyId, financialYearId, voucherType: 'RC', approvalStatus: 'POSTED', ...txDateFilter() };
      if (selectedVendor) where.vendorId = Number(selectedVendor);
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, vendor: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 2000,
      });
      if (q) return (data as any[]).filter((r: any) => r.voucherNo?.toLowerCase().includes(q) || r.vendor?.vendorName?.toLowerCase().includes(q));
      return data;
    }

    case 'vendor_returns': {
      const where: any = { companyId, financialYearId, voucherType: 'VR', approvalStatus: 'POSTED', ...txDateFilter() };
      if (selectedVendor) where.vendorId = Number(selectedVendor);
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, vendor: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 2000,
      });
      if (q) return (data as any[]).filter((r: any) => r.voucherNo?.toLowerCase().includes(q) || r.vendor?.vendorName?.toLowerCase().includes(q));
      return data;
    }

    case 'purchase_history': {
      const where: any = { companyId, financialYearId, voucherType: 'RC', ...txDateFilter() };
      if (selectedItemId) where.details = { some: { itemId: Number(selectedItemId) } };
      if (selectedCategoryId) where.details = { some: { item: { categoryId: Number(selectedCategoryId) } } };
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: { include: { unit: true } } } }, vendor: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      const result: any[] = [];
      let sNo = 1;
      let cumulativeQty = 0;
      let cumulativeValue = 0;
      for (const r of data as any[]) {
        for (const d of r.details || []) {
          const qty = Number(d.quantity || 0);
          cumulativeQty += qty;
          cumulativeValue += qty * Number(d.rate || 0);
          result.push({
            sNo: sNo++,
            itemCode: d.item?.itemCode || '',
            itemName: d.item?.itemName || '',
            dateFormatted: r.transactionDate ? formatDateDDMMYYYY(r.transactionDate) : '',
            challanNo: r.voucherNo || '',
            storeName: r.vendor?.vendorName || '',
            qty: `+${qty}`,
            rate: Number(d.rate || 0),
            total: qty * Number(d.rate || 0),
            totalQty: cumulativeQty,
            avgRate: cumulativeQty > 0 ? cumulativeValue / cumulativeQty : 0,
          });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    // ==================== ISSUE REPORTS ====================
    case 'issue_register': {
      const where: any = { companyId, financialYearId, voucherType: 'IC', approvalStatus: 'POSTED', ...txDateFilter() };
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, fromStore: true, toStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 2000,
      });
      if (q) return (data as any[]).filter((r: any) => r.voucherNo?.toLowerCase().includes(q) || r.fromStore?.name?.toLowerCase().includes(q));
      return data;
    }

    case 'department_wise': {
      const where: any = { companyId, financialYearId, voucherType: 'IC', ...txDateFilter() };
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, fromStore: true, toStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      if (q) return (data as any[]).filter((r: any) => r.voucherNo?.toLowerCase().includes(q));
      return data;
    }

    case 'transfer_register': {
      const where: any = { companyId, financialYearId, voucherType: 'TC', approvalStatus: 'POSTED', ...txDateFilter() };
      if (selectedDepartment) {
        where.OR = [{ fromStoreId: Number(selectedDepartment) }, { toStoreId: Number(selectedDepartment) }];
      }
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, fromStore: true, toStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 2000,
      });
      if (q) return (data as any[]).filter((r: any) => r.voucherNo?.toLowerCase().includes(q) || r.fromStore?.name?.toLowerCase().includes(q) || r.toStore?.name?.toLowerCase().includes(q));
      return data;
    }

    // ==================== INVENTORY REPORTS ====================
    case 'stock_ledger': {
      const where: any = { companyId, financialYearId, ...dateFilter() };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedStoreId) where.storeId = selectedStoreId;
      if (selectedTxType) where.movementType = selectedTxType;
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where,
        include: { item: { include: { category: true, unit: true } }, store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 5000,
      });
      let result = (data as any[]).map((t: any) => ({
        transactionDate: t.transactionDate,
        voucherNo: t.voucherNo || '',
        voucherType: t.voucherType || '',
        itemName: t.item?.itemName || '',
        itemCode: t.item?.itemCode || '',
        categoryName: t.item?.category?.name || '',
        unitName: t.item?.unit?.name || '',
        storeName: t.store?.name || '',
        quantityIn: t.quantityIn || 0,
        quantityOut: t.quantityOut || 0,
        rate: t.rate || 0,
        remarks: t.remarks || '',
      }));
      if (q) result = result.filter((r: any) => r.item?.itemName?.toLowerCase().includes(q) || r.voucherNo?.toLowerCase().includes(q));
      return result;
    }

    case 'stock_summary': {
      const where: any = { companyId, financialYearId };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: Number(selectedCategoryId) };
      if (selectedStoreId) where.storeId = selectedStoreId;

      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId', 'storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
        _count: true,
      });

      const results: any[] = [];
      for (const g of grouped as any[]) {
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        results.push({
          _itemId: g.itemId,
          itemCode: item?.itemCode || '',
          itemName: item?.itemName || '',
          category: item?.category?.name || '',
          unit: item?.unit?.name || '',
          storeName: store?.name || '',
          totalReceived: Number(g._sum.quantityIn || 0),
          totalIssued: Number(g._sum.quantityOut || 0),
          currentStock: Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0),
        });
      }
      if (q) return results.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return results;
    }

    case 'current_stock_custom': {
      const where: any = { companyId, financialYearId };
      if (selectedCategoryId) where.item = { categoryId: Number(selectedCategoryId) };
      if (selectedStoreId) where.storeId = selectedStoreId;

      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId', 'storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });

      let sNo = 1;
      const result: any[] = [];
      for (const g of grouped as any[]) {
        const stockQty = Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0);
        if (stockQty === 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        result.push({
          _itemId: g.itemId,
          sNo: sNo++,
          itemCode: item?.itemCode || '',
          itemName: item?.itemName || '',
          categoryName: item?.category?.name || '',
          storeName: store?.name || '',
          unitName: item?.unit?.name || '',
          totalIn: Number(g._sum.quantityIn || 0),
          totalOut: Number(g._sum.quantityOut || 0),
          stockQty,
          minimumStockLevel: Number(item?.minimumStockLevel || 0),
          stockStatus: stockQty <= 0 ? 'Out of Stock' : stockQty <= Number(item?.minimumStockLevel || 0) ? 'Low Stock' : 'Normal',
        });
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'stock_distribution': {
      const where: any = { companyId, financialYearId };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: selectedCategoryId };
      if (selectedStoreId) where.storeId = selectedStoreId;

      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId', 'storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });

      const result: any[] = [];
      for (const g of grouped as any[]) {
        const stockQty = Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0);
        if (stockQty === 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        result.push({
          itemCode: item?.itemCode || '',
          itemName: item?.itemName || '',
          categoryName: item?.category?.name || '',
          unitName: item?.unit?.name || '',
          storeName: store?.name || '',
          totalReceived: Number(g._sum.quantityIn || 0),
          totalIssued: Number(g._sum.quantityOut || 0),
          currentStock: stockQty,
          minimumStockLevel: Number(item?.minimumStockLevel || 0),
        });
      }
      if (lowStockOnly) return result.filter((r: any) => r.currentStock < r.minimumStockLevel);
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'low_stock': {
      const where: any = { companyId, financialYearId };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: selectedCategoryId };
      if (selectedStoreId) where.storeId = selectedStoreId;

      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId', 'storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });

      const result: any[] = [];
      for (const g of grouped as any[]) {
        const stockQty = Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0);
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        const minLevel = Number(item?.minimumStockLevel || 0);
        if (minLevel > 0 && stockQty < minLevel) {
          result.push({
            _itemId: g.itemId,
            itemCode: item?.itemCode || '',
            itemName: item?.itemName || '',
            categoryName: item?.category?.name || '',
            unitName: item?.unit?.name || '',
            storeName: store?.name || '',
            currentStock: stockQty,
            minimumLevel: minLevel,
            deficit: minLevel - stockQty,
          });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'dead_stock': {
      const where: any = { companyId, financialYearId };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: selectedCategoryId };
      if (selectedStoreId) where.storeId = selectedStoreId;

      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId', 'storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });

      const result: any[] = [];
      for (const g of grouped as any[]) {
        const stockQty = Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0);
        if (stockQty <= 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        result.push({
          _itemId: g.itemId,
          itemCode: item?.itemCode || '',
          itemName: item?.itemName || '',
          categoryName: item?.category?.name || '',
          unitName: item?.unit?.name || '',
          storeName: store?.name || '',
          currentStock: stockQty,
        });
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'item_history': {
      const where: any = { companyId, financialYearId, ...dateFilter() };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedStoreId) where.storeId = selectedStoreId;
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where,
        include: { item: true, store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });

      const TX_LABELS: Record<string, string> = {
        PURCHASE_RECEIPT: 'Receipt', ISSUE_OUT: 'Issue Out', ISSUE_IN: 'Issue In',
        TRANSFER_OUT: 'Transfer Out', TRANSFER_IN: 'Transfer In',
        DAMAGE_OUT: 'Damage Out', DAMAGE_IN: 'Damage In',
        VENDOR_RETURN: 'Vendor Return', ADJUSTMENT_PLUS: 'Adjustment +', ADJUSTMENT_MINUS: 'Adjustment -',
        INSTALL_OUT: 'Install Out', INSTALL_IN: 'Install In',
        SHIFT_OUT: 'Shift Out', SHIFT_IN: 'Shift In',
        REVERSAL: 'Reversal', OPENING_BALANCE: 'Opening', CARRY_FORWARD: 'Carry Forward',
        SCRAP_OUT: 'Scrap', REPAIR_OUT: 'Repair Out', REPAIR_IN: 'Repair In',
        RETURN_OUT: 'Return Out', RETURN_IN: 'Return In', REPLACEMENT_OUT: 'Replace Out', REPLACEMENT_IN: 'Replace In',
        CONSUMPTION_OUT: 'Consumption', CONSUMPTION_REVERSAL: 'Consumption Reversal',
        UNINSTALL_OUT: 'Uninstall',
      };

      let runningBalance = 0;
      const result = (data as any[]).map((t: any) => {
        const qtyIn = Number(t.quantityIn || 0);
        const qtyOut = Number(t.quantityOut || 0);
        runningBalance += qtyIn - qtyOut;
        return {
          _id: t.id,
          date: t.transactionDate,
          referenceNo: t.voucherNo || '-',
          transactionType: TX_LABELS[t.movementType] || t.movementType,
          item: t.item?.itemName || '-',
          storeName: t.store?.name || '-',
          quantityIn: qtyIn,
          quantityOut: qtyOut,
          balanceQty: runningBalance,
          rate: Number(t.rate || 0),
          remarks: t.condition || '-',
        };
      });

      if (q) return result.filter((r: any) => r.item?.toLowerCase().includes(q) || r.storeName?.toLowerCase().includes(q) || r.referenceNo?.toLowerCase().includes(q));
      return result.reverse();
    }

    case 'movement_register': {
      const where: any = { companyId, financialYearId, ...dateFilter() };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedStoreId) where.storeId = selectedStoreId;
      if (selectedTxType) where.movementType = selectedTxType;
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where,
        include: { item: true, store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      if (q) return (data as any[]).filter((t: any) => t.item?.itemName?.toLowerCase().includes(q) || t.store?.name?.toLowerCase().includes(q));
      return data;
    }

    case 'item_audit_ledger': {
      if (!selectedItemId) return [];
      const where: any = { companyId, financialYearId, itemId: Number(selectedItemId), ...dateFilter() };
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where,
        include: { store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });

      const TX_LABELS: Record<string, string> = {
        PURCHASE_RECEIPT: 'Receipt', ISSUE_OUT: 'Issue Out', ISSUE_IN: 'Issue In',
        TRANSFER_OUT: 'Transfer Out', TRANSFER_IN: 'Transfer In',
        DAMAGE_OUT: 'Damage Out', DAMAGE_IN: 'Damage In',
        VENDOR_RETURN: 'Vendor Return', ADJUSTMENT_PLUS: 'Adjustment +', ADJUSTMENT_MINUS: 'Adjustment -',
        REVERSAL: 'Reversal', OPENING_BALANCE: 'Opening',
        CONSUMPTION_OUT: 'Consumption', CONSUMPTION_REVERSAL: 'Consumption Reversal',
        SCRAP_OUT: 'Scrap', REPAIR_OUT: 'Repair Out', REPAIR_IN: 'Repair In',
        RETURN_OUT: 'Return Out', RETURN_IN: 'Return In', REPLACEMENT_OUT: 'Replace Out', REPLACEMENT_IN: 'Replace In',
        INSTALL_OUT: 'Install Out', INSTALL_IN: 'Install In',
        SHIFT_OUT: 'Shift Out', SHIFT_IN: 'Shift In',
        UNINSTALL_OUT: 'Uninstall', CARRY_FORWARD: 'Carry Forward',
      };

      let runningBalance = 0;
      const result = (data as any[]).map((t: any) => {
        const qtyIn = Number(t.quantityIn || 0);
        const qtyOut = Number(t.quantityOut || 0);
        runningBalance += qtyIn - qtyOut;
        return {
          _id: t.id,
          date: t.transactionDate,
          referenceNo: t.voucherNo || '-',
          transactionType: TX_LABELS[t.movementType] || t.movementType,
          storeName: t.store?.name || '-',
          quantityIn: qtyIn,
          quantityOut: qtyOut,
          balanceQty: runningBalance,
          createdBy: t.createdBy || '-',
          rate: Number(t.rate || 0),
        };
      });

      if (q) return result.filter((r: any) => r.referenceNo?.toLowerCase().includes(q) || r.transactionType?.toLowerCase().includes(q) || r.storeName?.toLowerCase().includes(q));
      return result;
    }

    case 'item_lifecycle': {
      if (!selectedItemId) return [];
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where: { companyId, financialYearId, itemId: Number(selectedItemId) },
        include: { item: { include: { category: true, unit: true } }, store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      let sNo = 1;
      return (data as any[]).map((t: any) => ({
        sNo: sNo++,
        date: t.transactionDate,
        transactionType: t.movementType,
        itemCode: t.item?.itemCode || '',
        itemName: t.item?.itemName || '',
        storeName: t.store?.name || '',
        quantityIn: Number(t.quantityIn || 0),
        quantityOut: Number(t.quantityOut || 0),
        rate: Number(t.rate || 0),
        balanceQty: Number(t.balanceQty || 0),
        condition: t.condition || '',
        voucherNo: t.voucherNo || '',
        voucherType: t.voucherType || '',
      }));
    }

    // ==================== DAMAGE & ADJUSTMENT REPORTS ====================
    case 'damage_report': {
      const where: any = { companyId, financialYearId, voucherType: 'DM', ...txDateFilter() };
      if (selectedItemId) where.details = { some: { itemId: Number(selectedItemId) } };
      if (selectedStoreId) where.fromStoreId = selectedStoreId;
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, fromStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 2000,
      });
      const result: any[] = [];
      for (const r of data as any[]) {
        for (const d of r.details || []) {
          result.push({
            _id: r.id,
            date: r.transactionDate,
            challanNo: r.voucherNo,
            itemName: d.item?.itemName || '-',
            itemCode: d.item?.itemCode || '-',
            quantity: Number(d.quantity),
            condition: d.condition || '-',
            storeName: r.fromStore?.name || '-',
            remarks: r.remarks || '-',
            status: r.approvalStatus,
          });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.challanNo?.toLowerCase().includes(q));
      return result;
    }

    case 'stock_adjustments': {
      const where: any = { companyId, financialYearId, voucherType: 'AD', ...txDateFilter() };
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where,
        include: { details: { include: { item: true } }, fromStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 2000,
      });
      const result: any[] = [];
      for (const r of data as any[]) {
        for (const d of r.details || []) {
          result.push({
            _id: r.id,
            date: r.transactionDate,
            challanNo: r.voucherNo,
            itemName: d.item?.itemName || '-',
            itemCode: d.item?.itemCode || '-',
            quantity: Number(d.quantity),
            rate: Number(d.rate || 0),
            storeName: r.fromStore?.name || '-',
            remarks: r.remarks || '-',
          });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.challanNo?.toLowerCase().includes(q));
      return result;
    }

    case 'damage_scrap_returns': {
      const [damageData, returnData] = await Promise.all([
        api.dbQuery('transactionHeader', 'findMany', {
          where: { companyId, financialYearId, voucherType: 'DM', ...txDateFilter() },
          include: { details: { include: { item: { include: { category: true, unit: true } } } }, fromStore: true },
          orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        }),
        api.dbQuery('transactionHeader', 'findMany', {
          where: { companyId, financialYearId, voucherType: 'VR', ...txDateFilter() },
          include: { details: { include: { item: { include: { category: true, unit: true } } } }, vendor: true },
          orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        }),
      ]);

      const rows: any[] = [];
      for (const r of damageData as any[]) {
        for (const d of r.details || []) {
          rows.push({
            _id: `DM-${r.id}`, date: r.transactionDate, entryType: 'DAMAGE',
            referenceNo: r.voucherNo, itemName: d.item?.itemName || '-',
            itemCode: d.item?.itemCode || '-', quantity: Number(d.quantity),
            unitName: d.item?.unit?.name || '-', storeName: r.fromStore?.name || '-',
            reason: r.remarks || '-', actionTaken: 'Damaged',
            categoryName: d.item?.category?.name || '-',
          });
        }
      }
      for (const r of returnData as any[]) {
        for (const d of r.details || []) {
          rows.push({
            _id: `VR-${r.id}`, date: r.transactionDate, entryType: 'VENDOR_RETURN',
            referenceNo: r.voucherNo, itemName: d.item?.itemName || '-',
            itemCode: d.item?.itemCode || '-', quantity: Number(d.quantity),
            unitName: d.item?.unit?.name || '-', storeName: r.vendor?.vendorName || '-',
            reason: r.remarks || '-', actionTaken: `Returned to ${r.vendor?.vendorName || 'Vendor'}`,
            categoryName: d.item?.category?.name || '-',
          });
        }
      }
      rows.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (q) return rows.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.referenceNo?.toLowerCase().includes(q));
      return rows;
    }

    // ==================== ENTERPRISE REPORTS ====================
    case 'central_store_summary': {
      const storeId = selectedStoreId || (selectedDepartment ? Number(selectedDepartment) : null);
      if (!storeId) return [];

      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId'],
        where: { companyId, financialYearId, storeId },
        _sum: { quantityIn: true, quantityOut: true },
      });

      const items: any[] = [];
      for (const g of grouped as any[]) {
        const stockQty = Number(g._sum.quantityIn || 0) - Number(g._sum.quantityOut || 0);
        if (stockQty <= 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        items.push({
          _itemId: g.itemId,
          itemCode: item?.itemCode || '',
          itemName: item?.itemName || '',
          categoryName: item?.category?.name || '',
          unitName: item?.unit?.name || '',
          minimumStockLevel: Number(item?.minimumStockLevel || 0),
          totalReceived: Number(g._sum.quantityIn || 0),
          totalIssued: Number(g._sum.quantityOut || 0),
          currentStock: stockQty,
          stockStatus: stockQty <= Number(item?.minimumStockLevel || 0) ? 'Low Stock' : 'Normal',
        });
      }
      if (q) return items.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return items;
    }

    case 'dharamshala_items': {
      const where: any = { companyId, financialYearId };
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where,
        include: { item: { include: { category: true, unit: true } }, store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      const summary: Record<number, any> = {};
      (data as any[]).forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) summary[key] = { item: t.item, store: t.store, totalIn: 0, totalOut: 0 };
        summary[key].totalIn += Number(t.quantityIn || 0);
        summary[key].totalOut += Number(t.quantityOut || 0);
      });
      let result = Object.values(summary).map((s: any) => ({
        ...s.item, storeName: s.store?.name || '', totalReceived: s.totalIn, totalIssued: s.totalOut, currentStock: s.totalIn - s.totalOut,
      })).filter((r: any) => r.currentStock > 0);
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'department_stock_status': {
      if (!selectedDepartment) return [];
      const where: any = { companyId, financialYearId, storeId: Number(selectedDepartment) };
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where,
        include: { item: true, store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      const summary: Record<number, any> = {};
      (data as any[]).forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) summary[key] = { item: t.item, store: t.store, totalIn: 0, totalOut: 0 };
        summary[key].totalIn += Number(t.quantityIn || 0);
        summary[key].totalOut += Number(t.quantityOut || 0);
      });
      let sNo = 1;
      let result = Object.values(summary).map((s: any) => ({
        _itemId: s.item.id,
        sNo: sNo++,
        itemName: s.item.itemName,
        itemCode: s.item.itemCode || '',
        storeName: s.store?.name || '',
        totalQty: s.totalIn,
        balanceQty: s.totalIn - s.totalOut,
      })).filter((r: any) => r.totalQty > 0 || r.balanceQty > 0);
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q));
      return result;
    }

    // ==================== INSTALLATION TRACKING ====================
    case 'installation_tracking': {
      const where: any = {};
      if (selectedStoreId) where.storeId = selectedStoreId;
      if (selectedItemId) where.itemId = Number(selectedItemId);
      const data = await api.dbQuery('assetInstallation', 'findMany', {
        where,
        include: { item: { include: { category: true, unit: true } }, room: { include: { location: true } }, store: true },
        orderBy: { installedDate: 'desc' },
      });
      let sNo = 1;
      let result = (data as any[]).map((inst: any) => ({
        sNo: sNo++,
        itemName: inst.item?.itemName || '-',
        itemCode: inst.item?.itemCode || '-',
        storeName: inst.store?.name || '-',
        locationName: inst.room?.location?.name || '-',
        roomName: inst.room?.name || '-',
        quantity: Number(inst.quantity),
        installedDate: inst.installedDate,
        installedBy: inst.installedBy || '-',
        uninstalledDate: inst.uninstalledDate,
        uninstalledBy: inst.uninstalledBy || '-',
        status: inst.status,
        remarks: inst.remarks || '-',
      }));
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.storeName?.toLowerCase().includes(q) || r.roomName?.toLowerCase().includes(q));
      return result;
    }

    // ==================== STORE-WISE STOCK ====================
    case 'store_wise_stock': {
      const where: any = { companyId, financialYearId };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: Number(selectedCategoryId) };

      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });

      const result: any[] = [];
      for (const g of grouped as any[]) {
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        // Get item-wise breakdown for this store
        const itemGrouped = await api.dbQuery('ledgerEntry', 'groupBy', {
          by: ['itemId'],
          where: { companyId, financialYearId, storeId: g.storeId },
          _sum: { quantityIn: true, quantityOut: true },
        });
        const items: any[] = [];
        for (const ig of itemGrouped as any[]) {
          const stockQty = Number(ig._sum.quantityIn || 0) - Number(ig._sum.quantityOut || 0);
          if (stockQty <= 0) continue;
          const item = await api.dbQuery('item', 'findUnique', { where: { id: ig.itemId }, include: { unit: true } });
          items.push({
            itemName: item?.itemName || '',
            itemCode: item?.itemCode || '',
            unitName: item?.unit?.name || '',
            quantity: stockQty,
            totalValue: stockQty * 0,
          });
        }
        result.push({
          storeId: g.storeId,
          storeName: store?.name || '',
          storeType: store?.storeType || '',
          totalItems: items.length,
          totalQuantity: items.reduce((s: number, i: any) => s + i.quantity, 0),
          items,
        });
      }
      if (q) return result.filter((r: any) => r.storeName?.toLowerCase().includes(q));
      return result;
    }

    // ==================== AUDIT LOG ====================
    case 'audit_log': {
      const where: any = { companyId };
      if (sd || ed) { where.createdAt = {}; if (sd) where.createdAt.gte = sd; if (ed) where.createdAt.lte = ed; }
      if (selectedAuditAction) where.action = selectedAuditAction;
      if (selectedAuditTable) where.tableName = selectedAuditTable;
      const data = await api.dbQuery('auditLog', 'findMany', { where, orderBy: { createdAt: 'desc' }, take: 2000 });
      if (q) return (data as any[]).filter((r: any) => r.action?.toLowerCase().includes(q) || r.tableName?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
      return data;
    }

    // ==================== VISUAL ANALYTICS ====================
    case 'visual_analytics': {
      const txData = await api.dbQuery('ledgerEntry', 'findMany', {
        where: { companyId, financialYearId },
        include: { item: { include: { category: true } }, store: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 10000,
      });

      const storeConsumption: Record<number, { name: string; received: number; issued: number }> = {};
      const monthlyTrend: Record<string, { month: string; received: number; issued: number }> = {};
      const storeDistribution: Record<number, { name: string; qty: number }> = {};

      for (const tx of txData as any[]) {
        const storeName = tx.store?.name || 'Unknown';
        const qtyIn = Number(tx.quantityIn || 0);
        const qtyOut = Number(tx.quantityOut || 0);

        if (!storeConsumption[tx.storeId]) storeConsumption[tx.storeId] = { name: storeName, received: 0, issued: 0 };
        storeConsumption[tx.storeId].received += qtyIn;
        storeConsumption[tx.storeId].issued += qtyOut;

        const d = new Date(tx.transactionDate);
        // Use IST timezone for month/year grouping
        const istParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(d);
        const istYear = parseInt(istParts.find(p => p.type === 'year')?.value || '0');
        const istMonth = parseInt(istParts.find(p => p.type === 'month')?.value || '0');
        const monthKey = `${istYear}-${String(istMonth).padStart(2, '0')}`;
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthLabel = `${monthNames[istMonth - 1]} ${String(istYear).slice(-2)}`;
        if (!monthlyTrend[monthKey]) monthlyTrend[monthKey] = { month: monthLabel, received: 0, issued: 0 };
        monthlyTrend[monthKey].received += qtyIn;
        monthlyTrend[monthKey].issued += qtyOut;

        if (!storeDistribution[tx.storeId]) storeDistribution[tx.storeId] = { name: storeName, qty: 0 };
        storeDistribution[tx.storeId].qty += qtyIn - qtyOut;
      }

      return [{
        departmentConsumption: Object.values(storeConsumption).filter((d: any) => d.received > 0 || d.issued > 0),
        monthlyTrend: Object.values(monthlyTrend),
        locationDistribution: Object.values(storeDistribution).filter((l: any) => l.qty > 0),
      }];
    }

    case 'dharamshala_distribution': {
      const stores = await api.dbQuery('store', 'findMany', {
        where: { companyId, storeType: 'DHARMSHALA_STORE' },
      });
      const result: any[] = [];
      for (const store of stores as any[]) {
        const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
          by: ['itemId', 'locationId'],
          where: { companyId, financialYearId, storeId: store.id },
          _sum: { quantityIn: true, quantityOut: true },
        });
        for (const g of grouped as any[]) {
          const totalReceived = Number(g._sum.quantityIn || 0);
          const totalIssued = Number(g._sum.quantityOut || 0);
          const balanceQty = totalReceived - totalIssued;
          if (balanceQty <= 0) continue;
          const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true } });
          let locationName = '';
          if (g.locationId) {
            const loc = await api.dbQuery('location', 'findUnique', { where: { id: g.locationId } });
            locationName = (loc as any)?.name || '';
          }
          result.push({
            storeName: store.name || '',
            locationName: locationName || '-',
            itemName: item?.itemName || '',
            itemCode: item?.itemCode || '',
            categoryName: item?.category?.name || '',
            totalReceived,
            totalIssued,
            consumed: totalIssued,
            balanceQty,
          });
        }
      }
      if (q) return result.filter((r: any) => r.storeName?.toLowerCase().includes(q) || r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q) || r.locationName?.toLowerCase().includes(q));
      return result;
    }

    case 'room_facilities': {
      const where: any = {};
      if (selectedStoreId) where.storeId = selectedStoreId;
      const data = await api.dbQuery('assetInstallation', 'findMany', {
        where,
        include: { item: { include: { category: true, unit: true } }, room: { include: { location: true } }, store: true },
        orderBy: { installedDate: 'desc' },
      });
      const result = (data as any[]).map((inst: any) => ({
        roomName: inst.room?.name || '-',
        locationName: inst.room?.location?.name || '-',
        storeName: inst.store?.name || '-',
        itemName: inst.item?.itemName || '-',
        itemCode: inst.item?.itemCode || '-',
        categoryName: inst.item?.category?.name || '-',
        quantity: Number(inst.quantity),
        installedDate: inst.installedDate,
        status: inst.status,
      }));
      if (q) return result.filter((r: any) => r.roomName?.toLowerCase().includes(q) || r.itemName?.toLowerCase().includes(q) || r.storeName?.toLowerCase().includes(q));
      return result;
    }

    // ==================== STOCK ANALYSIS REPORTS ====================
    case 'overall_stock': {
      const where: any = { companyId, financialYearId };
      if (selectedCategoryId) where.item = { categoryId: Number(selectedCategoryId) };
      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });
      const result: any[] = [];
      for (const g of grouped as any[]) {
        const qtyIn = Number(g._sum.quantityIn || 0);
        const qtyOut = Number(g._sum.quantityOut || 0);
        const balance = qtyIn - qtyOut;
        if (balance <= 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        result.push({
          itemCode: item?.itemCode || '', itemName: item?.itemName || '',
          categoryName: item?.category?.name || '', unitName: item?.unit?.name || '',
          qtyIn, qtyOut, balance,
        });
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'dept_stock': {
      const where: any = { companyId, financialYearId };
      if (selectedDepartment) where.storeId = Number(selectedDepartment);
      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId', 'storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });
      const result: any[] = [];
      for (const g of grouped as any[]) {
        const qtyIn = Number(g._sum.quantityIn || 0);
        const qtyOut = Number(g._sum.quantityOut || 0);
        const balance = qtyIn - qtyOut;
        if (balance <= 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        result.push({
          storeName: store?.name || '', itemName: item?.itemName || '',
          itemCode: item?.itemCode || '', categoryName: item?.category?.name || '',
          unitName: item?.unit?.name || '', qtyIn, qtyOut, balance,
        });
      }
      if (q) return result.filter((r: any) => r.storeName?.toLowerCase().includes(q) || r.itemName?.toLowerCase().includes(q));
      return result;
    }

    case 'item_stock': {
      const where: any = { companyId, financialYearId };
      if (selectedItemId) where.itemId = Number(selectedItemId);
      if (selectedCategoryId) where.item = { categoryId: Number(selectedCategoryId) };
      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId', 'storeId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });
      const result: any[] = [];
      for (const g of grouped as any[]) {
        const qtyIn = Number(g._sum.quantityIn || 0);
        const qtyOut = Number(g._sum.quantityOut || 0);
        const balance = qtyIn - qtyOut;
        if (balance <= 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true, unit: true } });
        const store = await api.dbQuery('store', 'findUnique', { where: { id: g.storeId } });
        result.push({
          itemCode: item?.itemCode || '', itemName: item?.itemName || '',
          categoryName: item?.category?.name || '', unitName: item?.unit?.name || '',
          storeName: store?.name || '', qtyIn, qtyOut, balance,
        });
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'category_stock': {
      const where: any = { companyId, financialYearId };
      if (selectedCategoryId) where.item = { categoryId: Number(selectedCategoryId) };
      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId'],
        where,
        _sum: { quantityIn: true, quantityOut: true },
      });
      const categoryMap: Record<number, { name: string; qtyIn: number; qtyOut: number; items: number }> = {};
      for (const g of grouped as any[]) {
        const qtyIn = Number(g._sum.quantityIn || 0);
        const qtyOut = Number(g._sum.quantityOut || 0);
        const balance = qtyIn - qtyOut;
        if (balance <= 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true } });
        const catId = item?.categoryId || 0;
        const catName = item?.category?.name || 'Uncategorized';
        if (!categoryMap[catId]) categoryMap[catId] = { name: catName, qtyIn: 0, qtyOut: 0, items: 0 };
        categoryMap[catId].qtyIn += qtyIn;
        categoryMap[catId].qtyOut += qtyOut;
        categoryMap[catId].items++;
      }
      const result = Object.values(categoryMap).map(c => ({
        categoryName: c.name, totalItems: c.items, qtyIn: c.qtyIn, qtyOut: c.qtyOut, balance: c.qtyIn - c.qtyOut,
      }));
      if (q) return result.filter((r: any) => r.categoryName?.toLowerCase().includes(q));
      return result;
    }

    // ==================== MOVEMENT REPORTS ====================
    case 'uninstallation_report': {
      const where: any = { companyId, financialYearId, voucherType: 'UN', ...txDateFilter() };
      if (selectedItemId) where.details = { some: { itemId: Number(selectedItemId) } };
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where, include: { details: { include: { item: true } }, fromStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 2000,
      });
      const result: any[] = [];
      for (const r of data as any[]) {
        for (const d of r.details || []) {
          result.push({ date: r.transactionDate, challanNo: r.voucherNo, itemName: d.item?.itemName || '-', itemCode: d.item?.itemCode || '-', quantity: Number(d.quantity), storeName: r.fromStore?.name || '-', remarks: r.remarks || '-' });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.challanNo?.toLowerCase().includes(q));
      return result;
    }

    case 'repair_report': {
      const where: any = { companyId, financialYearId, voucherType: 'RP', ...txDateFilter() };
      if (selectedItemId) where.details = { some: { itemId: Number(selectedItemId) } };
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where, include: { details: { include: { item: true } }, fromStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 2000,
      });
      const result: any[] = [];
      for (const r of data as any[]) {
        for (const d of r.details || []) {
          result.push({ date: r.transactionDate, challanNo: r.voucherNo, itemName: d.item?.itemName || '-', itemCode: d.item?.itemCode || '-', quantity: Number(d.quantity), storeName: r.fromStore?.name || '-', remarks: r.remarks || '-' });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.challanNo?.toLowerCase().includes(q));
      return result;
    }

    case 'replacement_report': {
      const where: any = { companyId, financialYearId, voucherType: 'RM', ...txDateFilter() };
      if (selectedItemId) where.details = { some: { itemId: Number(selectedItemId) } };
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where, include: { details: { include: { item: true } }, fromStore: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 2000,
      });
      const result: any[] = [];
      for (const r of data as any[]) {
        for (const d of r.details || []) {
          result.push({ date: r.transactionDate, challanNo: r.voucherNo, itemName: d.item?.itemName || '-', itemCode: d.item?.itemCode || '-', quantity: Number(d.quantity), storeName: r.fromStore?.name || '-', remarks: r.remarks || '-' });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.challanNo?.toLowerCase().includes(q));
      return result;
    }

    case 'return_report': {
      const where: any = { companyId, financialYearId, voucherType: 'RT', ...txDateFilter() };
      if (selectedItemId) where.details = { some: { itemId: Number(selectedItemId) } };
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where, include: { details: { include: { item: true } }, fromStore: true, vendor: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 2000,
      });
      const result: any[] = [];
      for (const r of data as any[]) {
        for (const d of r.details || []) {
          result.push({ date: r.transactionDate, challanNo: r.voucherNo, itemName: d.item?.itemName || '-', itemCode: d.item?.itemCode || '-', quantity: Number(d.quantity), vendor: r.vendor?.vendorName || '-', storeName: r.fromStore?.name || '-', remarks: r.remarks || '-' });
        }
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.challanNo?.toLowerCase().includes(q));
      return result;
    }

    // ==================== LEDGER REPORTS ====================
    case 'item_ledger': {
      if (!selectedItemId) return [];
      const where: any = { companyId, financialYearId, itemId: Number(selectedItemId), ...dateFilter() };
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where, include: { item: true, store: true }, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      if (q) return (data as any[]).filter((t: any) => t.store?.name?.toLowerCase().includes(q) || t.voucherNo?.toLowerCase().includes(q));
      return data;
    }

    case 'store_ledger': {
      if (!selectedStoreId) return [];
      const where: any = { companyId, financialYearId, storeId: Number(selectedStoreId), ...dateFilter() };
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where, include: { item: true, store: true }, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      if (q) return (data as any[]).filter((t: any) => t.item?.itemName?.toLowerCase().includes(q) || t.voucherNo?.toLowerCase().includes(q));
      return data;
    }

    case 'dept_ledger': {
      if (!selectedDepartment) return [];
      const where: any = { companyId, financialYearId, storeId: Number(selectedDepartment), ...dateFilter() };
      const data = await api.dbQuery('ledgerEntry', 'findMany', {
        where, include: { item: true, store: true }, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      if (q) return (data as any[]).filter((t: any) => t.item?.itemName?.toLowerCase().includes(q) || t.voucherNo?.toLowerCase().includes(q));
      return data;
    }

    // ==================== ASSET REPORTS ====================
    case 'asset_register': {
      const where: any = {};
      if (selectedStoreId) where.currentStoreId = selectedStoreId;
      const data = await api.dbQuery('asset', 'findMany', {
        where, include: { item: true, currentStore: true, currentRoom: true, currentDepartment: true },
        orderBy: { assetCode: 'asc' },
      });
      if (q) return (data as any[]).filter((a: any) => a.assetCode?.toLowerCase().includes(q) || a.item?.itemName?.toLowerCase().includes(q));
      return data;
    }

    case 'installed_assets': {
      const where: any = { status: 'ACTIVE' };
      if (selectedStoreId) where.storeId = selectedStoreId;
      const data = await api.dbQuery('assetInstallation', 'findMany', {
        where, include: { item: true, room: { include: { location: true } }, store: true },
        orderBy: { installedDate: 'desc' },
      });
      if (q) return (data as any[]).filter((i: any) => i.item?.itemName?.toLowerCase().includes(q) || i.store?.name?.toLowerCase().includes(q));
      return data;
    }

    case 'asset_health': {
      const data = await api.dbQuery('asset', 'findMany', {
        include: { item: true },
        orderBy: { assetCode: 'asc' },
      });
      if (q) return (data as any[]).filter((a: any) => a.assetCode?.toLowerCase().includes(q) || a.item?.itemName?.toLowerCase().includes(q));
      return data;
    }

    case 'warranty_expiry': {
      const where: any = { warrantyEnd: { not: null } };
      const data = await api.dbQuery('asset', 'findMany', {
        where, include: { item: true },
        orderBy: { warrantyEnd: 'asc' },
      });
      if (q) return (data as any[]).filter((a: any) => a.assetCode?.toLowerCase().includes(q) || a.item?.itemName?.toLowerCase().includes(q));
      return data;
    }

    case 'amc_expiry': {
      const data = await api.dbQuery('aMC', 'findMany', {
        where: { status: 'ACTIVE' },
        include: { asset: { include: { item: true } } },
        orderBy: { endDate: 'asc' },
      });
      if (q) return (data as any[]).filter((a: any) => a.asset?.assetCode?.toLowerCase().includes(q) || a.asset?.item?.itemName?.toLowerCase().includes(q));
      return data;
    }

    // ==================== PURCHASE ANALYSIS REPORTS ====================
    case 'purchase_register': {
      const where: any = { companyId, financialYearId, ...txDateFilter() };
      if (selectedVendor) where.vendorId = Number(selectedVendor);
      const data = await api.dbQuery('purchaseOrder', 'findMany', {
        where, include: { vendor: true, details: { include: { item: true } }, goodsReceipts: true },
        orderBy: { createdAt: 'desc' }, take: 2000,
      });
      if (q) return (data as any[]).filter((p: any) => p.poNumber?.toLowerCase().includes(q) || p.vendor?.name?.toLowerCase().includes(q));
      return data;
    }

    case 'grn_register': {
      const where: any = { companyId, financialYearId, ...txDateFilter() };
      if (selectedVendor) where.purchaseOrder = { vendorId: Number(selectedVendor) };
      const data = await api.dbQuery('goodsReceipt', 'findMany', {
        where, include: { purchaseOrder: { include: { vendor: true } }, details: { include: { item: true } } },
        orderBy: { createdAt: 'desc' }, take: 2000,
      });
      if (q) return (data as any[]).filter((g: any) => g.grnNumber?.toLowerCase().includes(q) || g.purchaseOrder?.vendor?.name?.toLowerCase().includes(q));
      return data;
    }

    case 'vendor_performance': {
      const vendors = await api.dbQuery('vendor', 'findMany', { where: { companyId }, orderBy: { vendorName: 'asc' } });
      const result: any[] = [];
      for (const v of vendors as any[]) {
        const poCount = await api.dbQuery('purchaseOrder', 'count', { where: { vendorId: v.id } });
        const grnCount = await api.dbQuery('goodsReceipt', 'count', { where: { purchaseOrder: { vendorId: v.id } } });
        result.push({ vendorCode: v.vendorCode || '', vendorName: v.vendorName, totalPO: poCount, completedGRN: grnCount, avgRating: v.vendorRating || 0 });
      }
      if (q) return result.filter((r: any) => r.vendorName?.toLowerCase().includes(q) || r.vendorCode?.toLowerCase().includes(q));
      return result;
    }

    // ==================== MAINTENANCE REPORTS ====================
    case 'service_register': {
      const where: any = {};
      if (selectedItemId) where.assetId = Number(selectedItemId);
      const data = await api.dbQuery('maintenanceHistory', 'findMany', {
        where, include: { asset: { include: { item: true } } },
        orderBy: { serviceDate: 'desc' }, take: 2000,
      });
      if (q) return (data as any[]).filter((m: any) => m.asset?.assetCode?.toLowerCase().includes(q) || m.asset?.item?.itemName?.toLowerCase().includes(q));
      return data;
    }

    case 'wo_register': {
      const data = await api.dbQuery('workOrder', 'findMany', {
        include: { asset: { include: { item: true } }, spareParts: true, costs: true },
        orderBy: { createdAt: 'desc' }, take: 2000,
      });
      if (q) return (data as any[]).filter((w: any) => w.orderNumber?.toLowerCase().includes(q) || w.asset?.assetCode?.toLowerCase().includes(q));
      return data;
    }

    case 'downtime_report': {
      const where: any = {};
      if (selectedItemId) where.assetId = Number(selectedItemId);
      const data = await api.dbQuery('breakdownHistory', 'findMany', {
        where, include: { asset: { include: { item: true } } },
        orderBy: { breakdownDate: 'desc' }, take: 2000,
      });
      if (q) return (data as any[]).filter((b: any) => b.asset?.assetCode?.toLowerCase().includes(q) || b.asset?.item?.itemName?.toLowerCase().includes(q));
      return data;
    }

    case 'repair_cost': {
      const data = await api.dbQuery('asset', 'findMany', {
        include: { item: true },
        orderBy: { assetCode: 'asc' },
      });
      if (q) return (data as any[]).filter((a: any) => a.assetCode?.toLowerCase().includes(q) || a.item?.itemName?.toLowerCase().includes(q));
      return data;
    }

    // ==================== FINANCIAL REPORTS ====================
    case 'inventory_valuation': {
      const where: any = { companyId, financialYearId };
      if (selectedCategoryId) where.item = { categoryId: Number(selectedCategoryId) };
      const grouped = await api.dbQuery('ledgerEntry', 'groupBy', {
        by: ['itemId'], where,
        _sum: { quantityIn: true, quantityOut: true },
      });
      const result: any[] = [];
      for (const g of grouped as any[]) {
        const qtyIn = Number(g._sum.quantityIn || 0);
        const qtyOut = Number(g._sum.quantityOut || 0);
        const balance = qtyIn - qtyOut;
        if (balance <= 0) continue;
        const item = await api.dbQuery('item', 'findUnique', { where: { id: g.itemId }, include: { category: true } });
        result.push({ itemCode: item?.itemCode || '', itemName: item?.itemName || '', categoryName: item?.category?.name || '', quantity: balance, avgRate: 0, value: 0 });
      }
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    case 'import_history': {
      const where: any = { companyId };
      const data = await api.dbQuery('importHistory', 'findMany', {
        where, orderBy: { createdAt: 'desc' }, take: 2000,
      });
      if (q) return (data as any[]).filter((i: any) => i.fileName?.toLowerCase().includes(q) || i.importType?.toLowerCase().includes(q));
      return data;
    }

    case 'transaction_summary': {
      const where: any = { companyId, financialYearId, ...txDateFilter() };
      const data = await api.dbQuery('transactionHeader', 'findMany', {
        where, select: { voucherType: true },
      });
      const counts: Record<string, number> = {};
      for (const d of data as any[]) {
        counts[d.voucherType] = (counts[d.voucherType] || 0) + 1;
      }
      return Object.entries(counts).map(([voucherType, txCount]) => ({ voucherType, txCount }));
    }

    default:
      return [];
  }
}
