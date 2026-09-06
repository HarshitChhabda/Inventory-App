import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Tooltip,
  alpha, useTheme, Grid, MenuItem, Skeleton, Stack, Autocomplete,
} from '@mui/material';
import { Add, Visibility, Edit, Delete, Search, Description, Cancel, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import EnterpriseDialog from '../../components/EnterpriseDialog';
import EmptyState from '../../components/EmptyState';
import { GuideButton } from '../../components/GuideSystem';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

const WORK_TYPES = ['Maintenance', 'Installation', 'Repair', 'Replacement', 'Event Setup', 'Renovation', 'New Room', 'Other'];
const DEMAND_TYPES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'CONSUMPTION', label: 'Consumption' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'TRANSFER', label: 'Transfer' },
];

export default function DemandSlips() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { company } = useCompany();
  const { currentUser } = useAuth();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editItemForm, setEditItemForm] = useState({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: demands = [], isLoading } = useQuery({
    queryKey: ['directDemands', companyId],
    queryFn: () => window.electronAPI.dbQuery('serviceRequest', 'findMany', {
      where: { companyId, serviceType: 'INTERNAL' },
      include: { demandItems: true },
      orderBy: { createdAt: 'desc' },
    }) as Promise<any[]>,
    enabled: !!companyId,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', companyId],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { companyId, isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!companyId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', companyId],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId, departmentType: 'Department', isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!companyId,
  });

  const { data: dharmshalas = [] } = useQuery({
    queryKey: ['dharmshalaStores', companyId],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { companyId, storeType: 'DHARMSHALA_STORE', isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!companyId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', companyId],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', { where: { store: { companyId }, isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!companyId,
  });

  const filteredDemands = useMemo(() => {
    let result = demands;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d: any) =>
        d.physicalDemandNo?.toLowerCase().includes(q) ||
        d.requestingPerson?.toLowerCase().includes(q) ||
        d.dharmshalaName?.toLowerCase().includes(q) ||
        d.locationName?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [demands, search]);

  const filteredLocations = useMemo(() => {
    if (!editForm.dharmshalaName) return locations;
    const dharmStore = dharmshalas.find((d: any) => d.name === editForm.dharmshalaName);
    if (!dharmStore) return locations;
    return (locations as any[]).filter((l: any) =>
      l.storeId === dharmStore.id && !(l.parentId === null && l.name === dharmStore.name)
    );
  }, [locations, editForm.dharmshalaName, dharmshalas]);

  const handleOpenEdit = async (sr: any) => {
    setEditTarget(sr);
    setEditForm({
      physicalDemandNo: sr.physicalDemandNo || '',
      demandDate: sr.demandDate ? sr.demandDate.split('T')[0] : new Date().toISOString().split('T')[0],
      requestingPerson: sr.requestingPerson || '',
      mobileNo: sr.mobileNo || '',
      responsiblePerson: sr.responsiblePerson || '',
      workType: sr.workType || '',
      demandType: sr.demandType || 'GENERAL',
      remarks: sr.issueDescription || '',
      locationName: sr.locationName || '',
      departmentId: sr.departmentId || 0,
      departmentName: sr.departmentName || '',
      dharmshalaName: sr.dharmshalaName || '',
      storeId: sr.storeId || 0,
      storeName: sr.storeName || '',
    });
    try {
      const itemsData = await window.electronAPI.getDemandItems(sr.id);
      setEditItems(itemsData || []);
    } catch {
      setEditItems([]);
    }
    setEditOpen(true);
  };

  const handleAddEditItem = () => {
    if (!editItemForm.itemId || !editItemForm.itemName) return;
    setEditItems([...editItems, { ...editItemForm }]);
    setEditItemForm({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  };

  const handleRemoveEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    try {
      const dept = departments.find((d: any) => d.id === editForm.departmentId);
      await window.electronAPI.updateDirectDemand(editTarget.id, {
        ...editForm,
        departmentName: dept?.name || '',
        items: editItems,
      });
      toast.success('Demand updated');
      setEditOpen(false);
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['directDemands'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to update demand');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await window.electronAPI.deleteDirectDemand(deleteTarget.id);
      toast.success('Demand deleted');
      setDeleteOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['directDemands'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete demand');
    }
  };

  const getDemandTypeColor = (type: string) => {
    switch (type) {
      case 'CONSUMPTION': return 'warning';
      case 'INSTALLATION': return 'info';
      case 'TRANSFER': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (sr: any) => {
    const status = sr.materialDemandStatus || 'PENDING';
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PARTIALLY_ISSUED': return 'warning';
      case 'PENDING': return 'default';
      default: return 'default';
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <Box>
      <PageHeader
        title="Demand Slips"
        subtitle="View and manage all direct material demands"
        actions={
          <Stack direction="row" spacing={1}>
            <GuideButton pageId="stock-ledger" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button startIcon={<Add />} variant="contained" onClick={() => navigate('/inventory/new-demand')}>
              New Demand
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ p: 2, mb: 2, border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, borderRadius: '12px' }}>
        <TextField
          fullWidth size="small" placeholder="Search by demand no, person, dharmshala..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
        />
      </Paper>

      <TableContainer component={Paper} sx={{ border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, borderRadius: '12px' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableCell sx={{ fontWeight: 700 }}>Demand No.</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Dharmshala</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Person</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {[...Array(9)].map((_, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredDemands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <EmptyState
                    icon={<Description />}
                    title="No demand slips"
                    description="Create a new direct demand to get started."
                    action={{ label: 'New Demand', onClick: () => navigate('/inventory/new-demand'), icon: <Add /> }}
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredDemands.map((sr: any) => (
                <TableRow key={sr.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize="0.85rem">
                      {sr.physicalDemandNo || sr.requestNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{sr.demandDate ? formatDateDDMMYYYY(new Date(sr.demandDate)) : '-'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={sr.demandType || 'GENERAL'} color={getDemandTypeColor(sr.demandType || 'GENERAL') as any}
                      sx={{ fontSize: '0.65rem', height: 20 }} />
                  </TableCell>
                  <TableCell>{sr.dharmshalaName || '-'}</TableCell>
                  <TableCell>{sr.locationName || '-'}</TableCell>
                  <TableCell>{sr.demandItems?.length || 0}</TableCell>
                  <TableCell>{sr.requestingPerson || sr.responsiblePerson || '-'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={sr.materialDemandStatus || 'PENDING'} color={getStatusColor(sr) as any}
                      sx={{ fontSize: '0.65rem', height: 20 }} />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => handleOpenEdit(sr)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => { setDeleteTarget(sr); setDeleteOpen(true); }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <EnterpriseDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Direct Demand"
        icon={<Edit />}
        maxWidth="lg"
        actions={
          <>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdit} disabled={!editForm.physicalDemandNo}>Update Demand</Button>
          </>
        }
      >
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={3}>
            <TextField fullWidth required label="Demand No."
              value={editForm.physicalDemandNo}
              onChange={e => setEditForm({ ...editForm, physicalDemandNo: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Demand Date" type="date"
              value={editForm.demandDate}
              onChange={e => setEditForm({ ...editForm, demandDate: e.target.value })}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Requesting Person"
              value={editForm.requestingPerson}
              onChange={e => setEditForm({ ...editForm, requestingPerson: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Mobile No."
              value={editForm.mobileNo}
              onChange={e => setEditForm({ ...editForm, mobileNo: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Responsible Person"
              value={editForm.responsiblePerson}
              onChange={e => setEditForm({ ...editForm, responsiblePerson: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Work Type"
              value={editForm.workType}
              onChange={e => setEditForm({ ...editForm, workType: e.target.value })}>
              <MenuItem value="">Select Work Type</MenuItem>
              {WORK_TYPES.map(wt => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Demand Type"
              value={editForm.demandType}
              onChange={e => setEditForm({ ...editForm, demandType: e.target.value })}>
              {DEMAND_TYPES.map(dt => <MenuItem key={dt.value} value={dt.value}>{dt.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Store (Issue From)"
              value={editForm.storeId}
              onChange={e => {
                const sid = +e.target.value;
                const store = stores.find((s: any) => s.id === sid);
                setEditForm({ ...editForm, storeId: sid, storeName: store?.name || '' });
              }}>
              <MenuItem value={0}>Select Store</MenuItem>
              {stores.filter((s: any) => s.storeType === 'MAIN_STORE').map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Dharmshala"
              value={editForm.dharmshalaName}
              onChange={e => setEditForm({ ...editForm, dharmshalaName: e.target.value, locationName: '' })}>
              <MenuItem value="">Select Dharmshala</MenuItem>
              {dharmshalas.map((d: any) => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Department"
              value={editForm.departmentId}
              onChange={e => {
                const did = +e.target.value;
                const dept = departments.find((d: any) => d.id === did);
                setEditForm({ ...editForm, departmentId: did, departmentName: dept?.name || '', locationName: '' });
              }}>
              <MenuItem value={0}>Select Department</MenuItem>
              {departments.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Location"
              value={editForm.locationName}
              onChange={e => setEditForm({ ...editForm, locationName: e.target.value })}
              disabled={!editForm.dharmshalaName && !editForm.departmentId}>
              <MenuItem value="">Select Location</MenuItem>
              {filteredLocations.map((l: any) => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Remarks"
              value={editForm.remarks}
              onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} />
          </Grid>
        </Grid>

        {/* Add Item */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Add Item</Typography>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={4}>
              <Autocomplete size="small" options={items} getOptionLabel={(o: any) => `${o.itemName} (${o.itemCode || ''})`}
                value={items.find((i: any) => i.id === editItemForm.itemId) || null}
                onChange={(_, v) => v && setEditItemForm({ ...editItemForm, itemId: v.id, itemName: v.itemName, unitName: v.unit?.name || 'NOS' })}
                renderInput={(params) => <TextField {...params} label="Item" placeholder="Search item..." />} />
            </Grid>
            <Grid item xs={2}>
              <TextField fullWidth size="small" label="Qty" type="number"
                value={editItemForm.quantityRequested}
                onChange={e => setEditItemForm({ ...editItemForm, quantityRequested: +e.target.value })} />
            </Grid>
            <Grid item xs={2}>
              <TextField fullWidth size="small" label="Unit" value={editItemForm.unitName} disabled />
            </Grid>
            <Grid item xs={2}>
              <TextField fullWidth size="small" label="Serial No"
                value={editItemForm.serialNumber}
                onChange={e => setEditItemForm({ ...editItemForm, serialNumber: e.target.value })} />
            </Grid>
            <Grid item xs={2}>
              <Button fullWidth variant="outlined" startIcon={<Add />} onClick={handleAddEditItem}>Add</Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Items Table */}
        {editItems.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Serial No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editItems.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.quantityRequested}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>{item.serialNumber || '-'}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => handleRemoveEditItem(idx)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </EnterpriseDialog>

      {/* Delete Confirmation */}
      <EnterpriseDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Demand"
        icon={<Delete />}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <Typography>Are you sure you want to delete demand <strong>{deleteTarget?.physicalDemandNo}</strong>?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>This action cannot be undone.</Typography>
      </EnterpriseDialog>
    </Box>
  );
}
