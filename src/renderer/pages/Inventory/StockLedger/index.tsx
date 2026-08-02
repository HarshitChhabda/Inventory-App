import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, TextField, Stack, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Autocomplete, Chip, alpha, useTheme,
  FormControl, InputLabel, Select, MenuItem, Button, Pagination, Switch, FormControlLabel,
} from '@mui/material';
import {
  Inventory, FilterList, Search as SearchIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import ImportExportButtons from '../../../components/ImportExportButtons';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateUtils';
import DatePickerField from '../../../components/DatePickerField';

const COLORS = {
  primary: '#2563EB',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0EA5E9',
  muted: '#64748B',
};

const PAGE_SIZE = 50;

const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function StockLedgerPage() {
  const { company, financialYear } = useCompany();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [invoiceStartDate, setInvoiceStartDate] = useState('');
  const [invoiceEndDate, setInvoiceEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');
  const [hideReversals, setHideReversals] = useState(false);
  const [page, setPage] = useState(1);

  const [appliedFilters, setAppliedFilters] = useState({
    selectedItemId: null as number | null,
    startDate: '',
    endDate: '',
    invoiceStartDate: '',
    invoiceEndDate: '',
    typeFilter: '',
    createdByFilter: '',
    hideReversals: false,
  });

  const handleApplyFilters = () => {
    setAppliedFilters({ selectedItemId, startDate, endDate, invoiceStartDate, invoiceEndDate, typeFilter, createdByFilter, hideReversals });
    setPage(1);
  };

  const handleReset = () => {
    setSelectedItemId(null);
    setStartDate('');
    setEndDate('');
    setInvoiceStartDate('');
    setInvoiceEndDate('');
    setTypeFilter('');
    setCreatedByFilter('');
    setHideReversals(false);
    setAppliedFilters({ selectedItemId: null, startDate: '', endDate: '', invoiceStartDate: '', invoiceEndDate: '', typeFilter: '', createdByFilter: '', hideReversals: false });
    setPage(1);
  };

  const resetPage = () => setPage(1);

  const exportColumns = useMemo(() => [
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
    { header: 'POSTED AT', key: 'createdAt' },
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
    queryKey: ['stockLedger', company?.id, financialYear?.id, appliedFilters.selectedItemId, appliedFilters.startDate, appliedFilters.endDate, appliedFilters.invoiceStartDate, appliedFilters.invoiceEndDate, appliedFilters.typeFilter, appliedFilters.createdByFilter, appliedFilters.hideReversals, page],
    queryFn: async () => {
      const where: any = { companyId: company!.id, financialYearId: financialYear!.id };
      if (appliedFilters.selectedItemId) where.itemId = appliedFilters.selectedItemId;
      const effectiveStart = appliedFilters.startDate || getToday();
      const effectiveEnd = appliedFilters.endDate || getToday();
      if (effectiveStart && effectiveEnd) {
        const [sy, sm, sd] = effectiveStart.split('-').map(Number);
        const [ey, em, ed] = effectiveEnd.split('-').map(Number);
        const startDateTime = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        const endDateTime = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        where.createdAt = { gte: startDateTime, lte: endDateTime };
      }
      if (appliedFilters.invoiceStartDate && appliedFilters.invoiceEndDate) {
        const [isy, ism, isd] = appliedFilters.invoiceStartDate.split('-').map(Number);
        const [iey, iem, ied] = appliedFilters.invoiceEndDate.split('-').map(Number);
        const invStart = new Date(isy, ism - 1, isd, 0, 0, 0, 0);
        const invEnd = new Date(iey, iem - 1, ied, 23, 59, 59, 999);
        where.transactionDate = { gte: invStart, lte: invEnd };
      } else if (appliedFilters.invoiceStartDate) {
        const [isy, ism, isd] = appliedFilters.invoiceStartDate.split('-').map(Number);
        where.transactionDate = { gte: new Date(isy, ism - 1, isd, 0, 0, 0, 0) };
      } else if (appliedFilters.invoiceEndDate) {
        const [iey, iem, ied] = appliedFilters.invoiceEndDate.split('-').map(Number);
        where.transactionDate = { lte: new Date(iey, iem - 1, ied, 23, 59, 59, 999) };
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
          include: { item: true, department: true, location: true },
          orderBy: { transactionDate: 'asc' },
          take: PAGE_SIZE,
          skip: (page - 1) * PAGE_SIZE,
        }),
        window.electronAPI.dbQuery('stockTransaction', 'count', { where }),
      ]);

      const rcIds: number[] = [];
      const icIds: number[] = [];
      const trIds: number[] = [];
      const vrcIds: number[] = [];
      (data as any[]).forEach((tx: any) => {
        if (tx.referenceType === 'ReceiptChallan' && tx.referenceId) rcIds.push(tx.referenceId);
        if (tx.referenceType === 'IssueChallan' && tx.referenceId) icIds.push(tx.referenceId);
        if (tx.referenceType === 'TransferChallan' && tx.referenceId) trIds.push(tx.referenceId);
        if (tx.referenceType === 'VendorReturnChallan' && tx.referenceId) vrcIds.push(tx.referenceId);
      });

      const [rcData, icData, trData, vrcData] = await Promise.all([
        rcIds.length > 0 ? window.electronAPI.dbQuery('receiptChallan', 'findMany', { where: { id: { in: rcIds } }, select: { id: true, invoiceNumber: true, challanNo: true, invoiceDate: true, date: true, sourceName: true, vendor: { select: { name: true } } } }) : [],
        icIds.length > 0 ? window.electronAPI.dbQuery('issueChallan', 'findMany', { where: { id: { in: icIds } }, select: { id: true, serialNo: true, challanNo: true, date: true } }) : [],
        trIds.length > 0 ? window.electronAPI.dbQuery('transferChallan', 'findMany', { where: { id: { in: trIds } }, select: { id: true, challanNo: true, date: true } }) : [],
        vrcIds.length > 0 ? window.electronAPI.dbQuery('vendorReturnChallan', 'findMany', { where: { id: { in: vrcIds } }, select: { id: true, challanNo: true, date: true } }) : [],
      ]);

      const rcMap = new Map((rcData as any[]).map((r: any) => [r.id, r]));
      const icMap = new Map((icData as any[]).map((r: any) => [r.id, r]));
      const trMap = new Map((trData as any[]).map((r: any) => [r.id, r]));
      const vrcMap = new Map((vrcData as any[]).map((r: any) => [r.id, r]));

      const enriched = (data as any[]).map((tx: any) => {
        let invoiceNo = tx.referenceNo || '-';
        let invoiceDate = tx.transactionDate;
        let vendorName = '-';
        if (tx.referenceType === 'ReceiptChallan' && tx.referenceId) {
          const rc = rcMap.get(tx.referenceId);
          if (rc) { invoiceNo = rc.invoiceNumber || rc.challanNo || '-'; invoiceDate = rc.invoiceDate || rc.date; vendorName = rc.vendor?.name || rc.sourceName || '-'; }
        } else if (tx.referenceType === 'IssueChallan' && tx.referenceId) {
          const ic = icMap.get(tx.referenceId);
          if (ic) { invoiceNo = ic.serialNo || ic.challanNo || '-'; invoiceDate = ic.date; }
        } else if (tx.referenceType === 'TransferChallan' && tx.referenceId) {
          const tr = trMap.get(tx.referenceId);
          if (tr) { invoiceNo = tr.challanNo || '-'; invoiceDate = tr.date; }
        } else if (tx.referenceType === 'VendorReturnChallan' && tx.referenceId) {
          const vrc = vrcMap.get(tx.referenceId);
          if (vrc) { invoiceNo = vrc.challanNo || '-'; invoiceDate = vrc.date; }
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
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const exportData = useMemo(() => {
    if (!ledger || !Array.isArray(ledger)) return [];
    return ledger.map((entry: any) => ({
      invoiceDate: formatDateDDMMYYYY(entry.invoiceDate),
      invoice: entry.invoiceNo || '',
      itemName: entry.item?.itemName || '',
      vendorName: entry.vendorName || '',
      department: entry.department?.name || '',
      location: entry.location ? `${entry.location.locationType} - ${entry.location.locationName}` : '',
      quantityIn: entry.quantityIn || 0,
      quantityOut: entry.quantityOut || 0,
      rate: entry.rate || 0,
      totalRate: ((Number(entry.quantityIn) || 0) - (Number(entry.quantityOut) || 0)) * (Number(entry.rate) || 0),
      balanceQty: entry.balanceQty || 0,
      transactionType: entry.transactionType,
      reference: entry.referenceType || '',
      remarks: entry.remarks || '',
      createdBy: entry.createdBy || '',
      createdAt: formatDateTimeDDMMYYYY(entry.createdAt),
    }));
  }, [ledger]);

  const typeColor = (t: string) => {
    switch (t) {
      case 'PURCHASE': return 'success';
      case 'ISSUE': return 'error';
      case 'TRANSFER': case 'TRANSFER_IN': case 'TRANSFER_OUT': return 'info';
      case 'ADJUSTMENT': return 'warning';
      case 'DAMAGE_OUT': case 'DAMAGE_TRANSFER_IN': return 'error';
      case 'OPENING_STOCK': return 'primary';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, color: 'text.primary', mb: 0.25 }}>
            Stock Ledger
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Detailed stock movement history and analysis
          </Typography>
        </Box>
        <ImportExportButtons
          data={exportData}
          columns={exportColumns}
          fileName="stock-ledger"
          showImport={false}
        />
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <FilterList sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600}>Filters</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Autocomplete
            options={items || []}
            getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName} (${o.unit?.name})`}
            value={items?.find((i: any) => i.id === selectedItemId) || null}
            onChange={(_, v: any) => setSelectedItemId(v?.id || null)}
            renderInput={(params) => <TextField {...params} label="Select Item" placeholder="Search item..." />}
            sx={{ minWidth: 300, maxWidth: 400 }}
          />
          <DatePickerField
            label="Posted Start Date"
            value={startDate}
            onChange={(v) => setStartDate(v)}
            size="small"
            sx={{ minWidth: 150 }}
          />
          <DatePickerField
            label="Posted End Date"
            value={endDate}
            onChange={(v) => setEndDate(v)}
            size="small"
            sx={{ minWidth: 150 }}
          />
          <DatePickerField
            label="Invoice Start Date"
            value={invoiceStartDate}
            onChange={(v) => setInvoiceStartDate(v)}
            size="small"
            sx={{ minWidth: 150 }}
          />
          <DatePickerField
            label="Invoice End Date"
            value={invoiceEndDate}
            onChange={(v) => setInvoiceEndDate(v)}
            size="small"
            sx={{ minWidth: 150 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="PURCHASE">Purchase</MenuItem>
              <MenuItem value="ISSUE">Issue</MenuItem>
              <MenuItem value="TRANSFER">Transfer</MenuItem>
              <MenuItem value="TRANSFER_IN">Transfer In</MenuItem>
              <MenuItem value="TRANSFER_OUT">Transfer Out</MenuItem>
              <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
              <MenuItem value="DAMAGE_OUT">Damage Out</MenuItem>
              <MenuItem value="DAMAGE_TRANSFER_IN">Damage Transfer In</MenuItem>
              <MenuItem value="OPENING_STOCK">Opening Stock</MenuItem>
            </Select>
          </FormControl>
          <Autocomplete
            options={createdByOptions}
            getOptionLabel={(o) => o}
            value={createdByFilter || null}
            onChange={(_, v) => setCreatedByFilter(v || '')}
            renderInput={(params) => <TextField {...params} label="Created By" placeholder="Filter by user..." />}
            sx={{ minWidth: 180 }}
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
            label={<Typography variant="body2" noWrap>Hide Reversals</Typography>}
          />
          <Button variant="contained" size="small" startIcon={<SearchIcon />} onClick={handleApplyFilters}>
            Submit
          </Button>
          <Button variant="outlined" size="small" onClick={handleReset}>
            Reset
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TableContainer sx={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <Table size="small" stickyHeader sx={{ minWidth: 1300 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 110 }}>Invoice Date</TableCell>
                <TableCell sx={{ minWidth: 110 }}>Invoice Number</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Item Name</TableCell>
                <TableCell sx={{ minWidth: 130 }}>Vendor Name</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Department</TableCell>
                <TableCell sx={{ minWidth: 140 }}>Location</TableCell>
                <TableCell align="right" sx={{ minWidth: 70 }}>Qty In</TableCell>
                <TableCell align="right" sx={{ minWidth: 70 }}>Qty Out</TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>Rate</TableCell>
                <TableCell align="right" sx={{ minWidth: 90 }}>Total Rate</TableCell>
                <TableCell align="right" sx={{ minWidth: 100 }}>Balance in Stock</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Type</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Reference</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Remarks</TableCell>
                <TableCell sx={{ minWidth: 100 }}>POSTED AT</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ledgerLoading ? (
                <TableRow>
                  <TableCell colSpan={15} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">Loading...</Typography>
                  </TableCell>
                </TableRow>
              ) : ledger?.length > 0 ? (
                ledger.map((entry: any) => {
                  const qtyIn = Number(entry.quantityIn) || 0;
                  const qtyOut = Number(entry.quantityOut) || 0;
                  const rate = Number(entry.rate) || 0;
                  const totalRate = (qtyIn - qtyOut) * rate;
                  return (
                    <TableRow key={entry.id} hover>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                        {formatDateDDMMYYYY(entry.invoiceDate)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                          {entry.invoiceNo || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{entry.item?.itemName || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">{entry.item?.itemCode}</Typography>
                      </TableCell>
                      <TableCell>{entry.vendorName || '-'}</TableCell>
                      <TableCell>{entry.department?.name || '-'}</TableCell>
                      <TableCell>{entry.location ? `${entry.location.locationType} - ${entry.location.locationName}` : '-'}</TableCell>
                      <TableCell align="right" sx={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                        color: qtyIn > 0 ? COLORS.success : 'text.secondary',
                        fontWeight: qtyIn > 0 ? 600 : 400,
                      }}>
                        {qtyIn > 0 ? `+${qtyIn}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                        color: qtyOut > 0 ? COLORS.danger : 'text.secondary',
                        fontWeight: qtyOut > 0 ? 600 : 400,
                      }}>
                        {qtyOut > 0 ? `-${qtyOut}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                        {rate > 0 ? `₹${rate.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                        color: totalRate > 0 ? COLORS.success : totalRate < 0 ? COLORS.danger : 'text.secondary',
                        fontWeight: 600,
                      }}>
                        {totalRate !== 0 ? `₹${totalRate.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                        {entry.balanceQty}
                      </TableCell>
                      <TableCell>
                        <Chip label={entry.transactionType} size="small" color={typeColor(entry.transactionType) as any} variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{entry.referenceType || '-'}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{entry.remarks || '-'}</TableCell>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                        {formatDateTimeDDMMYYYY(entry.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={15}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Inventory sx={{ fontSize: 40, color: '#CBD5E1', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        {selectedItemId ? 'No stock entries found for selected date range' : 'Select an item to view its stock history'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </Typography>
          <Pagination
            count={totalPages || 1}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            showFirstButton
            showLastButton
          />
        </Stack>
      </Paper>
    </Box>
  );
}
