import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Alert,
  Grid, FormControl, InputLabel, Select, Tooltip, CircularProgress, Link, Stack,
} from '@mui/material';
import { Add, Store, Business, Warehouse, Home, CheckCircle, Cancel, OpenInNew, LocationOn, Delete } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { GuideButton } from '../../components/GuideSystem';
import ImportExportButtons from '../../components/ImportExportButtons';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../components/ImportProgressDialog';
import { useCompany } from '../../context/CompanyContext';
import { getErrorMessage } from '../../utils/errorUtils';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface StoreRecord {
  id: number;
  uuid: string;
  name: string;
  code: string | null;
  storeType: string;
  parentStoreId: number | null;
  departmentId: number | null;
  isActive: boolean;
  companyId: number;
  parentStore?: { id: number; name: string; storeType: string } | null;
  _count?: { locations: number; ledgers: number; transactionsFrom: number; transactionsTo: number };
}

const storeSchema = z.object({
  name: z.string().min(1, 'Store name is required'),
  code: z.string(),
  storeType: z.string().min(1, 'Store type is required'),
  parentStoreId: z.number().nullable(),
  departmentId: z.number().nullable(),
});
type StoreFormData = z.infer<typeof storeSchema>;

const STORE_TYPES = [
  { value: 'MAIN_STORE', label: 'Main Store', icon: <Warehouse /> },
  { value: 'DEPARTMENT_STORE', label: 'Department Store', icon: <Business /> },
  { value: 'DHARMSHALA_STORE', label: 'Dharmshala Store', icon: <Home /> },
];

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Code', key: 'code' },
  { header: 'Type', key: 'storeType' },
  { header: 'Active', key: 'isActive' },
];

interface DepartmentRecord {
  id: number;
  name: string;
  code: string | null;
  departmentType: string;
  isActive: boolean;
}

export default function StoreMasterPage() {
  const { company } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; storeId: number | null }>({ open: false, storeId: null });

  const { register, handleSubmit, reset, watch, control, formState: { errors, isValid } } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    mode: 'onChange',
    defaultValues: { name: '', code: '', storeType: 'MAIN_STORE', parentStoreId: null, departmentId: null },
  });

  const loadStores = async () => {
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await window.electronAPI.listStores(company.id);
      setStores(data);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load stores'));
    }
    setLoading(false);
  };

  const loadDepartments = async () => {
    if (!company?.id) return;
    try {
      const data = await window.electronAPI.dbQuery('department', 'findMany', {
        where: { companyId: company.id, isActive: true },
        orderBy: { name: 'asc' },
      });
      setDepartments(data);
    } catch (err: any) {
      console.error('Failed to load departments', err);
    }
  };

  useEffect(() => { loadStores(); loadDepartments(); }, [company?.id]);

  const handleSave = async (data: StoreFormData) => {
    if (!company?.id) { toast.error('Select a company first'); return; }
    try {
      if (!editingStore) {
        const existingStore = stores.find(
          s => s.name.toLowerCase() === data.name.toLowerCase() && s.storeType === data.storeType
        );
        if (existingStore) {
          toast.error(`A store named "${data.name}" with type "${data.storeType.replace('_', ' ')}" already exists.`);
          return;
        }
      }

      if (editingStore) {
        await window.electronAPI.updateStore(editingStore.id, data);
        toast.success('Store updated');
      } else {
        await window.electronAPI.createStore({ ...data, companyId: company.id });
        toast.success('Store created');
      }
      setDialogOpen(false);
      setEditingStore(null);
      reset({ name: '', code: '', storeType: 'MAIN_STORE', parentStoreId: null, departmentId: null });
      loadStores();
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save store'));
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteConfirm({ open: true, storeId: id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.storeId) return;
    try {
      await window.electronAPI.deleteStore(deleteConfirm.storeId);
      toast.success('Store deleted');
      loadStores();
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to delete store'));
    }
    setDeleteConfirm({ open: false, storeId: null });
  };

  const handleToggle = async (id: number) => {
    try {
      await window.electronAPI.toggleStore(id);
      toast.success('Store status updated');
      loadStores();
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update store'));
    }
  };

  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImportStores = async (rows: any[]) => {
    if (!company?.id) { toast.error('Select a company first'); return; }
    const total = rows.length;
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const name = row['Name'] || row['name'] || '';
          if (!name) { skipped++; errors.push(`Row ${i + 1}: Missing name`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const storeType = row['Type'] || row['storeType'] || 'MAIN_STORE';
          const code = row['Code'] || row['code'] || '';
          const existing = stores.find(s => s.name === name);
          if (existing) {
            await window.electronAPI.updateStore(existing.id, { name, code, storeType });
            updated++;
          } else {
            await window.electronAPI.createStore({ name, code, storeType, companyId: company.id });
            created++;
          }
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1, created, updated, skipped, errors }));
      }
      loadStores();
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error(getErrorMessage(err, 'Import failed'));
    }
  };

  const getExportData = () => stores.map(s => ({
    name: s.name,
    code: s.code || '',
    storeType: s.storeType,
    isActive: s.isActive ? 'Yes' : 'No',
  }));

  const getStoreTypeColor = (type: string) => {
    switch (type) {
      case 'MAIN_STORE': return 'primary';
      case 'DEPARTMENT_STORE': return 'secondary';
      case 'DHARMSHALA_STORE': return 'success';
      default: return 'default';
    }
  };

  const getStoreTypeIcon = (type: string) => {
    switch (type) {
      case 'MAIN_STORE': return <Warehouse fontSize="small" />;
      case 'DEPARTMENT_STORE': return <Business fontSize="small" />;
      case 'DHARMSHALA_STORE': return <Home fontSize="small" />;
      default: return <Store fontSize="small" />;
    }
  };

  const getDepartmentName = (deptId: number | null) => {
    if (!deptId) return null;
    return departments.find(d => d.id === deptId)?.name || null;
  };

  const getDepartmentType = (deptId: number | null) => {
    if (!deptId) return null;
    return departments.find(d => d.id === deptId)?.departmentType || null;
  };

  const totalLocations = stores.reduce((sum, s) => sum + (s._count?.locations || 0), 0);
  const activeStores = stores.filter(s => s.isActive).length;

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={600}>Store Master</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {stores.length} stores ({activeStores} active) | {totalLocations} locations
          </Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <GuideButton pageId="store-master" />
          <ImportExportButtons
            data={getExportData()}
            columns={EXPORT_COLUMNS}
            fileName="stores"
            onImport={handleImportStores}
            showExport={stores.length > 0}
          />
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingStore(null); reset({ name: '', code: '', storeType: 'MAIN_STORE', parentStoreId: null, departmentId: null }); setDialogOpen(true); }}>
            Add Store
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Stores are auto-created when you add Stores/Dharamshalas from the Departments page. Use this page to add standalone stores manually. Stores linked to a Department can be managed from the Departments page.
      </Alert>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Store Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Parent Department/Dharamshala</TableCell>
                <TableCell>Locations</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stores.map((store) => {
                const deptName = getDepartmentName(store.departmentId);
                const deptType = getDepartmentType(store.departmentId);
                return (
                <TableRow key={store.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStoreTypeIcon(store.storeType)}
                      <Typography fontWeight={500}>{store.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{store.code || '-'}</TableCell>
                  <TableCell>
                    <Chip icon={getStoreTypeIcon(store.storeType)} label={store.storeType.replace('_', ' ')} color={getStoreTypeColor(store.storeType) as any} size="small" />
                  </TableCell>
                  <TableCell>
                    {deptName ? (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => navigate('/masters/departments')}
                          sx={{ fontWeight: 500, cursor: 'pointer' }}
                        >
                          {deptName}
                        </Link>
                        <Tooltip title="View in Departments">
                          <IconButton size="small" onClick={() => navigate('/masters/departments')} sx={{ p: 0 }}>
                            <OpenInNew sx={{ fontSize: 14, color: 'text.secondary' }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2">{store._count?.locations || 0}</Typography>
                      {(store._count?.locations || 0) > 0 && (
                        <Tooltip title="View Physical Locations">
                          <IconButton size="small" onClick={() => navigate(`/masters/locations?storeId=${store.id}`)} sx={{ p: 0 }}>
                            <OpenInNew sx={{ fontSize: 14, color: 'text.secondary' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={store.isActive ? 'Active' : 'Inactive'} color={store.isActive ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={store.isActive ? 'Disable' : 'Enable'}>
                      <IconButton size="small" onClick={() => handleToggle(store.id)} sx={{ color: store.isActive ? 'success.main' : 'text.secondary' }}>
                        {store.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => { setEditingStore(store); reset({ name: store.name, code: store.code || '', storeType: store.storeType, parentStoreId: store.parentStoreId, departmentId: store.departmentId }); setDialogOpen(true); }}>
                        <Store fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(store.id)} color="error">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                );
              })}
              {stores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="textSecondary">No stores found. Create your first store to get started.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="stores" />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingStore ? 'Edit Store' : 'Create Store'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Store Name" {...register('name')} error={!!errors.name} helperText={errors.name?.message} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Store Code" {...register('code')} error={!!errors.code} helperText={errors.code?.message} />
            </Grid>
            <Grid item xs={6}>
              <Controller name="storeType" control={control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Store Type</InputLabel>
                  <Select {...field} label="Store Type" MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                    {STORE_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        <Box display="flex" alignItems="center" gap={1}>{type.icon}{type.label}</Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )} />
            </Grid>
            {watch('storeType') !== 'MAIN_STORE' && (
              <Grid item xs={12}>
                <Controller name="parentStoreId" control={control} render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Parent Store</InputLabel>
                    <Select {...field} value={field.value ? String(field.value) : ''} label="Parent Store"
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                      <MenuItem value="">None</MenuItem>
                      {stores.filter((s) => s.storeType === 'MAIN_STORE' && s.isActive).map((s) => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )} />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit(handleSave)} disabled={!isValid}>{editingStore ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, storeId: null })}>
        <DialogTitle>Delete Store?</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this store? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, storeId: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
