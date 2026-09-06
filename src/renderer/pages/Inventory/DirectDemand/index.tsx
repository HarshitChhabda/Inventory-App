import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Grid, alpha, useTheme, Tooltip, Autocomplete, CircularProgress,
  MenuItem, Paper,
} from '@mui/material';
import { Add, Delete, ArrowBack, Search, Send, Cancel } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import DatePickerField from '../../../components/DatePickerField';
import { GuideButton } from '../../../components/GuideSystem';
import { todayISO } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';
import SuccessScreen from '../../../components/SuccessScreen';

const WORK_TYPES = [
  'Maintenance', 'Installation', 'Repair', 'Replacement',
  'Event Setup', 'Renovation', 'New Room', 'Other',
];

interface DemandItem {
  itemId: number;
  itemName: string;
  unitName: string;
  quantityRequested: number;
  serialNumber: string;
}

const INITIAL_FORM = {
  physicalDemandNo: '',
  demandDate: todayISO(),
  requestingPerson: '',
  mobileNo: '',
  responsiblePerson: '',
  workType: '',
  demandType: 'GENERAL',
  remarks: '',
  locationName: '',
  departmentId: 0,
  departmentName: '',
  dharmshalaName: '',
  storeId: 0,
  storeName: '',
};

export default function DirectDemand() {
  const { company } = useCompany();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [items, setItems] = useState<DemandItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<{ id: number; number: string } | null>(null);

  // Item form state
  const [itemId, setItemId] = useState(0);
  const [itemName, setItemName] = useState('');
  const [unitName, setUnitName] = useState('NOS');
  const [qty, setQty] = useState(1);
  const [serialNo, setSerialNo] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', {
      where: { companyId: company!.id, departmentType: 'Department', isActive: true },
      orderBy: { name: 'asc' },
    }),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', {
      where: { companyId: company!.id, isActive: true },
      orderBy: { name: 'asc' },
    }),
  });

  const { data: allItems } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', {
      where: { isActive: true },
      include: { unit: true },
      orderBy: { itemName: 'asc' },
    }),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', company?.id],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', {
      where: { store: { companyId: company!.id }, isActive: true },
      orderBy: { name: 'asc' },
    }),
  });

  const storesList = useMemo(() => (stores || []) as any[], [stores]);
  const dharmshalas = useMemo(() => storesList.filter((s: any) => s.storeType === 'DHARMSHALA_STORE'), [storesList]);
  const mainStores = useMemo(() => storesList.filter((s: any) => s.storeType === 'MAIN_STORE'), [storesList]);
  const departmentsList = useMemo(() => (departments || []) as any[], [departments]);

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    let filtered = locations as any[];
    if (formData.dharmshalaName) {
      const dharmStore = dharmshalas.find((d: any) => d.name === formData.dharmshalaName);
      if (dharmStore) {
        filtered = filtered.filter((l: any) =>
          l.storeId === dharmStore.id && !(l.parentId === null && l.name === dharmStore.name)
        );
      }
    }
    if (formData.departmentId) {
      const deptStores = storesList.filter((s: any) => s.departmentId === formData.departmentId);
      const deptStoreIds = deptStores.map((s: any) => s.id);
      filtered = filtered.filter((l: any) => {
        if (!deptStoreIds.includes(l.storeId)) return false;
        const matchingStore = deptStores.find((s: any) => s.id === l.storeId);
        return !(l.parentId === null && l.name === matchingStore?.name);
      });
    }
    return filtered;
  }, [locations, formData.dharmshalaName, formData.departmentId, dharmshalas, storesList]);

  const handleAddItem = useCallback(() => {
    if (!itemId || !itemName) { toast.error('Select an item'); return; }
    if (qty <= 0) { toast.error('Invalid quantity'); return; }
    setItems((prev) => [...prev, {
      itemId, itemName, unitName, quantityRequested: qty, serialNumber: serialNo,
    }]);
    setItemId(0);
    setItemName('');
    setUnitName('NOS');
    setQty(1);
    setSerialNo('');
  }, [itemId, itemName, unitName, qty, serialNo]);

  const handleRemoveItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.physicalDemandNo || items.length === 0) {
      toast.error('Physical Demand No. and at least one item required');
      return;
    }
    setSaving(true);
    try {
      const companyId = company?.id || 1;
      const fy = await window.electronAPI.getCurrentFinancialYear(companyId);
      if (!fy) {
        toast.error('No active financial year found');
        setSaving(false);
        return;
      }
      await window.electronAPI.createDirectDemand({
        companyId,
        financialYearId: fy.id,
        physicalDemandNo: formData.physicalDemandNo,
        demandDate: formData.demandDate,
        requestingPerson: formData.requestingPerson,
        mobileNo: formData.mobileNo,
        responsiblePerson: formData.responsiblePerson,
        workType: formData.workType,
        demandType: formData.demandType,
        remarks: formData.remarks,
        locationName: formData.locationName,
        departmentId: formData.departmentId || undefined,
        departmentName: formData.departmentName,
        dharmshalaName: formData.dharmshalaName,
        storeId: formData.storeId || undefined,
        storeName: formData.storeName,
        items,
      });
      toast.success(`Demand ${formData.physicalDemandNo} created`);
      setSavedResult({ id: Date.now(), number: formData.physicalDemandNo });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create demand');
    }
    setSaving(false);
  }, [company, formData, items]);

  const canSave = formData.physicalDemandNo.trim() !== '' && items.length > 0 && !saving;

  if (savedResult) {
    return (
      <SuccessScreen
        title="Demand Created"
        subtitle={`Demand slip ${savedResult.number} has been saved successfully.`}
        entityCode="DEMAND"
        entityName={savedResult.number}
        onCreateNew={() => { setSavedResult(null); setItems([]); setFormData(INITIAL_FORM); }}
        onBackToList={() => navigate('/inventory/movement')}
        showViewDetails={false}
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title="New Direct Demand"
        subtitle="Enter a physical demand slip into the system"
        breadcrumbs={[
          { label: 'Material Operations', path: '/inventory/movement' },
          { label: 'New Demand' },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <GuideButton pageId="stock-ledger" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      {/* Demand Header Details */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF',
      }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField fullWidth required label="मांग क्रमांक (Physical Demand No.)"
              value={formData.physicalDemandNo}
              onChange={(e) => setFormData((p) => ({ ...p, physicalDemandNo: e.target.value.replace(/[`]/g, '').trim() }))}
              placeholder="e.g. 71509" size="small" />
          </Grid>
          <Grid item xs={12} md={3}>
            <DatePickerField
              label="Demand Date"
              value={formData.demandDate}
              onChange={(val) => setFormData((p) => ({ ...p, demandDate: val }))}
              fullWidth size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Requesting Person" size="small"
              value={formData.requestingPerson}
              onChange={(e) => setFormData((p) => ({ ...p, requestingPerson: e.target.value }))}
              placeholder="e.g. Rajesh Kumar" />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Mobile No." size="small"
              value={formData.mobileNo}
              onChange={(e) => setFormData((p) => ({ ...p, mobileNo: e.target.value }))}
              placeholder="e.g. 9876543210" />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Responsible Person" size="small"
              value={formData.responsiblePerson}
              onChange={(e) => setFormData((p) => ({ ...p, responsiblePerson: e.target.value }))} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth select label="Work Type" size="small"
              value={formData.workType}
              onChange={(e) => setFormData((p) => ({ ...p, workType: e.target.value }))}>
              <MenuItem value="">Select Work Type</MenuItem>
              {WORK_TYPES.map((wt) => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth select label="Demand Type" size="small"
              value={formData.demandType}
              onChange={(e) => setFormData((p) => ({ ...p, demandType: e.target.value }))}
              helperText="Kya karna hai is demand par?">
              <MenuItem value="GENERAL">General (Sab ke liye)</MenuItem>
              <MenuItem value="CONSUMPTION">Consumption (Material use hoga)</MenuItem>
              <MenuItem value="INSTALLATION">Installation (Lagana hai)</MenuItem>
              <MenuItem value="TRANSFER">Transfer (Store mein wapas jana)</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth select label="Store (Issue From)" size="small"
              value={formData.storeId}
              onChange={(e) => {
                const sid = +e.target.value;
                const store = mainStores.find((s: any) => s.id === sid);
                setFormData((p) => ({ ...p, storeId: sid, storeName: store?.name || '' }));
              }}>
              <MenuItem value={0}>Select Store</MenuItem>
              {mainStores.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth select label="Dharmshala" size="small"
              value={formData.dharmshalaName}
              onChange={(e) => setFormData((p) => ({ ...p, dharmshalaName: e.target.value, locationName: '' }))}>
              <MenuItem value="">Select Dharmshala</MenuItem>
              {dharmshalas.map((d: any) => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth select label="Department" size="small"
              value={formData.departmentId}
              onChange={(e) => {
                const did = +e.target.value;
                const dept = departmentsList.find((d: any) => d.id === did);
                setFormData((p) => ({ ...p, departmentId: did, departmentName: dept?.name || '', locationName: '' }));
              }}>
              <MenuItem value={0}>Select Department</MenuItem>
              {departmentsList.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth select label="Location" size="small"
              value={formData.locationName}
              onChange={(e) => setFormData((p) => ({ ...p, locationName: e.target.value }))}
              disabled={!formData.dharmshalaName && !formData.departmentId}
              helperText={(!formData.dharmshalaName && !formData.departmentId) ? 'Select Dharmshala or Department first' : ''}>
              <MenuItem value="">Select Location</MenuItem>
              {filteredLocations.map((l: any) => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Remarks" size="small"
              value={formData.remarks}
              onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))} />
          </Grid>
        </Grid>
      </Box>

      {/* Add Items Inline */}
      <Box sx={{
        p: 2, mb: 2, borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Add Items
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <TextField fullWidth select label="Item" size="small"
              value={itemId}
              onChange={(e) => {
                const id = +e.target.value;
                const item = (allItems || []).find((i: any) => i.id === id);
                setItemId(id);
                setItemName(item?.itemName || '');
                setUnitName(item?.unit?.unitName || 'NOS');
              }}>
              <MenuItem value={0}>Select Item</MenuItem>
              {(allItems || []).map((item: any) => <MenuItem key={item.id} value={item.id}>{item.itemName}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth type="number" label="Quantity" size="small"
              value={qty}
              onChange={(e) => setQty(+e.target.value)}
              inputProps={{ min: 1 }} />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth label="Unit" size="small" value={unitName} disabled />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth label="Serial No" size="small"
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)} />
          </Grid>
          <Grid item xs={6} md={2}>
            <Button variant="outlined" startIcon={<Add />} onClick={handleAddItem} fullWidth sx={{ height: '40px' }}>
              Add
            </Button>
          </Grid>
        </Grid>

        {/* Items Table */}
        {items.length > 0 ? (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '10px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary' }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary' }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary' }}>Serial No</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.6875rem', color: 'text.secondary' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>{item.quantityRequested}</TableCell>
                    <TableCell>{item.serialNumber || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No items added. Select an item above and click "Add".
            </Typography>
          </Box>
        )}
      </Box>

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
          onClick={handleSave}
          disabled={!canSave}
          sx={{ fontWeight: 600, borderRadius: '10px', textTransform: 'none', px: 3 }}
        >
          {saving ? 'Saving...' : 'Save Demand'}
        </Button>
      </Box>
    </Box>
  );
}
