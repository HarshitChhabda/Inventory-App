import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, Autocomplete, Chip, Card, CardContent,
  alpha, useTheme, Divider, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot, TimelineOppositeContent } from '@mui/lab';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart as PurchaseIcon, CheckCircle as ReceivedIcon, Send as IssueIcon,
  Build as InstallIcon, Warning as DamageIcon, Delete as ScrapIcon,
  SwapHoriz as TransferIcon, Tune as AdjustIcon, Warehouse, TrendingUp, TrendingDown,
  History, Inventory, Send,
} from '@mui/icons-material';
import { useCompany } from '../../context/CompanyContext';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { useSearchParams } from 'react-router-dom';

const typeIcon = (type: string) => {
  switch (type) {
    case 'RECEIPT': case 'PURCHASE': return <PurchaseIcon sx={{ fontSize: 16 }} />;
    case 'ISSUE': return <IssueIcon sx={{ fontSize: 16 }} />;
    case 'OPENING_STOCK': case 'OPENING_BALANCE': return <ReceivedIcon sx={{ fontSize: 16 }} />;
    case 'TRANSFER_IN': return <TransferIcon sx={{ fontSize: 16 }} />;
    case 'TRANSFER_OUT': return <TransferIcon sx={{ fontSize: 16 }} />;
    case 'ADJUSTMENT_IN': return <AdjustIcon sx={{ fontSize: 16 }} />;
    case 'ADJUSTMENT_OUT': return <AdjustIcon sx={{ fontSize: 16 }} />;
    case 'DAMAGE': case 'DAMAGE_OUT': return <DamageIcon sx={{ fontSize: 16 }} />;
    case 'VENDOR_RETURN': return <ScrapIcon sx={{ fontSize: 16 }} />;
    case 'REVERSAL': return <AdjustIcon sx={{ fontSize: 16 }} />;
    default: return <ReceivedIcon sx={{ fontSize: 16 }} />;
  }
};

const typeColor = (type: string): string => {
  switch (type) {
    case 'RECEIPT': case 'PURCHASE': case 'OPENING_STOCK': case 'OPENING_BALANCE': case 'TRANSFER_IN': case 'ADJUSTMENT_IN': return '#16A34A';
    case 'ISSUE': case 'TRANSFER_OUT': case 'ADJUSTMENT_OUT': case 'DAMAGE': case 'DAMAGE_OUT': case 'VENDOR_RETURN': return '#DC2626';
    case 'REVERSAL': return '#D97706';
    default: return '#94A3B8';
  }
};

const typeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    RECEIPT: 'Receipt', PURCHASE: 'Purchase', ISSUE: 'Issue',
    TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out',
    ADJUSTMENT_IN: 'Adjustment In', ADJUSTMENT_OUT: 'Adjustment Out',
    DAMAGE: 'Damage', DAMAGE_OUT: 'Damage', VENDOR_RETURN: 'Vendor Return',
    OPENING_STOCK: 'Opening Stock', OPENING_BALANCE: 'Opening Balance',
    REVERSAL: 'Reversal',
  };
  return labels[type] || type;
};

export default function ItemHistoryTimeline() {
  const { company, financialYear } = useCompany();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  useEffect(() => {
    const id = searchParams.get('itemId');
    if (id) setSelectedItemId(Number(id));
  }, [searchParams]);

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: history } = useQuery({
    queryKey: ['itemHistory', company?.id, financialYear?.id, selectedItemId],
    queryFn: async () => {
      const entries = await window.electronAPI.dbQuery('stockTransaction', 'findMany', {
        where: { companyId: company!.id, financialYearId: financialYear!.id, itemId: selectedItemId! },
        include: { department: true, location: true },
        orderBy: { transactionDate: 'asc' },
      });
      return entries.map((e: any) => ({
        id: e.id, type: e.transactionType, date: e.transactionDate,
        dateFormatted: formatDateDDMMYYYY(e.transactionDate),
        challanNo: e.referenceNo, departmentName: e.department?.name,
        locationName: e.location?.locationName || 'Main Store',
        locationType: e.location?.locationType || '',
        quantityIn: Number(e.quantityIn || 0), quantityOut: Number(e.quantityOut || 0),
        rate: e.rate, balanceQty: e.balanceQty, remarks: e.remarks,
      }));
    },
    enabled: !!selectedItemId,
    refetchOnMount: true,
  });

  const { data: locationBalances } = useQuery({
    queryKey: ['locationBalances', company?.id, financialYear?.id, selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return [];
      const allTx = await window.electronAPI.dbQuery('stockTransaction', 'findMany', {
        where: { companyId: company!.id, financialYearId: financialYear!.id, itemId: selectedItemId },
        include: { location: true, department: true },
        orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
      });

      // Process chronologically to track Main Store balance
      let mainStoreBalance = 0;
      const rows: any[] = [];

      for (const t of allTx) {
        const qtyIn = Number(t.quantityIn || 0);
        const qtyOut = Number(t.quantityOut || 0);

        if (!t.locationId) {
          // Main Store transaction - just update balance
          mainStoreBalance += qtyIn - qtyOut;
        } else {
          // Location transaction - record snapshot
          const issuedQty = t.transactionType === 'ISSUE' ? qtyOut : qtyIn;
          const mainStoreBefore = mainStoreBalance;
          mainStoreBalance -= issuedQty;

          rows.push({
            id: t.id,
            locationId: t.locationId,
            locationName: t.location?.locationName || '',
            locationType: t.location?.locationType || '',
            departmentName: t.department?.name || '',
            issuedQty,
            mainStoreBefore,
            mainStoreBalance,
            date: t.transactionDate,
            transactionType: t.transactionType,
          });
        }
      }

      // Sort by date ascending (chronological order)
      rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return rows;
    },
    enabled: !!selectedItemId,
    refetchOnMount: true,
  });

  const selectedItem = items?.find((i: any) => i.itemId === selectedItemId || i.id === selectedItemId);
  const mainStoreFinal = locationBalances && locationBalances.length > 0 ? locationBalances[locationBalances.length - 1].mainStoreBalance : 0;

  return (
    <Box>
      {/* Header */}
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

      {/* Item Selector */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Autocomplete
          options={items || []}
          getOptionLabel={(o: any) => `${o.itemCode || ''} - ${o.itemName}`}
          value={selectedItem || null}
          onChange={(_, v: any) => {
            setSelectedItemId(v?.id || null);
            if (v?.id) setSearchParams({ itemId: String(v.id) });
            else setSearchParams({});
          }}
          renderInput={(params) => <TextField {...params} label="Search item by name or code..." />}
          sx={{ maxWidth: 500 }}
        />
      </Paper>

      {selectedItemId && (
        <>
          {/* Balance by Location Section */}
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
                {locationBalances.map((loc: any) => {
                  const deptName = loc.departmentName || '';
                  const roomNumber = loc.locationName?.match(/Room\s+(\d+)/i)?.[1] || '';
                  return (
                    <Box key={loc.id} sx={{ mb: 1.5 }}>
                      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 1 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                  Main Store
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 0, py: 1, width: 30 }} align="center">
                                <Send sx={{ fontSize: 16, color: 'primary.main' }} />
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 1 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                  Department : {deptName}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 0, py: 1, width: 30 }} align="center">
                                <Send sx={{ fontSize: 16, color: 'primary.main' }} />
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 1 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                  Room Number : {roomNumber || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 0, py: 1, width: 30 }} align="center">
                                <Send sx={{ fontSize: 16, color: 'primary.main' }} />
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 1 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                  Main Store Balance
                                </Typography>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 0.5 }}>
                                <Typography variant="body1" fontWeight={700} sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1rem' }}>
                                  {loc.mainStoreBefore}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 0, py: 0.5 }} align="center" />
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 0.5 }}>
                                <Typography variant="body1" fontWeight={700} sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1rem', color: '#DC2626' }}>
                                  {loc.issuedQty}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 0, py: 0.5 }} align="center" />
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 0.5 }}>
                                <Typography variant="body1" fontWeight={700} sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1rem' }}>
                                  {loc.locationName}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ borderBottom: 'none', px: 0, py: 0.5 }} align="center" />
                              <TableCell sx={{ borderBottom: 'none', px: 2, py: 0.5 }}>
                                <Chip
                                  label={`${loc.mainStoreBalance} ${selectedItem?.unit?.name || ''}`}
                                  size="small"
                                  sx={{
                                    fontWeight: 700,
                                    fontFamily: '"JetBrains Mono", monospace',
                                    backgroundColor: loc.mainStoreBalance > 0 ? alpha('#16A34A', 0.1) : alpha('#DC2626', 0.1),
                                    color: loc.mainStoreBalance > 0 ? '#16A34A' : '#DC2626',
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Timeline Section */}
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <History sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="h6" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: '0.875rem' }}>
                Transaction History
              </Typography>
              <Chip label={`${history?.length || 0} transactions`} size="small" />
            </Stack>
            {history && history.length > 0 ? (
              <Timeline position="alternate">
                {history.map((entry: any, idx: number) => {
                  const isLeft = ['PURCHASE', 'RECEIPT', 'OPENING_STOCK', 'OPENING_BALANCE', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'REVERSAL'].includes(entry.type);
                  return (
                  <TimelineItem key={entry.id || idx} position={isLeft ? 'left' : 'right'}>
                    <TimelineOppositeContent sx={{ m: 'auto 0' }} variant="caption" color="text.secondary">
                      {entry.dateFormatted}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineConnector sx={{ backgroundColor: alpha(typeColor(entry.type), 0.2) }} />
                      <TimelineDot sx={{
                        backgroundColor: alpha(typeColor(entry.type), 0.12),
                        color: typeColor(entry.type),
                        boxShadow: `0 0 0 2px ${alpha(typeColor(entry.type), 0.15)}`,
                        width: 36, height: 36,
                      }}>
                        {typeIcon(entry.type)}
                      </TimelineDot>
                      <TimelineConnector sx={{ backgroundColor: alpha(typeColor(entry.type), 0.2) }} />
                    </TimelineSeparator>
                    <TimelineContent sx={{ py: '8px', px: 2 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5, border: '1px solid', borderColor: 'divider',
                          borderLeft: `3px solid ${typeColor(entry.type)}`,
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Chip
                            label={typeLabel(entry.type)}
                            size="small"
                            sx={{
                              height: 20, fontSize: '0.6875rem', fontWeight: 600,
                              backgroundColor: alpha(typeColor(entry.type), 0.1),
                              color: typeColor(entry.type),
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
                          {entry.challanNo && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              Ref: {entry.challanNo}
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
                                Loc: {entry.locationName}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="caption" sx={{
                            fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
                            fontSize: '0.75rem', color: 'text.primary',
                          }}>
                            Balance: {entry.balanceQty}
                            {Number(entry.rate) > 0 && ` | Rate: ₹${Number(entry.rate).toFixed(2)}`}
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
          </Paper>
        </>
      )}
    </Box>
  );
}
