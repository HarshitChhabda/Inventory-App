import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Grid, Chip, alpha, useTheme, Tooltip, Autocomplete, Alert,
  CircularProgress, Tab, Tabs,
} from '@mui/material';
import {
  Add, Delete, ArrowBack, LocalShipping, Search,
  LinkOff, Send, Save,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import DatePickerField from '../../../components/DatePickerField';
import { GuideButton } from '../../../components/GuideSystem';
import { todayISO } from '../../../utils/dateUtils';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
import toast from 'react-hot-toast';
import SuccessScreen from '../../../components/SuccessScreen';
import PostConfirmationDialog from '../../../components/PostConfirmationDialog';

interface IssueItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  unitName: string;
  unitId: number;
  quantity: number;
  maxAvailable: number;
  locationId: number | null;
  locationName: string;
  purpose: string;
  remarks: string;
  demandItemId?: number;
  demandItemName?: string;
  demandRequested?: number;
  demandIssued?: number;
  demandRemaining?: number;
}

const INITIAL_ITEM: IssueItem = {
  itemId: 0, itemName: '', itemCode: '', unitName: '', unitId: 0,
  quantity: 1, maxAvailable: 0, locationId: null, locationName: '',
  purpose: '', remarks: '',
};

export default function MaterialIssueForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [issueMode, setIssueMode] = useState<'general' | 'demand'>(0 as any);
  const [formData, setFormData] = useState({
    date: todayISO(),
    referenceNo: '',
    sourceStoreId: null as number | null,
    destinationStoreId: null as number | null,
    departmentId: 0,
    issuedBy: '',
    approvedBy: '',
    purpose: '',
    remarks: '',
  });

  const [items, setItems] = useState<IssueItem[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [selectedDemand, setSelectedDemand] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [savedResult, setSavedResult] = useState<{ id: number; status: string } | null>(null);

  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id, departmentType: 'Department', isActive: true }, orderBy: { name: 'asc' } }),
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

  const hasRoomLocations = !!destRoomLocations && destRoomLocations.length > 0;

  const { data: openDemands } = useQuery({
    queryKey: ['openDemands', company?.id],
    queryFn: () => window.electronAPI.getOpenDemands(company!.id, financialYear?.id),
    enabled: !!company?.id && issueMode === 'demand',
  });

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

  const availableStock = useMemo(() => stockBalances || {}, [stockBalances]);

  const destinationLocations = useMemo(() => {
    if (!allLocations || !formData.destinationStoreId) return [];
    const destName = selectedDestStore?.name || '';
    const storeLocs = allLocations.filter((l: any) =>
      l.storeId === formData.destinationStoreId && l.name !== destName
    );
    // Include any location referenced by items (e.g. from demand) that may belong to another store
    const itemLocIds = new Set(items.map((i) => i.locationId).filter(Boolean));
    const extraLocs = allLocations.filter((l: any) => itemLocIds.has(l.id) && !storeLocs.some((sl: any) => sl.id === l.id));
    return [...storeLocs, ...extraLocs];
  }, [allLocations, formData.destinationStoreId, selectedDestStore, items]);

  const showLocationColumn = destinationLocations.length > 0;

  const filteredItems = useMemo(() => allItems || [], [allItems]);

  const quickAddFiltered = useMemo(() => {
    const list = filteredItems.filter((i: any) => (availableStock[i.id] || 0) > 0 && !items.some((item) => item.itemId === i.id));
    if (!quickAddSearch) return list;
    const q = quickAddSearch.toLowerCase();
    return list.filter((i: any) => (i.itemName || '').toLowerCase().includes(q) || (i.itemCode || '').toLowerCase().includes(q));
  }, [filteredItems, items, quickAddSearch, availableStock]);

  const handleModeChange = useCallback((_: any, newVal: 'general' | 'demand') => {
    setIssueMode(newVal);
    setItems([]);
    setSelectedDemand(null);
    setFormData((p) => ({ ...p, destinationStoreId: null, departmentId: 0 }));
  }, []);

  const handleStoreChange = useCallback((storeId: number | null) => {
    setFormData((p) => ({ ...p, sourceStoreId: storeId }));
    setItems([]);
  }, []);

  const handleAddItem = useCallback((item: any) => {
    const stock = availableStock[item.id] || 0;
    if (stock <= 0) return;
    const newItem: IssueItem = {
      itemId: item.id,
      itemName: item.itemName,
      itemCode: item.itemCode || '',
      unitName: item.unit?.name || '',
      unitId: item.unit?.id || 0,
      quantity: 1,
      maxAvailable: stock,
      locationId: null,
      locationName: '',
      purpose: '',
      remarks: '',
    };
    setItems((prev) => [...prev, newItem]);
    setQuickAddOpen(false);
    setQuickAddSearch('');
  }, [availableStock]);

  const handleUpdateItem = useCallback((idx: number, field: keyof IssueItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const handleRemoveItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDemandSelect = useCallback(async (demand: any) => {
    setSelectedDemand(demand);
    console.log('[MaterialIssue] demand selected:', JSON.stringify(demand, null, 2));
    if (demand?.id) {
      try {
        const demandItems = await window.electronAPI.getDemandItems(demand.id);
        console.log('[MaterialIssue] demand items:', JSON.stringify(demandItems, null, 2));

        // Resolve destination store from dharmshala name
        let destStoreId = formData.destinationStoreId;
        if (demand.dharmshalaName) {
          const dharmStore = (stores || []).find((s: any) => s.name === demand.dharmshalaName);
          if (dharmStore) destStoreId = dharmStore.id;
        }

        // Get locations at destination store for name matching
        let destLocs: any[] = [];
        if (destStoreId && allLocations) {
          destLocs = allLocations.filter((l: any) => l.storeId === destStoreId);
        }

        const itemMap = new Map((allItems || []).map((it: any) => [it.id, it]));
        const newItems: IssueItem[] = (demandItems || [])
          .filter((di: any) => {
            const remaining = Math.max(0, Number(di.quantityRequested) - Number(di.quantityIssued) + Number(di.quantityReturned));
            return remaining > 0;
          })
          .map((di: any) => {
            const itemRecord = itemMap.get(di.itemId);
            const remaining = Math.max(0, Number(di.quantityRequested) - Number(di.quantityIssued) + Number(di.quantityReturned));
            const demandLocName = di.locationName || demand.locationName || '';
            const matchedLoc = demandLocName ? destLocs.find((l: any) => l.name === demandLocName) : null;
            return {
              itemId: di.itemId,
              itemName: di.itemName,
              itemCode: di.itemCode || '',
              unitName: di.unitName || (itemRecord as any)?.unit?.name || '',
              unitId: (itemRecord as any)?.unit?.id || 0,
              quantity: remaining,
              maxAvailable: stockBalances?.[di.itemId] || remaining,
              locationId: matchedLoc?.id || di.locationId || null,
              locationName: matchedLoc?.name || demandLocName || '',
              purpose: demand.workType || '',
              remarks: '',
              demandItemId: di.id,
              demandItemName: di.itemName,
              demandRequested: Number(di.quantityRequested),
              demandIssued: Number(di.quantityIssued),
              demandRemaining: remaining,
            };
          });
        setItems(newItems);

        setFormData((p) => ({
          ...p,
          sourceStoreId: demand.storeId || p.sourceStoreId,
          destinationStoreId: destStoreId || p.destinationStoreId,
          departmentId: demand.departmentId || p.departmentId,
          issuedBy: p.issuedBy || demand.requestingPerson || demand.responsiblePerson || '',
          approvedBy: p.approvedBy || demand.assignedToName || '',
          purpose: p.purpose || demand.workType || '',
          remarks: p.remarks || demand.issueDescription || '',
        }));
      } catch {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [allItems, stockBalances, stores, allLocations, formData.destinationStoreId]);

  const handleSave = useCallback(async () => {
    if (!company || !financialYear) return;
    setSaving(true);
    try {
      const challans = await window.electronAPI.dbQuery(
        'issueChallans', 'findMany',
        { where: { companyId: company.id, financialYearId: financialYear.id }, orderBy: { id: 'desc' }, take: 1 }
      );
      const lastNo = challans.length > 0
        ? parseInt((challans[0].voucherNo || '').replace('IC-', '')) + 1
        : 1;
      const challanNo = `IC-${String(lastNo).padStart(5, '0')}`;

      const payload: any = {
        date: formData.date, referenceNo: formData.referenceNo || null,
        sourceStoreId: formData.sourceStoreId, destinationStoreId: formData.destinationStoreId,
        departmentId: formData.departmentId || null,
        issuedBy: formData.issuedBy, approvedBy: formData.approvedBy,
        purpose: formData.purpose || (issueMode === 'demand' ? (selectedDemand?.workType || 'Demand Slip') : 'General Issue'),
        remarks: formData.remarks,
        companyId: company.id, financialYearId: financialYear.id,
        status: 'Posted', challanNo,
        demandData: issueMode === 'demand' && selectedDemand?.id ? {
          serviceRequestId: selectedDemand.id,
          demandAllocations: items.filter((i) => i.demandItemId).map((i) => ({
            demandItemId: i.demandItemId!, quantityAllocated: i.quantity,
          })),
        } : undefined,
      };

      const formattedItems = items.map((i) => ({
        itemId: i.itemId, unitId: i.unitId, quantity: i.quantity,
        condition: 'GOOD', locationId: i.locationId,
        usedAt: i.locationName, purpose: i.purpose, remarks: i.remarks,
      }));

      const saved = await window.electronAPI.saveIssueChallan(payload, formattedItems, false);
      await window.electronAPI.postIssueChallan(saved.id);
      toast.success('Issue challan posted successfully');
      setSavedResult({ id: saved.id, status: 'Posted' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(false);
  }, [company, financialYear, issueMode, formData, items, selectedDemand]);

  const canSave = useMemo(() => {
    if (!formData.sourceStoreId || !formData.issuedBy || items.length === 0) return false;
    if (items.some((i) => i.itemId <= 0 || i.quantity <= 0)) return false;
    if (items.some((i) => i.quantity > i.maxAvailable)) return false;
    if (!formData.destinationStoreId) return false;
    if (hasRoomLocations && items.some((i) => i.locationId == null)) return false;
    return true;
  }, [formData, items, hasRoomLocations]);

  if (savedResult) {
    return (
      <SuccessScreen
        title="Issue Challan Posted"
        subtitle="Stock balances have been updated successfully."
        entityCode="IC"
        entityName={`Issue Challan #${savedResult.id}`}
        onViewDetails={() => navigate(`/inventory/issue-challan/${savedResult.id}`)}
        onCreateNew={() => { setSavedResult(null); setItems([]); setSelectedDemand(null); setFormData((p) => ({ ...p, referenceNo: '', remarks: '' })); }}
        onBackToList={() => navigate('/inventory/movement')}
        showViewDetails
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title="Issue Material"
        subtitle="Issue material from store to department or against a demand"
        breadcrumbs={[
          { label: 'Material Operations', path: '/inventory/movement' },
          { label: 'Issue Material' },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <GuideButton pageId="issue-challan" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      {/* Mode Tabs */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#F8FAFC',
      }}>
        <Tabs
          value={issueMode}
          onChange={handleModeChange}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none' },
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab label="General Issue" value="general" />
          <Tab label="Demand Slip" value="demand" />
        </Tabs>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {issueMode === 'general'
            ? 'Issue material directly from store to a department or person.'
            : 'Issue material against an approved demand request.'}
        </Typography>
      </Box>

      {/* Basic Info */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF',
      }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <DatePickerField
              label="Date"
              value={formData.date}
              onChange={(val) => setFormData((p) => ({ ...p, date: val }))}
              fullWidth size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={(stores || []).filter((s: any) => s.storeType === 'MAIN_STORE' || s.storeType === 'DEPARTMENT_STORE')}
              getOptionLabel={(o: any) => o.name || ''}
              value={selectedStore || null}
              onChange={(_, v: any) => handleStoreChange(v?.id || null)}
              renderInput={(params) => <TextField {...params} label="Source Store" required placeholder="Select store..." />}
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
              renderInput={(params) => <TextField {...params} label="Issue To (Store)" required placeholder="Select store..." />}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Issued By"
              value={formData.issuedBy}
              onChange={(e) => setFormData((p) => ({ ...p, issuedBy: e.target.value }))}
              fullWidth required placeholder="Person name"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={departments || []}
              getOptionLabel={(o: any) => o.name || ''}
              value={departments?.find((d: any) => d.id === formData.departmentId) || null}
              onChange={(_, v: any) => setFormData((p) => ({ ...p, departmentId: v?.id || 0 }))}
              renderInput={(params) => <TextField {...params} label="Department (optional)" placeholder="Select..." />}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Approved By" value={formData.approvedBy}
              onChange={(e) => setFormData((p) => ({ ...p, approvedBy: e.target.value }))}
              fullWidth placeholder="Person name" />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Purpose" value={formData.purpose}
              onChange={(e) => setFormData((p) => ({ ...p, purpose: e.target.value }))}
              fullWidth placeholder="e.g. Room maintenance, Festival supplies..." size="small" />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Remarks" value={formData.remarks}
              onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
              fullWidth placeholder="Optional notes" size="small" />
          </Grid>
        </Grid>
      </Box>

      {/* Demand Slip Selection */}
      {issueMode === 'demand' && (
        <Box sx={{
          p: 2, mb: 2, borderRadius: '12px',
          border: `1px solid ${alpha('#7C3AED', 0.2)}`,
          backgroundColor: alpha('#7C3AED', 0.03),
        }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
            <LinkOff sx={{ fontSize: 18, color: '#7C3AED' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#7C3AED' }}>
              Select Approved Demand
            </Typography>
          </Stack>
          <Autocomplete
            size="small"
            options={openDemands || []}
            getOptionLabel={(o: any) => `${o.physicalDemandNo || o.requestNumber} — ${o.dharmshalaName || 'N/A'} (${o.demandItems?.length || 0} items)`}
            value={selectedDemand || null}
            onChange={(_, v: any) => handleDemandSelect(v)}
            renderInput={(params) => <TextField {...params} placeholder="Search approved demands..." />}
            fullWidth
          />
          {selectedDemand && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
              <Chip size="small" label={`Dept: ${selectedDemand.departmentName || 'N/A'}`} variant="outlined" />
              <Chip size="small" label={`Location: ${selectedDemand.locationName || 'N/A'}`} variant="outlined" />
              <Chip size="small" label={`Person: ${selectedDemand.responsiblePerson || 'N/A'}`} variant="outlined" />
              <Chip size="small" label={`Work: ${selectedDemand.workType || 'N/A'}`} variant="outlined" />
            </Stack>
          )}
        </Box>
      )}

      {/* Items Section */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF',
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Items {items.length > 0 && `(${items.length})`}
          </Typography>
          <Button startIcon={<Add />} size="small" onClick={() => setQuickAddOpen(true)} disabled={!formData.sourceStoreId}>
            Add Item
          </Button>
        </Stack>

        {!formData.sourceStoreId ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <LocalShipping sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">Select a source store first to see available items.</Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No items added. Click "Add Item" to begin.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ borderRadius: '10px', border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, '& .MuiTableCell-root': { fontSize: '0.8125rem' } }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 36, fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Item</TableCell>
                  <TableCell sx={{ width: 70, fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Unit</TableCell>
                  <TableCell sx={{ width: 100, fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Quantity</TableCell>
                  {hasRoomLocations && <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Location</TableCell>}
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Remarks</TableCell>
                  <TableCell sx={{ width: 40, bgcolor: alpha(theme.palette.primary.main, 0.03) }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Box sx={{ width: 22, height: 22, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(theme.palette.primary.main, 0.08), fontSize: '0.65rem', fontWeight: 700, color: 'primary.main' }}>
                        {idx + 1}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={500} fontSize="0.8125rem">{item.itemName}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.itemCode}</Typography>
                      {item.demandItemName && (
                        <Chip label="From Demand" size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem', bgcolor: alpha('#7C3AED', 0.1), color: '#7C3AED' }} />
                      )}
                    </TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <TextField size="small" type="number" value={item.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const adjusted = isIntegerOnlyUnit(item.unitName) ? Math.round(val) : val;
                            handleUpdateItem(idx, 'quantity', adjusted);
                          }}
                          inputProps={{ min: 0.01, step: isIntegerOnlyUnit(item.unitName) ? 1 : 0.01 }}
                          sx={{ width: 80 }}
                          error={item.quantity > item.maxAvailable || item.quantity <= 0} />
                        <Chip label={`${item.quantity}/${item.maxAvailable}`} size="small"
                          sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, backgroundColor: item.quantity > item.maxAvailable ? alpha('#DC2626', 0.1) : alpha('#16A34A', 0.1), color: item.quantity > item.maxAvailable ? '#DC2626' : '#16A34A' }} />
                      </Stack>
                    </TableCell>
                    {hasRoomLocations && (
                      <TableCell>
                        <Autocomplete
                          size="small"
                          options={destinationLocations}
                          getOptionLabel={(o: any) => o.name || ''}
                          value={destinationLocations.find((l: any) => l.id === item.locationId) || null}
                          onChange={(_, v: any) => {
                            handleUpdateItem(idx, 'locationId', v?.id || null);
                            handleUpdateItem(idx, 'locationName', v?.name || '');
                          }}
                          renderInput={(params) => <TextField {...params} placeholder="Select room..." />}
                          sx={{ minWidth: 160 }}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <TextField size="small" value={item.remarks}
                        onChange={(e) => handleUpdateItem(idx, 'remarks', e.target.value)}
                        placeholder="Note..." sx={{ width: 140 }} />
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

        {items.length > 0 && items.some((i) => i.quantity > i.maxAvailable) && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            Some items exceed available stock. Please reduce quantities.
          </Alert>
        )}
        {hasRoomLocations && items.length > 0 && items.some((i) => i.locationId == null) && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Location (Room) is required for all items when the destination store has rooms.
          </Alert>
        )}
      </Box>

      {/* Quick Add Dialog */}
      <EnterpriseDialog
        open={quickAddOpen}
        onClose={() => { setQuickAddOpen(false); setQuickAddSearch(''); }}
        title="Add Item"
        subtitle="Search and select from available stock"
        icon={<Search />}
        maxWidth="sm"
      >
        <TextField
          fullWidth size="small" placeholder="Search by name or code..."
          value={quickAddSearch} onChange={(e) => setQuickAddSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ mb: 2 }}
        />
        <Stack spacing={0.5} sx={{ maxHeight: 300, overflow: 'auto' }}>
          {quickAddFiltered.map((item: any) => {
            const bal = availableStock[item.id] || 0;
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
        <Button
          variant="outlined"
          onClick={() => navigate('/inventory/movement')}
          disabled={saving}
          sx={{ fontWeight: 500, borderRadius: '10px', textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Send />}
          onClick={() => setShowPostConfirm(true)}
          disabled={!canSave || saving}
          sx={{ fontWeight: 600, borderRadius: '10px', textTransform: 'none', px: 3 }}
        >
          {saving ? 'Processing...' : 'Confirm & Post'}
        </Button>
      </Box>

      {/* Confirmation Dialog */}
      <PostConfirmationDialog
        open={showPostConfirm}
        title="Confirm Issue"
        summary={[
          { label: 'Mode', value: issueMode === 'general' ? 'General Issue' : 'Demand Slip' },
          { label: 'From Store', value: selectedStore?.name || '---' },
          { label: 'To Store', value: selectedDestStore?.name || '---' },
          { label: 'Items', value: `${items.length} item(s)` },
          { label: 'Issued By', value: formData.issuedBy || '---' },
        ]}
        onConfirm={() => { setShowPostConfirm(false); handleSave(); }}
        onCancel={() => setShowPostConfirm(false)}
        loading={saving}
        confirmLabel="Post Issue"
      />
    </Box>
  );
}
