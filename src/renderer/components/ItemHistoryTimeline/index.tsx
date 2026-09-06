import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, Autocomplete, Chip, Card, CardContent,
  alpha, useTheme, Divider, Grid, FormControl, InputLabel, Select, MenuItem, Pagination, Button,
} from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot, TimelineOppositeContent } from '@mui/lab';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart as PurchaseIcon, CheckCircle as ReceivedIcon, Send as IssueIcon,
  Build as InstallIcon, Warning as DamageIcon, Delete as ScrapIcon,
  SwapHoriz as TransferIcon, Tune as AdjustIcon, Warehouse, TrendingUp, TrendingDown,
  History, Inventory, FilterList,
} from '@mui/icons-material';
import { useCompany } from '../../context/CompanyContext';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { toNumber } from '../../utils/numberUtils';
import { useSearchParams } from 'react-router-dom';
import DatePickerField from '../DatePickerField';

const PAGE_SIZE = 50;

const typeIcon = (type: string) => {
  switch (type) {
    case 'RECEIPT': case 'PURCHASE_RECEIPT': return <PurchaseIcon sx={{ fontSize: 16 }} />;
    case 'ISSUE_OUT': case 'ISSUE_IN': return <IssueIcon sx={{ fontSize: 16 }} />;
    case 'OPENING_BALANCE': return <ReceivedIcon sx={{ fontSize: 16 }} />;
    case 'TRANSFER_IN': case 'TRANSFER_OUT': return <TransferIcon sx={{ fontSize: 16 }} />;
    case 'ADJUSTMENT_PLUS': case 'ADJUSTMENT_MINUS': return <AdjustIcon sx={{ fontSize: 16 }} />;
    case 'DAMAGE_OUT': case 'DAMAGE_IN': return <DamageIcon sx={{ fontSize: 16 }} />;
    case 'VENDOR_RETURN': return <ScrapIcon sx={{ fontSize: 16 }} />;
    case 'REVERSAL': return <AdjustIcon sx={{ fontSize: 16 }} />;
    case 'SHIFT_OUT': case 'SHIFT_IN': return <TransferIcon sx={{ fontSize: 16 }} />;
    default: return <ReceivedIcon sx={{ fontSize: 16 }} />;
  }
};

const typeColor = (type: string): string => {
  switch (type) {
    case 'PURCHASE_RECEIPT': case 'OPENING_BALANCE': case 'TRANSFER_IN': case 'ADJUSTMENT_PLUS': case 'RETURN_IN': return '#16A34A';
    case 'ISSUE_OUT': case 'TRANSFER_OUT': case 'ADJUSTMENT_MINUS': case 'DAMAGE_OUT': case 'VENDOR_RETURN': case 'SCRAP_OUT': return '#DC2626';
    case 'REVERSAL': return '#D97706';
    case 'ISSUE_IN': return '#0EA5E9';
    default: return '#94A3B8';
  }
};

const typeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    PURCHASE_RECEIPT: 'Receipt', ISSUE_OUT: 'Issue Out', ISSUE_IN: 'Issue In',
    TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
    ADJUSTMENT_PLUS: 'Adjustment In', ADJUSTMENT_MINUS: 'Adjustment Out',
    DAMAGE_OUT: 'Damage Out', DAMAGE_IN: 'Damage In', VENDOR_RETURN: 'Vendor Return',
    OPENING_BALANCE: 'Opening Balance', REVERSAL: 'Reversal',
    SHIFT_OUT: 'Shift Out', SHIFT_IN: 'Shift In',
    RETURN_OUT: 'Return Out', RETURN_IN: 'Return In',
    SCRAP_OUT: 'Scrap',
  };
  return labels[type] || type;
};

export default function ItemHistoryTimeline() {
  const { company, financialYear } = useCompany();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');

  useEffect(() => {
    const id = searchParams.get('itemId');
    if (id) setSelectedItemId(Number(id));
  }, [searchParams]);

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ data: any[]; total: number; page: number; pageSize: number; totalPages: number } | null>({
    queryKey: ['itemHistoryPaginated', company?.id, financialYear?.id, selectedItemId, page, storeId, startDate, endDate, voucherTypeFilter, movementTypeFilter],
    queryFn: async () => {
      if (!company?.id || !financialYear?.id || !selectedItemId) return null;
      const params: any = {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: selectedItemId,
        page,
        pageSize: PAGE_SIZE,
      };
      if (storeId) params.storeId = storeId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (voucherTypeFilter) params.voucherType = voucherTypeFilter;
      if (movementTypeFilter) params.movementType = movementTypeFilter;
      return window.electronAPI.getItemHistoryPaginated(params);
    },
    enabled: !!selectedItemId && !!company?.id && !!financialYear?.id,
    placeholderData: (prev) => prev,
  });

  const { data: locationBalances } = useQuery({
    queryKey: ['locationBalances', company?.id, financialYear?.id, selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return [];
      const allTx = await window.electronAPI.dbQuery('stockTransaction', 'findMany', {
        where: { companyId: company!.id, financialYearId: financialYear!.id, itemId: selectedItemId },
        include: { transaction: { include: { department: true, fromStore: true, toStore: true } }, store: true, location: true },
        orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
      });

      // Overall running balance (for main store remaining)
      let runningBalance = 0;
      for (const t of allTx) {
        runningBalance += toNumber(t.quantityIn) - toNumber(t.quantityOut);
      }

      // Location-wise: net items received at each location
      const locationNet: Record<number, { name: string; dept: string; net: number }> = {};
      for (const t of allTx) {
        if (!t.locationId) continue;
        const net = toNumber(t.quantityIn) - toNumber(t.quantityOut);
        if (!locationNet[t.locationId]) {
          locationNet[t.locationId] = {
            name: t.location?.name || '',
            dept: t.transaction?.department?.name || '',
            net: 0,
          };
        }
        locationNet[t.locationId].net += net;
      }

      // Build rows: only show locations with net != 0, plus a summary
      const rows: any[] = [];
      let totalAtLocations = 0;
      for (const [locId, data] of Object.entries(locationNet)) {
        const net = data.net;
        if (net === 0) continue;
        totalAtLocations += net;
        rows.push({
          id: Number(locId),
          locationName: data.name,
          departmentName: data.dept,
          netQty: net,
        });
      }

      // Add "Main Store (remaining)" row
      const mainStoreRemaining = runningBalance - totalAtLocations;
      rows.unshift({
        id: 0,
        locationName: 'Main Store',
        departmentName: '',
        netQty: mainStoreRemaining,
        isMainStore: true,
      });

      return rows;
    },
    enabled: !!selectedItemId,
    refetchOnMount: true,
  });

  const history = historyData?.data || [];
  const totalTransactions = historyData?.total || 0;
  const totalPages = historyData?.totalPages || 1;

  const selectedItem = items?.find((i: any) => i.id === selectedItemId);
  const mainStoreFinal = locationBalances && locationBalances.length > 0
    ? (locationBalances.find((l: any) => l.isMainStore)?.netQty ?? 0)
    : (history.reduce((sum: number, t: any) => sum + (t.quantityIn || 0) - (t.quantityOut || 0), 0));

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <Box>
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, color: 'text.primary', mb: 0.25 }}>
            Item History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track complete item movement and location-wise balances
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
          <FilterList sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600}>Filters</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Autocomplete
            options={items || []}
            getOptionLabel={(o: any) => `${o.itemCode || ''} - ${o.itemName}`}
            value={selectedItem || null}
            onChange={(_, v: any) => {
              setSelectedItemId(v?.id || null);
              setPage(1);
              if (v?.id) setSearchParams({ itemId: String(v.id) });
              else setSearchParams({});
            }}
            renderInput={(params) => <TextField {...params} label="Search item..." />}
            sx={{ minWidth: 250, maxWidth: 400 }}
          />
          <Autocomplete
            options={stores || []}
            getOptionLabel={(o: any) => o.name}
            value={stores?.find((s: any) => s.id === storeId) || null}
            onChange={(_, v: any) => { setStoreId(v?.id || null); handleFilterChange(); }}
            renderInput={(params) => <TextField {...params} label="Store" />}
            sx={{ minWidth: 180 }}
            size="small"
          />
          <DatePickerField label="From" value={startDate} onChange={(v) => { setStartDate(v); handleFilterChange(); }} size="small" sx={{ minWidth: 130 }} />
          <DatePickerField label="To" value={endDate} onChange={(v) => { setEndDate(v); handleFilterChange(); }} size="small" sx={{ minWidth: 130 }} />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Voucher Type</InputLabel>
            <Select value={voucherTypeFilter} label="Voucher Type" onChange={(e) => { setVoucherTypeFilter(e.target.value); handleFilterChange(); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="RC">Receipt (RC)</MenuItem>
              <MenuItem value="IC">Issue (IC)</MenuItem>
              <MenuItem value="TC">Transfer (TC)</MenuItem>
              <MenuItem value="OB">Opening Balance (OB)</MenuItem>
              <MenuItem value="DM">Damage (DM)</MenuItem>
              <MenuItem value="AD">Adjustment (AD)</MenuItem>
              <MenuItem value="RV">Reversal (RV)</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Movement Type</InputLabel>
            <Select value={movementTypeFilter} label="Movement Type" onChange={(e) => { setMovementTypeFilter(e.target.value); handleFilterChange(); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="PURCHASE_RECEIPT">Purchase Receipt</MenuItem>
              <MenuItem value="ISSUE_OUT">Issue Out</MenuItem>
              <MenuItem value="ISSUE_IN">Issue In</MenuItem>
              <MenuItem value="TRANSFER_OUT">Transfer Out</MenuItem>
              <MenuItem value="TRANSFER_IN">Transfer In</MenuItem>
              <MenuItem value="OPENING_BALANCE">Opening Balance</MenuItem>
              <MenuItem value="DAMAGE_OUT">Damage Out</MenuItem>
              <MenuItem value="REVERSAL">Reversal</MenuItem>
              <MenuItem value="ADJUSTMENT_PLUS">Adjustment Plus</MenuItem>
              <MenuItem value="ADJUSTMENT_MINUS">Adjustment Minus</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {selectedItemId && (
        <>
          {locationBalances && locationBalances.length > 0 && (
            <Card sx={{ mb: 2, borderLeft: `3px solid ${theme.palette.primary.main}` }}>
              <CardContent sx={{ p: '16px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                  <Warehouse sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: '0.875rem' }}>
                    Balance by Location
                  </Typography>
                  <Chip
                    label={`Remaining: ${mainStoreFinal} ${selectedItem?.unit?.name || ''}`}
                    size="small"
                    color="primary"
                    sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                  />
                </Stack>
                {locationBalances.map((loc: any) => (
                  <Box key={loc.id} sx={{ mb: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1, px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Warehouse sx={{ fontSize: 18, color: loc.isMainStore ? 'primary.main' : 'text.secondary' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {loc.locationName}
                        </Typography>
                        {loc.departmentName && (
                          <Typography variant="caption" color="text.secondary">
                            Dept: {loc.departmentName}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={`${loc.netQty > 0 ? '+' : ''}${loc.netQty} ${selectedItem?.unit?.name || ''}`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontFamily: '"JetBrains Mono", monospace',
                          backgroundColor: loc.netQty > 0 ? alpha('#16A34A', 0.1) : loc.netQty < 0 ? alpha('#DC2626', 0.1) : alpha('#94A3B8', 0.1),
                          color: loc.netQty > 0 ? '#16A34A' : loc.netQty < 0 ? '#DC2626' : '#94A3B8',
                        }}
                      />
                    </Stack>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          <Paper sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <History sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="h6" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: '0.875rem' }}>
                  Transaction History
                </Typography>
                <Chip label={`${totalTransactions} transactions`} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Showing {totalTransactions === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalTransactions)} of {totalTransactions}
              </Typography>
            </Stack>
            {historyLoading ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Loading...</Typography>
              </Box>
            ) : history.length > 0 ? (
              <Timeline position="alternate">
                {history.map((entry: any, idx: number) => {
                  const isLeft = ['PURCHASE_RECEIPT', 'OPENING_BALANCE', 'TRANSFER_IN', 'ADJUSTMENT_PLUS', 'REVERSAL', 'RETURN_IN', 'SHIFT_IN', 'ISSUE_IN'].includes(entry.movementType);
                  return (
                  <TimelineItem key={entry.id || idx} position={isLeft ? 'left' : 'right'}>
                    <TimelineOppositeContent sx={{ m: 'auto 0' }} variant="caption" color="text.secondary">
                      {formatDateDDMMYYYY(entry.transactionDate)}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineConnector sx={{ backgroundColor: alpha(typeColor(entry.movementType), 0.2) }} />
                      <TimelineDot sx={{
                        backgroundColor: alpha(typeColor(entry.movementType), 0.12),
                        color: typeColor(entry.movementType),
                        boxShadow: `0 0 0 2px ${alpha(typeColor(entry.movementType), 0.15)}`,
                        width: 36, height: 36,
                      }}>
                        {typeIcon(entry.movementType)}
                      </TimelineDot>
                      <TimelineConnector sx={{ backgroundColor: alpha(typeColor(entry.movementType), 0.2) }} />
                    </TimelineSeparator>
                    <TimelineContent sx={{ py: '8px', px: 2 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5, border: '1px solid', borderColor: 'divider',
                          borderLeft: `3px solid ${typeColor(entry.movementType)}`,
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Chip
                            label={typeLabel(entry.movementType)}
                            size="small"
                            sx={{
                              height: 20, fontSize: '0.6875rem', fontWeight: 600,
                              backgroundColor: alpha(typeColor(entry.movementType), 0.1),
                              color: typeColor(entry.movementType),
                            }}
                          />
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {entry.quantityIn > 0 && (
                              <Chip
                                icon={<TrendingUp sx={{ fontSize: '12px !important' }} />}
                                label={`+${entry.quantityIn}`}
                                size="small"
                                sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: alpha('#16A34A', 0.1), color: '#16A34A' }}
                              />
                            )}
                            {entry.quantityOut > 0 && (
                              <Chip
                                icon={<TrendingDown sx={{ fontSize: '12px !important' }} />}
                                label={`-${entry.quantityOut}`}
                                size="small"
                                sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: alpha('#DC2626', 0.1), color: '#DC2626' }}
                              />
                            )}
                          </Stack>
                        </Stack>
                        <Stack spacing={0.25}>
                          {entry.voucherNo && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              Ref: {entry.voucherNo}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1}>
                            {entry.departmentName && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                Dept: {entry.departmentName}
                              </Typography>
                            )}
                            {entry.locationName && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                Room: {entry.locationName}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="caption" sx={{
                            fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
                            fontSize: '0.75rem', color: 'text.primary',
                          }}>
                            Balance: {toNumber(entry.balanceQty)} {entry.unitName ? entry.unitName : ''}
                            {toNumber(entry.rate) > 0 && ` | Rate: ₹${toNumber(entry.rate).toFixed(2)}`}
                          </Typography>
                          {entry.remarks && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                              {entry.remarks}
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                  );
                })}
              </Timeline>
            ) : (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Inventory sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">No transaction history for this item</Typography>
              </Box>
            )}
            {totalPages > 1 && (
              <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, v) => setPage(v)}
                  size="small"
                  showFirstButton
                  showLastButton
                />
              </Stack>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
