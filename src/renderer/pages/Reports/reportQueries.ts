import { safeNumber } from '../../utils/numberUtils';

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
}

function buildDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  const sd = startDate ? (() => { const [y, m, d] = startDate.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0, 0); })() : undefined;
  const ed = endDate ? (() => { const [y, m, d] = endDate.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999); })() : undefined;
  return { sd, ed };
}

export async function fetchReportData(params: ReportQueryParams): Promise<any[]> {
  const api = window.electronAPI;
  const {
    activeReport, companyId, financialYearId, selectedItemId, selectedCategoryId,
    selectedDepartment, selectedVendor, selectedLocation, selectedTxType,
    selectedAdjustmentType, selectedStatus, selectedAuditAction, selectedAuditTable,
    searchText, lowStockOnly,
  } = params;

  const dateRange = buildDateRange(params.startDate, params.endDate);
  const sd = dateRange?.sd;
  const ed = dateRange?.ed;
  const where: any = {};
  const include: any = {};
  const q = searchText?.toLowerCase();

  switch (activeReport) {
    case 'receipt_register': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.status = 'Posted';
      if (sd || ed) { where.date = {}; if (sd) where.date.gte = sd; if (ed) where.date.lte = ed; }
      if (selectedVendor) where.vendorId = Number(selectedVendor);
      if (selectedStatus) where.status = selectedStatus;
      include.vendor = true;
      include.items = { include: { item: true, unit: true } };
      const data = await api.dbQuery('receiptChallan', 'findMany', { where, include, orderBy: { date: 'asc' }, take: 2000 });
      const result: any[] = [];
      for (const r of data as any[]) {
        const sourceName = r.sourceType === 'Vendor' ? (r.vendor?.name || r.sourceName || '') : (r.sourceName || r.vendor?.name || '');
        const items = r.items || [];
        if (items.length === 0) {
          result.push({
            challanNo: r.challanNo, date: r.date, sourceType: r.sourceType, sourceName,
            invoiceNumber: r.invoiceNumber, invoiceDate: r.invoiceDate, vehicleNumber: r.vehicleNumber,
            receivedBy: r.receivedBy, remarks: r.remarks, status: r.status, postedAt: r.postedAt,
            itemName: '', itemCode: '', quantity: 0, rate: 0, amount: 0, unitName: '',
          });
        } else {
          for (const item of items) {
            result.push({
              challanNo: r.challanNo, date: r.date, sourceType: r.sourceType, sourceName,
              invoiceNumber: r.invoiceNumber, invoiceDate: r.invoiceDate, vehicleNumber: r.vehicleNumber,
              receivedBy: r.receivedBy, remarks: r.remarks, status: r.status, postedAt: r.postedAt,
              itemName: item.item?.itemName || '', itemCode: item.item?.itemCode || '',
              quantity: Number(item.quantity || 0), rate: Number(item.rate || 0), amount: Number(item.amount || 0),
              unitName: item.unit?.name || '',
            });
          }
        }
      }
      if (q) return result.filter((r: any) => r.challanNo?.toLowerCase().includes(q) || r.sourceName?.toLowerCase().includes(q) || r.itemName?.toLowerCase().includes(q));
      return result;
    }
    case 'issue_register': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.status = 'Posted';
      if (sd || ed) { where.date = {}; if (sd) where.date.gte = sd; if (ed) where.date.lte = ed; }
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      if (selectedStatus) where.status = selectedStatus;
      include.department = true;
      include.items = { include: { item: true, unit: true } };
      const data = await api.dbQuery('issueChallan', 'findMany', { where, include, orderBy: { date: 'asc' }, take: 2000 });
      if (q) return data.filter((r: any) => r.challanNo?.toLowerCase().includes(q) || r.department?.name?.toLowerCase().includes(q));
      return data;
    }
    case 'stock_ledger': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (sd || ed) { where.transactionDate = {}; if (sd) where.transactionDate.gte = sd; if (ed) where.transactionDate.lte = ed; }
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      if (selectedTxType) where.transactionType = selectedTxType;
      include.item = true;
      include.department = true;
      include.location = true;
      const data = await api.dbQuery('stockTransaction', 'findMany', { where, include, orderBy: { transactionDate: 'desc' }, take: 1000 });

      const receiptIds = [...new Set(data.filter((t: any) => t.referenceType === 'ReceiptChallan' && t.referenceId).map((t: any) => t.referenceId))];
      const vendorMap = new Map<number, string>();
      if (receiptIds.length > 0) {
        const receipts = await api.dbQuery('receiptChallan', 'findMany', { where: { id: { in: receiptIds } }, include: { vendor: true } });
        receipts.forEach((r: any) => vendorMap.set(r.id, r.vendor?.name || r.sourceName || ''));
      }

      let result = data.map((t: any) => ({
        ...t,
        vendorName: t.referenceType === 'ReceiptChallan' && t.referenceId ? (vendorMap.get(t.referenceId) || '') : '',
      }));

      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.vendorName?.toLowerCase().includes(q) || r.referenceNo?.toLowerCase().includes(q));
      return result;
    }
    case 'current_stock_custom': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (selectedCategoryId) {
        // If category name matches a department name, also filter by that department
        const categories = await api.dbQuery('itemCategory', 'findMany', { where: { isActive: true } });
        const departments = await api.dbQuery('department', 'findMany', { where: { companyId } });
        const selectedCat = categories.find((c: any) => c.id === Number(selectedCategoryId));
        const matchingDept = selectedCat ? departments.find((d: any) => d.name === selectedCat.name) : null;
        if (matchingDept) {
          where.departmentId = matchingDept.id;
        } else {
          where.item = { categoryId: Number(selectedCategoryId) };
        }
      }
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);

      // Simple query: all stock transactions with item + category + department
      const data = await api.dbQuery('stockTransaction', 'findMany', { 
        where, 
        include: { 
          item: { include: { category: true, unit: true } }, 
          department: true,
        },
        orderBy: { transactionDate: 'asc' } 
      });

      // Aggregate by item
      const summary: Record<string, any> = {};
      
      data.forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) {
          summary[key] = { 
            item: t.item, 
            department: t.department,
            totalIn: 0, 
            totalOut: 0,
            rateSum: 0,
            rateCount: 0,
          };
        }
        const qtyIn = safeNumber(t.quantityIn);
        const qtyOut = safeNumber(t.quantityOut);
        const rate = safeNumber(t.rate);
        summary[key].totalIn += qtyIn;
        summary[key].totalOut += qtyOut;
        // Weighted avg rate: only from qtyIn with rate > 0
        if (qtyIn > 0 && rate > 0) {
          summary[key].rateSum += qtyIn * rate;
          summary[key].rateCount += qtyIn;
        }
      });
      
      let sNo = 1;
      let result = Object.values(summary).map((s: any) => {
        const stockQty = s.totalIn - s.totalOut;
        const avgRate = s.rateCount > 0 ? s.rateSum / s.rateCount : 0;
        const totalValue = stockQty * avgRate;
        
        return {
          _itemId: s.item.id,
          sNo: sNo++,
          itemCode: s.item.itemCode || '',
          itemName: s.item.itemName,
          categoryName: s.item.category?.name || '',
          departmentName: s.department?.name || '',
          unitName: s.item.unit?.name || '',
          totalIn: s.totalIn,
          totalOut: s.totalOut,
          rate: Math.round(avgRate * 100) / 100,
          stockQty,
          total: Math.round(totalValue * 100) / 100,
        };
      }).filter((r: any) => r.stockQty !== 0 || r.totalIn > 0);
      
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }
    case 'stock_distribution': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: selectedCategoryId };
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      if (selectedLocation) where.locationId = Number(selectedLocation);
      const data = await api.dbQuery('stockTransaction', 'findMany', { where, select: {
        itemId: true, quantityIn: true, quantityOut: true, transactionDate: true,
        item: { include: { category: true, unit: true } },
      }, orderBy: { transactionDate: 'desc' } });
      const summary: Record<string, any> = {};
      data.forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) summary[key] = { item: t.item, totalIn: 0, totalOut: 0, lastDate: t.transactionDate };
        summary[key].totalIn += Number(t.quantityIn || 0);
        summary[key].totalOut += Number(t.quantityOut || 0);
      });
      let result = Object.values(summary).map((s: any) => ({
        ...s.item, totalReceived: s.totalIn, totalIssued: s.totalOut, currentStock: s.totalIn - s.totalOut, lastMovement: s.lastDate,
      }));
      if (lowStockOnly) result = result.filter((r: any) => r.currentStock < Number(r.minimumStockLevel || 0));
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }
    case 'low_stock': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: selectedCategoryId };
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      include.item = { include: { category: true, unit: true } };
      const data = await api.dbQuery('stockTransaction', 'findMany', { where, include, orderBy: { transactionDate: 'desc' } });
      const summary: Record<string, any> = {};
      data.forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) summary[key] = { item: t.item, totalIn: 0, totalOut: 0 };
        summary[key].totalIn += Number(t.quantityIn || 0);
        summary[key].totalOut += Number(t.quantityOut || 0);
      });
      let result = Object.values(summary)
        .map((s: any) => ({ ...s.item, currentStock: s.totalIn - s.totalOut }))
        .filter((r: any) => Number(r.minimumStockLevel || 0) > 0 && r.currentStock < Number(r.minimumStockLevel));
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }
    case 'dead_stock': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: selectedCategoryId };
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      include.item = { include: { category: true, unit: true } };
      const data = await api.dbQuery('stockTransaction', 'findMany', { where, include, orderBy: { transactionDate: 'desc' }, take: 2000 });
      const summary: Record<string, any> = {};
      data.forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) summary[key] = { item: t.item, totalIn: 0, totalOut: 0, lastDate: t.transactionDate };
        summary[key].totalIn += Number(t.quantityIn || 0);
        summary[key].totalOut += Number(t.quantityOut || 0);
        if (new Date(t.transactionDate) > new Date(summary[key].lastDate)) summary[key].lastDate = t.transactionDate;
      });
      let result = Object.values(summary)
        .map((s: any) => ({ ...s.item, currentStock: s.totalIn - s.totalOut, lastMovement: s.lastDate }))
        .filter((r: any) => r.currentStock > 0);
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }
    case 'damage_report': {
      where.companyId = companyId;
      if (sd || ed) { where.date = {}; if (sd) where.date.gte = sd; if (ed) where.date.lte = ed; }
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedLocation) where.locationId = Number(selectedLocation);
      if (selectedStatus) where.status = selectedStatus;
      include.item = true;
      include.location = true;
      const data = await api.dbQuery('damageEntry', 'findMany', { where, include, orderBy: { date: 'desc' }, take: 2000 });
      if (q) return data.filter((r: any) => r.item?.itemName?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q));
      return data;
    }
    case 'department_wise': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.departmentId = { not: null };
      if (sd || ed) { where.transactionDate = {}; if (sd) where.transactionDate.gte = sd; if (ed) where.transactionDate.lte = ed; }
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedTxType) where.transactionType = selectedTxType;
      include.department = true;
      include.item = true;
      return api.dbQuery('stockTransaction', 'findMany', { where, include, orderBy: { transactionDate: 'desc' } });
    }
    case 'department_stock_status': {
      if (!selectedDepartment) return [];
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.departmentId = Number(selectedDepartment);
      
      const data = await api.dbQuery('stockTransaction', 'findMany', { 
        where, 
        include: { item: true, location: true }, 
        orderBy: { transactionDate: 'asc' } 
      });

      const summary: Record<string, any> = {};
      data.forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) {
          summary[key] = {
            item: t.item,
            totalIn: 0,
            totalOut: 0,
            deptQty: 0,
            rooms: {}
          };
        }
        const qtyIn = Number(t.quantityIn || 0);
        const qtyOut = Number(t.quantityOut || 0);
        const roomName = t.location?.locationName || null;

        if (t.transactionType === 'ISSUE') {
          if (qtyIn > 0) {
            if (roomName) {
              summary[key].rooms[roomName] = (summary[key].rooms[roomName] || 0) + qtyIn;
            } else {
              summary[key].totalIn += qtyIn;
              summary[key].deptQty += qtyIn;
            }
          } else {
            summary[key].totalOut += qtyOut;
            if (roomName) {
              summary[key].rooms[roomName] = (summary[key].rooms[roomName] || 0) - qtyOut;
            } else {
              summary[key].deptQty -= qtyOut;
            }
          }
        } else if (t.transactionType === 'TRANSFER_OUT') {
          if (roomName) {
            summary[key].rooms[roomName] = (summary[key].rooms[roomName] || 0) - qtyOut;
          } else {
            summary[key].totalOut += qtyOut;
            summary[key].deptQty -= qtyOut;
          }
        } else if (t.transactionType === 'TRANSFER_IN') {
          if (roomName) {
            summary[key].rooms[roomName] = (summary[key].rooms[roomName] || 0) + qtyIn;
          } else {
            summary[key].totalIn += qtyIn;
            summary[key].deptQty += qtyIn;
          }
        } else {
          summary[key].totalIn += qtyIn;
          summary[key].totalOut += qtyOut;
          if (roomName) {
            summary[key].rooms[roomName] = (summary[key].rooms[roomName] || 0) + qtyIn - qtyOut;
          } else {
            summary[key].deptQty += qtyIn - qtyOut;
          }
        }
      });

      let sNo = 1;
      let result = Object.values(summary).map((s: any) => {
        const balanceQty = s.deptQty;
        const roomEntries = Object.entries(s.rooms).filter(([_, v]: any) => v > 0);
        const rooms = roomEntries.map(([name, qty]: any) => `${name}(${qty})`).join(', ');
        return {
          _itemId: s.item.id,
          sNo: sNo++,
          itemName: s.item.itemName,
          itemCode: s.item.itemCode || '',
          totalQty: s.totalIn,
          rooms: rooms || '-',
          balanceQty: balanceQty
        };
      }).filter((r: any) => r.totalQty > 0 || r.balanceQty > 0);

      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q));
      return result;
    }
    case 'vendor_purchase': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.status = 'Posted';
      where.sourceType = 'Vendor';
      if (sd || ed) { where.date = {}; if (sd) where.date.gte = sd; if (ed) where.date.lte = ed; }
      if (selectedVendor) where.vendorId = Number(selectedVendor);
      include.vendor = true;
      include.items = { include: { item: true } };
      const data = await api.dbQuery('receiptChallan', 'findMany', { where, include, orderBy: { date: 'asc' }, take: 2000 });
      if (q) return data.filter((r: any) => r.challanNo?.toLowerCase().includes(q) || r.vendor?.name?.toLowerCase().includes(q));
      return data;
    }
    case 'item_history': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (sd || ed) { where.transactionDate = {}; if (sd) where.transactionDate.gte = sd; if (ed) where.transactionDate.lte = ed; }
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      const txns = await api.dbQuery('stockTransaction', 'findMany', {
        where,
        include: { item: true, department: true, location: true },
        orderBy: { transactionDate: 'asc' },
      });

      const TX_LABELS: Record<string, string> = {
        PURCHASE: 'Purchase', ISSUE: 'Issue', TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
        REVERSAL: 'Reversal', ADJUSTMENT_IN: 'Adjustment In', ADJUSTMENT_OUT: 'Adjustment Out',
        DAMAGE: 'Damage', VENDOR_RETURN: 'Vendor Return', OPENING_STOCK: 'Opening Stock',
        RETURN_IN: 'Return In', RETURN_OUT: 'Return Out',
      };

      let runningBalance = 0;
      const result = txns.map((txn: any) => {
        const qtyIn = Number(txn.quantityIn || 0);
        const qtyOut = Number(txn.quantityOut || 0);
        runningBalance += qtyIn - qtyOut;

        let source = '-';
        let destination = '-';
        if (txn.transactionType === 'PURCHASE' || txn.transactionType === 'OPENING_STOCK') {
          source = txn.remarks || 'External';
          destination = txn.department?.name || 'Store';
        } else if (txn.transactionType === 'ISSUE') {
          if (qtyOut > 0) {
            source = txn.department?.name || 'Store';
            destination = txn.remarks || '-';
          } else {
            source = txn.remarks || '-';
            destination = txn.department?.name || '-';
          }
        } else if (txn.transactionType === 'TRANSFER_OUT') {
          source = `${txn.department?.name || ''}${txn.location ? '/' + txn.location.locationName : ''}`;
          destination = txn.remarks || '-';
        } else if (txn.transactionType === 'TRANSFER_IN') {
          source = txn.remarks || '-';
          destination = `${txn.department?.name || ''}${txn.location ? '/' + txn.location.locationName : ''}`;
        } else if (txn.transactionType === 'DAMAGE') {
          source = txn.department?.name || '-';
          destination = 'Scrap';
        } else if (txn.transactionType === 'VENDOR_RETURN') {
          source = txn.department?.name || '-';
          destination = 'Vendor';
        } else {
          source = txn.department?.name || '-';
          destination = txn.location?.locationName || '-';
        }

        return {
          _id: txn.id,
          date: txn.transactionDate,
          referenceNo: txn.referenceNo || '-',
          transactionType: TX_LABELS[txn.transactionType] || txn.transactionType,
          item: txn.item?.itemName || '-',
          department: txn.department?.name || '-',
          location: txn.location?.locationName || '-',
          source,
          destination,
          quantityIn: qtyIn,
          quantityOut: qtyOut,
          balanceQty: runningBalance,
          remarks: txn.remarks || '-',
        };
      });

      if (q) return result.filter((r: any) => r.item?.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q) || r.referenceNo?.toLowerCase().includes(q));
      return result.reverse();
    }
    case 'movement_register': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (sd || ed) { where.transactionDate = {}; if (sd) where.transactionDate.gte = sd; if (ed) where.transactionDate.lte = ed; }
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedDepartment) where.departmentId = Number(selectedDepartment);
      if (selectedTxType) where.transactionType = selectedTxType;
      include.item = true;
      include.department = true;
      const data = await api.dbQuery('stockTransaction', 'findMany', { where, include, orderBy: { transactionDate: 'asc' } });
      if (q) return data.filter((t: any) => t.item?.itemName?.toLowerCase().includes(q) || t.department?.name?.toLowerCase().includes(q));
      return data;
    }
    case 'transfer_register': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.status = 'Posted';
      if (sd || ed) { where.date = {}; if (sd) where.date.gte = sd; if (ed) where.date.lte = ed; }
      if (selectedDepartment) {
        where.OR = [{ fromDepartmentId: Number(selectedDepartment) }, { toDepartmentId: Number(selectedDepartment) }];
      }
      include.fromDepartment = true;
      include.toDepartment = true;
      include.items = { include: { item: true } };
      const data = await api.dbQuery('transferChallan', 'findMany', { where, include, orderBy: { date: 'asc' }, take: 2000 });
      if (q) return data.filter((r: any) => r.challanNo?.toLowerCase().includes(q) || r.fromDepartment?.name?.toLowerCase().includes(q) || r.toDepartment?.name?.toLowerCase().includes(q));
      return data;
    }
    case 'vendor_returns': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.status = 'Posted';
      if (sd || ed) { where.date = {}; if (sd) where.date.gte = sd; if (ed) where.date.lte = ed; }
      if (selectedVendor) where.vendorId = Number(selectedVendor);
      include.vendor = true;
      include.items = { include: { item: true } };
      const data = await api.dbQuery('vendorReturnChallan', 'findMany', { where, include, orderBy: { date: 'asc' }, take: 2000 });
      if (q) return data.filter((r: any) => r.challanNo?.toLowerCase().includes(q) || r.vendor?.name?.toLowerCase().includes(q));
      return data;
    }
    case 'purchase_history': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      where.transactionType = { in: ['PURCHASE', 'RECEIPT', 'OPENING_STOCK'] };
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedCategoryId) where.item = { categoryId: selectedCategoryId };
      if (sd || ed) { where.transactionDate = {}; if (sd) where.transactionDate.gte = sd; if (ed) where.transactionDate.lte = ed; }
      include.item = { include: { unit: true } };
      include.department = true;
      const data = await api.dbQuery('stockTransaction', 'findMany', { where, include, orderBy: [{ itemId: 'asc' }, { transactionDate: 'asc' }, { id: 'asc' }] });
      const itemGroups: Record<number, any[]> = {};
      data.forEach((t: any) => {
        if (!itemGroups[t.itemId]) itemGroups[t.itemId] = [];
        itemGroups[t.itemId].push(t);
      });
      const result: any[] = [];
      let sNo = 1;
      Object.entries(itemGroups).forEach(([itemId, txns]) => {
        let cumulativeQty = 0;
        let cumulativeValue = 0;
        txns.forEach((txn: any) => {
          const qty = Number(txn.quantityIn || 0) - Number(txn.quantityOut || 0);
          cumulativeQty += Math.abs(qty);
          cumulativeValue += Math.abs(qty) * Number(txn.rate || 0);
          result.push({
            sNo: sNo++,
            itemCode: txn.item?.itemCode || '',
            itemName: txn.item?.itemName || '',
            dateFormatted: txn.transactionDate ? new Date(txn.transactionDate).toLocaleDateString('en-IN') : '',
            challanNo: txn.referenceNo || '',
            storeName: txn.department?.name || '',
            qty: qty > 0 ? `+${qty}` : qty < 0 ? `${qty}` : '0',
            rate: Number(txn.rate || 0),
            total: Math.abs(qty) * Number(txn.rate || 0),
            totalQty: cumulativeQty,
            avgRate: cumulativeQty > 0 ? cumulativeValue / cumulativeQty : 0,
          });
        });
      });
      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }
    case 'stock_adjustments': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      if (sd || ed) { where.date = {}; if (sd) where.date.gte = sd; if (ed) where.date.lte = ed; }
      if (selectedItemId) where.itemId = selectedItemId;
      if (selectedAdjustmentType) where.adjustmentType = selectedAdjustmentType;
      include.item = true;
      const data = await api.dbQuery('stockAdjustment', 'findMany', { where, include, orderBy: { date: 'desc' }, take: 2000 });
      if (q) return data.filter((r: any) => r.item?.itemName?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q));
      return data;
    }
    case 'audit_log': {
      where.companyId = companyId;
      if (sd || ed) { where.createdAt = {}; if (sd) where.createdAt.gte = sd; if (ed) where.createdAt.lte = ed; }
      if (selectedAuditAction) where.action = selectedAuditAction;
      if (selectedAuditTable) where.tableName = selectedAuditTable;
      const data = await api.dbQuery('auditLog', 'findMany', { where, orderBy: { createdAt: 'desc' }, take: 2000 });
      if (q) return data.filter((r: any) => r.action?.toLowerCase().includes(q) || r.tableName?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
      return data;
    }
    case 'dharamshala_items': {
      where.companyId = companyId;
      where.financialYearId = financialYearId;
      const data = await api.dbQuery('stockTransaction', 'findMany', { where: {
        companyId, financialYearId,
        location: { locationType: 'Dharamshala' },
      }, select: {
        itemId: true, quantityIn: true, quantityOut: true,
        item: { include: { category: true, unit: true } },
      }, orderBy: { transactionDate: 'desc' } });
      const summary: Record<string, any> = {};
      data.forEach((t: any) => {
        const key = t.itemId;
        if (!summary[key]) summary[key] = { item: t.item, totalIn: 0, totalOut: 0 };
        summary[key].totalIn += Number(t.quantityIn || 0);
        summary[key].totalOut += Number(t.quantityOut || 0);
      });
      let result = Object.values(summary).map((s: any) => ({ ...s.item, totalReceived: s.totalIn, totalIssued: s.totalOut, currentStock: s.totalIn - s.totalOut }));
      if (q) result = result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return result;
    }

    // ==================== ENTERPRISE REPORTS ====================

    case 'central_store_summary': {
      // Store-level stock & issue summary with destination-wise breakdown
      const storeId = selectedDepartment ? Number(selectedDepartment) : null;
      if (!storeId) return [];

      // Get all transactions for this store
      const txns = await api.dbQuery('stockTransaction', 'findMany', {
        where: {
          companyId, financialYearId,
          departmentId: storeId,
          ...(sd || ed ? { transactionDate: { ...(sd ? { gte: sd } : {}), ...(ed ? { lte: ed } : {}) } } : {}),
        },
        include: { item: { include: { category: true, unit: true } }, department: true, location: true },
        orderBy: { transactionDate: 'asc' },
      });

      // Get all ISSUE transactions going OUT from this store (for destination breakdown)
      const issueTxns = await api.dbQuery('stockTransaction', 'findMany', {
        where: {
          companyId, financialYearId,
          departmentId: storeId,
          transactionType: 'ISSUE',
          quantityOut: { gt: 0 },
          ...(sd || ed ? { transactionDate: { ...(sd ? { gte: sd } : {}), ...(ed ? { lte: ed } : {}) } } : {}),
        },
        include: { department: true },
      });

      // Get issue breakdown: for each item, which departments received stock
      const issueBreakdown: Record<number, Record<string, number>> = {};
      for (const txn of issueTxns) {
        if (!txn.department) continue;
        // We need to find the paired ISSUE IN row to know the destination
        // The paired row has same referenceNo and itemId but quantityIn > 0
        const destTxns = await api.dbQuery('stockTransaction', 'findMany', {
          where: {
            companyId, financialYearId,
            itemId: txn.itemId,
            referenceNo: txn.referenceNo,
            transactionType: 'ISSUE',
            quantityIn: { gt: 0 },
            departmentId: { not: storeId },
          },
          include: { department: true },
        });
        for (const dest of destTxns) {
          if (!dest.department) continue;
          if (!issueBreakdown[txn.itemId]) issueBreakdown[txn.itemId] = {};
          const deptName = dest.department.name;
          issueBreakdown[txn.itemId][deptName] = (issueBreakdown[txn.itemId][deptName] || 0) + Number(txn.quantityOut);
        }
      }

      // Aggregate per item
      const itemMap: Record<number, any> = {};
      for (const txn of txns) {
        const iid = txn.itemId;
        if (!itemMap[iid]) {
          itemMap[iid] = {
            _itemId: iid,
            itemCode: txn.item?.itemCode || '',
            itemName: txn.item?.itemName || '',
            categoryName: txn.item?.category?.name || '',
            unitName: txn.item?.unit?.name || '',
            minimumStockLevel: Number(txn.item?.minimumStockLevel || 0),
            totalReceived: 0,
            totalIssued: 0,
            damagedQty: 0,
            issueBreakdown: issueBreakdown[iid] || {},
          };
        }
        const qtyIn = Number(txn.quantityIn || 0);
        const qtyOut = Number(txn.quantityOut || 0);
        if (['PURCHASE', 'OPENING_STOCK', 'RECEIPT'].includes(txn.transactionType)) {
          itemMap[iid].totalReceived += qtyIn;
        }
        if (txn.transactionType === 'ISSUE' || txn.transactionType === 'TRANSFER_OUT') {
          itemMap[iid].totalIssued += qtyOut;
        }
        if (txn.transactionType === 'DAMAGE' || txn.condition === 'DAMAGED') {
          itemMap[iid].damagedQty += qtyOut || qtyIn;
        }
      }

      const items = Object.values(itemMap).map((item: any) => ({
        ...item,
        currentStock: item.totalReceived - item.totalIssued - item.damagedQty,
        stockStatus: (item.totalReceived - item.totalIssued - item.damagedQty) <= 0 ? 'Out of Stock'
          : (item.totalReceived - item.totalIssued - item.damagedQty) <= item.minimumStockLevel ? 'Low Stock' : 'Normal',
        breakdownText: Object.entries(item.issueBreakdown).map(([dept, qty]) => `${dept} (${qty})`).join(', ') || '-',
      }));

      if (q) return items.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return items;
    }

    case 'dharamshala_distribution': {
      // Dharamshala-level stock with room allocation breakdown
      const deptId = selectedDepartment ? Number(selectedDepartment) : null;
      if (!deptId) return [];

      // Get department type to determine query logic
      const dept = await api.dbQuery('department', 'findFirst', { where: { id: deptId } });
      const isStore = dept?.departmentType === 'Store';

      const txns = await api.dbQuery('stockTransaction', 'findMany', {
        where: { companyId, financialYearId, departmentId: deptId },
        include: { item: { include: { category: true, unit: true } }, location: true },
        orderBy: { transactionDate: 'asc' },
      });

      const itemMap: Record<number, any> = {};
      for (const txn of txns) {
        const iid = txn.itemId;
        if (!itemMap[iid]) {
          itemMap[iid] = {
            _itemId: iid,
            itemCode: txn.item?.itemCode || '',
            itemName: txn.item?.itemName || '',
            unitName: txn.item?.unit?.name || '',
            totalReceived: 0,
            allocatedToRooms: 0,
            rooms: {} as Record<string, number>,
            poolBalance: 0,
          };
        }
        const qtyIn = Number(txn.quantityIn || 0);
        const qtyOut = Number(txn.quantityOut || 0);
        const roomName = txn.location?.locationName || null;
        const isRoom = txn.locationId != null;

        if (isStore) {
          // Store: PURCHASE/TRANSFER_IN/OPENING_STOCK = received, ISSUE/TRANSFER_OUT = sent out
          if ((txn.transactionType === 'PURCHASE' || txn.transactionType === 'TRANSFER_IN' || txn.transactionType === 'OPENING_STOCK') && qtyIn > 0) {
            itemMap[iid].totalReceived += qtyIn;
          }
          if ((txn.transactionType === 'ISSUE' || txn.transactionType === 'TRANSFER_OUT') && qtyOut > 0) {
            itemMap[iid].allocatedToRooms += qtyOut;
          }
        } else {
          // Dharamshala: ISSUE/OPENING_STOCK without room = pool, with room = allocated
          if ((txn.transactionType === 'ISSUE' || txn.transactionType === 'OPENING_STOCK') && qtyIn > 0 && !isRoom) {
            itemMap[iid].totalReceived += qtyIn;
          }
          if ((txn.transactionType === 'ISSUE' || txn.transactionType === 'OPENING_STOCK') && qtyIn > 0 && isRoom && roomName) {
            itemMap[iid].rooms[roomName] = (itemMap[iid].rooms[roomName] || 0) + qtyIn;
          }
        }
        // Both: TRANSFER_OUT with room = item sent from room to pool/another dharamshala
        if (txn.transactionType === 'TRANSFER_OUT' && qtyOut > 0 && roomName) {
          itemMap[iid].rooms[roomName] = (itemMap[iid].rooms[roomName] || 0) - qtyOut;
        }
      }

      // Calculate allocated and pool balance
      for (const item of Object.values(itemMap)) {
        if (!isStore) {
          // Dharamshala: allocated = sum of room allocations
          item.allocatedToRooms = Object.values(item.rooms).reduce((s: number, v: any) => s + Math.max(0, Number(v)), 0);
        }
        item.poolBalance = item.totalReceived - item.allocatedToRooms;
      }

      const items = Object.values(itemMap).map((item: any) => ({
        ...item,
        roomBreakdown: Object.entries(item.rooms).filter(([_, v]: any) => v > 0).map(([name, qty]) => `${name} (${qty})`).join(', ') || '-',
      }));

      if (q) return items.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return items;
    }

    case 'room_facilities': {
      // Installed assets per room with status
      const whereClause: any = {};
      if (selectedDepartment) {
        // Resolve department → location by name (Department and Location are separate tables)
        const dept = await api.dbQuery('department', 'findFirst', {
          where: { id: Number(selectedDepartment) },
        });
        if (dept) {
          const parentLoc = await api.dbQuery('location', 'findFirst', {
            where: { locationName: dept.name, locationType: { in: ['Dharamshala', 'Store'] } },
          });
          if (parentLoc) {
            whereClause.location = { parentId: parentLoc.id };
          }
        }
      }
      if (selectedLocation) {
        whereClause.locationId = Number(selectedLocation);
      }

      const installs = await api.dbQuery('assetInstallation', 'findMany', {
        where: whereClause,
        include: {
          item: { include: { category: true, unit: true } },
          location: true,
        },
        orderBy: { installedDate: 'desc' },
      });

      const result = installs.map((inst: any) => ({
        _id: inst.id,
        roomNo: inst.location?.locationName || '-',
        roomCategory: inst.location?.category || '-',
        floor: inst.location?.floor || '-',
        itemName: inst.item?.itemName || '-',
        itemCode: inst.item?.itemCode || '-',
        quantity: Number(inst.quantity),
        unitName: inst.item?.unit?.name || '-',
        installedDate: inst.installedDate,
        issueChallanNo: inst.issueChallanId ? `IC-${String(inst.issueChallanId).padStart(5, '0')}` : '-',
        status: inst.status,
        remarks: inst.remarks || '-',
      }));

      if (q) return result.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.roomNo?.toLowerCase().includes(q));
      return result;
    }

    case 'item_audit_ledger': {
      // Complete item movement history with source/destination resolution
      if (!selectedItemId) return [];

      const txns = await api.dbQuery('stockTransaction', 'findMany', {
        where: {
          companyId, financialYearId,
          itemId: Number(selectedItemId),
          ...(sd || ed ? { transactionDate: { ...(sd ? { gte: sd } : {}), ...(ed ? { lte: ed } : {}) } } : {}),
        },
        include: { department: true, location: true },
        orderBy: { transactionDate: 'asc' },
      });

      const TX_LABELS: Record<string, string> = {
        PURCHASE: 'Purchase', ISSUE: 'Issue', TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
        REVERSAL: 'Reversal', ADJUSTMENT_IN: 'Adjustment In', ADJUSTMENT_OUT: 'Adjustment Out',
        DAMAGE: 'Damage', VENDOR_RETURN: 'Vendor Return', OPENING_STOCK: 'Opening Stock',
        RETURN_IN: 'Return In', RETURN_OUT: 'Return Out',
      };

      let runningBalance = 0;
      const result = txns.map((txn: any) => {
        const qtyIn = Number(txn.quantityIn || 0);
        const qtyOut = Number(txn.quantityOut || 0);
        runningBalance += qtyIn - qtyOut;

        // Resolve source/destination from transaction type
        let source = '-';
        let destination = '-';
        if (txn.transactionType === 'PURCHASE' || txn.transactionType === 'OPENING_STOCK') {
          source = txn.remarks || 'External';
          destination = txn.department?.name || 'Store';
        } else if (txn.transactionType === 'ISSUE') {
          if (qtyOut > 0) {
            source = txn.department?.name || 'Store';
            destination = txn.remarks || '-';
          } else {
            source = txn.remarks || '-';
            destination = txn.department?.name || 'Dharamshala';
          }
        } else if (txn.transactionType === 'TRANSFER_OUT') {
          source = `${txn.department?.name || ''}${txn.location ? '/' + txn.location.locationName : ''}`;
          destination = txn.remarks || '-';
        } else if (txn.transactionType === 'TRANSFER_IN') {
          source = txn.remarks || '-';
          destination = `${txn.department?.name || ''}${txn.location ? '/' + txn.location.locationName : ''}`;
        } else if (txn.transactionType === 'DAMAGE') {
          source = txn.department?.name || '-';
          destination = 'Scrap';
        } else if (txn.transactionType === 'VENDOR_RETURN') {
          source = txn.department?.name || '-';
          destination = 'Vendor';
        } else {
          source = txn.department?.name || '-';
          destination = txn.location?.locationName || '-';
        }

        return {
          _id: txn.id,
          date: txn.transactionDate,
          referenceNo: txn.referenceNo || '-',
          transactionType: TX_LABELS[txn.transactionType] || txn.transactionType,
          source,
          destination,
          quantityIn: qtyIn,
          quantityOut: qtyOut,
          balanceQty: runningBalance,
          createdBy: txn.createdBy || '-',
          remarks: txn.remarks || '-',
        };
      });

      if (q) return result.filter((r: any) => r.referenceNo?.toLowerCase().includes(q) || r.transactionType?.toLowerCase().includes(q) || r.source?.toLowerCase().includes(q) || r.destination?.toLowerCase().includes(q));
      return result;
    }

    case 'damage_scrap_returns': {
      // Combined damage, scrap & vendor return report
      const [damageData, returnData] = await Promise.all([
        api.dbQuery('damageEntry', 'findMany', {
          where: {
            ...(sd || ed ? { date: { ...(sd ? { gte: sd } : {}), ...(ed ? { lte: ed } : {}) } } : {}),
          },
          include: { item: { include: { category: true, unit: true } }, location: true },
          orderBy: { date: 'desc' },
        }),
        api.dbQuery('vendorReturnChallan', 'findMany', {
          where: {
            status: 'Posted',
            ...(sd || ed ? { date: { ...(sd ? { gte: sd } : {}), ...(ed ? { lte: ed } : {}) } } : {}),
          },
          include: { vendor: true, items: { include: { item: { include: { category: true, unit: true } } } } },
          orderBy: { date: 'desc' },
        }),
      ]);

      const rows: any[] = [];

      for (const d of damageData) {
        rows.push({
          _id: `DMG-${d.id}`,
          date: d.date,
          entryType: 'DAMAGE',
          referenceNo: `DMG-${d.id}`,
          itemName: d.item?.itemName || '-',
          itemCode: d.item?.itemCode || '-',
          quantity: Number(d.quantity),
          unitName: d.item?.unit?.name || '-',
          sourceLocation: d.location?.locationName || '-',
          reason: d.reason || '-',
          actionTaken: 'Sent to Scrap',
          reportedBy: d.reportedBy || '-',
          categoryName: d.item?.category?.name || '-',
        });
      }

      for (const r of returnData) {
        for (const item of r.items || []) {
          rows.push({
            _id: `VRC-${r.challanNo}`,
            date: r.date,
            entryType: 'VENDOR_RETURN',
            referenceNo: r.challanNo,
            itemName: item.item?.itemName || '-',
            itemCode: item.item?.itemCode || '-',
            quantity: Number(item.quantity),
            unitName: item.item?.unit?.name || '-',
            sourceLocation: '-',
            reason: r.reason || '-',
            actionTaken: `Returned to ${r.vendor?.name || 'Vendor'}`,
            reportedBy: r.returnedBy || '-',
            categoryName: item.item?.category?.name || '-',
          });
        }
      }

      rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Filter by category if selected
      if (selectedCategoryId) {
        const cat = await api.dbQuery('itemCategory', 'findUnique', { where: { id: Number(selectedCategoryId) } });
        if (cat?.name) return rows.filter(r => r.categoryName === cat.name);
      }

      if (q) return rows.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.referenceNo?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q));
      return rows;
    }

    case 'stock_summary': {
      // Aggregate stock by item — total received, total issued, current balance
      const allTx = await api.dbQuery('stockTransaction', 'findMany', {
        where: { companyId, financialYearId, ...(sd || ed ? { transactionDate: { ...(sd ? { gte: sd } : {}), ...(ed ? { lte: ed } : {}) } } : {}) },
        include: { item: true, location: true, department: true },
        orderBy: { transactionDate: 'asc' },
        take: 10000,
      });

      const itemMap = new Map<number, any>();
      for (const tx of allTx as any[]) {
        const key = tx.itemId;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            itemCode: tx.item?.itemCode || '',
            itemName: tx.item?.itemName || '',
            category: tx.item?.category?.name || '',
            unit: tx.item?.unit?.name || '',
            totalReceived: 0,
            totalIssued: 0,
            currentStock: 0,
            lastDate: tx.transactionDate,
            lastRate: tx.rate,
          });
        }
        const agg = itemMap.get(key);
        agg.totalReceived += Number(tx.quantityIn || 0);
        agg.totalIssued += Number(tx.quantityOut || 0);
        agg.currentStock = agg.totalReceived - agg.totalIssued;
        if (tx.transactionDate > agg.lastDate) {
          agg.lastDate = tx.transactionDate;
          agg.lastRate = tx.rate;
        }
      }

      let rows = Array.from(itemMap.values());
      if (q) rows = rows.filter((r: any) => r.itemName?.toLowerCase().includes(q) || r.itemCode?.toLowerCase().includes(q));
      return rows;
    }

    default:
      return [];
  }
}
