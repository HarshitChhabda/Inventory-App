import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
import {
  Box, Typography, Paper, Stack, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab, Autocomplete, Chip, Card,
  CardContent, alpha, useTheme, IconButton, Tooltip, Divider, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, Switch, FormControlLabel,
  Collapse, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import EnterpriseDialog from '../../components/EnterpriseDialog';
import {
  Download as DownloadIcon, Assessment, FilterList, Inventory, LocalShipping,
  Business, Analytics, TrendingUp, TrendingDown, Warning, Search,
  CalendarMonth, Clear, ArrowBack, ExpandMore, ExpandLess, Print as PrintIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import EmptyState from '../../components/EmptyState';
import DatePickerField from '../../components/DatePickerField';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { exportToExcel, ExportColumn, downloadBuffer } from '../../utils/importExport';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { safeNumber, safeFixed, toNumber } from '../../utils/numberUtils';
import toast from 'react-hot-toast';
import {
  REPORT_SECTIONS, REPORT_NAMES, TX_TYPES, ADJUSTMENT_TYPES, AUDIT_ACTIONS,
  EXCLUDE_KEYS, COLUMN_LABELS, REPORT_FILTER_MAP,
} from './reportConfigs';
import { fetchReportData } from './reportQueries';
import {
  CentralStoreSummaryReport,
  DharamshalaDistributionReport,
  RoomFacilitiesReport,
  ItemAuditLedgerReport,
  DamageScrapReturnsReport,
  ItemLifecycleRenderer,
  VisualAnalyticsRenderer,
} from './ReportRenderers';

export default function ReportsPage() {
  const { company, financialYear } = useCompany();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => { try { return localStorage.getItem('reports_startDate') || ''; } catch { return ''; } });
  const [endDate, setEndDate] = useState(() => { try { return localStorage.getItem('reports_endDate') || ''; } catch { return ''; } });
  const [selectedItemId, setSelectedItemId] = useState<number | null>(() => { try { const v = localStorage.getItem('reports_selectedItemId'); return v ? Number(v) : null; } catch { return null; } });
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(() => { try { const v = localStorage.getItem('reports_selectedCategoryId'); return v ? Number(v) : null; } catch { return null; } });
  const [selectedDepartment, setSelectedDepartment] = useState(() => { try { return localStorage.getItem('reports_selectedDepartment') || ''; } catch { return ''; } });
  const [selectedVendor, setSelectedVendor] = useState(() => { try { return localStorage.getItem('reports_selectedVendor') || ''; } catch { return ''; } });
  const [selectedLocation, setSelectedLocation] = useState(() => { try { return localStorage.getItem('reports_selectedLocation') || ''; } catch { return ''; } });
  const [selectedTxType, setSelectedTxType] = useState(() => { try { return localStorage.getItem('reports_selectedTxType') || ''; } catch { return ''; } });
  const [selectedAdjustmentType, setSelectedAdjustmentType] = useState(() => { try { return localStorage.getItem('reports_selectedAdjustmentType') || ''; } catch { return ''; } });
  const [selectedStatus, setSelectedStatus] = useState(() => { try { return localStorage.getItem('reports_selectedStatus') || ''; } catch { return ''; } });
  const [selectedAuditAction, setSelectedAuditAction] = useState(() => { try { return localStorage.getItem('reports_selectedAuditAction') || ''; } catch { return ''; } });
  const [selectedAuditTable, setSelectedAuditTable] = useState(() => { try { return localStorage.getItem('reports_selectedAuditTable') || ''; } catch { return ''; } });
  const [searchText, setSearchText] = useState(() => { try { return localStorage.getItem('reports_searchText') || ''; } catch { return ''; } });
  const [lowStockOnly, setLowStockOnly] = useState(() => { try { return localStorage.getItem('reports_lowStockOnly') === 'true'; } catch { return false; } });
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => { try { const v = localStorage.getItem('reports_selectedStoreId'); return v ? Number(v) : null; } catch { return null; } });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [reportSearch, setReportSearch] = useState('');
  const [issueDrilldownItem, setIssueDrilldownItem] = useState<any>(null);
  const [stockDetailItem, setStockDetailItem] = useState<any>(null);
  const [reportPage, setReportPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const rowsPerPage = 50;

  // Persist filters to localStorage
  useEffect(() => {
    const save = (k: string, v: any) => { try { localStorage.setItem(k, v); } catch {} };
    save('reports_startDate', startDate);
    save('reports_endDate', endDate);
    save('reports_selectedItemId', selectedItemId ?? '');
    save('reports_selectedCategoryId', selectedCategoryId ?? '');
    save('reports_selectedDepartment', selectedDepartment);
    save('reports_selectedVendor', selectedVendor);
    save('reports_selectedLocation', selectedLocation);
    save('reports_selectedTxType', selectedTxType);
    save('reports_selectedAdjustmentType', selectedAdjustmentType);
    save('reports_selectedStatus', selectedStatus);
    save('reports_selectedAuditAction', selectedAuditAction);
    save('reports_selectedAuditTable', selectedAuditTable);
    save('reports_searchText', searchText);
    save('reports_lowStockOnly', lowStockOnly);
    save('reports_selectedStoreId', selectedStoreId ?? '');
  }, [startDate, endDate, selectedItemId, selectedCategoryId, selectedDepartment, selectedVendor, selectedLocation, selectedTxType, selectedAdjustmentType, selectedStatus, selectedAuditAction, selectedAuditTable, searchText, lowStockOnly, selectedStoreId]);

  const [appliedFilters, setAppliedFilters] = useState(() => {
    const get = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
    const getN = (k: string) => { try { const v = localStorage.getItem(k); return v ? Number(v) : null; } catch { return null; } };
    const getB = (k: string) => { try { return localStorage.getItem(k) === 'true'; } catch { return false; } };
    return {
      startDate: get('reports_startDate'), endDate: get('reports_endDate'),
      selectedItemId: getN('reports_selectedItemId'), selectedCategoryId: getN('reports_selectedCategoryId'),
      selectedDepartment: get('reports_selectedDepartment'), selectedVendor: get('reports_selectedVendor'),
      selectedLocation: get('reports_selectedLocation'), selectedTxType: get('reports_selectedTxType'),
      selectedAdjustmentType: get('reports_selectedAdjustmentType'), selectedStatus: get('reports_selectedStatus'),
      selectedAuditAction: get('reports_selectedAuditAction'), selectedAuditTable: get('reports_selectedAuditTable'),
      searchText: get('reports_searchText'), lowStockOnly: getB('reports_lowStockOnly'),
      selectedStoreId: getN('reports_selectedStoreId'),
    };
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      startDate, endDate, selectedItemId, selectedCategoryId,
      selectedDepartment, selectedVendor, selectedLocation,
      selectedTxType, selectedAdjustmentType, selectedStatus,
      selectedAuditAction, selectedAuditTable, searchText, lowStockOnly,
      selectedStoreId,
    });
    setReportPage(0);
    setShowAll(false);
  };

  const handleResetFilters = () => {
    setStartDate(''); setEndDate(''); setSelectedItemId(null);
    setSelectedCategoryId(null); setSelectedDepartment('');
    setSelectedVendor(''); setSelectedLocation('');
    setSelectedTxType(''); setSelectedAdjustmentType('');
    setSelectedStatus(''); setSelectedAuditAction('');
    setSelectedAuditTable(''); setSearchText('');
    setLowStockOnly(false); setSelectedStoreId(null);
    setAppliedFilters({
      startDate: '', endDate: '', selectedItemId: null, selectedCategoryId: null,
      selectedDepartment: '', selectedVendor: '', selectedLocation: '',
      selectedTxType: '', selectedAdjustmentType: '', selectedStatus: '',
      selectedAuditAction: '', selectedAuditTable: '', searchText: '', lowStockOnly: false,
      selectedStoreId: null,
    });
    setReportPage(0);
    setShowAll(false);
    // Clear persisted filters
    ['reports_startDate','reports_endDate','reports_selectedItemId','reports_selectedCategoryId','reports_selectedDepartment','reports_selectedVendor','reports_selectedLocation','reports_selectedTxType','reports_selectedAdjustmentType','reports_selectedStatus','reports_selectedAuditAction','reports_selectedAuditTable','reports_searchText','reports_lowStockOnly','reports_selectedStoreId'].forEach(k => { try { localStorage.removeItem(k); } catch {} });
  };

  const debouncedSearch = useDebounce(appliedFilters.searchText, 300);
  const debouncedStartDate = useDebounce(appliedFilters.startDate, 300);
  const debouncedEndDate = useDebounce(appliedFilters.endDate, 300);

  useEffect(() => {
    setReportPage(0);
    setShowAll(false);
  }, [debouncedSearch, debouncedStartDate, debouncedEndDate, appliedFilters.selectedCategoryId, appliedFilters.selectedDepartment, appliedFilters.selectedVendor, appliedFilters.selectedLocation, appliedFilters.selectedTxType, appliedFilters.selectedItemId, appliedFilters.selectedStoreId]);

  // Reset location when department changes (rooms belong to specific dharamshala)
  useEffect(() => {
    setSelectedLocation('');
  }, [selectedDepartment]);

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, orderBy: { itemName: 'asc' } }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => window.electronAPI.dbQuery('itemCategory', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company?.id } }),
    enabled: !!company?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => window.electronAPI.dbQuery('vendor', 'findMany', { where: { isActive: true }, orderBy: { vendorName: 'asc' } }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', selectedDepartment],
    queryFn: async () => {
      if (selectedDepartment) {
        // Find department name, then find matching parent location, then return its child rooms
        const dept = departments?.find((d: any) => d.id === Number(selectedDepartment));
        if (dept) {
          const parentLoc = await window.electronAPI.dbQuery('location', 'findFirst', {
            where: { name: dept.name, locationType: { in: ['Dharamshala', 'Store', 'Department'] } },
          });
          if (parentLoc) {
            return window.electronAPI.dbQuery('location', 'findMany', {
              where: { parentId: parentLoc.id, isActive: true },
              orderBy: { name: 'asc' },
            });
          }
        }
        return [];
      }
      return window.electronAPI.dbQuery('location', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } });
    },
    enabled: !!departments,
    staleTime: 5 * 60 * 1000,
  });

  // Departments that have at least one child room (for room_facilities filter)
  const { data: deptsWithRooms } = useQuery({
    queryKey: ['deptsWithRooms', company?.id],
    queryFn: async () => {
      // Get all parent locations (Dharamshala/Store/Department) that have at least one child room
      const parentLocations = await window.electronAPI.dbQuery('location', 'findMany', {
        where: { locationType: { in: ['Dharamshala', 'Store', 'Department'] }, isActive: true },
      });
      const parentIds = parentLocations.map((p: any) => p.id);
      if (parentIds.length === 0) return [];
      // Check which parents have child rooms
      const childRooms = await window.electronAPI.dbQuery('location', 'findMany', {
        where: { parentId: { in: parentIds }, isActive: true },
        select: { parentId: true },
      });
      const parentNamesWithRooms = new Set(childRooms.map((r: any) => {
        const parent = parentLocations.find((p: any) => p.id === r.parentId);
        return parent?.name;
      }).filter(Boolean));
      // Return only departments whose name matches a parent location that has rooms
      return departments?.filter((d: any) => parentNamesWithRooms.has(d.name)) || [];
    },
    enabled: !!departments && !!company?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => window.electronAPI.dbQuery('user', 'findMany', { where: { isActive: true }, orderBy: { username: 'asc' } }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: issueBreakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ['issueBreakdown', company?.id, financialYear?.id, issueDrilldownItem?.id],
    queryFn: () => window.electronAPI.getIssueBreakdown(company!.id, financialYear!.id, issueDrilldownItem!.id),
    enabled: !!company?.id && !!financialYear?.id && !!issueDrilldownItem?.id,
    refetchOnMount: true,
  });

  const { data: stockTransactions, isLoading: stockTxLoading } = useQuery({
    queryKey: ['stockTransactions', company?.id, financialYear?.id, stockDetailItem?.id, appliedFilters.selectedCategoryId, appliedFilters.selectedDepartment],
    queryFn: async () => {
      const where: any = { companyId: company!.id, financialYearId: financialYear!.id, itemId: stockDetailItem!.id };
      if (appliedFilters.selectedDepartment) {
        where.departmentId = Number(appliedFilters.selectedDepartment);
      } else if (appliedFilters.selectedCategoryId) {
        const categories = await window.electronAPI.dbQuery('itemCategory', 'findMany', { where: { isActive: true } });
        const departments = await window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company?.id } });
        const selectedCat = categories.find((c: any) => c.id === Number(appliedFilters.selectedCategoryId));
        const matchingDept = selectedCat ? departments.find((d: any) => d.name === selectedCat.name) : null;
        if (matchingDept) where.departmentId = matchingDept.id;
      }
      return window.electronAPI.dbQuery('stockTransaction', 'findMany', {
        where,
        include: { transaction: { include: { department: true, fromStore: true, toStore: true } } },
        orderBy: { transactionDate: 'desc' },
      });
    },
    enabled: !!company?.id && !!financialYear?.id && !!stockDetailItem?.id,
    refetchOnMount: true,
  });

  const reportQuery = useQuery({
    queryKey: ['report', activeReport, company?.id, financialYear?.id, debouncedStartDate, debouncedEndDate, appliedFilters.selectedItemId, appliedFilters.selectedCategoryId, appliedFilters.selectedDepartment, appliedFilters.selectedVendor, appliedFilters.selectedLocation, appliedFilters.selectedTxType, appliedFilters.selectedAdjustmentType, appliedFilters.selectedStatus, appliedFilters.selectedAuditAction, appliedFilters.selectedAuditTable, appliedFilters.lowStockOnly, debouncedSearch, appliedFilters.selectedStoreId],
    queryFn: () => fetchReportData({
      activeReport: activeReport!,
      companyId: company!.id,
      financialYearId: financialYear!.id,
      startDate: debouncedStartDate,
      endDate: debouncedEndDate,
      selectedItemId: appliedFilters.selectedItemId,
      selectedCategoryId: appliedFilters.selectedCategoryId,
      selectedDepartment: appliedFilters.selectedDepartment,
      selectedVendor: appliedFilters.selectedVendor,
      selectedLocation: appliedFilters.selectedLocation,
      selectedTxType: appliedFilters.selectedTxType,
      selectedAdjustmentType: appliedFilters.selectedAdjustmentType,
      selectedStatus: appliedFilters.selectedStatus,
      selectedAuditAction: appliedFilters.selectedAuditAction,
      selectedAuditTable: appliedFilters.selectedAuditTable,
      searchText: debouncedSearch,
      lowStockOnly: appliedFilters.lowStockOnly,
      selectedStoreId: appliedFilters.selectedStoreId,
    }),
    enabled: !!company?.id && !!financialYear?.id && activeReport !== null,
    refetchOnMount: true,
  });

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedItemId(null);
    setSelectedCategoryId(null);
    setSelectedDepartment('');
    setSelectedVendor('');
    setSelectedLocation('');
    setSelectedTxType('');
    setSelectedAdjustmentType('');
    setSelectedStatus('');
    setSelectedAuditAction('');
    setSelectedAuditTable('');
    setSearchText('');
    setLowStockOnly(false);
    setSelectedStoreId(null);
    setAppliedFilters({
      startDate: '', endDate: '', selectedItemId: null, selectedCategoryId: null,
      selectedDepartment: '', selectedVendor: '', selectedLocation: '',
      selectedTxType: '', selectedAdjustmentType: '', selectedStatus: '',
      selectedAuditAction: '', selectedAuditTable: '', searchText: '', lowStockOnly: false,
      selectedStoreId: null,
    });
  };

  const hasFilters = appliedFilters.startDate || appliedFilters.endDate || appliedFilters.selectedItemId || appliedFilters.selectedCategoryId || appliedFilters.selectedDepartment || appliedFilters.selectedVendor || appliedFilters.selectedLocation || appliedFilters.selectedTxType || appliedFilters.selectedAdjustmentType || appliedFilters.selectedStatus || appliedFilters.selectedAuditAction || appliedFilters.selectedAuditTable || appliedFilters.searchText || appliedFilters.lowStockOnly || appliedFilters.selectedStoreId;

  const showDateFilter = ['receipt_register', 'issue_register', 'stock_ledger', 'item_history', 'movement_register', 'transfer_register', 'vendor_returns', 'vendor_purchase', 'damage_report', 'stock_adjustments', 'audit_log', 'dharamshala_items', 'purchase_history', 'central_store_summary', 'item_audit_ledger', 'damage_scrap_returns'].includes(activeReport || '');
  const showItemFilter = ['stock_ledger', 'stock_summary', 'low_stock', 'dead_stock', 'item_history', 'movement_register', 'department_wise', 'dharamshala_items', 'damage_report', 'stock_adjustments', 'stock_distribution', 'purchase_history', 'item_audit_ledger'].includes(activeReport || '');
  const showCategoryFilter = ['stock_summary', 'low_stock', 'dead_stock', 'current_stock_custom', 'stock_distribution', 'purchase_history', 'central_store_summary', 'damage_scrap_returns'].includes(activeReport || '');
  const showDepartmentFilter = ['stock_ledger', 'item_history', 'movement_register', 'department_wise', 'transfer_register', 'dharamshala_items', 'stock_distribution', 'department_stock_status', 'central_store_summary', 'dharamshala_distribution', 'room_facilities'].includes(activeReport || '');
  const showVendorFilter = ['receipt_register', 'vendor_purchase', 'vendor_returns'].includes(activeReport || '');
  const showLocationFilter = ['damage_report', 'stock_distribution', 'room_facilities'].includes(activeReport || '');
  const showTxTypeFilter = ['stock_ledger', 'movement_register', 'department_wise'].includes(activeReport || '');
  const showAdjustmentTypeFilter = ['stock_adjustments'].includes(activeReport || '');
  const showStatusFilter = ['receipt_register', 'issue_register', 'damage_report', 'stock_adjustments'].includes(activeReport || '');
  const showAuditFilters = ['audit_log'].includes(activeReport || '');
  const showSearchFilter = activeReport !== null;
  const showLowStockToggle = ['stock_summary'].includes(activeReport || '');
  const showStoreFilter = (REPORT_FILTER_MAP[activeReport || ''] || []).includes('store');

  const formatCellValue = (row: any, key: string, value: any): string => {
    if (value === null || value === undefined) {
      if (key === 'vendor' && row.sourceName) return row.sourceName;
      return '-';
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.itemName) return value.itemName;
      if (value.name) return value.name;
      if (value.challanNo) return value.challanNo;
      if (value.label) return value.label;
      if (value.fullName) return value.fullName;
      return '-';
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '-';
      const names = value.map((v: any) => v?.item?.itemName || v?.itemName || v?.name || v?.challanNo || null).filter(Boolean);
      if (names.length > 0) return names.join(', ');
      return `${value.length} items`;
    }
    if (key === 'itemId' && typeof value === 'number') {
      const item = items?.find((i: any) => i.id === value);
      return item ? `${item.itemCode} - ${item.itemName}` : `Item #${value}`;
    }
    if (key === 'departmentId' && typeof value === 'number') {
      const dept = departments?.find((d: any) => d.id === value);
      return dept ? dept.name : `Dept #${value}`;
    }
    if (key === 'vendorId' && typeof value === 'number') {
      const vendor = vendors?.find((v: any) => v.id === value);
      return vendor ? vendor.vendorName : `Vendor #${value}`;
    }
    if (key === 'categoryId' && typeof value === 'number') {
      const cat = categories?.find((c: any) => c.id === value);
      return cat ? cat.name : `Cat #${value}`;
    }
    if (key === 'locationId' && typeof value === 'number') {
      const loc = locations?.find((l: any) => l.id === value);
      return loc ? loc.name : `Loc #${value}`;
    }
    if ((key === 'storeId' || key === 'fromStoreId' || key === 'toStoreId') && typeof value === 'number') {
      const store = stores?.find((s: any) => s.id === value);
      return store ? store.name : `Store #${value}`;
    }
    if (key === 'roomId' && typeof value === 'number') {
      const loc = locations?.find((l: any) => l.id === value);
      return loc ? loc.name : `Room #${value}`;
    }
    if ((key.toLowerCase().includes('date') || key.endsWith('At') || key.endsWith('_at')) && typeof value === 'string') {
      try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return formatDateDDMMYYYY(d);
      } catch { }
    }
    if (key === 'status' || key === 'approvalStatus') return String(value);
    if (key === 'tableName') {
      const tableLabels: Record<string, string> = {
        ReceiptChallan: 'Goods Receipt', IssueChallan: 'Store Issue',
        TransferChallan: 'Store Transfer', StockTransaction: 'Stock Transaction',
        DamageEntry: 'Damage Entry', StockAdjustment: 'Stock Adjustment',
        VendorReturn: 'Vendor Return', Item: 'Item', User: 'User',
        Company: 'Company', FinancialYear: 'Financial Year',
        Asset: 'Asset', AssetInstallation: 'Asset Installation',
        Requisition: 'Requisition', PurchaseOrder: 'Purchase Order',
      };
      return tableLabels[value] || String(value).replace(/([A-Z])/g, ' $1').trim();
    }
    if (key === 'movementType') {
      const movementLabels: Record<string, string> = {
        PURCHASE_RECEIPT: 'Receipt', ISSUE_OUT: 'Issue Out', TRANSFER_IN: 'Transfer In',
        TRANSFER_OUT: 'Transfer Out', OPENING_BALANCE: 'Opening', ADJUSTMENT_IN: 'Adjustment +',
        ADJUSTMENT_OUT: 'Adjustment -', DAMAGE_OUT: 'Damage Out', VENDOR_RETURN: 'Vendor Return',
        INSTALL_IN: 'Install In', INSTALL_OUT: 'Install Out', REPAIR_IN: 'Repair In',
        REPAIR_OUT: 'Repair Out', SCRAP: 'Scrap', SHIFT_IN: 'Shift In', SHIFT_OUT: 'Shift Out',
      };
      return movementLabels[value] || String(value).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (key === 'transactionType' || key === 'voucherType') {
      const labels: Record<string, string> = {
        RECEIPT: 'Receipt', RC: 'Receipt', ISSUE: 'Issue', IS: 'Issue',
        TRANSFER_IN: 'Transfer In', TC: 'Transfer',
        ADJUSTMENT_IN: 'Adj In', ADJUSTMENT_OUT: 'Adj Out',
        DAMAGE: 'Damage', DM: 'Damage', VR: 'Vendor Return',
        OPENING_BALANCE: 'Opening', OB: 'Opening',
        CARRY_FORWARD: 'Carry Forward', CF: 'Carry Forward',
        REVERSAL: 'Reversal', RV: 'Reversal',
        INSTALL: 'Install', UNINSTALL: 'Uninstall', UN: 'Uninstall',
        SCRAP: 'Scrap', REPAIR: 'Repair',
      };
      return labels[value] || String(value);
    }
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('value')) {
        return `₹${value.toFixed(2)}`;
      }
      return String(value);
    }
    if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...';
    return String(value ?? '-');
  };

  const excludeKeys = [
    'id', 'uuid', 'companyId', 'financialYearId', 'categoryId', 'unitId', 'vendorId',
    'departmentId', 'locationId', 'parentId', 'receiptChallanId', 'issueChallanId',
    'transferChallanId', 'vendorReturnChallanId', 'assetInstallationId', 'originalReceiptId',
    'createdAt', 'updatedAt', 'cancelledAt', 'postedAt', 'sourceStoreId',
    'isActive', 'isClosed', 'closedAt', 'minimumStockLevel', 'categoryId',
  ];

  const columnLabels: Record<string, string> = {
    challanNo: 'Challan No', sourceType: 'Source', sourceName: 'Source Name',
    invoiceNumber: 'Invoice No', invoiceDate: 'Invoice Date', vehicleNumber: 'Vehicle No',
    receivedBy: 'Received By', issuedBy: 'Issued By', approvedBy: 'Approved By',
    transferredBy: 'Transferred By', returnedBy: 'Returned By', reportedBy: 'Reported By',
    adjustedBy: 'Adjusted By', createdBy: 'Created By', transactionType: 'Type',
    transactionDate: 'Date', quantityIn: 'Qty In', quantityOut: 'Qty Out',
    referenceType: 'Ref Type', referenceNo: 'Ref No',
    departmentType: 'Dept Type', departmentName: 'Department', itemName: 'Item Name',
    itemCode: 'Code', locationType: 'Location Type', locationName: 'Location',
    totalAmount: 'Total', purpose: 'Purpose', remarks: 'Remarks', adjustmentType: 'Type',
    reason: 'Reason', installedDate: 'Installed', installedBy: 'Installed By',
    status: 'Status', totalReceived: 'Received', totalIssued: 'Issued',
    currentStock: 'Current Stock', lastMovement: 'Last Movement', name: 'Name',
    username: 'Username', action: 'Action', tableName: 'Table', description: 'Description',
    oldValues: 'Old Values', newValues: 'New Values',
    item: 'Item Name', department: 'Department', location: 'Location',
    vendor: 'Vendor', items: 'Items',
    vendorName: 'Vendor Name', totalQty: 'Total Qty', rooms: 'Rooms / Location',
    balanceQty: 'Balance Qty', rate: 'Rate', total: 'Total',
    quantity: 'Qty', amount: 'Amount', unitName: 'Unit', postedAt: 'Posted At',
  };

  const renderReportData = () => {
    if (activeReport === null) return null;
    if (reportQuery.isLoading) return <TableSkeleton rows={8} columns={6} />;
    const data = reportQuery.data;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <EmptyState icon={<Assessment />} title="No data found" description="No records match your current filter criteria" />;
    }
    const keys = Object.keys(data[0]).filter((k) => !excludeKeys.includes(k) && !k.startsWith('_'));

    if (activeReport === 'current_stock_custom') {
      const selectedCat = categories?.find((c: any) => c.id === selectedCategoryId);
      const subTitle = selectedCat ? `${selectedCat.name} - Current Stock Report` : 'All Stores - Current Stock Report';
      const grandTotal = data.reduce((sum: number, row: any) => sum + (row.total || 0), 0);

      return (
        <Box>
          <Stack direction="row" justifyContent="flex-end" alignItems="center" mb={1.5}>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={async () => {
              try {
                const exportData = {
                  title: 'Digambar Jain Atishay Kshetra Shri Mahaveer JI',
                  subTitle,
                  columns: [
                    { header: 'S.NO.', key: 'sNo' },
                    { header: 'ITEM CODE', key: 'itemCode' },
                    { header: 'ITEM NAME', key: 'itemName' },
                    { header: 'CATEGORY', key: 'categoryName' },
                    { header: 'Total Stock Qty', key: 'totalIn' },
                    { header: 'AVG RATE', key: 'rate' },
                    { header: 'Balance STOCK QTY', key: 'stockQty' },
                    { header: 'TOTAL Rate Value', key: 'total' },
                  ],
                  rows: [...data, { sNo: '', itemCode: '', itemName: '', categoryName: '', totalIn: '', rate: '', stockQty: 'Grand Total', total: grandTotal }],
                };
                const buffer = await window.electronAPI.exportStockReport(exportData);
                downloadBuffer(buffer, 'Current_Stock_Report.xlsx');
                toast.success(`Exported ${data.length} rows`);
              } catch (err: any) {
                toast.error('Export failed: ' + err.message);
              }
            }}>
              Export
            </Button>
            <Button variant="outlined" size="small" startIcon={<PrintIcon />} sx={{ ml: 1 }} onClick={() => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              const rows = data.map((row: any, i: number) => `<tr><td>${i + 1}</td><td>${row.itemCode || ''}</td><td style="text-align:left">${row.itemName || ''}</td><td style="text-align:left">${row.categoryName || ''}</td><td>${row.totalIn ?? ''}</td><td>${row.rate?.toFixed(2) || '0.00'}</td><td>${row.stockQty ?? ''}</td><td>${row.total?.toFixed(2) || '0.00'}</td></tr>`).join('');
              const tableHtml = `<table><thead><tr><th>S.NO.</th><th>ITEM CODE</th><th>ITEM NAME</th><th>CATEGORY</th><th>Total Stock Qty</th><th>AVG RATE</th><th>Balance STOCK QTY</th><th>TOTAL Rate Value</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="7" style="text-align:right;font-weight:bold">Grand Total</td><td style="text-align:center;font-weight:bold">${grandTotal.toFixed(2)}</td></tr></tfoot></table>`;
              printWindow.document.write(`
                <html><head><title>Current Stock Report</title>
                <style>
                  body { font-family: serif; margin: 20px; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                  th { background-color: #f0f0f0; font-weight: bold; }
                  .header { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 5px; }
                  .subheader { text-align: center; font-weight: 600; font-size: 14px; margin-bottom: 10px; }
                  @media print { body { margin: 0; } }
                </style></head><body>
                <div class="header">Digambar Jain Atishay Kshetra Shri Mahaveer JI</div>
                <div class="subheader">${subTitle}</div>
                ${tableHtml}
                </body></html>
              `);
              printWindow.document.close();
              printWindow.print();
            }}>
              Print
            </Button>
          </Stack>

          <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #000', borderRadius: 0 }} elevation={0}>
            {/* Header section matching the image */}
            <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#000', fontFamily: 'serif' }}>
                Digambar Jain Atishay Kshetra Shri Mahaveer JI
              </Typography>
            </Box>
            <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000' }}>
                {subTitle}
              </Typography>
            </Box>

            <TableContainer>
              <Table id="stock-dist-table" size="small" sx={{
                '& .MuiTableCell-root': { borderBottom: '1px solid #000', borderRight: '1px solid #000', color: '#000', py: 1, px: 2 },
                '& .MuiTableCell-root:last-child': { borderRight: 'none' },
              }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>S.NO.</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>ITEM CODE</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>ITEM NAME</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>CATEGORY</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Total Stock Qty</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>AVG RATE</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Balance STOCK QTY</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>TOTAL Rate Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(showAll ? data : data.slice(reportPage * rowsPerPage, reportPage * rowsPerPage + rowsPerPage)).map((row: any) => (
                    <TableRow key={row._itemId} hover>
                      <TableCell align="center">{row.sNo}</TableCell>
                      <TableCell align="left">{row.itemCode}</TableCell>
                      <TableCell align="left">{row.itemName}</TableCell>
                      <TableCell align="left">{row.categoryName || ''}</TableCell>
                      <TableCell align="center">{row.totalIn}</TableCell>
                      <TableCell align="center">{row.rate?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          cursor: 'pointer',
                          color: 'primary.main',
                          fontWeight: 600,
                          textDecoration: 'underline',
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                        onClick={() => setStockDetailItem({ id: row._itemId, itemName: row.itemName, totalIn: row.totalIn, stockQty: row.stockQty })}
                      >
                        {row.stockQty}
                      </TableCell>
                      <TableCell align="center">{row.total?.toFixed(2) || '0.00'}</TableCell>
                    </TableRow>
                  ))}
                  {/* Grand Total Row */}
                  <TableRow>
                    <TableCell colSpan={7} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      Grand Total
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      {grandTotal.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            {data.length > rowsPerPage && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, borderTop: '1px solid #000' }}>
                <Typography variant="body2" sx={{ color: '#000' }}>
                  {showAll ? `All ${data.length} rows` : `Showing ${reportPage * rowsPerPage + 1}-${Math.min((reportPage + 1) * rowsPerPage, data.length)} of ${data.length}`}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant={showAll ? 'contained' : 'outlined'} onClick={() => { setShowAll(!showAll); setReportPage(0); }}>
                    {showAll ? 'Paginate' : 'All'}
                  </Button>
                  {!showAll && (
                    <>
                      <Button size="small" disabled={reportPage === 0} onClick={() => setReportPage(0)}>First</Button>
                      <Button size="small" disabled={reportPage === 0} onClick={() => setReportPage(p => p - 1)}>Prev</Button>
                      <Button size="small" disabled={(reportPage + 1) * rowsPerPage >= data.length} onClick={() => setReportPage(p => p + 1)}>Next</Button>
                      <Button size="small" disabled={(reportPage + 1) * rowsPerPage >= data.length} onClick={() => setReportPage(Math.ceil(data.length / rowsPerPage) - 1)}>Last</Button>
                    </>
                  )}
                </Stack>
              </Stack>
            )}
          </Paper>
        </Box>
      );
    }

    if (activeReport === 'stock_distribution') {
      const grandTotal = data.reduce((sum: number, row: any) => sum + (row.total || 0), 0);

      return (
        <Box>
          <Stack direction="row" justifyContent="flex-end" alignItems="center" mb={1.5}>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={async () => {
              try {
                const columns: ExportColumn[] = [
                  { header: 'S.No.', key: '_id' },
                  { header: 'Item Code', key: 'itemCode' },
                  { header: 'Item Name', key: 'itemName' },
                  { header: 'Store', key: 'storeName' },
                  { header: 'Dharamshala', key: 'dharamshalaName' },
                  { header: 'Room', key: 'roomNumber' },
                  { header: 'Qty', key: 'qty' },
                  { header: 'Rate', key: 'rate' },
                  { header: 'Total', key: 'total' },
                ];
                await exportToExcel([...data, { _id: '', itemCode: '', itemName: '', storeName: '', dharamshalaName: '', roomNumber: 'Grand Total', qty: '', rate: '', total: grandTotal }], columns, 'Stock_Distribution_Report');
                toast.success(`Exported ${data.length} rows`);
              } catch (err: any) {
                toast.error('Export failed: ' + err.message);
              }
            }}>
              Export
            </Button>
            <Button variant="outlined" size="small" startIcon={<PrintIcon />} sx={{ ml: 1 }} onClick={() => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              const rows = data.map((row: any, i: number) => `<tr><td>${i + 1}</td><td>${row.itemCode || ''}</td><td>${row.itemName || ''}</td><td>${row.storeName || ''}</td><td>${row.dharamshalaName || ''}</td><td>${row.roomNumber || ''}</td><td>${row.qty ?? ''}</td><td>${row.rate?.toFixed(2) || '0.00'}</td><td>${row.total?.toFixed(2) || '0.00'}</td></tr>`).join('');
              const tableHtml = `<table><thead><tr><th>S.NO.</th><th>Item Code</th><th>Item Name</th><th>Store</th><th>Dharamshala</th><th>Room</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="8" style="text-align:right;font-weight:bold">Grand Total</td><td style="text-align:center;font-weight:bold">${grandTotal.toFixed(2)}</td></tr></tfoot></table>`;
              printWindow.document.write(`
                <html><head><title>Stock Distribution Report</title>
                <style>
                  body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 20px; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { border: 1px solid #E2E8F0; padding: 8px 12px; text-align: center; font-size: 12px; }
                  th { background-color: #2563EB; color: white; font-weight: 600; }
                  .print-header { text-align: center; margin-bottom: 12px; }
                  .print-header h2 { margin: 0; font-size: 16px; color: #1E3A5F; }
                  .print-header p { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748B; }
                  @media print { body { margin: 10px; } }
                </style></head><body>
                <div class="print-header">
                  <h2>Digambar Jain Atishay Kshetra Shri Mahaveer JI</h2>
                  <p>Stock Distribution Report</p>
                </div>
                ${tableHtml}
                </body></html>
              `);
              printWindow.document.close();
              printWindow.print();
            }}>
              Print
            </Button>
          </Stack>

          <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #000', borderRadius: 0 }} elevation={0}>
            <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#000', fontFamily: 'serif' }}>
                Digambar Jain Atishay Kshetra Shri Mahaveer JI
              </Typography>
            </Box>
            <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000' }}>
                Stock Distribution Report
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small" sx={{
                '& .MuiTableCell-root': { borderBottom: '1px solid #000', borderRight: '1px solid #000', color: '#000', py: 1, px: 2 },
                '& .MuiTableCell-root:last-child': { borderRight: 'none' },
              }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>S.No.</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Item Code</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Item Name</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Store</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Dharamshala</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Room</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Rate</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((row: any) => (
                    <TableRow key={row._id} hover>
                      <TableCell align="center">{row._id}</TableCell>
                      <TableCell align="left">{row.itemCode}</TableCell>
                      <TableCell align="left">{row.itemName}</TableCell>
                      <TableCell align="left">{row.storeName}</TableCell>
                      <TableCell align="left">{row.dharamshalaName}</TableCell>
                      <TableCell align="left">{row.roomNumber}</TableCell>
                      <TableCell align="center">{row.qty}</TableCell>
                      <TableCell align="center">{row.rate?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell align="center">{row.total?.toFixed(2) || '0.00'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={8} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      Grand Total
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      {grandTotal.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      );
    }

    if (activeReport === 'department_stock_status') {
      const selectedDept = departments?.find((d: any) => d.id === Number(selectedDepartment));
      const subTitle = selectedDept ? `Department ${selectedDept.name} - Current Stock Report` : 'Department - Current Stock Report';

      return (
        <Box>
          {!selectedDepartment ? (
            <EmptyState icon={<Business />} title="Select a Department" description="Please select a department from the filters above to view its stock status." />
          ) : (
            <>
              <Stack direction="row" justifyContent="flex-end" alignItems="center" mb={1.5}>
                <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={async () => {
                  try {
                    const exportData = {
                      title: 'Digambar Jain Atishay Kshetra Shri Mahaveer JI',
                      subTitle,
                      columns: [
                        { header: 'S.NO.', key: 'sNo' },
                        { header: 'ITEM NAME', key: 'itemName' },
                        { header: 'Total Stock Qty (Department Wise)', key: 'totalQty' },
                        { header: 'Room Number (Department wise) / Location', key: 'rooms' },
                        { header: 'Balance STOCK QTY', key: 'balanceQty' },
                      ],
                      rows: data,
                    };
                    const buffer = await window.electronAPI.exportStockReport(exportData);
                    downloadBuffer(buffer, 'Department_Stock_Status.xlsx');
                    toast.success(`Exported ${data.length} rows`);
                  } catch (err: any) {
                    toast.error('Export failed: ' + err.message);
                  }
                }}>
                  Export
                </Button>
                <Button variant="outlined" size="small" startIcon={<PrintIcon />} sx={{ ml: 1 }} onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;
                  const rows = data.map((row: any, i: number) => `<tr><td>${row.sNo}</td><td style="text-align:left">${row.itemName || ''}</td><td>${row.totalQty ?? ''}</td><td>${row.rooms || '-'}</td><td>${row.balanceQty ?? ''}</td></tr>`).join('');
                  const tableHtml = `<table><thead><tr><th>S.NO.</th><th>ITEM NAME</th><th>Total Stock Qty (Department Wise)</th><th>Room Number (Department wise) / Location</th><th>Balance STOCK QTY</th></tr></thead><tbody>${rows}</tbody></table>`;
                  printWindow.document.write(`
                    <html><head><title>Department Stock Status</title>
                    <style>
                      body { font-family: serif; margin: 20px; }
                      table { width: 100%; border-collapse: collapse; }
                      th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                      th { background-color: #f0f0f0; font-weight: bold; }
                      .header { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 5px; }
                      .subheader { text-align: center; font-weight: 600; font-size: 14px; margin-bottom: 10px; }
                      @media print { body { margin: 0; } }
                    </style></head><body>
                    <div class="header">Digambar Jain Atishay Kshetra Shri Mahaveer JI</div>
                    <div class="subheader">${subTitle}</div>
                    ${tableHtml}
                    </body></html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }}>
                  Print
                </Button>
              </Stack>

              <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #000', borderRadius: 0 }} elevation={0}>
                <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#000', fontFamily: 'serif' }}>
                    Digambar Jain Atishay Kshetra Shri Mahaveer JI
                  </Typography>
                </Box>
                <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000' }}>
                    {subTitle}
                  </Typography>
                </Box>

                <TableContainer>
                  <Table size="small" sx={{
                    '& .MuiTableCell-root': { borderBottom: '1px solid #000', borderRight: '1px solid #000', color: '#000', py: 1, px: 2 },
                    '& .MuiTableCell-root:last-child': { borderRight: 'none' },
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>S.NO.</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>ITEM NAME</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Total Stock Qty (Department Wise)</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Room Number (Department wise) / Location</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Balance STOCK QTY</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(showAll ? data : data.slice(reportPage * rowsPerPage, reportPage * rowsPerPage + rowsPerPage)).map((row: any) => (
                        <TableRow key={row._itemId} hover>
                          <TableCell align="center">{row.sNo}</TableCell>
                          <TableCell align="left">{row.itemName}</TableCell>
                          <TableCell align="center">{row.totalQty}</TableCell>
                          <TableCell align="center">{row.rooms}</TableCell>
                          <TableCell align="center">{row.balanceQty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {data.length > rowsPerPage && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, borderTop: '1px solid #000' }}>
                    <Typography variant="body2" sx={{ color: '#000' }}>
                      {showAll ? `All ${data.length} rows` : `Showing ${reportPage * rowsPerPage + 1}-${Math.min((reportPage + 1) * rowsPerPage, data.length)} of ${data.length}`}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant={showAll ? 'contained' : 'outlined'} onClick={() => { setShowAll(!showAll); setReportPage(0); }}>
                        {showAll ? 'Paginate' : 'All'}
                      </Button>
                      {!showAll && (
                        <>
                          <Button size="small" disabled={reportPage === 0} onClick={() => setReportPage(0)}>First</Button>
                          <Button size="small" disabled={reportPage === 0} onClick={() => setReportPage(p => p - 1)}>Prev</Button>
                          <Button size="small" disabled={(reportPage + 1) * rowsPerPage >= data.length} onClick={() => setReportPage(p => p + 1)}>Next</Button>
                          <Button size="small" disabled={(reportPage + 1) * rowsPerPage >= data.length} onClick={() => setReportPage(Math.ceil(data.length / rowsPerPage) - 1)}>Last</Button>
                        </>
                      )}
                    </Stack>
                  </Stack>
                )}
              </Paper>
            </>
          )}
        </Box>
      );
    }

    if (activeReport === 'purchase_history') {
      const grandTotal = data.reduce((sum: number, row: any) => sum + (row.total || 0), 0);

      return (
        <Box>
          <Stack direction="row" justifyContent="flex-end" alignItems="center" mb={1.5}>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={async () => {
              try {
                const columns: ExportColumn[] = [
                  { header: 'S.No.', key: 'sNo' },
                  { header: 'Item Code', key: 'itemCode' },
                  { header: 'Item Name', key: 'itemName' },
                  { header: 'Date', key: 'dateFormatted' },
                  { header: 'Challan No', key: 'challanNo' },
                  { header: 'Store', key: 'storeName' },
                  { header: 'Qty', key: 'qty' },
                  { header: 'Rate', key: 'rate' },
                  { header: 'Total', key: 'total' },
                  { header: 'Cumulative Qty', key: 'totalQty' },
                  { header: 'Avg Rate', key: 'avgRate' },
                ];
                await exportToExcel([...data, { sNo: '', itemCode: '', itemName: '', dateFormatted: '', challanNo: '', storeName: 'Grand Total', qty: '', rate: '', total: grandTotal, totalQty: '', avgRate: '' }], columns, 'Purchase_History_Report');
                toast.success(`Exported ${data.length} rows`);
              } catch (err: any) {
                toast.error('Export failed: ' + err.message);
              }
            }}>
              Export
            </Button>
          </Stack>

          <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #000', borderRadius: 0 }} elevation={0}>
            <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#000', fontFamily: 'serif' }}>
                Digambar Jain Atishay Kshetra Shri Mahaveer JI
              </Typography>
            </Box>
            <Box sx={{ borderBottom: '1px solid #000', p: 1, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000' }}>
                Purchase History Report
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small" sx={{
                '& .MuiTableCell-root': { borderBottom: '1px solid #000', borderRight: '1px solid #000', color: '#000', py: 1, px: 2 },
                '& .MuiTableCell-root:last-child': { borderRight: 'none' },
              }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>S.No.</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Item Code</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Item Name</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Challan No</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Store</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Rate</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Cumulative Qty</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Avg Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((row: any) => (
                    <TableRow key={row.sNo} hover>
                      <TableCell align="center">{row.sNo}</TableCell>
                      <TableCell align="left">{row.itemCode}</TableCell>
                      <TableCell align="left">{row.itemName}</TableCell>
                      <TableCell align="center">{row.dateFormatted}</TableCell>
                      <TableCell align="left">{row.challanNo}</TableCell>
                      <TableCell align="left">{row.storeName}</TableCell>
                      <TableCell align="center">{row.qty}</TableCell>
                      <TableCell align="center">{row.rate?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell align="center">{row.total?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell align="center">{row.totalQty}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, color: '#16A34A' }}>{row.avgRate?.toFixed(2) || '0.00'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={8} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      Grand Total
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      {grandTotal.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      );
    }

    // ==================== ENTERPRISE REPORT RENDERERS ====================

    if (activeReport === 'central_store_summary') {
      const store = departments?.find((d: any) => d.id === Number(selectedDepartment));
      return (
        <CentralStoreSummaryReport
          data={data}
          storeName={store?.name || 'Store'}
          fyLabel={financialYear?.label || ''}
        />
      );
    }

    if (activeReport === 'dharamshala_distribution') {
      if (!appliedFilters.selectedDepartment) {
        return <EmptyState icon={<Inventory />} title="Select a Department" description="Please select a store or dharamshala from the filters above and click Apply." />;
      }
      const dept = departments?.find((d: any) => d.id === Number(appliedFilters.selectedDepartment));
      return (
        <DharamshalaDistributionReport
          data={data}
          deptName={dept?.name || 'Department'}
          fyLabel={financialYear?.label || ''}
        />
      );
    }

    if (activeReport === 'room_facilities') {
      if (!appliedFilters.selectedDepartment && !appliedFilters.selectedLocation) {
        return <EmptyState icon={<Inventory />} title="Select a Dharamshala or Room" description="Please select a department or room from the filters above and click Apply." />;
      }
      const dept = departments?.find((d: any) => d.id === Number(appliedFilters.selectedDepartment));
      return (
        <RoomFacilitiesReport
          data={data}
          dharamshalaName={dept?.name || 'All Locations'}
        />
      );
    }

    if (activeReport === 'item_audit_ledger') {
      if (!selectedItemId) {
        return <EmptyState icon={<Assessment />} title="Select an Item" description="Please select an item from the filters above to view its complete movement history." />;
      }
      const item = items?.find((i: any) => i.id === Number(selectedItemId));
      return (
        <ItemAuditLedgerReport
          data={data}
          itemName={item?.itemName || 'Item'}
          fyLabel={financialYear?.label || ''}
        />
      );
    }

    if (activeReport === 'damage_scrap_returns') {
      return (
        <DamageScrapReturnsReport
          data={data}
          fyLabel={financialYear?.label || ''}
        />
      );
    }

    if (activeReport === 'item_lifecycle') {
      if (!selectedItemId) {
        return <EmptyState icon={<Assessment />} title="Select an Item" description="Please select an item from the filters above to view its complete lifecycle." />;
      }
      return <ItemLifecycleRenderer data={data} />;
    }

    if (activeReport === 'visual_analytics') {
      return <VisualAnalyticsRenderer data={data} />;
    }

    return (
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`${data.length} records`} size="small" color="primary" />
            {hasFilters && <Chip label="Filtered" size="small" color="warning" />}
          </Stack>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={async () => {
            try {
              const columns: ExportColumn[] = keys.map((key) => ({
                header: columnLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(),
                key,
              }));
              const exportData = data.map((row: any) => {
                const flatRow: any = {};
                for (const key of keys) {
                  const val = row[key];
                  if (val === null || val === undefined) {
                    flatRow[key] = (key === 'vendor' && row.sourceName) ? row.sourceName : '';
                    continue;
                  }
                  if (typeof val === 'object' && !Array.isArray(val)) {
                    flatRow[key] = val.itemName || val.name || val.challanNo || val.label || val.fullName || '';
                  } else if (Array.isArray(val)) {
                    const names = val.map((v: any) => v?.item?.itemName || v?.itemName || v?.name || v?.challanNo || null).filter(Boolean);
                    flatRow[key] = names.length > 0 ? names.join(', ') : `${val.length} items`;
                  } else {
                    flatRow[key] = val;
                  }
                }
                return flatRow;
              });
              await exportToExcel(exportData, columns, `${REPORT_NAMES[activeReport || 'report']}`);
              toast.success(`Exported ${data.length} rows`);
            } catch (err: any) {
                toast.error('Export failed: ' + err.message);
              }
            }}>
              Export
            </Button>
            <Button variant="outlined" size="small" startIcon={<PrintIcon />} sx={{ ml: 1 }} onClick={() => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              const reportName = REPORT_NAMES[activeReport || 'report'] || 'Report';
              const headers = keys.map(key => `<th>${columnLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()}</th>`).join('');
              const rows = data.map((row: any, i: number) => {
                const cells = keys.map(key => {
                  const val = row[key];
                  let display = '';
                  if (val === null || val === undefined) display = (key === 'vendor' && row.sourceName) ? row.sourceName : '';
                  else if (typeof val === 'object' && !Array.isArray(val)) display = val.itemName || val.name || val.challanNo || val.label || val.fullName || '';
                  else if (Array.isArray(val)) {
                    const names = val.map((v: any) => v?.item?.itemName || v?.itemName || v?.name || v?.challanNo || null).filter(Boolean);
                    display = names.length > 0 ? names.join(', ') : `${val.length} items`;
                  }
                  else display = String(val);
                  return `<td>${display}</td>`;
                }).join('');
                return `<tr><td>${i + 1}</td>${cells}</tr>`;
              }).join('');
              const tableHtml = `<table><thead><tr><th>S.NO.</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
              printWindow.document.write(`
                <html><head><title>${reportName}</title>
                <style>
                  body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 20px; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { border: 1px solid #E2E8F0; padding: 8px 12px; text-align: left; font-size: 12px; }
                  th { background-color: #2563EB; color: white; font-weight: 600; }
                  tr:nth-child(even) { background-color: #F8FAFC; }
                  .print-header { text-align: center; margin-bottom: 16px; }
                  .print-header h2 { margin: 0; font-size: 16px; color: #1E3A5F; }
                  .print-header p { margin: 4px 0 0; font-size: 12px; color: #64748B; }
                  @media print { body { margin: 10px; } }
                </style></head><body>
                <div class="print-header">
                  <h2>Digambar Jain Atishay Kshetra Shri Mahaveer JI</h2>
                  <p>${reportName}</p>
                </div>
                ${tableHtml}
                </body></html>
              `);
              printWindow.document.close();
              printWindow.print();
            }}>
              Print
            </Button>
          </Stack>
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table id="generic-report-table" size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.05em', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                  S.NO.
                </TableCell>
                {keys.map((key) => (
                  <TableCell key={key} sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.05em', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    {columnLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(showAll ? data : data.slice(reportPage * rowsPerPage, reportPage * rowsPerPage + rowsPerPage)).map((row: any, idx: number) => (
                <TableRow key={idx} hover>
                  <TableCell sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                    {idx + 1}
                  </TableCell>
                  {keys.map((key) => (
                    <TableCell
                      key={key}
                      sx={{
                        fontSize: '0.8125rem',
                        ...(activeReport === 'stock_summary' && key === 'totalIssued' && row[key] > 0
                          ? { color: 'primary.main', cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }
                          : {}),
                      }}
                      onClick={
                        activeReport === 'stock_summary' && key === 'totalIssued' && row[key] > 0
                          ? () => setIssueDrilldownItem(row)
                          : undefined
                      }
                    >
                      {formatCellValue(row, key, row[key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {data.length > rowsPerPage && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              {showAll ? `All ${data.length} rows` : `Showing ${reportPage * rowsPerPage + 1}-${Math.min((reportPage + 1) * rowsPerPage, data.length)} of ${data.length}`}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant={showAll ? 'contained' : 'outlined'} onClick={() => { setShowAll(!showAll); setReportPage(0); }}>
                {showAll ? 'Paginate' : 'All'}
              </Button>
              {!showAll && (
                <>
                  <Button size="small" disabled={reportPage === 0} onClick={() => setReportPage(0)}>First</Button>
                  <Button size="small" disabled={reportPage === 0} onClick={() => setReportPage(p => p - 1)}>Prev</Button>
                  <Button size="small" disabled={(reportPage + 1) * rowsPerPage >= data.length} onClick={() => setReportPage(p => p + 1)}>Next</Button>
                  <Button size="small" disabled={(reportPage + 1) * rowsPerPage >= data.length} onClick={() => setReportPage(Math.ceil(data.length / rowsPerPage) - 1)}>Last</Button>
                </>
              )}
            </Stack>
          </Stack>
        )}
      </Box>
    );
  };

  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  return (
    <Box sx={{ display: 'flex', gap: 2, minHeight: 500 }}>
      {/* Left Sidebar */}
      <Paper
        elevation={0}
        sx={{
          width: 240,
          flexShrink: 0,
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search */}
        <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search reports..."
            value={reportSearch}
            onChange={(e) => { setReportSearch(e.target.value); setSelectedSection(null); }}
            InputProps={{
              startAdornment: <Search sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />,
              endAdornment: reportSearch ? (
                <IconButton size="small" onClick={() => setReportSearch('')} sx={{ p: 0.25 }}>
                  <Clear sx={{ fontSize: 14 }} />
                </IconButton>
              ) : null,
              sx: { borderRadius: '8px', fontSize: '0.8125rem', height: 34 },
            }}
          />
        </Box>

        {/* Categories */}
        <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
          {REPORT_SECTIONS.map((section) => {
            const filtered = reportSearch
              ? section.reports.filter((r) =>
                  r.name.toLowerCase().includes(reportSearch.toLowerCase()) ||
                  r.description.toLowerCase().includes(reportSearch.toLowerCase()))
              : section.reports;
            if (reportSearch && filtered.length === 0) return null;

            const isExpanded = selectedSection === section.title || reportSearch.length > 0;

            return (
              <Box key={section.title}>
                <ListItemButton
                  selected={selectedSection === section.title && !reportSearch}
                  onClick={() => { setSelectedSection(selectedSection === section.title ? null : section.title); setReportSearch(''); }}
                  sx={{ py: 0.75, px: 1.5, borderRadius: 0 }}
                >
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    backgroundColor: section.color, mr: 1, flexShrink: 0,
                  }} />
                  <ListItemText
                    primary={section.title}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                  />
                  <Chip label={filtered.length} size="small" sx={{ height: 18, fontSize: '0.625rem' }} />
                </ListItemButton>

                {isExpanded && (
                  <Box sx={{ pb: 0.5 }}>
                    {filtered.map((report) => (
                      <ListItemButton
                        key={report.key}
                        selected={activeReport === report.key}
                        onClick={() => { setActiveReport(report.key); clearFilters(); setSelectedSection(null); setReportSearch(''); }}
                        sx={{ py: 0.5, pl: 4, pr: 1.5, borderRadius: 0 }}
                      >
                        <ListItemText
                          primary={report.name}
                          primaryTypographyProps={{
                            fontSize: '0.75rem',
                            fontWeight: activeReport === report.key ? 600 : 400,
                            color: activeReport === report.key ? 'primary.main' : 'text.secondary',
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {activeReport === null ? (
          /* Welcome */
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Assessment sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Report Center
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select a report from the sidebar to get started
            </Typography>
          </Box>
        ) : (
          /* Report Content */
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Button size="small" onClick={() => setActiveReport(null)} startIcon={<ArrowBack sx={{ fontSize: 16 }} />} sx={{ minWidth: 0 }}>
                Back
              </Button>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                {REPORT_NAMES[activeReport]}
              </Typography>
            </Stack>

          <Paper sx={{ p: 1.5, mb: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <FilterList sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle2" fontWeight={600}>Filters</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button variant="contained" size="small" onClick={handleApplyFilters}>
                  Submit
                </Button>
                {hasFilters && (
                  <Button size="small" startIcon={<Clear sx={{ fontSize: 14 }} />} onClick={handleResetFilters}>Clear All</Button>
                )}
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              {showDateFilter && (
                <>
                  <DatePickerField label="Start Date" value={startDate} onChange={(val) => setStartDate(val)} size="small" sx={{ minWidth: 150 }} />
                  <DatePickerField label="End Date" value={endDate} onChange={(val) => setEndDate(val)} size="small" sx={{ minWidth: 150 }} />
                </>
              )}
              {showItemFilter && (
                <Autocomplete
                  options={items || []}
                  getOptionLabel={(o: any) => `${o.itemCode || ''} - ${o.itemName}`}
                  onChange={(_, v: any) => { const val = v?.id || null; setSelectedItemId(val); setAppliedFilters(prev => ({ ...prev, selectedItemId: val })); setReportPage(0); }}
                  renderInput={(params) => <TextField {...params} label="Item" size="small" />}
                  sx={{ minWidth: 250 }}
                  slotProps={{
                    popper: {
                      placement: 'bottom-start',
                      sx: { zIndex: 1050 },
                      modifiers: [{ name: 'preventOverflow', options: { boundary: 'viewport' } }],
                    },
                    paper: {
                      sx: { maxHeight: 300, overflow: 'auto' },
                    },
                  }}
                />
              )}
              {showCategoryFilter && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Category</InputLabel>
                  <Select value={selectedCategoryId || ''} label="Category" onChange={(e) => { const val = e.target.value ? Number(e.target.value) : null; setSelectedCategoryId(val); setAppliedFilters(prev => ({ ...prev, selectedCategoryId: val })); setReportPage(0); }}>
                    <MenuItem value="">All</MenuItem>
                    {categories?.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {showDepartmentFilter && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Department</InputLabel>
                  <Select value={selectedDepartment} label="Department" onChange={(e) => setSelectedDepartment(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {(activeReport === 'room_facilities' ? deptsWithRooms : departments)?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {showStoreFilter && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Store</InputLabel>
                  <Select value={selectedStoreId || ''} label="Store" onChange={(e) => { const val = e.target.value ? Number(e.target.value) : null; setSelectedStoreId(val); setAppliedFilters(prev => ({ ...prev, selectedStoreId: val })); setReportPage(0); }}>
                    <MenuItem value="">All Stores</MenuItem>
                    {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {showVendorFilter && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Vendor</InputLabel>
                  <Select value={selectedVendor} label="Vendor" onChange={(e) => setSelectedVendor(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {vendors?.map((v: any) => <MenuItem key={v.id} value={v.id}>{v.vendorName}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {showLocationFilter && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Location</InputLabel>
                  <Select value={selectedLocation} label="Location" onChange={(e) => setSelectedLocation(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {locations?.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {showTxTypeFilter && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Tx Type</InputLabel>
                  <Select value={selectedTxType} label="Tx Type" onChange={(e) => setSelectedTxType(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {TX_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {showAdjustmentTypeFilter && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Adjustment Type</InputLabel>
                  <Select value={selectedAdjustmentType} label="Adjustment Type" onChange={(e) => setSelectedAdjustmentType(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {ADJUSTMENT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {showStatusFilter && (
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Status</InputLabel>
                  <Select value={selectedStatus} label="Status" onChange={(e) => setSelectedStatus(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="Draft">Draft</MenuItem>
                    <MenuItem value="Posted">Posted</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              )}
              {showAuditFilters && (
                <>
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Action</InputLabel>
                    <Select value={selectedAuditAction} label="Action" onChange={(e) => setSelectedAuditAction(e.target.value)}>
                      <MenuItem value="">All</MenuItem>
                      {AUDIT_ACTIONS.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Table</InputLabel>
                    <Select value={selectedAuditTable} label="Table" onChange={(e) => setSelectedAuditTable(e.target.value)}>
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="Item">Item</MenuItem>
                      <MenuItem value="ReceiptChallan">Goods Receipt</MenuItem>
                      <MenuItem value="IssueChallan">Store Issue</MenuItem>
                      <MenuItem value="TransferChallan">Store Transfer</MenuItem>
                      <MenuItem value="StockTransaction">Stock Transaction</MenuItem>
                      <MenuItem value="Company">Company</MenuItem>
                      <MenuItem value="Department">Department</MenuItem>
                      <MenuItem value="Vendor">Vendor</MenuItem>
                      <MenuItem value="DamageEntry">Damage Entry</MenuItem>
                      <MenuItem value="StockAdjustment">Stock Adjustment</MenuItem>
                    </Select>
                  </FormControl>
                </>
              )}
              {showLowStockToggle && (
                <FormControlLabel
                  control={<Switch checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} size="small" />}
                  label={<Typography variant="body2" fontSize="0.8125rem">Low Stock Only</Typography>}
                />
              )}
              {showSearchFilter && (
                <TextField
                  size="small" placeholder="Search..." value={searchText} onChange={(e) => { const val = e.target.value; setSearchText(val); setAppliedFilters(prev => ({ ...prev, searchText: val })); setReportPage(0); }}
                  InputProps={{ startAdornment: <Search sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} /> }}
                  sx={{ minWidth: 200 }}
                />
              )}
            </Stack>
          </Paper>

          <Paper>
            <Box sx={{ p: 2 }}>
              {renderReportData()}
            </Box>
          </Paper>
        </Box>
        )}
      </Box>

      {/* Issue Drill-down Dialog */}
      <EnterpriseDialog
        open={!!issueDrilldownItem}
        onClose={() => setIssueDrilldownItem(null)}
        title={`Issue Breakdown — ${issueDrilldownItem?.itemName || ''}`}
        subtitle={`Where ${issueDrilldownItem?.totalIssued || 0} units were issued`}
        icon={<LocalShipping />}
        maxWidth="md"
        actions={<Button onClick={() => setIssueDrilldownItem(null)}>Close</Button>}
      >
        {breakdownLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !issueBreakdown || issueBreakdown.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No issue data found for this item.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Qty Issued</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">% of Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {issueBreakdown.map((row: any, idx: number) => {
                  const total = issueDrilldownItem?.totalIssued || 1;
                  const pct = ((row.totalQty / total) * 100).toFixed(1);
                  return (
                    <TableRow key={idx} hover>
                      <TableCell>{row.departmentName}</TableCell>
                      <TableCell>{row.locationName}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                        {row.totalQty}
                      </TableCell>
                      <TableCell align="right">
                        <Chip label={`${pct}%`} size="small" color={Number(pct) > 20 ? 'error' : 'default'} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </EnterpriseDialog>

      {/* Stock Transaction Details Dialog */}
      <EnterpriseDialog
        open={!!stockDetailItem}
        onClose={() => setStockDetailItem(null)}
        title={`Stock Details — ${stockDetailItem?.itemName || ''}`}
        subtitle={`Total Received: ${stockDetailItem?.totalIn || 0} | Balance: ${stockDetailItem?.stockQty || 0}`}
        icon={<Inventory />}
        maxWidth="lg"
        actions={<Button onClick={() => setStockDetailItem(null)}>Close</Button>}
      >
        {stockTxLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !stockTransactions || stockTransactions.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No transactions found for this item.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Qty In</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Qty Out</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Rate</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Balance</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const sorted = [...stockTransactions].sort((a: any, b: any) => {
                    const da = new Date(a.date || 0); const db = new Date(b.date || 0);
                    return (isNaN(da.getTime()) ? 0 : da.getTime()) - (isNaN(db.getTime()) ? 0 : db.getTime());
                  });
                  let runningBalance = 0;
                  return sorted.map((txn: any, idx: number) => {
                    runningBalance += toNumber(txn.quantityIn) - toNumber(txn.quantityOut);
                    return (
                      <TableRow key={idx} hover>
                        <TableCell>{formatDateDDMMYYYY(txn.date)}</TableCell>
                        <TableCell>
                          <Chip
                            label={txn.transactionType}
                            size="small"
                            color={
                              ['RECEIPT', 'PURCHASE', 'OPENING_BALANCE', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(txn.transactionType)
                                ? 'success'
                                : ['ISSUE', 'TRANSFER_OUT', 'ADJUSTMENT_OUT', 'DAMAGE'].includes(txn.transactionType)
                                  ? 'error'
                                  : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>{txn.referenceNo || '-'}</TableCell>
                        <TableCell align="right" sx={{ color: toNumber(txn.quantityIn) > 0 ? 'success.main' : 'text.secondary' }}>
                          {toNumber(txn.quantityIn) > 0 ? toNumber(txn.quantityIn) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: toNumber(txn.quantityOut) > 0 ? 'error.main' : 'text.secondary' }}>
                          {toNumber(txn.quantityOut) > 0 ? toNumber(txn.quantityOut) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                          {toNumber(txn.rate) > 0 ? `₹${toNumber(txn.rate).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: runningBalance > 0 ? 'primary.main' : runningBalance < 0 ? 'error.main' : 'text.secondary' }}>
                          {runningBalance}
                        </TableCell>
                        <TableCell>{txn.transaction?.department?.name || '-'}</TableCell>
                        <TableCell>{txn.transaction?.fromStore?.name || txn.transaction?.toStore?.name || '-'}</TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </EnterpriseDialog>
    </Box>
  );
}
