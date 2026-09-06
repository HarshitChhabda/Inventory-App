import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { useAuth } from '../../../context/AuthContext';
import { useListState } from '../../../hooks/useListState';
import toast from 'react-hot-toast';

const STOCK_KEYS = [
  'stockTransactions', 'stockLedger', 'stockBalance', 'dashboard',
  'itemHistory', 'locationBalances', 'report',
  'buildingIssues', 'roomIssues', 'roomInstallations', 'buildingInstallations',
];

interface UseChallanListOpts {
  queryKey: string;
  listKey: string;
  model: string;
  include: any;
  searchFields: string[];
  newRoute: string;
  postFn: (id: number) => Promise<any>;
  deleteFn: (id: number) => Promise<any>;
  cancelFn: (id: number, reason: string) => Promise<any>;
  exportColumns: { header: string; key: string }[];
  getExportRow: (item: any) => Record<string, any>;
  statusFilter?: boolean;
  voucherTypeFilter?: string[];
  filterExtra?: Record<string, any>;
}

export function useChallanList(o: UseChallanListOpts) {
  const { company, financialYear } = useCompany();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enabled = !!company?.id && !!financialYear?.id;

  const {
    state: listState,
    setSearch: setListSearch,
    setPage: setListPage,
    setPageSize: setListPageSize,
    setFilter: setListFilter,
    setSelectedTab: setListTab,
    clampPage,
  } = useListState(o.listKey, { pageSize: 50 });

  const [debounced, setDebounced] = useState(listState.search);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Sync debounced search from persisted state on mount
  useEffect(() => {
    if (listState.search) {
      setDebounced(listState.search);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [viewDlg, setViewDlg] = useState<{ open: boolean; data: any }>({ open: false, data: null });
  const [delDlg, setDelDlg] = useState<{ open: boolean; id: number | null; label: string }>({ open: false, id: null, label: '' });
  const [cancelDlg, setCancelDlg] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [cancelReason, setCancelReason] = useState('');

  const onSearch = (v: string) => {
    setListSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setDebounced(v); }, 500);
  };

  useEffect(() => {
    return () => { clearTimeout(timer.current); };
  }, []);

  const onStatusFilter = (v: string) => { setListFilter('status', v); };

  // All data for export
  const { data: allData } = useQuery({
    queryKey: [o.queryKey, company?.id, financialYear?.id, 'all'],
    queryFn: () => {
      if (!company?.id || !financialYear?.id) return [];
      const w: any = { companyId: company.id, financialYearId: financialYear.id };
      if (o.voucherTypeFilter && o.voucherTypeFilter.length > 0) {
        w.voucherType = { in: o.voucherTypeFilter };
      }
      if (o.filterExtra) {
        Object.assign(w, o.filterExtra);
      }
      return window.electronAPI.dbQuery(o.model, 'findMany', {
        where: w,
        include: o.include, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
    },
    enabled,
  });

  // Paginated data
  const { data: pageData, isLoading, isError } = useQuery({
    queryKey: [o.queryKey, company?.id, financialYear?.id, listState.page, listState.pageSize, debounced, listState.filters.status || ''],
    queryFn: async () => {
      if (!company?.id || !financialYear?.id) return { items: [], total: 0 };
      const w: any = { companyId: company.id, financialYearId: financialYear.id };
      if (o.voucherTypeFilter && o.voucherTypeFilter.length > 0) {
        w.voucherType = { in: o.voucherTypeFilter };
      }
      if (o.filterExtra) {
        Object.assign(w, o.filterExtra);
      }
      if (debounced && o.searchFields.length) {
        w.OR = o.searchFields.map((f) => ({ [f]: { contains: debounced } }));
      }
      const statusVal = listState.filters.status || '';
      if (statusVal) w.approvalStatus = statusVal;
      const [items, total] = await Promise.all([
        window.electronAPI.dbQuery(o.model, 'findMany', { where: w, include: o.include, skip: listState.page * listState.pageSize, take: listState.pageSize, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] }),
        window.electronAPI.dbQuery(o.model, 'count', { where: w }),
      ]);
      return { items, total };
    },
    enabled,
  });

  // Clamp page after data loads
  useEffect(() => {
    if (pageData?.total !== undefined) {
      clampPage(pageData.total);
    }
  }, [pageData?.total, clampPage]);

  const invalidateAll = useCallback(async () => {
    await Promise.all(STOCK_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
    await qc.invalidateQueries({ queryKey: [o.queryKey] });
  }, [qc, o.queryKey]);

  const postMut = useMutation({
    mutationFn: (id: number) => o.postFn(id),
    onSuccess: async () => { await invalidateAll(); toast.success('Challan posted'); },
    onError: (e: any) => toast.error(e.message || 'Post failed'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => o.deleteFn(id),
    onSuccess: async () => {
      await invalidateAll();
      setDelDlg({ open: false, id: null, label: '' });
      toast.success('Challan deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Delete failed'),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => o.cancelFn(id, reason),
    onSuccess: async () => {
      await invalidateAll();
      setCancelDlg({ open: false, id: null });
      setCancelReason('');
      toast.success('Challan cancelled');
    },
    onError: (e: any) => toast.error(e.message || 'Cancel failed'),
  });

  const getExportData = useCallback(() => (allData || []).map((r: any) => o.getExportRow(r)), [allData, o.getExportRow]);

  const statusColor = (s: string) => {
    const upper = s.toUpperCase();
    if (upper === 'DRAFT') return 'warning';
    if (upper === 'POSTED' || upper === 'APPROVED') return 'success';
    if (upper === 'CANCELLED' || upper === 'REJECTED') return 'error';
    return 'default';
  };

  return {
    company, financialYear, hasPermission, navigate,
    search: listState.search, onSearch,
    statusFilter: listState.filters.status || '', onStatusFilter,
    page: listState.page, setPage: setListPage,
    rpp: listState.pageSize, setRpp: setListPageSize,
    items: pageData?.items || [], total: pageData?.total || 0, isLoading, isError,
    viewDlg, setViewDlg, delDlg, setDelDlg, cancelDlg, setCancelDlg,
    cancelReason, setCancelReason,
    postMut, delMut, cancelMut,
    getExportData, exportColumns: o.exportColumns, statusColor,
    newRoute: o.newRoute,
    refetch: invalidateAll,
  };
}
