import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Autocomplete,
  Grid, Chip, alpha, useTheme, Tooltip,
} from '@mui/material';
import { Add, Delete, ArrowBack, LocalShipping, Inventory2, Search, LinkOff } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import DatePickerField from '../../../components/DatePickerField';
import { todayISO } from '../../../utils/dateUtils';
import { toNumber } from '../../../utils/numberUtils';
import { IssueChallanFormData, IssueChallanItem } from '../types';
import { useChallanForm } from '../hooks/useChallanForm';
import { useChallanSave } from '../hooks/useChallanSave';
import ChallanFormSection from '../components/ChallanFormSection';
import ActionBar from '../components/ActionBar';
import EmptyItemsState from '../components/EmptyItemsState';
import SuccessScreen from '../../../components/SuccessScreen';
import PostConfirmationDialog from '../../../components/PostConfirmationDialog';
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesDialog from '../../../components/UnsavedChangesDialog';

const INITIAL_ITEM: IssueChallanItem = { itemId: 0, unitId: 0, quantity: 1, locationId: null, usedAt: '', purpose: '', remarks: '' };

export default function IssueChallanForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const { id } = useParams();
  const theme = useTheme();
  const isEdit = id && id !== 'new';

  // Guard against stale async responses when switching between records
  const editRequestIdRef = useRef(0);

  const [formData, setFormData] = useState<IssueChallanFormData>({
    date: todayISO(),
    referenceNo: '',
    sourceStoreId: null,
    destinationStoreId: null,
    departmentId: 0,
    issuedBy: '',
    approvedBy: '',
    purpose: '',
    remarks: '',
    items: [],
  });

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [selectedDemand, setSelectedDemand] = useState<any>(null);
  const [demandItems, setDemandItems] = useState<any[]>([]);
  const [linkedServiceRequestId, setLinkedServiceRequestId] = useState<number | null>(null);

  const {
    items, setItems, recentItemIds, addItem, updateItem,
    removeItem, trackRecentItem, isItemTracked,
  } = useChallanForm<IssueChallanItem>({
    storageKey: 'recentIssueItems',
    initialItem: () => ({ ...INITIAL_ITEM }),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: allItems } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true, category: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: allLocations } = useQuery({
    queryKey: ['locations', formData.destinationStoreId],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', {
      where: { isActive: true, ...(formData.destinationStoreId ? { storeId: formData.destinationStoreId } : {}) },
      orderBy: { name: 'asc' },
    }),
  });

  const { data: destRoomLocations } = useQuery({
    queryKey: ['roomLocations', formData.destinationStoreId],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', {
      where: { isActive: true, storeId: formData.destinationStoreId, locationType: 'Room' },
      select: { id: true },
    }),
    enabled: !!formData.destinationStoreId,
  });

  const { data: openDemands } = useQuery({
    queryKey: ['openDemands', company?.id],
    queryFn: () => window.electronAPI.getOpenDemands(company!.id, financialYear?.id),
    enabled: !!company?.id,
  });

  useEffect(() => {
    if (selectedDemand?.id) {
      window.electronAPI.getDemandItems(selectedDemand.id).then((items: any[]) => {
        setDemandItems(items || []);
      });
    } else {
      setDemandItems([]);
    }
  }, [selectedDemand?.id]);

  const { data: stockBalances } = useQuery({
    queryKey: ['stockBalance', 'issue', company?.id, financialYear?.id, formData.sourceStoreId],
    queryFn: async () => {
      if (!formData.sourceStoreId) return {};
      const stockData = await window.electronAPI.getStoreStock(company!.id, financialYear!.id, formData.sourceStoreId);
      const bal: Record<number, number> = {};
      if (Array.isArray(stockData)) {
        stockData.forEach((s: any) => { if (s.itemId) bal[s.itemId] = Number(s.available || 0); });
      }
      return bal;
    },
    enabled: !!company?.id && !!financialYear?.id && !!formData.sourceStoreId,
    refetchOnMount: true,
  });

  const selectedStore = useMemo(() => stores?.find((s: any) => s.id === formData.sourceStoreId), [stores, formData.sourceStoreId]);
  const selectedDestStore = useMemo(() => stores?.find((s: any) => s.id === formData.destinationStoreId), [stores, formData.destinationStoreId]);
  const selectedDept = useMemo(() => departments?.find((d: any) => d.id === formData.departmentId), [departments, formData.departmentId]);
  const hasRoomLocations = !!destRoomLocations && destRoomLocations.length > 0;
  const showLocationColumn = hasRoomLocations;

  const destinationLocations = useMemo(() => {
    if (!allLocations || !formData.destinationStoreId) return [];
    return allLocations.filter((l: any) => l.storeId === formData.destinationStoreId);
  }, [allLocations, formData.destinationStoreId]);

  const filteredItems = useMemo(() => allItems || [], [allItems]);

  const totalQtyPerItem = useMemo(() => {
    const map: Record<number, number> = {};
    items.forEach((i) => {
      if (i.itemId > 0) map[i.itemId] = (map[i.itemId] || 0) + i.quantity;
    });
    return map;
  }, [items]);

  const allItemsForEdit = useMemo(() => {
    if (!isEdit || !allItems) return filteredItems;
    const existingItemIds = new Set(items.map((i) => i.itemId));
    const existingItems = allItems.filter((i: any) => existingItemIds.has(i.id));
    const merged = new Map<number, any>();
    for (const item of [...existingItems, ...filteredItems]) merged.set(item.id, item);
    return Array.from(merged.values());
  }, [isEdit, allItems, filteredItems, items]);

  const quickAddFiltered = useMemo(() => {
    const list = stockBalances !== undefined
      ? filteredItems.filter((i: any) => (stockBalances?.[i.id] || 0) > 0 && !isItemTracked(i.id))
      : filteredItems.filter((i: any) => !isItemTracked(i.id));
    if (!quickAddSearch) return list;
    const q = quickAddSearch.toLowerCase();
    return list.filter((i: any) => (i.itemName || '').toLowerCase().includes(q) || (i.itemCode || '').toLowerCase().includes(q));
  }, [filteredItems, stockBalances, quickAddSearch, isItemTracked]);

  const { saveMutation, savedResult, clearSavedResult } = useChallanSave({
    challanType: 'IC',
    listKey: 'issueChallans',
    entityName: 'issue challan',
    editPath: '/inventory/issue-challan',
    isEdit: !!isEdit,
    editId: id,
    saveFn: (payload, formattedItems, isEditFn, editIdNum) =>
      window.electronAPI.saveIssueChallan(payload, formattedItems, isEditFn, editIdNum),
    postFn: (challanId) => window.electronAPI.postIssueChallan(challanId),
    buildPayload: () => ({
      payload: {
        date: formData.date, referenceNo: formData.referenceNo || null,
        destinationStoreId: formData.destinationStoreId, departmentId: formData.departmentId || null,
        sourceStoreId: formData.sourceStoreId,
        issuedBy: formData.issuedBy, approvedBy: formData.approvedBy,
        purpose: formData.purpose, remarks: formData.remarks,
        companyId: company!.id, financialYearId: financialYear!.id, status: 'Draft' as const,
        demandData: (() => {
          const allocItems = items.filter(i => i.itemId > 0 && i.demandItemId);
          if (allocItems.length === 0) return undefined;
          const srId = selectedDemand?.id || linkedServiceRequestId;
          if (!srId) return undefined;
          return {
            serviceRequestId: srId,
            demandAllocations: allocItems.map(i => ({
              demandItemId: i.demandItemId!,
              quantityAllocated: i.quantity,
            })),
          };
        })(),
      },
      items: items.map((i) => ({
        itemId: i.itemId, unitId: i.unitId, quantity: i.quantity, condition: (i as any).condition || 'GOOD',
        locationId: i.locationId, usedAt: i.usedAt, purpose: i.purpose, remarks: i.remarks, serialNumber: i.serialNumber || null,
      })),
    }),
  });

  const initialFormDataRef = useRef<IssueChallanFormData>({
    date: todayISO(),
    referenceNo: '',
    sourceStoreId: null,
    destinationStoreId: null,
    departmentId: 0,
    issuedBy: '',
    approvedBy: '',
    purpose: '',
    remarks: '',
    items: [],
  });
  const initialItemsRef = useRef<IssueChallanItem[]>([]);
  const editLoadedRef = useRef(!isEdit);

  useEffect(() => {
    if (isEdit) {
      const requestId = ++editRequestIdRef.current;
      Promise.all([
        window.electronAPI.dbQuery('issueChallan', 'findUnique', {
          where: { id: Number(id) },
          include: { items: { include: { item: { include: { unit: true, category: true } } } } },
        }),
        window.electronAPI.getDemandAllocationsByTransaction(Number(id)),
      ]).then(([ic, allocs]: any[]) => {
        if (requestId !== editRequestIdRef.current) return;
        if (ic) {
          const loadedFormData: IssueChallanFormData = {
            date: ic.date.split('T')[0],
            referenceNo: ic.referenceNo || '',
            sourceStoreId: ic.sourceStoreId || null,
            destinationStoreId: ic.toStoreId || null,
            departmentId: ic.departmentId || 0,
            issuedBy: ic.issuedBy,
            approvedBy: ic.approvedBy || '',
            purpose: ic.purpose || '',
            remarks: ic.remarks || '',
            items: [],
          };
          const allocMap = new Map<number, any>();
          let firstServiceRequestId: number | null = null;
          if (Array.isArray(allocs)) {
            allocs.forEach((a: any) => {
              if (a.materialDemandItemId) allocMap.set(a.materialDemandItemId, a);
              if (!firstServiceRequestId && a.materialDemandItem?.serviceRequestId) {
                firstServiceRequestId = a.materialDemandItem.serviceRequestId;
              }
            });
          }
          const loadedItems: IssueChallanItem[] = ic.items.map((i: any) => {
            const alloc = allocMap.get(i.id) || null;
            const demandItem = alloc?.materialDemandItem || null;
            const demandRemaining = demandItem
              ? Math.max(0, Number(demandItem.quantityRequested) - Number(demandItem.quantityIssued) + Number(demandItem.quantityReturned))
              : undefined;
            return {
              itemId: i.itemId, unitId: i.unitId, quantity: toNumber(i.quantity),
              locationId: i.locationId, usedAt: i.usedAt || i.location?.name || '',
              purpose: i.purpose || '', remarks: i.remarks || '',
              demandItemId: demandItem?.id || undefined,
              demandItemName: demandItem?.itemName || undefined,
              demandRequested: demandItem ? Number(demandItem.quantityRequested) : undefined,
              demandIssued: demandItem ? Number(demandItem.quantityIssued) : undefined,
              demandRemaining,
            };
          });
          initialFormDataRef.current = loadedFormData;
          initialItemsRef.current = loadedItems;
          setFormData(loadedFormData);
          setItems(loadedItems);
          setLinkedServiceRequestId(firstServiceRequestId);
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
      navigate('/inventory/issue-challan');
    }
  }, [isDirty, setShowDialog, navigate]);

  const handleCreateNew = useCallback(() => {
    clearSavedResult();
    navigate('/inventory/issue-challan/new');
  }, [clearSavedResult, navigate]);

  const handleBackToList = useCallback(() => {
    clearSavedResult();
    navigate('/inventory/issue-challan');
  }, [clearSavedResult, navigate]);

  const canSave = formData.sourceStoreId && formData.destinationStoreId && formData.sourceStoreId !== formData.destinationStoreId && formData.issuedBy && items.length > 0
    && items.every((i) => i.itemId > 0 && i.unitId > 0 && i.quantity > 0)
    && Object.entries(totalQtyPerItem).every(([itemId, totalQty]) => totalQty <= (stockBalances?.[Number(itemId)] || 0))
    && (!hasRoomLocations || items.every((i) => i.locationId != null))
    && items.every((i) => !i.demandItemId || i.quantity <= (i.demandRemaining || Infinity));

  return (
    <Box>
      {savedResult ? (
        <SuccessScreen
          title={savedResult.status === 'Posted' ? 'Challan Posted Successfully' : 'Draft Saved Successfully'}
          subtitle={savedResult.status === 'Posted'
            ? 'Stock balances have been updated. The challan is now posted and cannot be edited.'
            : 'Your challan has been saved as a draft. You can edit and post it later.'}
          entityCode="IC"
          entityName={`Issue Challan ${savedResult.id ? `#${savedResult.id}` : ''}`}
          onViewDetails={() => navigate(`/inventory/issue-challan/${savedResult.id}`)}
          onCreateNew={handleCreateNew}
          onBackToList={handleBackToList}
        />
      ) : (
        <>
          <PageHeader
        title={isEdit ? 'Edit Store Issue' : 'New Store Issue'}
        subtitle="Issue material from one store to another store or location"
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/issue-challan' },
          { label: 'Store Issue', path: '/inventory/issue-challan' },
          { label: isEdit ? 'Edit' : 'New Issue' },
        ]}
        actions={
          <Tooltip title="Back">
            <IconButton onClick={handleBack} aria-label="Back" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <ArrowBack fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      <ChallanFormSection icon={LocalShipping} title="Challan Details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <DatePickerField label="Issue Date" value={formData.date} onChange={(val) => setFormData((p) => ({ ...p, date: val }))} fullWidth size="small" />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Reference No." value={formData.referenceNo}
              onChange={(e) => setFormData((p) => ({ ...p, referenceNo: e.target.value }))}
              fullWidth placeholder="e.g. INV-001, Bill-123..." />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={(stores || []).filter((s: any) => s.storeType === 'MAIN_STORE' || s.storeType === 'DEPARTMENT_STORE')}
              getOptionLabel={(o: any) => o.name || ''}
              value={selectedStore || null}
              onChange={(_, v: any) => setFormData((p) => ({ ...p, sourceStoreId: v?.id || null }))}
              renderInput={(params) => <TextField {...params} label="Source Store" required placeholder="Search store..." />}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={(stores || []).filter((s: any) => s.id !== formData.sourceStoreId && (s.storeType === 'DHARMSHALA_STORE' || s.storeType === 'DEPARTMENT_STORE'))}
              getOptionLabel={(o: any) => o.name || ''}
              value={selectedDestStore || null}
              onChange={(_, v: any) => setFormData((p) => ({ ...p, destinationStoreId: v?.id || null }))}
              renderInput={(params) => <TextField {...params} label="Destination Store" required placeholder="Search store..." />}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={departments || []}
              getOptionLabel={(o: any) => o.name || ''}
              value={selectedDept || null}
              onChange={(_, v: any) => setFormData((p) => ({ ...p, departmentId: v?.id || 0 }))}
              renderInput={(params) => <TextField {...params} label="Department (optional)" placeholder="Search department..." />}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Issued By" value={formData.issuedBy}
              onChange={(e) => setFormData((p) => ({ ...p, issuedBy: e.target.value }))} fullWidth required />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Approved By" value={formData.approvedBy}
              onChange={(e) => setFormData((p) => ({ ...p, approvedBy: e.target.value }))} fullWidth />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Purpose" value={formData.purpose}
              onChange={(e) => setFormData((p) => ({ ...p, purpose: e.target.value }))}
              fullWidth placeholder="e.g. Room maintenance, Festival supplies..." />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Remarks" value={formData.remarks}
              onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))} fullWidth />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
          {selectedStore && (
            <Chip label={`${selectedStore.name} - ${filteredItems.length} items available`} size="small" color="info" variant="outlined" />
          )}
          {selectedDestStore && (
            <Chip label={`To: ${selectedDestStore.name}`} size="small" color="success" variant="outlined" />
          )}
          {formData.destinationStoreId && hasRoomLocations && (
            <Chip label={`${destRoomLocations.length} rooms at destination`} size="small" color="warning" variant="outlined" />
          )}
        </Stack>
      </ChallanFormSection>

      <ChallanFormSection icon={LinkOff} title="Demand Reference (Optional)">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              size="small"
              options={openDemands || []}
              getOptionLabel={(o: any) => `${o.physicalDemandNo || `DEM-${o.requestNumber}`} — ${o.asset?.assetName || 'N/A'} (${o.demandItems?.length || 0} items)`}
              value={selectedDemand || null}
              onChange={(_, v: any) => {
                setSelectedDemand(v);
                if (v) {
                  const itemMap = new Map((allItems || []).map((it: any) => [it.id, it]));
                  const destId = formData.destinationStoreId ||
                    ((stores || []).find((s: any) => s.storeType === 'DHARMSHALA_STORE' && s.name === v.dharmshalaName)?.id || null);
                  const destLocs = (allLocations || []).filter((l: any) => l.storeId === destId);
                  const newItems = (v.demandItems || []).map((di: any) => {
                    const itemRecord = itemMap.get(di.itemId);
                    const demandLocName = di.locationName || v.locationName || '';
                    const matchedLoc = demandLocName ? destLocs.find((l: any) => l.name === demandLocName) : null;
                    return {
                      itemId: di.itemId,
                      unitId: (itemRecord as any)?.unitId || (itemRecord as any)?.unit?.id || 0,
                      quantity: Math.max(0, Number(di.quantityRequested) - Number(di.quantityIssued) + Number(di.quantityReturned)),
                      locationId: matchedLoc?.id || null,
                      usedAt: matchedLoc?.name || demandLocName || '',
                      purpose: v.workType || '',
                      remarks: '',
                      demandItemId: di.id,
                      demandItemName: di.itemName,
                      demandRequested: Number(di.quantityRequested),
                      demandIssued: Number(di.quantityIssued),
                      demandRemaining: Math.max(0, Number(di.quantityRequested) - Number(di.quantityIssued) + Number(di.quantityReturned)),
                      serialNumber: di.serialNumber || '',
                    };
                  });
                  setItems(newItems);
                  setFormData((p) => ({
                    ...p,
                    sourceStoreId: v.storeId || p.sourceStoreId,
                    destinationStoreId: destId,
                    departmentId: v.departmentId || p.departmentId,
                    issuedBy: p.issuedBy || v.requestingPerson || v.responsiblePerson || '',
                    purpose: p.purpose || v.workType || '',
                    remarks: p.remarks || v.issueDescription || '',
                  }));
                } else {
                  setItems([]);
                }
              }}
              renderInput={(params) => <TextField {...params} label="Select Demand (Optional)" placeholder="Search demands..." />}
              fullWidth
            />
          </Grid>
          {selectedDemand && (
            <>
              <Grid item xs={12} md={3}>
                <TextField size="small" label="Location" value={selectedDemand.locationName || selectedDemand.asset?.locationName || '—'} disabled fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField size="small" label="Dharmshala" value={selectedDemand.dharmshalaName || '—'} disabled fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField size="small" label="Department" value={selectedDemand.departmentName || '—'} disabled fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField size="small" label="Responsible Person" value={selectedDemand.responsiblePerson || '—'} disabled fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField size="small" label="Work Type" value={selectedDemand.workType || '—'} disabled fullWidth />
              </Grid>
            </>
          )}
        </Grid>
        {selectedDemand && demandItems.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Demand Items</Typography>
            <TableContainer sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Requested</TableCell>
                    <TableCell align="right">Already Issued</TableCell>
                    <TableCell align="right">Remaining</TableCell>
                    <TableCell align="right">Issue Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {demandItems.map((di: any) => {
                    const remaining = Math.max(0, Number(di.quantityRequested) - Number(di.quantityIssued) + Number(di.quantityReturned));
                    return (
                      <TableRow key={di.id}>
                        <TableCell>{di.itemName} {di.itemCode ? `(${di.itemCode})` : ''}</TableCell>
                        <TableCell align="right">{Number(di.quantityRequested)}</TableCell>
                        <TableCell align="right">{Number(di.quantityIssued)}</TableCell>
                        <TableCell align="right">
                          <Chip label={remaining} size="small" color={remaining > 0 ? 'warning' : 'success'} sx={{ height: 20, fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell align="right">{remaining > 0 ? 'Ready to issue' : 'Completed'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </ChallanFormSection>

      <ChallanFormSection icon={Inventory2} title="Items" count={items.length}>
        {recentItemIds.length > 0 && formData.sourceStoreId && (
          <Stack direction="row" spacing={0.5} mb={1.5} useFlexGap flexWrap="wrap" alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5, fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent:
            </Typography>
            {recentItemIds.slice(0, 5).map((rid) => {
              const ri = filteredItems.find((i: any) => i.id === rid) || allItems?.find((i: any) => i.id === rid);
              if (!ri) return null;
              const bal = stockBalances?.[rid] || 0;
              if (bal <= 0) return null;
              return (
                <Chip key={rid} label={`${ri.itemCode || ri.itemName} (${bal})`} size="small"
                  onClick={() => { if (!isItemTracked(rid)) addItem(); }}
                  disabled={isItemTracked(rid)}
                  sx={{
                    fontSize: '0.6875rem',
                    height: 24,
                    borderRadius: '6px',
                    fontWeight: 500,
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                    '&.Mui-disabled': { opacity: 0.5 },
                  }} />
              );
            })}
          </Stack>
        )}

        {!formData.sourceStoreId ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <LocalShipping sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">Please select a Source Store first to see available items.</Typography>
          </Box>
        ) : (
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
                  <TableCell sx={{ width: 80, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Unit</TableCell>
                  <TableCell sx={{ width: 100, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Quantity</TableCell>
                  {showLocationColumn && <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Location</TableCell>}
                  <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Purpose</TableCell>
                  <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Remarks</TableCell>
                  <TableCell sx={{ width: 50, bgcolor: alpha(theme.palette.primary.main, 0.03) }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => {
                  const selectedItem = allItemsForEdit.find((i: any) => i.id === item.itemId)
                    || allItems?.find((i: any) => i.id === item.itemId);
                  return (
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
                        <Autocomplete size="small"
                          options={stockBalances !== undefined ? allItemsForEdit.filter((o: any) => (stockBalances?.[o.id] || 0) > 0) : allItemsForEdit}
                          getOptionLabel={(o: any) => `${o.itemCode || ''} - ${o.itemName}`}
                          value={selectedItem || null}
                          onChange={(_, v: any) => {
                            updateItem(idx, 'itemId', v?.id || 0);
                            if (v?.unit?.id) updateItem(idx, 'unitId', v.unit.id);
                            if (v?.id) trackRecentItem(v.id);
                          }}
                          renderOption={(props, option: any) => {
                            const bal = stockBalances?.[option.id] || 0;
                            return (
                              <li {...props} key={option.id}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                  <span>{option.itemCode || ''} - {option.itemName}</span>
                                  <Chip label={`${bal} ${option.unit?.name || ''}`} size="small"
                                    sx={{ height: 20, fontSize: '0.65rem', ml: 1, backgroundColor: alpha('#16A34A', 0.1), color: '#16A34A' }} />
                                </Box>
                              </li>
                            );
                          }}
                          renderInput={(params) => <TextField {...params} placeholder="Search & select item..." />}
                          sx={{ minWidth: 260 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: '0.8125rem' }}>
                          {selectedItem?.unit?.name || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <TextField size="small" type="number" value={item.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const adjusted = isIntegerOnlyUnit(selectedItem?.unit?.name) ? Math.round(val) : val;
                              updateItem(idx, 'quantity', adjusted);
                            }}
                            inputProps={{ min: 0.01, step: isIntegerOnlyUnit(selectedItem?.unit?.name) ? 1 : 0.01 }}
                            sx={{ width: 90 }}
                            error={item.itemId > 0 && (
                              (totalQtyPerItem[item.itemId] || 0) > (stockBalances?.[item.itemId] || 0) ||
                              (!!item.demandRemaining && item.quantity > item.demandRemaining)
                            )} />
                          {item.itemId > 0 && !!item.demandRemaining && item.demandRemaining > 0 && (
                            <Chip label={`Max: ${item.demandRemaining}`} size="small"
                              sx={{
                                height: 20, fontSize: '0.6rem', fontWeight: 600,
                                backgroundColor: item.demandRemaining && item.quantity > item.demandRemaining ? alpha('#DC2626', 0.1) : alpha('#2563EB', 0.1),
                                color: item.demandRemaining && item.quantity > item.demandRemaining ? '#DC2626' : '#2563EB',
                              }} />
                          )}
                          {item.itemId > 0 && !item.demandRemaining && (
                            <Chip label={`${totalQtyPerItem[item.itemId] || 0} / ${stockBalances?.[item.itemId] || 0}`} size="small"
                              sx={{
                                height: 20, fontSize: '0.6rem', fontWeight: 600,
                                backgroundColor: (totalQtyPerItem[item.itemId] || 0) > (stockBalances?.[item.itemId] || 0) ? alpha('#DC2626', 0.1) : alpha('#16A34A', 0.1),
                                color: (totalQtyPerItem[item.itemId] || 0) > (stockBalances?.[item.itemId] || 0) ? '#DC2626' : '#16A34A',
                              }} />
                          )}
                        </Stack>
                      </TableCell>
                      {showLocationColumn && (
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={destinationLocations}
                            getOptionLabel={(o: any) => o.name || ''}
                            value={destinationLocations.find((l: any) => l.id === item.locationId) || null}
                            onChange={(_, v: any) => {
                              updateItem(idx, 'locationId', v?.id || null);
                              updateItem(idx, 'usedAt', v?.name || '');
                            }}
                            renderInput={(params) => <TextField {...params} placeholder="Select location..." />}
                            sx={{ minWidth: 180 }}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <TextField size="small" value={item.purpose}
                          onChange={(e) => updateItem(idx, 'purpose', e.target.value)}
                          placeholder="Use for..." sx={{ width: 150 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={item.remarks}
                          onChange={(e) => updateItem(idx, 'remarks', e.target.value)}
                          placeholder="Note..." sx={{ width: 150 }} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Remove item">
                          <IconButton size="small" color="error" onClick={() => removeItem(idx)}
                            aria-label="Remove item"
                            sx={{ '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showLocationColumn ? 8 : 7}>
                      <EmptyItemsState actionLabel="Add first item" onAction={() => addItem()} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {items.length > 0 && items.some((i) => i.itemId > 0 && (i.quantity <= 0 || i.quantity > (stockBalances?.[i.itemId] || 0))) && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: alpha('#DC2626', 0.06), border: '1px solid', borderColor: alpha('#DC2626', 0.2) }}>
            <Stack spacing={0.5}>
              {items.filter((i) => i.itemId > 0 && i.quantity <= 0).map((i) => {
                const item = allItems?.find((it: any) => it.id === i.itemId);
                return <Typography key={i.itemId} variant="caption" color="error.main" fontWeight={500}>"{item?.itemName}" - Quantity must be greater than 0</Typography>;
              })}
              {items.filter((i) => i.itemId > 0 && i.quantity > (stockBalances?.[i.itemId] || 0)).map((i) => {
                const item = allItems?.find((it: any) => it.id === i.itemId);
                const bal = stockBalances?.[i.itemId] || 0;
                return <Typography key={i.itemId} variant="caption" color="error.main" fontWeight={500}>"{item?.itemName}" - Requested {i.quantity} but only {bal} available in stock</Typography>;
              })}
            </Stack>
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button startIcon={<Add />} size="small" onClick={() => addItem()}>
            Add Item
          </Button>
          {formData.sourceStoreId && (
            <Button startIcon={<Search />} size="small" variant="outlined" onClick={() => setQuickAddOpen(true)}>
              Quick Add
            </Button>
          )}
        </Stack>
      </ChallanFormSection>

      <EnterpriseDialog
        open={quickAddOpen}
        onClose={() => { setQuickAddOpen(false); setQuickAddSearch(''); }}
        title="Quick Add Item"
        subtitle="Search and add items from stock"
        icon={<Search />}
        maxWidth="sm"
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Search items by name or code..."
          value={quickAddSearch}
          onChange={(e) => setQuickAddSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ mb: 2 }}
        />
        <Stack spacing={0.5} sx={{ maxHeight: 300, overflow: 'auto' }}>
          {quickAddFiltered.map((item: any) => {
            const bal = stockBalances?.[item.id] || 0;
            return (
              <Box
                key={item.id}
                onClick={() => {
                  addItem();
                  const idx = items.length;
                  setTimeout(() => {
                    updateItem(idx, 'itemId', item.id);
                    if (item.unit?.id) updateItem(idx, 'unitId', item.unit.id);
                    trackRecentItem(item.id);
                  }, 0);
                }}
                sx={{
                  p: 1, borderRadius: 1, cursor: 'pointer',
                  border: '1px solid', borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                }}
              >
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

      <ActionBar
        onCancel={handleBack}
        onSaveDraft={() => saveMutation.mutate('Draft')}
        onPost={() => setShowPostConfirm(true)}
        canSave={!!canSave}
        saving={saveMutation.isPending}
      />

      <PostConfirmationDialog
        open={showPostConfirm}
        title="Post Issue Challan"
        summary={[
          { label: 'Challan Type', value: 'Store Issue' },
          { label: 'Date', value: formData.date },
          { label: 'Items', value: `${items.length} item(s)` },
          { label: 'Issued By', value: formData.issuedBy || '—' },
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
