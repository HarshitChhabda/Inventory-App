import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Grid, Chip, alpha, useTheme, Tooltip, Autocomplete,   CircularProgress, Alert,
} from '@mui/material';
import { Add, Delete, ArrowBack, SwapHoriz, Search, Send } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import PageHeader from '../../components/PageHeader';
import EnterpriseDialog from '../../components/EnterpriseDialog';
import DatePickerField from '../../components/DatePickerField';
import { GuideButton } from '../../components/GuideSystem';
import { todayISO } from '../../utils/dateUtils';
import { isIntegerOnlyUnit } from '../../utils/unitUtils';
import toast from 'react-hot-toast';
import SuccessScreen from '../../components/SuccessScreen';
import PostConfirmationDialog from '../../components/PostConfirmationDialog';
import { MaterialTransferItem } from './types';

export default function MaterialTransfer() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [formData, setFormData] = useState({
    date: todayISO(),
    fromStoreId: 0,
    toStoreId: 0,
    transferredBy: '',
    approvedBy: '',
    remarks: '',
    serviceRequestId: 0,
    serviceRequestNumber: '',
  });

  const [items, setItems] = useState<MaterialTransferItem[]>([]);
  const [linkedDemandItems, setLinkedDemandItems] = useState<any[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [savedResult, setSavedResult] = useState<{ id: number; status: string } | null>(null);

  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: stockBalances } = useQuery({
    queryKey: ['stockBalanceTransfer', company?.id, financialYear?.id, formData.fromStoreId],
    queryFn: async () => {
      if (!formData.fromStoreId) return [];
      return await window.electronAPI.getStoreStock(company!.id, financialYear!.id, formData.fromStoreId);
    },
    enabled: !!company?.id && !!financialYear?.id && !!formData.fromStoreId,
    refetchOnMount: true,
  });

  const { data: allItems } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: openDemands } = useQuery({
    queryKey: ['openDemands', company?.id, 'TRANSFER'],
    queryFn: () => window.electronAPI.getOpenDemands(company!.id, financialYear?.id, 'TRANSFER'),
    enabled: !!company?.id,
  });

  const selectedFromStore = useMemo(() => stores?.find((s: any) => s.id === formData.fromStoreId), [stores, formData.fromStoreId]);
  const selectedToStore = useMemo(() => stores?.find((s: any) => s.id === formData.toStoreId), [stores, formData.toStoreId]);

  const storeStockMap = useMemo(() => {
    if (!stockBalances || !Array.isArray(stockBalances)) return {};
    const map: Record<number, number> = {};
    stockBalances.forEach((bal: any) => {
      if (bal.storeId === formData.fromStoreId) {
        map[bal.itemId] = (map[bal.itemId] || 0) + Number(bal.available || 0);
      }
    });
    return map;
  }, [stockBalances, formData.fromStoreId]);

  const availableItems = useMemo(() => {
    if (!formData.fromStoreId || !allItems) return [];
    return allItems.filter((item: any) => (storeStockMap[item.id] || 0) > 0);
  }, [allItems, storeStockMap, formData.fromStoreId]);

  const quickAddFiltered = useMemo(() => {
    const list = availableItems.filter((i: any) => !items.some((item) => item.itemId === i.id));
    if (!quickAddSearch) return list;
    const q = quickAddSearch.toLowerCase();
    return list.filter((i: any) => (i.itemName || '').toLowerCase().includes(q) || (i.itemCode || '').toLowerCase().includes(q));
  }, [availableItems, items, quickAddSearch]);

  const totalQtyPerItem = useMemo(() => {
    const map: Record<number, number> = {};
    items.forEach((i) => { if (i.itemId > 0) map[i.itemId] = (map[i.itemId] || 0) + i.quantity; });
    return map;
  }, [items]);

  const handleAddItem = useCallback((item: any) => {
    const stock = storeStockMap[item.id] || 0;
    if (stock <= 0) return;
    setItems((prev) => [...prev, {
      itemId: item.id,
      itemName: item.itemName,
      itemCode: item.itemCode || '',
      unitName: item.unit?.name || '',
      quantity: 1,
      maxAvailable: stock,
      remarks: '',
    }]);
    setQuickAddOpen(false);
    setQuickAddSearch('');
  }, [storeStockMap]);

  const handleUpdateItem = useCallback((idx: number, field: keyof MaterialTransferItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const handleRemoveItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = useCallback(async () => {
    if (!company || !financialYear) return;
    setSaving(true);
    try {
      const challans = await window.electronAPI.dbQuery(
        'transferChallans', 'findMany',
        { where: { companyId: company.id, financialYearId: financialYear.id }, orderBy: { id: 'desc' }, take: 1 }
      );
      const lastNo = challans.length > 0
        ? parseInt((challans[0].voucherNo || '').replace('TC-', '')) + 1
        : 1;
      const challanNo = `TC-${String(lastNo).padStart(5, '0')}`;

      const payload = {
        date: formData.date,
        fromStoreId: formData.fromStoreId,
        toStoreId: formData.toStoreId,
        transferredBy: formData.transferredBy,
        approvedBy: formData.approvedBy,
        remarks: formData.remarks,
        serviceRequestId: formData.serviceRequestId || undefined,
        companyId: company.id,
        financialYearId: financialYear.id,
        status: 'Posted' as const,
        challanNo,
      };

      const formattedItems = items.map((i) => ({
        itemId: i.itemId, quantity: i.quantity, rate: 0,
        condition: 'GOOD', remarks: i.remarks,
      }));

      const saved = await window.electronAPI.saveTransferChallan(payload, formattedItems, false);
      await window.electronAPI.postTransferChallan(saved.id);
      toast.success('Transfer posted successfully');
      setSavedResult({ id: saved.id, status: 'Posted' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save transfer');
    }
    setSaving(false);
  }, [company, financialYear, formData, items]);

  const canSave = useMemo(() => {
    if (!formData.fromStoreId || !formData.toStoreId || formData.fromStoreId === formData.toStoreId) return false;
    if (!formData.transferredBy || items.length === 0) return false;
    if (items.some((i) => i.itemId <= 0 || i.quantity <= 0 || i.quantity > i.maxAvailable)) return false;
    return true;
  }, [formData, items]);

  const fromStoreOptions = useMemo(() =>
    (stores || []).map((s: any) => ({ id: s.id, label: `${s.name} (${s.storeType.replace('_', ' ')})` })),
    [stores]
  );

  const toStoreOptions = useMemo(() =>
    (stores || []).filter((s: any) => s.id !== formData.fromStoreId)
      .map((s: any) => ({ id: s.id, label: `${s.name} (${s.storeType.replace('_', ' ')})` })),
    [stores, formData.fromStoreId]
  );

  const itemOptions = useMemo(() =>
    availableItems.map((item: any) => ({ ...item, label: `${item.itemCode} - ${item.itemName}` })),
    [availableItems]
  );

  if (savedResult) {
    return (
      <SuccessScreen
        title="Transfer Completed"
        subtitle="Stock has been moved between stores successfully."
        entityCode="TC"
        entityName={`Transfer #${savedResult.id}`}
        onCreateNew={() => { setSavedResult(null); setItems([]); setFormData((p) => ({ ...p, remarks: '' })); }}
        onBackToList={() => navigate('/inventory/movement')}
        showViewDetails={false}
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title="Transfer Material"
        subtitle="Move stock from one store to another"
        breadcrumbs={[
          { label: 'Material Operations', path: '/inventory/movement' },
          { label: 'Transfer Material' },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <GuideButton pageId="transfer-challan" />
            <Tooltip title="Back to Material Movement">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      {/* Transfer Details */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: '14px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF',
      }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <DatePickerField label="Date" value={formData.date}
              onChange={(val) => setFormData((p) => ({ ...p, date: val }))}
              fullWidth size="small" />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={(openDemands as any[] || [])}
              getOptionLabel={(o: any) => `${o.physicalDemandNo || o.requestNumber} — ${o.dharmshalaName || 'N/A'}`}
              value={(openDemands as any[] || []).find((d: any) => d.id === formData.serviceRequestId) || null}
              onChange={(_, v) => {
                if (!v) {
                  setFormData((p) => ({ ...p, serviceRequestId: 0, serviceRequestNumber: '' }));
                  setLinkedDemandItems([]);
                  return;
                }
                const demand = v as any;
                const fromStore = (stores as any[] || []).find((s: any) => s.id === demand.storeId);
                const toStore = (stores as any[] || []).find((s: any) => s.name === demand.dharmshalaName && s.storeType === 'DHARMSHALA_STORE');
                setFormData((p) => ({
                  ...p,
                  serviceRequestId: demand.id,
                  serviceRequestNumber: demand.physicalDemandNo || '',
                  fromStoreId: fromStore?.id || p.fromStoreId,
                  toStoreId: toStore?.id || p.toStoreId,
                  transferredBy: demand.requestingPerson || demand.responsiblePerson || p.transferredBy,
                  remarks: [demand.workType, demand.issueDescription].filter(Boolean).join(' -- ') || p.remarks,
                }));
                window.electronAPI.getDemandItems(demand.id).then((demandItems: any[]) => {
                  setLinkedDemandItems(demandItems || []);
                  const allItemsList = (allItems as any[] || []);
                  const newItems = demandItems
                    .filter((di: any) => {
                      const remaining = Number(di.quantityRequested) - Number(di.quantityIssued) + Number(di.quantityReturned || 0);
                      return remaining > 0;
                    })
                    .map((di: any) => {
                      const item = allItemsList.find((i: any) => i.id === di.itemId);
                      const remaining = Number(di.quantityRequested) - Number(di.quantityIssued) + Number(di.quantityReturned || 0);
                      return {
                        itemId: di.itemId,
                        itemName: di.itemName,
                        itemCode: di.itemCode || item?.itemCode || '',
                        unitName: di.unitName || item?.unit?.name || 'NOS',
                        quantity: remaining,
                        maxAvailable: remaining,
                        fromLocationId: 0,
                        fromLocationName: '',
                        toLocationId: 0,
                        toLocationName: '',
                        remarks: '',
                        demandItemId: di.id,
                      };
                    });
                  setItems(newItems);
                }).catch(() => setLinkedDemandItems([]));
              }}
              renderInput={(params) => <TextField {...params} label="Link to Demand (Optional)" placeholder="Search demand..." />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small" options={fromStoreOptions} getOptionLabel={(o) => o.label}
              value={fromStoreOptions.find((o: any) => o.id === formData.fromStoreId) || null}
              onChange={(_, v) => setFormData((p) => ({ ...p, fromStoreId: v?.id || 0, toStoreId: p.toStoreId === v?.id ? 0 : p.toStoreId }))}
              renderInput={(params) => <TextField {...params} label="From Store" required />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small" options={toStoreOptions} getOptionLabel={(o) => o.label}
              value={toStoreOptions.find((o: any) => o.id === formData.toStoreId) || null}
              onChange={(_, v) => setFormData((p) => ({ ...p, toStoreId: v?.id || 0 }))}
              renderInput={(params) => <TextField {...params} label="To Store" required />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Transferred By" value={formData.transferredBy}
              onChange={(e) => setFormData((p) => ({ ...p, transferredBy: e.target.value }))}
              fullWidth required placeholder="Name" />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Remarks" value={formData.remarks}
              onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
              fullWidth placeholder="Optional notes" />
          </Grid>
        </Grid>
        {formData.fromStoreId > 0 && formData.toStoreId > 0 && formData.fromStoreId === formData.toStoreId && (
          <Alert severity="error" sx={{ mt: 1.5 }}>Source and destination stores cannot be the same.</Alert>
        )}
      </Box>

      {/* Items */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: '14px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF',
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Items {items.length > 0 && `(${items.length})`}
          </Typography>
          <Button startIcon={<Add />} size="small" onClick={() => setQuickAddOpen(true)} disabled={!formData.fromStoreId}>
            Add Item
          </Button>
        </Stack>

        {!formData.fromStoreId ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <SwapHoriz sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">Select a source store first.</Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No items added. Click "Add Item" to begin.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ borderRadius: '12px', border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, '& .MuiTableCell-root': { fontSize: '0.8125rem' } }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Item</TableCell>
                  <TableCell sx={{ width: 100, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Quantity</TableCell>
                  <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Remarks</TableCell>
                  <TableCell sx={{ width: 50, bgcolor: alpha(theme.palette.primary.main, 0.03) }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: `${alpha(theme.palette.primary.main, 0.04)} !important` } }}>
                    <TableCell>
                      <Box sx={{ width: 24, height: 24, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(theme.palette.primary.main, 0.08), fontSize: '0.6875rem', fontWeight: 700, color: 'primary.main' }}>
                        {idx + 1}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={500} fontSize="0.8125rem">{item.itemName}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.itemCode} ({item.unitName})</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <TextField size="small" type="number" value={item.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const adjusted = isIntegerOnlyUnit(item.unitName) ? Math.round(val) : val;
                            handleUpdateItem(idx, 'quantity', adjusted);
                          }}
                          inputProps={{ min: 0.01, step: isIntegerOnlyUnit(item.unitName) ? 1 : 0.01 }}
                          sx={{ width: 90 }}
                          error={item.quantity > item.maxAvailable || item.quantity <= 0} />
                        <Chip label={`${item.maxAvailable} avail`} size="small"
                          sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: item.quantity > item.maxAvailable ? alpha('#DC2626', 0.1) : alpha('#16A34A', 0.1), color: item.quantity > item.maxAvailable ? '#DC2626' : '#16A34A' }} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <TextField size="small" value={item.remarks}
                        onChange={(e) => handleUpdateItem(idx, 'remarks', e.target.value)}
                        placeholder="Note..." sx={{ width: 150 }} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Remove">
                        <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Quick Add Dialog */}
      <EnterpriseDialog
        open={quickAddOpen}
        onClose={() => { setQuickAddOpen(false); setQuickAddSearch(''); }}
        title="Add Item from Store"
        subtitle="Search and select items with available stock"
        icon={<Search />}
        maxWidth="sm"
      >
        <TextField fullWidth size="small" placeholder="Search by name or code..."
          value={quickAddSearch} onChange={(e) => setQuickAddSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ mb: 2 }}
        />
        <Stack spacing={0.5} sx={{ maxHeight: 300, overflow: 'auto' }}>
          {quickAddFiltered.map((item: any) => {
            const bal = storeStockMap[item.id] || 0;
            return (
              <Box key={item.id} onClick={() => handleAddItem(item)} sx={{
                p: 1, borderRadius: 1, cursor: 'pointer', border: '1px solid', borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
              }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{item.itemName}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.itemCode}</Typography>
                  </Box>
                  <Chip label={`${bal} ${item.unit?.name || ''}`} size="small"
                    sx={{ height: 20, fontSize: '0.65rem', backgroundColor: alpha('#16A34A', 0.1), color: '#16A34A' }} />
                </Stack>
              </Box>
            );
          })}
          {quickAddFiltered.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {quickAddSearch ? 'No items match your search' : 'No items with available stock'}
              </Typography>
            </Box>
          )}
        </Stack>
      </EnterpriseDialog>

      {/* Action Bar */}
      <Box sx={{
        p: 2, mt: 1, borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#FFFFFF',
        display: 'flex', justifyContent: 'flex-end', gap: 1,
        position: 'sticky', bottom: 16,
        boxShadow: isDark ? '0 -4px 24px rgba(0,0,0,0.3)' : '0 -4px 24px rgba(0,0,0,0.04)',
      }}>
        <Button variant="outlined" onClick={() => navigate('/inventory/movement')} disabled={saving}
          sx={{ fontWeight: 500, borderRadius: '10px', textTransform: 'none' }}>
          Cancel
        </Button>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Send />}
          onClick={() => setShowPostConfirm(true)} disabled={!canSave || saving}
          sx={{ fontWeight: 600, borderRadius: '10px', textTransform: 'none', px: 3 }}>
          {saving ? 'Processing...' : 'Confirm Transfer'}
        </Button>
      </Box>

      <PostConfirmationDialog
        open={showPostConfirm}
        title="Confirm Store Transfer"
        summary={[
          { label: 'From', value: selectedFromStore?.name || '—' },
          { label: 'To', value: selectedToStore?.name || '—' },
          { label: 'Items', value: `${items.length} item(s)` },
          { label: 'Transferred By', value: formData.transferredBy || '—' },
        ]}
        onConfirm={() => { setShowPostConfirm(false); handleSave(); }}
        onCancel={() => setShowPostConfirm(false)}
        loading={saving}
        confirmLabel="Post Transfer"
      />
    </Box>
  );
}
