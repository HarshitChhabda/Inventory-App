import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Autocomplete,
  Grid, Chip, alpha, useTheme, Tooltip,
} from '@mui/material';
import { Add, Delete, ArrowBack, Transform, Inventory2 } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import DatePickerField from '../../../components/DatePickerField';
import { todayISO } from '../../../utils/dateUtils';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
import { toNumber } from '../../../utils/numberUtils';
import { TransferChallanFormData, TransferChallanItem } from '../types';
import { useChallanForm } from '../hooks/useChallanForm';
import { useChallanSave } from '../hooks/useChallanSave';
import ChallanFormSection from '../components/ChallanFormSection';
import ActionBar from '../components/ActionBar';
import EmptyItemsState from '../components/EmptyItemsState';
import SuccessScreen from '../../../components/SuccessScreen';
import PostConfirmationDialog from '../../../components/PostConfirmationDialog';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesDialog from '../../../components/UnsavedChangesDialog';

const INITIAL_ITEM: TransferChallanItem = {
  itemId: 0,
  quantity: 1,
  rate: 0,
  remarks: '',
};

export default function TransferChallanForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const { id } = useParams();
  const theme = useTheme();
  const isEdit = id && id !== 'new';

  // Guard against stale async responses when switching between records
  const editRequestIdRef = useRef(0);

  const [formData, setFormData] = useState<TransferChallanFormData>({
    date: todayISO(),
    fromStoreId: 0,
    toStoreId: 0,
    transferredBy: '',
    approvedBy: '',
    remarks: '',
    items: [],
  });

  const {
    items, setItems, addItem, updateItem, removeItem,
  } = useChallanForm<TransferChallanItem>({
    storageKey: 'recentTransferItems',
    initialItem: () => ({ ...INITIAL_ITEM }),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', {
      where: { isActive: true },
      include: { unit: true },
      orderBy: { itemName: 'asc' },
    }),
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

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: () => window.electronAPI.dbQuery('unit', 'findMany', { orderBy: { name: 'asc' } }),
  });

  const selectedFromStore = useMemo(
    () => stores?.find((s: any) => s.id === formData.fromStoreId),
    [stores, formData.fromStoreId]
  );
  const selectedToStore = useMemo(
    () => stores?.find((s: any) => s.id === formData.toStoreId),
    [stores, formData.toStoreId]
  );

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

  const getItemStock = useCallback(
    (itemId: number, locationId: number | null | undefined) => {
      if (!stockBalances || !Array.isArray(stockBalances) || !formData.fromStoreId) return 0;
      const match = stockBalances.find((b: any) => b.itemId === itemId && b.storeId === formData.fromStoreId);
      return match ? Number(match.available || 0) : 0;
    },
    [stockBalances, formData.fromStoreId]
  );

  const availableItems = useMemo(
    () =>
      !formData.fromStoreId || !itemsData
        ? []
        : itemsData.filter((item: any) => (storeStockMap[item.id] || 0) > 0),
    [itemsData, storeStockMap, formData.fromStoreId]
  );

  // Quick Add Item dialog state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddItemName, setQuickAddItemName] = useState('');
  const [quickAddItemCode, setQuickAddItemCode] = useState('');
  const [quickAddUnit, setQuickAddUnit] = useState('');

  const { saveMutation, savedResult, clearSavedResult } = useChallanSave({
    challanType: 'TC',
    listKey: 'transferChallans',
    entityName: 'transfer challan',
    editPath: '/inventory/transfer-challan',
    isEdit: !!isEdit,
    editId: id,
    saveFn: (payload, formattedItems, isEditFn, editIdNum) =>
      window.electronAPI.saveTransferChallan(payload, formattedItems, isEditFn, editIdNum),
    postFn: (challanId) => window.electronAPI.postTransferChallan(challanId),
    buildPayload: () => ({
      payload: {
        date: formData.date,
        fromStoreId: formData.fromStoreId,
        toStoreId: formData.toStoreId,
        transferredBy: formData.transferredBy,
        approvedBy: formData.approvedBy,
        remarks: formData.remarks,
        companyId: company!.id,
        financialYearId: financialYear!.id,
        status: 'Draft' as const,
      },
      items: items.map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity,
        rate: 0,
        condition: 'GOOD',
        remarks: i.remarks,
      })),
    }),
  });

  const initialFormDataRef = useRef<TransferChallanFormData>({
    date: todayISO(),
    fromStoreId: 0,
    toStoreId: 0,
    transferredBy: '',
    approvedBy: '',
    remarks: '',
    items: [],
  });
  const initialItemsRef = useRef<TransferChallanItem[]>([]);
  const editLoadedRef = useRef(!isEdit);

  useEffect(() => {
    if (isEdit) {
      const requestId = ++editRequestIdRef.current;
      window.electronAPI.dbQuery('transferChallan', 'findUnique', {
        where: { id: Number(id) },
        include: { items: { include: { item: { include: { unit: true } } } } },
      }).then((tc: any) => {
        if (requestId !== editRequestIdRef.current) return;
        if (tc) {
          const loadedFormData: TransferChallanFormData = {
            date: tc.date.split('T')[0],
            fromStoreId: tc.fromStoreId || 0,
            toStoreId: tc.toStoreId || 0,
            transferredBy: tc.transferredBy,
            approvedBy: tc.approvedBy || '',
            remarks: tc.remarks || '',
            items: [],
          };
          const loadedItems: TransferChallanItem[] = tc.items.map((i: any) => ({
            itemId: i.itemId,
            quantity: toNumber(i.quantity),
            rate: toNumber(i.rate),
            remarks: i.remarks || '',
          }));
          initialFormDataRef.current = loadedFormData;
          initialItemsRef.current = loadedItems;
          setFormData(loadedFormData);
          setItems(loadedItems);
          editLoadedRef.current = true;
        }
      });
    }
  }, [id, isEdit, setItems]);

  const isDirty = useMemo(() => {
    if (!editLoadedRef.current) return false;
    const formDataChanged = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(initialItemsRef.current);
    return formDataChanged || itemsChanged;
  }, [formData, items]);

  const {
    showDialog, setShowDialog, handleConfirmNavigation,
    handleCancelNavigation, handleSaveDraft, hasDraftSupport,
  } = useUnsavedChangesWarning({ isDirty });

  const [showPostConfirm, setShowPostConfirm] = useState(false);

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowDialog(true);
    } else {
      navigate('/inventory/transfer-challan');
    }
  }, [isDirty, setShowDialog, navigate]);

  const handleCreateNew = useCallback(() => {
    clearSavedResult();
    navigate('/inventory/transfer-challan/new');
  }, [clearSavedResult, navigate]);

  const handleBackToList = useCallback(() => {
    clearSavedResult();
    navigate('/inventory/transfer-challan');
  }, [clearSavedResult, navigate]);

  const canSave =
    formData.fromStoreId > 0 &&
    formData.toStoreId > 0 &&
    formData.fromStoreId !== formData.toStoreId &&
    !!formData.transferredBy &&
    items.length > 0;

  const hasInsufficientStock =
    formData.fromStoreId > 0 &&
    items.some(
      (i) => i.itemId > 0 && i.quantity > getItemStock(i.itemId, null)
    );

  const fromStoreOptions = useMemo(() => {
    if (!stores) return [];
    return stores.map((s: any) => ({
      id: s.id,
      label: `${s.name} (${s.storeType.replace('_', ' ')})`,
      type: s.storeType,
      name: s.name,
    }));
  }, [stores]);

  const toStoreOptions = useMemo(() => {
    if (!stores) return [];
    return stores
      .filter((s: any) => s.id !== formData.fromStoreId)
      .map((s: any) => ({
        id: s.id,
        label: `${s.name} (${s.storeType.replace('_', ' ')})`,
        type: s.storeType,
        name: s.name,
      }));
  }, [stores, formData.fromStoreId]);

  const itemOptions = useMemo(() => {
    const source = formData.fromStoreId && Object.keys(storeStockMap).length > 0
      ? availableItems
      : (itemsData || []);
    return source.map((item: any) => ({
      ...item,
      label: `${item.itemCode} - ${item.itemName}`,
    }));
  }, [formData.fromStoreId, storeStockMap, availableItems, itemsData]);

  return (
    <Box>
      {savedResult ? (
        <SuccessScreen
          title={savedResult.status === 'Posted' ? 'Transfer Posted Successfully' : 'Draft Saved Successfully'}
          subtitle={savedResult.status === 'Posted'
            ? 'Stock balances have been updated. The transfer challan is now posted and cannot be edited.'
            : 'Your transfer challan has been saved as a draft. You can edit and post it later.'}
          entityCode="TC"
          entityName={`Transfer Challan ${savedResult.id ? `#${savedResult.id}` : ''}`}
          onViewDetails={() => navigate(`/inventory/transfer-challan/${savedResult.id}`)}
          onCreateNew={handleCreateNew}
          onBackToList={handleBackToList}
        />
      ) : (
        <>
          <PageHeader
        title={isEdit ? 'Edit Store Transfer' : 'New Store Transfer'}
        subtitle="Transfer stock between stores"
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/transfer-challan' },
          { label: 'Store Transfer', path: '/inventory/transfer-challan' },
          { label: isEdit ? 'Edit' : 'New Transfer' },
        ]}
        actions={
          <Tooltip title="Back">
            <IconButton
              onClick={handleBack}
              aria-label="Back"
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      <ChallanFormSection
        icon={Transform}
        title="Transfer Details"
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <DatePickerField
              label="Transfer Date"
              value={formData.date}
              onChange={(val) => setFormData((p) => ({ ...p, date: val }))}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={fromStoreOptions}
              getOptionLabel={(o) => o.label}
              value={fromStoreOptions.find((o: { id: number }) => o.id === formData.fromStoreId) || null}
              onChange={(_, v) => {
                setFormData((p) => ({
                  ...p,
                  fromStoreId: v?.id || 0,
                  toStoreId: p.toStoreId === v?.id ? 0 : p.toStoreId,
                }));
              }}
              renderInput={(params) => (
                <TextField {...params} label="From Store" required />
              )}
              sx={{ minWidth: 220 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={toStoreOptions}
              getOptionLabel={(o) => o.label}
              value={toStoreOptions.find((o: { id: number }) => o.id === formData.toStoreId) || null}
              onChange={(_, v) => {
                setFormData((p) => ({
                  ...p,
                  toStoreId: v?.id || 0,
                }));
              }}
              renderInput={(params) => (
                <TextField {...params} label="To Store" required />
              )}
              sx={{ minWidth: 220 }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Transferred By"
              value={formData.transferredBy}
              onChange={(e) => setFormData((p) => ({ ...p, transferredBy: e.target.value }))}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Approved By"
              value={formData.approvedBy}
              onChange={(e) => setFormData((p) => ({ ...p, approvedBy: e.target.value }))}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Remarks"
              value={formData.remarks}
              onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
              fullWidth
            />
          </Grid>
        </Grid>
      </ChallanFormSection>

      <ChallanFormSection icon={Inventory2} title="Items" count={items.length}>
        <TableContainer
          sx={{
            borderRadius: '12px',
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            '& .MuiTableCell-root': { fontSize: '0.8125rem' },
            overflow: 'visible',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Item</TableCell>
                <TableCell sx={{ width: 110, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Quantity</TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Remarks</TableCell>
                <TableCell sx={{ width: 50, bgcolor: alpha(theme.palette.primary.main, 0.03) }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow
                  key={idx}
                  hover
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: alpha(theme.palette.action.hover, 0.02) },
                    '&:hover': { bgcolor: `${alpha(theme.palette.primary.main, 0.04)} !important` },
                    transition: 'background-color 150ms ease-out',
                  }}
                >
                  <TableCell>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'primary.main',
                      }}
                    >
                      {idx + 1}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      options={itemOptions}
                      getOptionLabel={(o: any) => o.label}
                      value={itemOptions.find((o: any) => o.id === item.itemId) || null}
                      onChange={(_, v: any) => updateItem(idx, 'itemId', v?.id || 0)}
                      renderOption={(props, option: any) => {
                        const itemStock = getItemStock(option.id, null);
                        return (
                          <li {...props} key={option.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                              <span>{option.itemCode} - {option.itemName}</span>
                              <Chip
                                label={`${itemStock} ${option.unit?.name || ''}`}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  ml: 1,
                                  backgroundColor: itemStock > 0
                                    ? alpha('#16A34A', 0.1)
                                    : alpha('#DC2626', 0.1),
                                  color: itemStock > 0 ? '#16A34A' : '#DC2626',
                                }}
                              />
                            </Box>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={
                            formData.fromStoreId
                              ? 'Search items in store...'
                              : 'Search & select item...'
                          }
                        />
                      )}
                      sx={{ minWidth: 260 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {(() => {
                        const itemStock = getItemStock(item.itemId, null);
                        const selectedItem = itemsData?.find((i: any) => i.id === item.itemId);
                        return (
                          <>
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const adjusted = isIntegerOnlyUnit(selectedItem?.unit?.name)
                                  ? Math.round(val)
                                  : val;
                                updateItem(idx, 'quantity', adjusted);
                              }}
                              inputProps={{
                                min: 0.01,
                                step: isIntegerOnlyUnit(selectedItem?.unit?.name) ? 1 : 0.01,
                              }}
                              sx={{ width: 90 }}
                              error={
                                item.itemId > 0 &&
                                formData.fromStoreId > 0 &&
                                item.quantity > itemStock
                              }
                            />
                            {item.itemId > 0 && formData.fromStoreId > 0 && (
                              <Chip
                                label={`${itemStock} avail`}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  backgroundColor:
                                    item.quantity > itemStock
                                      ? alpha('#DC2626', 0.1)
                                      : alpha('#16A34A', 0.1),
                                  color: item.quantity > itemStock ? '#DC2626' : '#16A34A',
                                }}
                              />
                            )}
                          </>
                        );
                      })()}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={item.remarks}
                      onChange={(e) => updateItem(idx, 'remarks', e.target.value)}
                      placeholder="Note..."
                      sx={{ width: 150 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Remove item">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeItem(idx)}
                        aria-label="Remove item"
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                          },
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyItemsState actionLabel="Add first item" onAction={() => addItem()} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1.5 }}>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => addItem()}
          >
            Add Item
          </Button>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => setQuickAddOpen(true)}
            sx={{ ml: 1 }}
          >
            Quick Add Item
          </Button>
        </Box>
      </ChallanFormSection>

      {/* Quick Add Item Dialog */}
      <EnterpriseDialog
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false);
          setQuickAddItemName('');
          setQuickAddItemCode('');
          setQuickAddUnit('');
        }}
        title="Quick Add Item"
        subtitle="Add a new item and insert it into the form"
        icon={<Inventory2 />}
        maxWidth="xs"
        actions={
          <>
            <Button
              onClick={() => {
                setQuickAddOpen(false);
                setQuickAddItemName('');
                setQuickAddItemCode('');
                setQuickAddUnit('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={!quickAddItemName || !quickAddItemCode}
              onClick={async () => {
                try {
                  const api = window.electronAPI;
                  let unitId = 0;
                  if (quickAddUnit.trim()) {
                    const existingUnit = units?.find((u: any) => u.name.toLowerCase() === quickAddUnit.trim().toLowerCase());
                    if (existingUnit) {
                      unitId = existingUnit.id;
                    } else {
                      const created: any = await api.createUnit({ name: quickAddUnit.trim() });
                      unitId = created.id;
                    }
                  }
                  if (!unitId) throw new Error('Unit is required');

                  const newItem = await api.createItemEnterprise({
                    itemName: quickAddItemName,
                    itemCode: quickAddItemCode,
                    unitId,
                    isActive: true,
                  });
                  if (newItem?.id) {
                    addItem();
                    const idx = items.length;
                    setTimeout(() => {
                      updateItem(idx, 'itemId', newItem.id);
                    }, 0);
                    toast.success(`Item "${quickAddItemName}" created`);
                    setQuickAddOpen(false);
                    setQuickAddItemName('');
                    setQuickAddItemCode('');
                    setQuickAddUnit('');
                  }
                } catch (err: any) {
                  toast.error(getErrorMessage(err, 'Failed to create item'));
                }
              }}
            >
              Add & Insert
            </Button>
          </>
        }
      >
        <Stack spacing={2}>
          <TextField
            label="Item Name"
            value={quickAddItemName}
            onChange={(e) => setQuickAddItemName(e.target.value)}
            fullWidth
            required
            size="small"
          />
          <TextField
            label="Item Code"
            value={quickAddItemCode}
            onChange={(e) => setQuickAddItemCode(e.target.value)}
            fullWidth
            required
            size="small"
          />
          <TextField
            label="Unit"
            value={quickAddUnit}
            onChange={(e) => setQuickAddUnit(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. Pcs, Kg, Box"
          />
        </Stack>
      </EnterpriseDialog>

      <ActionBar
        onCancel={handleBack}
        onSaveDraft={() => saveMutation.mutate('Draft')}
        onPost={() => setShowPostConfirm(true)}
        canSave={canSave}
        saving={saveMutation.isPending}
        postLabel="Post Transfer"
      />

      <PostConfirmationDialog
        open={showPostConfirm}
        title="Post Transfer Challan"
        summary={[
          { label: 'Challan Type', value: 'Store Transfer' },
          { label: 'Date', value: formData.date },
          { label: 'Items', value: `${items.length} item(s)` },
          { label: 'Transferred By', value: formData.transferredBy || '—' },
        ]}
        onConfirm={() => {
          setShowPostConfirm(false);
          saveMutation.mutate('Posted');
        }}
        onCancel={() => setShowPostConfirm(false)}
        loading={saveMutation.isPending}
      />

      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
        onSaveDraft={handleSaveDraft}
        hasDraftSupport={hasDraftSupport}
      />
        </>
      )}
    </Box>
  );
}
