import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Grid, Chip, alpha, useTheme, Tooltip, Autocomplete, Alert, MenuItem,
} from '@mui/material';
import { Add, Delete, ArrowBack, Build, Search } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import { todayISO } from '../../../utils/dateUtils';
import { toast } from 'react-hot-toast';

interface InstallationItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  unitName: string;
  quantityInstalled: number;
  maxAvailable: number;
  condition: string;
  remarks: string;
  materialDemandItemId?: number;
  transactionHeaderId?: number;
}

export default function InstallationForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();
  const { getPreference, setPreference, getRecentValues, addRecentValue } = useUserPreferences({ prefix: 'installation.' });

  const [formData, setFormData] = useState({
    date: todayISO(),
    storeId: 0,
    storeName: '',
    locationId: 0,
    locationName: '',
    departmentId: 0,
    departmentName: '',
    dharmshalaName: '',
    installedBy: '',
    approvedBy: '',
    remarks: '',
    serviceRequestId: 0,
    serviceRequestNumber: '',
  });

  const [items, setItems] = useState<InstallationItem[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkedDemandItems, setLinkedDemandItems] = useState<any[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [recentInstalledBy, setRecentInstalledBy] = useState<string[]>([]);
  const [recentApprovedBy, setRecentApprovedBy] = useState<string[]>([]);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [savedStoreId, savedDeptId, savedDharmshala, savedInstalledBy, savedApprovedBy, recentIB, recentAB] = await Promise.all([
          getPreference('lastStoreId'),
          getPreference('lastDepartmentId'),
          getPreference('lastDharmshala'),
          getPreference('lastInstalledBy'),
          getPreference('lastApprovedBy'),
          getRecentValues('installedBy'),
          getRecentValues('approvedBy'),
        ]);
        setRecentInstalledBy(recentIB);
        setRecentApprovedBy(recentAB);
        if (savedStoreId || savedDeptId || savedInstalledBy || savedApprovedBy) {
          setFormData((prev) => ({
            ...prev,
            storeId: savedStoreId ? Number(savedStoreId) : prev.storeId,
            departmentId: savedDeptId ? Number(savedDeptId) : prev.departmentId,
            dharmshalaName: savedDharmshala || prev.dharmshalaName,
            installedBy: savedInstalledBy || prev.installedBy,
            approvedBy: savedApprovedBy || prev.approvedBy,
          }));
        }
      } catch {}
      setPrefsLoaded(true);
    };
    loadPrefs();
  }, []);

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
    queryKey: ['openDemands', company?.id, 'INSTALLATION'],
    queryFn: () => window.electronAPI.getOpenDemands(company!.id, financialYear?.id, 'INSTALLATION'),
    enabled: !!company?.id,
  });

  const storesList = useMemo(() => (stores || []) as any[], [stores]);
  const allStores = storesList;
  const selectedStore = useMemo(() => allStores.find((s: any) => s.id === formData.storeId), [allStores, formData.storeId]);

  const quickAddFiltered = useMemo(() => {
    const stockList = (locationStock || []).filter((s: any) => s.balance > 0 && !items.some((i) => i.itemId === s.itemId));
    if (!quickAddSearch) return stockList;
    const q = quickAddSearch.toLowerCase();
    return stockList.filter((s: any) => (s.itemName || '').toLowerCase().includes(q) || (s.itemCode || '').toLowerCase().includes(q));
  }, [locationStock, quickAddSearch, items]);

  const canSave = formData.storeId > 0 && formData.date && items.length > 0
    && items.every((i) => i.itemId > 0 && i.quantityInstalled > 0 && i.quantityInstalled <= i.maxAvailable);

  const handleAddItem = (stock: any) => {
    if (items.some((i) => i.itemId === stock.itemId)) return;
    const matchedDemandItem = linkedDemandItems.find((di: any) => di.itemId === stock.itemId);
    const matchedAllocation = matchedDemandItem?.allocations?.find((a: any) => a.transactionHeaderId);
    setItems([...items, {
      itemId: stock.itemId,
      itemName: stock.itemName,
      itemCode: stock.itemCode,
      unitName: stock.unitName || '',
      quantityInstalled: 1,
      maxAvailable: stock.balance,
      condition: 'GOOD',
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
      await window.electronAPI.createInstallation({
        companyId: company!.id,
        financialYearId: financialYear!.id,
        storeId: formData.storeId,
        locationId: formData.locationId || null,
        locationName: formData.locationName || null,
        departmentId: formData.departmentId || null,
        departmentName: formData.departmentName || null,
        dharmshalaName: formData.dharmshalaName || null,
        date: formData.date,
        installedBy: formData.installedBy,
        approvedBy: formData.approvedBy,
        remarks: formData.remarks,
        serviceRequestId: formData.serviceRequestId || null,
        items: items.map((i) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          itemCode: i.itemCode,
          unitName: i.unitName,
          quantityInstalled: i.quantityInstalled,
          condition: i.condition,
          remarks: i.remarks,
          materialDemandItemId: i.materialDemandItemId || null,
          transactionHeaderId: i.transactionHeaderId || null,
          serviceRequestId: formData.serviceRequestId || null,
        })),
      });
      toast.success('Installation recorded successfully');
      await Promise.all([
        setPreference('lastStoreId', String(formData.storeId)),
        setPreference('lastDepartmentId', String(formData.departmentId)),
        setPreference('lastDharmshala', formData.dharmshalaName),
        setPreference('lastInstalledBy', formData.installedBy),
        setPreference('lastApprovedBy', formData.approvedBy),
        addRecentValue('installedBy', formData.installedBy),
        addRecentValue('approvedBy', formData.approvedBy),
      ]);
      navigate('/inventory/installation');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save installation');
    }
    setSaving(false);
  };

  return (
    <Box p={3}>
      <PageHeader
        title="Material Installation"
        subtitle="Record materials physically installed/placed at a location. Installation decreases available stock and tracks where items are placed."
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/installation' },
          { label: 'Installation' },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/inventory/installation')}>Back</Button>
            <Button variant="contained" onClick={handleSave} disabled={!canSave || saving}
              sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}>
              {saving ? 'Saving...' : 'Save Installation'}
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <TextField fullWidth required label="Installation Date" type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={3}>
          <TextField fullWidth select label="Store / Dharmshala"
            value={formData.storeId}
            onChange={(e) => {
              const sid = +e.target.value;
              const store = allStores.find((s: any) => s.id === sid);
              setFormData({ ...formData, storeId: sid, storeName: store?.name || '', locationId: 0, locationName: '' });
            }}>
            <MenuItem value={0}>Select Store</MenuItem>
            {allStores.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
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
            options={recentInstalledBy}
            inputValue={formData.installedBy}
            onInputChange={(_, v) => setFormData({ ...formData, installedBy: v || '' })}
            renderInput={(params) => (
              <TextField {...params} fullWidth label="Installed By" placeholder="Technician / Worker name" />
            )}
          />
        </Grid>
        <Grid item xs={3}>
          <TextField fullWidth select label="Department"
            value={formData.departmentId}
            onChange={(e) => {
              const dept = (departments || []).find((d: any) => d.id === +e.target.value);
              setFormData({ ...formData, departmentId: +e.target.value, departmentName: dept?.name || '' });
            }}>
            <MenuItem value={0}>Select Department</MenuItem>
            {(departments || []).map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={3}>
          <Autocomplete
            freeSolo
            size="small"
            options={recentApprovedBy}
            inputValue={formData.approvedBy}
            onInputChange={(_, v) => setFormData({ ...formData, approvedBy: v || '' })}
            renderInput={(params) => (
              <TextField {...params} fullWidth label="Approved By" placeholder="Supervisor / Manager" />
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
                setFormData({ ...formData, serviceRequestId: 0, serviceRequestNumber: '', installedBy: '', remarks: '', storeId: 0, storeName: '', locationId: 0, locationName: '', departmentId: 0, departmentName: '', dharmshalaName: '' });
                setLinkedDemandItems([]);
                setItems([]);
                return;
              }
              const matchedStore = allStores.find((s: any) => s.name === v.dharmshalaName || s.id === v.storeId);
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
                installedBy: v.responsiblePerson || v.requestingPerson || '',
                remarks: [v.workType, v.issueDescription].filter(Boolean).join(' — ') || '',
                departmentId: v.departmentId || 0,
                departmentName: v.departmentName || '',
              });

              if (v?.id) {
                try {
                  const demandItems = await window.electronAPI.getDemandItems(v.id);
                  setLinkedDemandItems(demandItems || []);
                  const autoItems: InstallationItem[] = (demandItems || [])
                    .filter((di: any) => {
                      const issued = Number(di.quantityIssued);
                      const consumed = Number(di.quantityConsumed);
                      const installed = Number(di.quantityInstalled || 0);
                      return issued > 0 && (consumed + installed) < issued;
                    })
                    .map((di: any) => ({
                      itemId: di.itemId,
                      itemName: di.itemName,
                      itemCode: di.itemCode || '',
                      unitName: di.unitName || '',
                      quantityInstalled: 0,
                      maxAvailable: Number(di.quantityIssued) - Number(di.quantityConsumed) - Number(di.quantityInstalled || 0),
                      condition: 'GOOD',
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
                    toast('No installable items in this demand', { icon: 'ℹ️' });
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
          Location stock shown below. Available = Received (from Store Issue) - Consumed - Previously Installed.
        </Alert>
      )}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={600}>Installation Items</Typography>
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
                <TableCell align="right" sx={{ fontWeight: 700 }}>Qty Install</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Condition</TableCell>
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
                    <TextField size="small" type="number" value={item.quantityInstalled}
                      onChange={(e) => handleUpdateItem(idx, 'quantityInstalled', Math.max(0, +e.target.value))}
                      error={item.quantityInstalled > item.maxAvailable}
                      helperText={item.quantityInstalled > item.maxAvailable ? `Max: ${item.maxAvailable}` : ''}
                      inputProps={{ min: 1, step: 1 }}
                      sx={{ width: 90 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" select value={item.condition}
                      onChange={(e) => handleUpdateItem(idx, 'condition', e.target.value)}
                      sx={{ width: 110 }}>
                      <MenuItem value="GOOD">Good</MenuItem>
                      <MenuItem value="DAMAGED">Damaged</MenuItem>
                      <MenuItem value="PARTIAL">Partial</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={item.remarks}
                      onChange={(e) => handleUpdateItem(idx, 'remarks', e.target.value)}
                      placeholder="Notes" sx={{ width: 120 }} />
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
        title="Add Item from Location Stock" icon={<Build />} maxWidth="md"
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
                    <Button size="small" variant="contained" color="success" onClick={() => handleAddItem(stock)}>Add</Button>
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
