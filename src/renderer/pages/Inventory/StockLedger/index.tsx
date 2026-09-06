import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, TextField, Stack, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Autocomplete, Chip, alpha, useTheme, IconButton, Tooltip,
  FormControl, InputLabel, Select, MenuItem, Button, Pagination, Switch, FormControlLabel,
  Collapse, Badge, Divider, LinearProgress,
} from '@mui/material';
import {
  Inventory, FilterList, Search as SearchIcon, TableChart, ExpandMore, ExpandLess,
  TrendingUp, TrendingDown, Balance, Assessment, Clear, Download,
} from '@mui/icons-material';
import { TableSkeleton } from '../../../components/LoadingSkeleton';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import ImportExportButtons from '../../../components/ImportExportButtons';
import { GuideButton } from '../../../components/GuideSystem';
import EmptyState from '../../../components/EmptyState';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateUtils';
import { toNumber } from '../../../utils/numberUtils';
import DatePickerField from '../../../components/DatePickerField';

const PAGE_SIZE = 50;

const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  PURCHASE_RECEIPT: { color: '#16A34A', bg: '#DCFCE7', label: 'Purchase' },
  PURCHASE: { color: '#16A34A', bg: '#DCFCE7', label: 'Purchase' },
  ISSUE_IN: { color: '#0EA5E9', bg: '#E0F2FE', label: 'Issue In' },
  ISSUE_OUT: { color: '#DC2626', bg: '#FEE2E2', label: 'Issue Out' },
  ISSUE: { color: '#DC2626', bg: '#FEE2E2', label: 'Issue' },
  'Transfer In': { color: '#0EA5E9', bg: '#E0F2FE', label: 'Transfer In' },
  'Transfer Out': { color: '#F59E0B', bg: '#FEF3C7', label: 'Transfer Out' },
  TRANSFER: { color: '#0EA5E9', bg: '#E0F2FE', label: 'Transfer' },
  TRANSFER_IN: { color: '#0EA5E9', bg: '#E0F2FE', label: 'Transfer In' },
  TRANSFER_OUT: { color: '#F59E0B', bg: '#FEF3C7', label: 'Transfer Out' },
  ADJUSTMENT: { color: '#D97706', bg: '#FEF3C7', label: 'Adjustment' },
  DAMAGE_OUT: { color: '#DC2626', bg: '#FEE2E2', label: 'Damage Out' },
  DAMAGE_TRANSFER_IN: { color: '#DC2626', bg: '#FEE2E2', label: 'Damage Transfer In' },
  OPENING_BALANCE: { color: '#2563EB', bg: '#DBEAFE', label: 'Opening Stock' },
  Reversal: { color: '#6B7280', bg: '#F3F4F6', label: 'Reversal' },
  REVERSAL: { color: '#6B7280', bg: '#F3F4F6', label: 'Reversal' },
};

export default function StockLedgerPage() {
  const { company, financialYear } = useCompany();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');
  const [hideReversals, setHideReversals] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [appliedFilters, setAppliedFilters] = useState({
    selectedItemId: null as number | null,
    startDate: '',
    endDate: '',
    typeFilter: '',
    createdByFilter: '',
    hideReversals: false,
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.selectedItemId) count++;
    if (appliedFilters.startDate) count++;
    if (appliedFilters.endDate) count++;
    if (appliedFilters.typeFilter) count++;
    if (appliedFilters.createdByFilter) count++;
    if (appliedFilters.hideReversals) count++;
    return count;
  }, [appliedFilters]);

  const handleApplyFilters = () => {
    setAppliedFilters({ selectedItemId, startDate, endDate, typeFilter, createdByFilter, hideReversals });
    setPage(1);
  };

  const handleReset = () => {
    setSelectedItemId(null);
    setStartDate('');
    setEndDate('');
    setTypeFilter('');
    setCreatedByFilter('');
    setHideReversals(false);
    setAppliedFilters({ selectedItemId: null, startDate: '', endDate: '', typeFilter: '', createdByFilter: '', hideReversals: false });
    setPage(1);
  };

  const exportColumns = useMemo(() => [
    { header: 'Date', key: 'transactionDate' },
    { header: 'Invoice Date', key: 'invoiceDate' },
    { header: 'Invoice Number', key: 'invoice' },
    { header: 'Item Name', key: 'itemName' },
    { header: 'Vendor Name', key: 'vendorName' },
    { header: 'Department', key: 'department' },
    { header: 'Location', key: 'location' },
    { header: 'Qty In', key: 'quantityIn' },
    { header: 'Qty Out', key: 'quantityOut' },
    { header: 'Rate', key: 'rate' },
    { header: 'Total Rate', key: 'totalRate' },
    { header: 'Balance in Stock', key: 'balanceQty' },
    { header: 'Type', key: 'transactionType' },
    { header: 'Reference', key: 'reference' },
    { header: 'Remarks', key: 'remarks' },
    { header: 'Created By', key: 'createdBy' },
    { header: 'POSTED AT', key: 'postedAt' },
  ], []);

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => window.electronAPI.listUsers(),
  });

  const createdByOptions = useMemo(() => {
    if (!users) return [];
    return (users as any[]).map((u: any) => u.fullName || u.username);
  }, [users]);

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['stockLedger', company?.id, financialYear?.id, appliedFilters.selectedItemId, appliedFilters.startDate, appliedFilters.endDate, appliedFilters.typeFilter, appliedFilters.createdByFilter, appliedFilters.hideReversals, page, pageSize],
    queryFn: async () => {
      const where: any = { companyId: company!.id, financialYearId: financialYear!.id };
      if (appliedFilters.selectedItemId) where.itemId = appliedFilters.selectedItemId;
      if (appliedFilters.startDate && appliedFilters.endDate) {
        const [sy, sm, sd] = appliedFilters.startDate.split('-').map(Number);
        const [ey, em, ed] = appliedFilters.endDate.split('-').map(Number);
        const startDateTime = new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString();
        const endDateTime = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();
        where.transactionDate = { gte: startDateTime, lte: endDateTime };
      } else if (appliedFilters.startDate) {
        const [sy, sm, sd] = appliedFilters.startDate.split('-').map(Number);
        where.transactionDate = { gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString() };
      } else if (appliedFilters.endDate) {
        const [ey, em, ed] = appliedFilters.endDate.split('-').map(Number);
        where.transactionDate = { lte: new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString() };
      }
      if (appliedFilters.typeFilter) where.transactionType = appliedFilters.typeFilter;
      if (appliedFilters.createdByFilter) where.createdBy = appliedFilters.createdByFilter;
      if (appliedFilters.hideReversals) where.transactionType = { not: 'REVERSAL' };
      if (appliedFilters.typeFilter && appliedFilters.hideReversals) {
        where.transactionType = { in: [appliedFilters.typeFilter], not: 'REVERSAL' };
      }
      const [data, total] = await Promise.all([
        window.electronAPI.dbQuery('stockTransaction', 'findMany', {
          where,
          include: { item: true, store: true, transaction: { include: { department: true, fromStore: true, toStore: true, vendor: true } } },
          orderBy: [{ createdAt: 'desc' }, { transactionDate: 'desc' }, { id: 'desc' }],
          take: pageSize,
          skip: (page - 1) * pageSize,
        }),
        window.electronAPI.dbQuery('stockTransaction', 'count', { where }),
      ]);

      const rcVoucherNos: string[] = [];
      (data as any[]).forEach((tx: any) => {
        if (tx.voucherType === 'RC' && tx.voucherNo) rcVoucherNos.push(tx.voucherNo);
      });

      const uniqueRcVoucherNos = [...new Set(rcVoucherNos)];

      const [grnData] = await Promise.all([
        uniqueRcVoucherNos.length > 0 ? window.electronAPI.dbQuery('goodsReceipt', 'findMany', { where: { grnNumber: { in: uniqueRcVoucherNos } }, select: { grnNumber: true, invoiceDate: true, invoiceNumber: true } }) : [],
      ]);

      const grnMap = new Map((grnData as any[]).map((r: any) => [r.grnNumber, r]));

      const enriched = (data as any[]).map((tx: any) => {
        let invoiceNo = tx.voucherNo || '-';
        let invoiceDate: string | null = null;
        let vendorName = tx.transaction?.vendor?.vendorName || '-';
        if (tx.voucherType === 'RC' && tx.voucherNo) {
          const grn = grnMap.get(tx.voucherNo);
          if (grn?.invoiceDate) { invoiceDate = grn.invoiceDate; }
          if (grn?.invoiceNumber) { invoiceNo = grn.invoiceNumber; }
        }
        return { ...tx, invoiceNo, invoiceDate, vendorName };
      });

      return { data: enriched, total };
    },
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const ledger = ledgerData?.data || [];
  const totalCount = ledgerData?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const summaryStats = useMemo(() => {
    if (!ledger || !Array.isArray(ledger)) return { totalIn: 0, totalOut: 0, transactionCount: 0 };
    let totalIn = 0;
    let totalOut = 0;
    ledger.forEach((entry: any) => {
      totalIn += toNumber(entry.quantityIn);
      totalOut += toNumber(entry.quantityOut);
    });
    return { totalIn, totalOut, transactionCount: totalCount };
  }, [ledger, totalCount]);

  const exportData = useMemo(() => {
    if (!ledger || !Array.isArray(ledger)) return [];
    return ledger.map((entry: any) => ({
      transactionDate: formatDateDDMMYYYY(entry.date),
      invoiceDate: entry.invoiceDate ? formatDateDDMMYYYY(entry.invoiceDate) : '—',
      invoice: entry.invoiceNo || '',
      itemName: entry.item?.itemName || '',
      vendorName: entry.vendorName || '',
      department: entry.transaction?.department?.name || '',
      location: entry.transaction?.fromStore?.name || entry.transaction?.toStore?.name || '',
      quantityIn: toNumber(entry.quantityIn),
      quantityOut: toNumber(entry.quantityOut),
      rate: toNumber(entry.rate),
      totalRate: ((toNumber(entry.quantityIn)) - (toNumber(entry.quantityOut))) * (toNumber(entry.rate)),
      balanceQty: entry.balanceQty || 0,
      transactionType: entry.transactionType,
      reference: entry.voucherType || entry.transactionType || '',
      remarks: entry.transaction?.remarks || '',
      createdBy: entry.createdBy || '',
      postedAt: formatDateTimeDDMMYYYY(entry.postedAt || entry.createdAt),
    }));
  }, [ledger]);

  const typeConfig = (t: string) => TYPE_CONFIG[t] || { color: '#6B7280', bg: '#F3F4F6', label: t };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', gap: 2.5 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${alpha('#1E40AF', 0.1)}, ${alpha('#3B82F6', 0.05)})`,
            border: `1px solid ${alpha('#1E40AF', 0.12)}`,
          }}>
            <Inventory sx={{ fontSize: 24, color: '#1E40AF' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Stock Ledger
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Detailed stock movement history and analysis
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <GuideButton pageId="stock-ledger" />
          <ImportExportButtons
            data={exportData}
            columns={exportColumns}
            fileName="stock-ledger"
            showImport={false}
          />
        </Stack>
      </Stack>

      {/* Summary Cards */}
      <Stack direction="row" spacing={2}>
        {[
          { label: 'Total Received', value: summaryStats.totalIn, icon: <TrendingUp />, color: '#16A34A', bg: '#DCFCE7' },
          { label: 'Total Issued', value: summaryStats.totalOut, icon: <TrendingDown />, color: '#DC2626', bg: '#FEE2E2' },
          { label: 'Transactions', value: summaryStats.transactionCount, icon: <Assessment />, color: '#2563EB', bg: '#DBEAFE' },
        ].map((stat) => (
          <Paper key={stat.label} sx={{
            flex: 1, p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
            border: `1px solid ${alpha(stat.color, 0.12)}`,
            background: alpha(stat.bg, isDark ? 0.1 : 0.5),
            transition: 'all 0.2s ease',
            '&:hover': { boxShadow: `0 2px 8px ${alpha(stat.color, 0.15)}`, transform: 'translateY(-1px)' },
          }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: alpha(stat.color, 0.1),
            }}>
              {React.cloneElement(stat.icon, { sx: { fontSize: 20, color: stat.color } })}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', fontSize: '1.1rem', lineHeight: 1.2 }}>
                {stat.value.toLocaleString()}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Stack>

      {/* Filters */}
      <Paper sx={{
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        overflow: 'hidden',
      }}>
        <Box
          sx={{
            p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', userSelect: 'none',
            '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) },
            transition: 'background-color 0.15s ease',
          }}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <FilterList sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" fontWeight={600}>Filters</Typography>
            {activeFilterCount > 0 && (
              <Badge badgeContent={activeFilterCount} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 18, minWidth: 18 } }} />
            )}
          </Stack>
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            {filtersOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={filtersOpen}>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Autocomplete
                options={items || []}
                getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName} (${o.unit?.name})`}
                value={items?.find((i: any) => i.id === selectedItemId) || null}
                onChange={(_, v: any) => setSelectedItemId(v?.id || null)}
                renderInput={(params) => <TextField {...params} label="Select Item" placeholder="Search item..." size="small" />}
                sx={{ minWidth: 280, maxWidth: 360 }}
                size="small"
              />
              <DatePickerField
                label="Start Date"
                value={startDate}
                onChange={(v) => setStartDate(v)}
                size="small"
                sx={{ minWidth: 140 }}
              />
              <DatePickerField
                label="End Date"
                value={endDate}
                onChange={(v) => setEndDate(v)}
                size="small"
                sx={{ minWidth: 140 }}
              />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Type</InputLabel>
                <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
                  <MenuItem value="">All Types</MenuItem>
                  {[
                    { value: 'PURCHASE_RECEIPT', label: 'Purchase' },
                    { value: 'ISSUE_IN', label: 'Issue In' },
                    { value: 'ISSUE_OUT', label: 'Issue Out' },
                    { value: 'Transfer In', label: 'Transfer In' },
                    { value: 'Transfer Out', label: 'Transfer Out' },
                    { value: 'ADJUSTMENT', label: 'Adjustment' },
                    { value: 'DAMAGE_OUT', label: 'Damage Out' },
                    { value: 'OPENING_BALANCE', label: 'Opening Stock' },
                    { value: 'Reversal', label: 'Reversal' },
                  ].map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                options={createdByOptions}
                getOptionLabel={(o) => o}
                value={createdByFilter || null}
                onChange={(_, v) => setCreatedByFilter(v || '')}
                renderInput={(params) => <TextField {...params} label="Created By" placeholder="Filter by user..." size="small" />}
                sx={{ minWidth: 170 }}
                size="small"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={hideReversals}
                    onChange={(e) => setHideReversals(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="body2" noWrap sx={{ fontSize: '0.8125rem' }}>Hide Reversals</Typography>}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<SearchIcon />}
                onClick={handleApplyFilters}
                sx={{ textTransform: 'none', fontWeight: 600, boxShadow: 'none', px: 2.5, '&:hover': { boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' } }}
              >
                Apply
              </Button>
              <Button
                variant="text"
                size="small"
                startIcon={<Clear />}
                onClick={handleReset}
                sx={{ textTransform: 'none', color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha('#DC2626', 0.04) } }}
              >
                Reset
              </Button>
            </Stack>

            {/* Active Filter Badges */}
            {activeFilterCount > 0 && (
              <Stack direction="row" spacing={0.75} mt={1.5} flexWrap="wrap" useFlexGap>
                {appliedFilters.selectedItemId && (
                  <Chip
                    size="small"
                    label={`Item: ${items?.find((i: any) => i.id === appliedFilters.selectedItemId)?.itemName || ''}`}
                    onDelete={() => { setSelectedItemId(null); setAppliedFilters(p => ({ ...p, selectedItemId: null })); }}
                    sx={{ fontSize: '0.7rem', height: 24 }}
                  />
                )}
                {appliedFilters.startDate && (
                  <Chip size="small" label={`From: ${appliedFilters.startDate}`} onDelete={() => { setStartDate(''); setAppliedFilters(p => ({ ...p, startDate: '' })); }} sx={{ fontSize: '0.7rem', height: 24 }} />
                )}
                {appliedFilters.endDate && (
                  <Chip size="small" label={`To: ${appliedFilters.endDate}`} onDelete={() => { setEndDate(''); setAppliedFilters(p => ({ ...p, endDate: '' })); }} sx={{ fontSize: '0.7rem', height: 24 }} />
                )}
                {appliedFilters.typeFilter && (
                  <Chip size="small" label={`Type: ${typeConfig(appliedFilters.typeFilter).label}`} onDelete={() => { setTypeFilter(''); setAppliedFilters(p => ({ ...p, typeFilter: '' })); }} sx={{ fontSize: '0.7rem', height: 24 }} />
                )}
                {appliedFilters.createdByFilter && (
                  <Chip size="small" label={`By: ${appliedFilters.createdByFilter}`} onDelete={() => { setCreatedByFilter(''); setAppliedFilters(p => ({ ...p, createdByFilter: '' })); }} sx={{ fontSize: '0.7rem', height: 24 }} />
                )}
                {appliedFilters.hideReversals && (
                  <Chip size="small" label="No Reversals" onDelete={() => { setHideReversals(false); setAppliedFilters(p => ({ ...p, hideReversals: false })); }} sx={{ fontSize: '0.7rem', height: 24 }} />
                )}
              </Stack>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Data Table */}
      <Paper sx={{
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
      }}>
        {ledgerLoading && <LinearProgress sx={{ height: 2 }} />}

        <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 1400 }}>
            <TableHead>
              <TableRow>
                {[
                  { label: 'Date', align: 'left' as const, width: 110 },
                  { label: 'Invoice Date', align: 'left' as const, width: 110 },
                  { label: 'Invoice No.', align: 'left' as const, width: 110 },
                  { label: 'Item Name', align: 'left' as const, width: 160 },
                  { label: 'Vendor', align: 'left' as const, width: 130 },
                  { label: 'Department', align: 'left' as const, width: 120 },
                  { label: 'Location', align: 'left' as const, width: 140 },
                  { label: 'Qty In', align: 'right' as const, width: 70 },
                  { label: 'Qty Out', align: 'right' as const, width: 70 },
                  { label: 'Rate', align: 'right' as const, width: 80 },
                  { label: 'Total', align: 'right' as const, width: 90 },
                  { label: 'Balance', align: 'right' as const, width: 90 },
                  { label: 'Type', align: 'center' as const, width: 110 },
                  { label: 'Reference', align: 'left' as const, width: 90 },
                  { label: 'Remarks', align: 'left' as const, width: 120 },
                  { label: 'Posted At', align: 'left' as const, width: 120 },
                ].map((col) => (
                  <TableCell
                    key={col.label}
                    align={col.align}
                    sx={{
                      bgcolor: isDark ? 'grey.900' : '#F1F5F9',
                      borderBottom: `2px solid ${isDark ? 'grey.800' : '#CBD5E1'}`,
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'text.secondary',
                      py: 1.2,
                      whiteSpace: 'nowrap',
                      minWidth: col.width,
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {ledgerLoading ? (
                <TableRow>
                  <TableCell colSpan={16} sx={{ p: 0, border: 'none' }}>
                    <Box sx={{ py: 3 }}>
                      <TableSkeleton rows={8} columns={8} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : ledger?.length > 0 ? (
                ledger.map((entry: any, idx: number) => {
                  const qtyIn = toNumber(entry.quantityIn);
                  const qtyOut = toNumber(entry.quantityOut);
                  const rate = toNumber(entry.rate);
                  const totalRate = (qtyIn - qtyOut) * rate;
                  const cfg = typeConfig(entry.transactionType);
                  return (
                    <TableRow
                      key={entry.id}
                      hover
                      sx={{
                        '&:nth-of-type(odd)': { bgcolor: alpha(theme.palette.action.hover, 0.02) },
                        '&:hover': { bgcolor: `${alpha('#2563EB', 0.04)} !important` },
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {formatDateDDMMYYYY(entry.date)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {entry.invoiceDate ? formatDateDDMMYYYY(entry.invoiceDate) : <Typography component="span" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>—</Typography>}
                      </TableCell>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                        {entry.invoiceNo || '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem', lineHeight: 1.3 }}>{entry.item?.itemName || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.675rem' }}>{entry.item?.itemCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={entry.vendorName || '-'} arrow placement="top">
                          <span>{entry.vendorName || '-'}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem' }}>{entry.transaction?.department?.name || '-'}</TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.store?.name || entry.transaction?.fromStore?.name || entry.transaction?.toStore?.name || '-'}
                      </TableCell>
                      <TableCell align="right" sx={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                        color: qtyIn > 0 ? '#16A34A' : 'text.disabled',
                        fontWeight: qtyIn > 0 ? 700 : 400,
                        bgcolor: qtyIn > 0 ? alpha('#16A34A', 0.04) : 'transparent',
                      }}>
                        {qtyIn > 0 ? `+${qtyIn}` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                        color: qtyOut > 0 ? '#DC2626' : 'text.disabled',
                        fontWeight: qtyOut > 0 ? 700 : 400,
                        bgcolor: qtyOut > 0 ? alpha('#DC2626', 0.04) : 'transparent',
                      }}>
                        {qtyOut > 0 ? `-${qtyOut}` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                        {rate > 0 ? `₹${rate.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                        color: totalRate > 0 ? '#16A34A' : totalRate < 0 ? '#DC2626' : 'text.disabled',
                        fontWeight: 700,
                        bgcolor: totalRate !== 0 ? alpha(totalRate > 0 ? '#16A34A' : '#DC2626', 0.04) : 'transparent',
                      }}>
                        {totalRate !== 0 ? `₹${totalRate.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                        fontWeight: 700,
                        color: toNumber(entry.balanceQty) > 0 ? 'text.primary' : 'text.disabled',
                      }}>
                        {toNumber(entry.balanceQty)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={cfg.label}
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            height: 22,
                            fontWeight: 600,
                            bgcolor: alpha(cfg.color, 0.1),
                            color: cfg.color,
                            border: `1px solid ${alpha(cfg.color, 0.2)}`,
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {entry.voucherType || entry.transactionType || '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                        <Tooltip title={entry.transaction?.remarks || '-'} arrow placement="top">
                          <span>{entry.transaction?.remarks || '-'}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {formatDateTimeDDMMYYYY(entry.postedAt || entry.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={16} sx={{ p: 0, border: 'none' }}>
                    <EmptyState
                      icon={<TableChart />}
                      title={selectedItemId ? 'No stock entries found' : 'Select an item to view its stock history'}
                      description={selectedItemId ? 'Try adjusting your filters or date range' : 'Use the item filter above to search for a specific item'}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Divider />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 70 }}>
              <Select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                sx={{ fontSize: '0.8rem', height: 30 }}
              >
                {[25, 50, 100, 200].map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Pagination
            count={totalPages || 1}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            showFirstButton
            showLastButton
            sx={{ '& .MuiPaginationItem-root': { fontSize: '0.8rem' } }}
          />
        </Stack>
      </Paper>
    </Box>
  );
}
