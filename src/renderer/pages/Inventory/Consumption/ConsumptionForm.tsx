import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Grid, Chip, alpha, useTheme, Tooltip, Autocomplete, Alert, MenuItem,
} from '@mui/material';
import { Add, Delete, ArrowBack, LocalShipping, Search } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import { GuideButton } from '../../../components/GuideSystem';
import { todayISO } from '../../../utils/dateUtils';
import { toast } from 'react-hot-toast';

interface ConsumptionItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  unitName: string;
  quantityUsed: number;
  maxAvailable: number;
  remarks: string;
  materialDemandItemId?: number;
  transactionHeaderId?: number;
}

export default function ConsumptionForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();
  const { getPreference, setPreference, getRecentValues, addRecentValue } = useUserPreferences({ prefix: 'consumption.' });

  const [formData, setFormData] = useState({
    date: todayISO(),
    storeId: 0,
    storeName: '',
    locationId: 0,
    locationName: '',
    departmentId: 0,
    departmentName: '',
    dharmshalaName: '',
    usedBy: '',
    remarks: '',
    serviceRequestId: 0,
    serviceRequestNumber: '',
  });

  const [items, setItems] = useState<ConsumptionItem[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkedDemandItems, setLinkedDemandItems] = useState<any[]>([]);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [savedStoreId, savedDeptId, savedDharmshala, savedUsedBy, recentUB] = await Promise.all([
          getPreference('lastStoreId'),
          getPreference('lastDepartmentId'),
          getPreference('lastDharmshala'),
          getPreference('lastUsedBy'),
          getRecentValues('usedBy'),
        ]);
        setRecentUsedBy(recentUB);
        if (savedStoreId || savedDeptId || savedUsedBy) {
          setFormData((prev) => ({
            ...prev,
            storeId: savedStoreId ? Number(savedStoreId) : prev.storeId,
            departmentId: savedDeptId ? Number(savedDeptId) : prev.departmentId,
            dharmshalaName: savedDharmshala || prev.dharmshalaName,
            usedBy: savedUsedBy || prev.usedBy,
          }));
        }
      } catch {}
    };
    loadPrefs();
  }, []);
  const [recentUsedBy, setRecentUsedBy] = useState<string[]>([]);

  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id, departmentType: 'Department', isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', formData.storeId],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', {
      where: { isActive: true, ...(formData.storeId ? { storeId: formData.storeId } : {}) },
      orderBy: { name: 'asc' },
    }),
  });

  const filteredLocations = useMemo(() => {
    if (!locations || !formData.storeId) return locations || [];
    const selectedStore = (stores || []).find((s: any) => s.id === formData.storeId);
    if (!selectedStore) return locations;
    return (locations as any[]).filter((l: any) => !(l.parentId === null && l.name === selectedStore.name));
  }, [locations, formData.storeId, stores]);

  const { data: locationStock, refetch: refetchStock } = useQuery({
    queryKey: ['locationConsumptionStock', formData.storeId, formData.locationId],
    queryFn: () => window.electronAPI.getLocationConsumptionStock(formData.storeId, formData.locationId || undefined),
    enabled: !!formData.storeId,
  });

  const { data: openDemands } = useQuery({
    queryKey: ['openDemands', company?.id, 'CONSUMPTION'],
    queryFn: () => window.electronAPI.getOpenDemands(company!.id, financialYear?.id, 'CONSUMPTION'),
    enabled: !!company?.id,
  });

  const dharmshalas = useMemo(() =>
    (stores || []).filter((s: any) => s.storeType === 'DHARMSHALA_STORE'),
    [stores]
  );

  const selectedStore = useMemo(() =>
    (stores || []).find((s: any) => s.id === formData.storeId),
    [stores, formData.storeId]
  );

  const quickAddFiltered = useMemo(() => {
    const stockList = (locationStock || []).filter((s: any) => s.balance > 0 && !items.some((i) => i.itemId === s.itemId));
    if (!quickAddSearch) return stockList;
    const q = quickAddSearch.toLowerCase();
    return stockList.filter((s: any) => (s.itemName || '').toLowerCase().includes(q) || (s.itemCode || '').toLowerCase().includes(q));
  }, [locationStock, quickAddSearch, items]);

  const totalUsedPerItem = useMemo(() => {
    const map: Record<number, number> = {};
    items.forEach((i) => { if (i.itemId > 0) map[i.itemId] = (map[i.itemId] || 0) + i.quantityUsed; });
    return map;
  }, [items]);

  const canSave = formData.storeId > 0 && formData.date && items.length > 0
    && items.every((i) => i.itemId > 0 && i.quantityUsed > 0 && i.quantityUsed <= i.maxAvailable);

  const handleAddItem = (stock: any) => {
    if (items.some((i) => i.itemId === stock.itemId)) return;
    const matchedDemandItem = linkedDemandItems.find((di: any) => di.itemId === stock.itemId);
    const matchedAllocation = matchedDemandItem?.allocations?.find((a: any) => a.transactionHeaderId);
    setItems([...items, {
      itemId: stock.itemId,
      itemName: stock.itemName,
      itemCode: stock.itemCode,
      unitName: stock.unitName || '',
      quantityUsed: 1,
      maxAvailable: stock.balance,
      remarks: '',
      materialDemandItemId: matchedDemandItem?.id || undefined,
      transactionHeaderId: matchedAllocation?.transactionHeaderId || undefined,
    }]);
    setQuickAddOpen(false);
    setQuickAddSearch('');
  };

  const handleUpdateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await window.electronAPI.createConsumption({
        companyId: company!.id,
        financialYearId: financialYear!.id,
        storeId: formData.storeId,
        storeName: formData.storeName,
        locationId: formData.locationId || null,
        locationName: formData.locationName || null,
        departmentId: formData.departmentId || null,
        departmentName: formData.departmentName || null,
        dharmshalaName: formData.dharmshalaName || null,
        date: formData.date,
        usedBy: formData.usedBy,
        remarks: formData.remarks,
        serviceRequestId: formData.serviceRequestId || null,
        items: items.map((i) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          itemCode: i.itemCode,
          unitName: i.unitName,
          quantityUsed: i.quantityUsed,
          materialDemandItemId: i.materialDemandItemId || null,
          transactionHeaderId: i.transactionHeaderId || null,
          serviceRequestId: formData.serviceRequestId || null,
        })),
      });
      toast.success('Consumption recorded successfully');
      await Promise.all([
        setPreference('lastStoreId', String(formData.storeId)),
        setPreference('lastDepartmentId', String(formData.departmentId)),
        setPreference('lastDharmshala', formData.dharmshalaName),
        setPreference('lastUsedBy', formData.usedBy),
        addRecentValue('usedBy', formData.usedBy),
      ]);
      navigate('/inventory/consumption');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save consumption');
    }
    setSaving(false);
  };

  return (
    <Box p={3}>
      <PageHeader
        title="Material Consumption"
        subtitle="Record material used/consumed at a location. Consumption means the material is used up and no longer available."
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/consumption' },
          { label: 'Consumption' },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <GuideButton pageId="consumption" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button variant="contained" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'Saving...' : 'Save Consumption'}
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <TextField fullWidth required label="Consumption Date" type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={3}>
          <TextField fullWidth select label="Dharmshala / Store"
            value={formData.storeId}
            onChange={(e) => {
              const sid = +e.target.value;
              const store = dharmshalas.find((s: any) => s.id === sid);
              setFormData({ ...formData, storeId: sid, storeName: store?.name || '', locationId: 0, locationName: '' });
            }}>
            <MenuItem value={0}>Select Dharmshala</MenuItem>
            {dharmshalas.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={3}>
          <TextField fullWidth select label="Location"
            value={formData.locationId}
            onChange={(e) => {
              const loc = (locations || []).find((l: any) => l.id === +e.target.value);
              setFormData({ ...formData, locationId: +e.target.value, locationName: loc?.name || '' });
            }}
            disabled={!formData.storeId}>
            <MenuItem value={0}>All Locations</MenuItem>
            {filteredLocations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={3}>
          <Autocomplete
            freeSolo
            size="small"
            options={recentUsedBy}
            inputValue={formData.usedBy}
            onInputChange={(_, v) => setFormData({ ...formData, usedBy: v || '' })}
            renderInput={(params) => (
              <TextField {...params} fullWidth label="Used By" placeholder="Person who consumed" />
            )}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="Remarks"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
        </Grid>
        <Grid item xs={6}>
          <Autocomplete
            size="small"
            options={openDemands || []}
            getOptionLabel={(o: any) => `${o.physicalDemandNo || o.requestNumber} — ${o.dharmshalaName || 'N/A'}`}
            onChange={async (_, v: any) => {
              if (!v) {
                setFormData({
                  ...formData,
                  serviceRequestId: 0,
                  serviceRequestNumber: '',
                  usedBy: '',
                  remarks: '',
                  storeId: 0,
                  storeName: '',
                  locationId: 0,
                  locationName: '',
                  departmentId: 0,
                  departmentName: '',
                  dharmshalaName: '',
                });
                setLinkedDemandItems([]);
                setItems([]);
                return;
              }
              const matchedStore = (dharmshalas || []).find((s: any) => s.name === v.dharmshalaName || s.id === v.storeId);
              const locList = matchedStore
                ? (await window.electronAPI.dbQuery('location', 'findMany', { where: { isActive: true, storeId: matchedStore.id }, orderBy: { name: 'asc' } })) as any[]
                : [];
              const matchedLoc = locList.find((l: any) => l.name === v.locationName) || null;
              setFormData({
                ...formData,
                serviceRequestId: v.id,
                serviceRequestNumber: v.physicalDemandNo || '',
                storeId: matchedStore?.id || 0,
                storeName: matchedStore?.name || v.storeName || '',
                locationId: matchedLoc?.id || 0,
                locationName: matchedLoc?.name || v.locationName || '',
                dharmshalaName: v.dharmshalaName || '',
                usedBy: v.responsiblePerson || v.requestingPerson || '',
                remarks: [v.workType, v.issueDescription].filter(Boolean).join(' — ') || '',
                departmentId: v.departmentId || 0,
                departmentName: v.departmentName || '',
              });

              if (v?.id) {
                try {
                  const demandItems = await window.electronAPI.getDemandItems(v.id);
                  setLinkedDemandItems(demandItems || []);
                  const autoItems: ConsumptionItem[] = (demandItems || [])
                    .filter((di: any) => Number(di.quantityIssued) > Number(di.quantityConsumed))
                    .map((di: any) => ({
                      itemId: di.itemId,
                      itemName: di.itemName,
                      itemCode: di.itemCode || '',
                      unitName: di.unitName || '',
                      quantityUsed: 0,
                      maxAvailable: Number(di.quantityIssued) - Number(di.quantityConsumed),
                      remarks: '',
                      materialDemandItemId: di.id,
                      transactionHeaderId: di.allocations?.find((a: any) => a.transactionHeaderId)?.transactionHeaderId || undefined,
                    }));
                  if (autoItems.length > 0) {
                    setItems((prev) => {
                      const existingIds = new Set(prev.map((i) => i.itemId));
                      const newItems = autoItems.filter((i) => !existingIds.has(i.itemId));
                      return [...prev, ...newItems];
                    });
                    toast.success(`${autoItems.length} item(s) loaded from demand`);
                  } else {
                    toast('No un-consumed items in this demand', { icon: 'ℹ️' });
                  }
                } catch {
                  setLinkedDemandItems([]);
                }
              } else {
                setLinkedDemandItems([]);
              }
            }}
            renderInput={(params) => <TextField {...params} label="Link to Demand (Optional)" placeholder="Search demands..." />}
            fullWidth />
        </Grid>
      </Grid>

      {formData.storeId > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Location stock shown below. Balance = Received (from Store Issue) - Previously Consumed.
        </Alert>
      )}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={600}>Consumption Items</Typography>
        <Button startIcon={<Add />} variant="outlined" onClick={() => setQuickAddOpen(true)} disabled={!formData.storeId}>
          Add Item
        </Button>
      </Box>

      {items.length === 0 ? (
        <Alert severity="info">No items added. Click "Add Item" to select from location stock.</Alert>
      ) : (
        <TableContainer component={Box} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Available</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Qty Used</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>
                    <Typography fontWeight={500}>{item.itemName}</Typography>
                  </TableCell>
                  <TableCell>{item.itemCode}</TableCell>
                  <TableCell>{item.unitName}</TableCell>
                  <TableCell align="right">
                    <Chip label={item.maxAvailable} size="small"
                      sx={{ backgroundColor: alpha('#2563EB', 0.1), color: '#2563EB' }} />
                  </TableCell>
                  <TableCell align="right">
                    <TextField size="small" type="number" value={item.quantityUsed}
                      onChange={(e) => handleUpdateItem(idx, 'quantityUsed', Math.max(0, +e.target.value))}
                      error={item.quantityUsed > item.maxAvailable}
                      helperText={item.quantityUsed > item.maxAvailable ? `Max: ${item.maxAvailable}` : ''}
                      inputProps={{ min: 0.01, step: 1 }}
                      sx={{ width: 90 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={item.remarks}
                      onChange={(e) => handleUpdateItem(idx, 'remarks', e.target.value)}
                      placeholder="Purpose" sx={{ width: 120 }} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EnterpriseDialog open={quickAddOpen} onClose={() => { setQuickAddOpen(false); setQuickAddSearch(''); }}
        title="Add Item from Location Stock" icon={<LocalShipping />} maxWidth="md"
        actions={<Button onClick={() => { setQuickAddOpen(false); setQuickAddSearch(''); }}>Close</Button>}>
        <TextField fullWidth size="small" placeholder="Search items..." value={quickAddSearch}
          onChange={(e) => setQuickAddSearch(e.target.value)} sx={{ mb: 2 }}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Code</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quickAddFiltered.map((stock: any) => (
                <TableRow key={stock.itemId} hover>
                  <TableCell>{stock.itemName}</TableCell>
                  <TableCell>{stock.itemCode}</TableCell>
                  <TableCell align="right">{stock.balance}</TableCell>
                  <TableCell>
                    <Button size="small" variant="contained" onClick={() => handleAddItem(stock)}>Add</Button>
                  </TableCell>
                </TableRow>
              ))}
              {quickAddFiltered.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">No items available at this location</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </EnterpriseDialog>
    </Box>
  );
}
