import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Chip, TextField, InputAdornment,
  Grid, FormControl, InputLabel, Select, MenuItem, Rating, Tooltip, Card,
  CardContent, Tabs, Tab, Divider, LinearProgress, Avatar, List, ListItem,
  ListItemText, ListItemIcon,
} from '@mui/material';
import {
  Add, Search, Edit, Delete, Visibility, QrCode, Warning, CheckCircle,
  Build, LocationOn, Inventory2, TrendingUp, CalendarMonth, AttachFile,
  PhotoCamera, Assignment, History, Speed, Engineering, RestartAlt,
  Assessment, SwapHoriz, EventBusy, LocalShipping, AssignmentReturn,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import { useListState } from '../../../hooks/useListState';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, toISODateIST } from '../../../utils/dateUtils';
import StatusBadge from '../../../components/StatusBadge';

const assetSchema = z.object({
  assetName: z.string().min(1, 'Asset name is required'),
  itemId: z.number().min(1, 'Item is required'),
  brandId: z.number().min(0),
  modelNumber: z.string(),
  serialNumber: z.string(),
  purchaseDate: z.string(),
  purchaseCost: z.number().min(0),
  vendorId: z.number().min(0),
  invoiceNumber: z.string(),
  expectedLifeYears: z.number().min(0),
  expectedLifeMonths: z.number().min(0),
  remarks: z.string(),
});
type AssetFormData = z.infer<typeof assetSchema>;

const STATUS_OPTIONS = [
  'PURCHASED', 'AVAILABLE', 'RESERVED', 'INSTALLED', 'IN_TRANSIT', 'REPAIR',
  'DAMAGED', 'REPLACEMENT', 'SCRAPPED', 'DISPOSED', 'LOST', 'ARCHIVED',
];

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: '#22C55E', GOOD: '#3B82F6', AVERAGE: '#F59E0B',
  POOR: '#F97316', CRITICAL: '#EF4444', SCRAP: '#6B7280',
};

export default function AssetRegistryPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const {
    state: ls, setSearch: setLsSearch, setPage: setLsPage, setPageSize: setLsPageSize, setFilter,
  } = useListState('assets', { pageSize: 20 });

  const [page, setPage] = useState(ls.page);
  const [rowsPerPage, setRowsPerPage] = useState(ls.pageSize);
  const [search, setSearchLocal] = useState(ls.search);
  const [statusFilter, setStatusFilterLocal] = useState(ls.filters.status || '');
  const [conditionFilter, setConditionFilterLocal] = useState(ls.filters.condition || '');
  const [storeIdFilter, setStoreIdFilterLocal] = useState<number | ''>((ls.filters.store as any) || '');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [profileTab, setProfileTab] = useState(0);

  const handleSearchChange = (v: string) => {
    setSearchLocal(v);
    setLsSearch(v);
  };
  const handleStatusChange = (v: string) => {
    setStatusFilterLocal(v);
    setFilter('status', v);
  };
  const handleConditionChange = (v: string) => {
    setConditionFilterLocal(v);
    setFilter('condition', v);
  };
  const handleStoreChange = (v: number | '') => {
    setStoreIdFilterLocal(v);
    setFilter('store', String(v));
  };
  const handlePageChange = (_: any, newPage: number) => {
    setPage(newPage);
    setLsPage(newPage);
  };
  const handleRowsPerPageChange = (e: any) => {
    const val = parseInt(e.target.value, 10);
    setRowsPerPage(val);
    setLsPageSize(val);
    setPage(0);
  };

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    mode: 'onChange',
    defaultValues: { assetName: '', itemId: 0, brandId: 0, modelNumber: '', serialNumber: '', purchaseDate: '', purchaseCost: 0, vendorId: 0, invoiceNumber: '', expectedLifeYears: 5, expectedLifeMonths: 0, remarks: '' },
  });

  const { data: assetData, isLoading } = useQuery({
    queryKey: ['assets', companyId, page, rowsPerPage, search, statusFilter, conditionFilter, storeIdFilter],
    queryFn: () => window.electronAPI.searchAssets({
      companyId, page: page + 1, pageSize: rowsPerPage, search,
      status: statusFilter || undefined, condition: conditionFilter || undefined,
      storeId: storeIdFilter || undefined,
    }),
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => window.electronAPI.dbQuery('brand', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => window.electronAPI.dbQuery('vendor', 'findMany', { where: { isActive: true }, orderBy: { vendorName: 'asc' } }),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['assetDashboard', companyId],
    queryFn: () => window.electronAPI.getAssetDashboard(companyId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.createAsset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetDashboard'] });
      toast.success('Asset created successfully');
      setCreateOpen(false);
      reset({ assetName: '', itemId: 0, brandId: 0, modelNumber: '', serialNumber: '', purchaseDate: '', purchaseCost: 0, vendorId: 0, invoiceNumber: '', expectedLifeYears: 5, expectedLifeMonths: 0, remarks: '' });
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create asset')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => window.electronAPI.updateAsset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetDashboard'] });
      toast.success('Asset updated successfully');
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update asset')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.deleteAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetDashboard'] });
      toast.success('Asset deleted');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to delete asset')),
  });

  const handleCreate = (data: AssetFormData) => {
    createMutation.mutate({
      companyId, ...data,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
    });
  };

  const handleViewProfile = async (asset: any) => {
    const full = await window.electronAPI.getAsset(asset.id);
    setSelectedAsset(full);
    setProfileOpen(true);
    setProfileTab(0);
  };

  const handleEdit = (asset: any) => {
    reset({
      assetName: asset.assetName, itemId: asset.itemId, brandId: asset.brandId || 0,
      modelNumber: asset.modelNumber || '', serialNumber: asset.serialNumber || '',
      purchaseDate: asset.purchaseDate ? toISODateIST(asset.purchaseDate) : '',
      purchaseCost: Number(asset.purchaseCost) || 0, vendorId: asset.vendorId || 0,
      invoiceNumber: asset.invoiceNumber || '', expectedLifeYears: asset.expectedLifeYears || 5,
      expectedLifeMonths: asset.expectedLifeMonths || 0, remarks: asset.remarks || '',
    });
    setSelectedAsset(asset);
    setEditOpen(true);
  };

  const assets = assetData?.data || [];
  const total = assetData?.total || 0;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>Digital Asset Registry</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Every asset has a permanent identity, complete history, and full lifecycle tracking.</Typography>

      {/* Dashboard Cards */}
      {dashboard && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography variant="h4" fontWeight={700}>{dashboard.total}</Typography>
              <Typography variant="body2" color="text.secondary">Total Assets</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography variant="h4" fontWeight={700} color="primary">{dashboard.byStatus?.INSTALLED || 0}</Typography>
              <Typography variant="body2" color="text.secondary">Installed</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h4" fontWeight={700} color="success.main">{dashboard.averageHealthScore}%</Typography>
                <Speed color="success" />
              </Box>
              <Typography variant="body2" color="text.secondary">Avg Health Score</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h4" fontWeight={700} color="warning.main">{dashboard.expiringWarrantyCount + dashboard.expiringAMCCount}</Typography>
                <Warning color="warning" />
              </Box>
              <Typography variant="body2" color="text.secondary">Warranty/AMC Expiring</Typography>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField fullWidth size="small" placeholder="Search by ID, name, serial, QR..."
              value={search} onChange={e => handleSearchChange(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={e => handleStatusChange(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Condition</InputLabel>
              <Select value={conditionFilter} label="Condition" onChange={e => handleConditionChange(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {Object.keys(CONDITION_COLORS).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Store</InputLabel>
              <Select value={storeIdFilter} label="Store" onChange={e => handleStoreChange(e.target.value as any)}>
                <MenuItem value="">All</MenuItem>
                {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <Button fullWidth variant="contained" startIcon={<Add />} onClick={() => { reset({ assetName: '', itemId: 0, brandId: 0, modelNumber: '', serialNumber: '', purchaseDate: '', purchaseCost: 0, vendorId: 0, invoiceNumber: '', expectedLifeYears: 5, expectedLifeMonths: 0, remarks: '' }); setCreateOpen(true); }}>
              New Asset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        {isLoading && <LinearProgress />}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Asset ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Serial No</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell>Health</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Warranty</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((asset: any) => (
              <TableRow key={asset.id} hover>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <QrCode fontSize="small" color="action" />
                    <Typography variant="body2" fontWeight={600} fontFamily="monospace">{asset.assetCode}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{asset.assetName}</TableCell>
                <TableCell>{asset.item?.itemName}</TableCell>
                <TableCell>{asset.serialNumber || '-'}</TableCell>
                <TableCell>
                  <StatusBadge status={asset.status} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={asset.condition}
                    sx={{ bgcolor: CONDITION_COLORS[asset.condition] + '20', color: CONDITION_COLORS[asset.condition], fontWeight: 600 }} />
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LinearProgress variant="determinate" value={asset.healthScore}
                      sx={{ width: 60, height: 6, borderRadius: 3, bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': { bgcolor: asset.healthScore > 70 ? 'success.main' : asset.healthScore > 40 ? 'warning.main' : 'error.main' } }} />
                    <Typography variant="caption" fontWeight={600}>{asset.healthScore}%</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{asset.currentStore?.name || '-'}</Typography>
                  {asset.currentRoom && <Typography variant="caption" color="text.secondary">{asset.currentRoom.name}</Typography>}
                </TableCell>
                <TableCell>
                  {asset.warrantyEnd ? (
                    <Box>
                      <Typography variant="body2" fontSize={12}>{formatDateDDMMYYYY(new Date(asset.warrantyEnd))}</Typography>
                      {new Date(asset.warrantyEnd) < new Date() ? (
                        <Chip size="small" label="Expired" color="error" variant="outlined" />
                      ) : (
                        <Chip size="small" label="Active" color="success" variant="outlined" />
                      )}
                    </Box>
                  ) : '-'}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Profile"><IconButton size="small" onClick={() => handleViewProfile(asset)}><Visibility fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => handleEdit(asset)}><Edit fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => { if (confirm(`Are you sure you want to delete asset "${asset.assetName}" (${asset.assetCode})? This action cannot be undone and all asset history will be lost.`)) deleteMutation.mutate(asset.id); }}><Delete fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {assets.length === 0 && (
              <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">No assets found. Create your first asset to get started.</Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange} onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50]} />
      </TableContainer>

      <EnterpriseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Asset"
        icon={<Inventory2 />}
        actions={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit(handleCreate)} disabled={!isValid}>Create Asset</Button>
          </>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Asset Name" {...register('assetName')} error={!!errors.assetName} helperText={errors.assetName?.message} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller
              control={control}
              name="itemId"
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.itemId}>
                  <InputLabel>Item</InputLabel>
                  <Select {...field} label="Item">
                    <MenuItem value={0}>Select Item</MenuItem>
                    {items?.map((i: any) => <MenuItem key={i.id} value={i.id}>{i.itemName}</MenuItem>)}
                  </Select>
                  {errors.itemId && <Typography variant="caption" color="error">{errors.itemId.message}</Typography>}
                </FormControl>
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller
              control={control}
              name="brandId"
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Brand</InputLabel>
                  <Select {...field} label="Brand">
                    <MenuItem value={0}>Select Brand</MenuItem>
                    {brands?.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Model Number" {...register('modelNumber')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Serial Number" {...register('serialNumber')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Invoice Number" {...register('invoiceNumber')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller name="purchaseDate" control={control} render={({ field }) => (
              <DatePickerField fullWidth label="Purchase Date" value={field.value} onChange={field.onChange} />
            )} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth type="number" label="Purchase Cost" {...register('purchaseCost', { valueAsNumber: true })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller
              control={control}
              name="vendorId"
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Vendor</InputLabel>
                  <Select {...field} label="Vendor">
                    <MenuItem value={0}>Select Vendor</MenuItem>
                    {vendors?.map((v: any) => <MenuItem key={v.id} value={v.id}>{v.vendorName}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth type="number" label="Expected Life (Years)" {...register('expectedLifeYears', { valueAsNumber: true })} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline rows={2} label="Remarks" {...register('remarks')} />
          </Grid>
        </Grid>
      </EnterpriseDialog>

      <EnterpriseDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Asset: ${selectedAsset?.assetCode || ''}`}
        icon={<Inventory2 />}
        actions={
          <>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit((data) => { if (selectedAsset) updateMutation.mutate({ id: selectedAsset.id, data }); })} disabled={!isValid}>Save Changes</Button>
          </>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Asset Name" {...register('assetName')} error={!!errors.assetName} helperText={errors.assetName?.message} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller
              control={control}
              name="itemId"
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.itemId}>
                  <InputLabel>Item</InputLabel>
                  <Select {...field} label="Item">
                    <MenuItem value={0}>Select Item</MenuItem>
                    {items?.map((i: any) => <MenuItem key={i.id} value={i.id}>{i.itemName}</MenuItem>)}
                  </Select>
                  {errors.itemId && <Typography variant="caption" color="error">{errors.itemId.message}</Typography>}
                </FormControl>
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Serial Number" {...register('serialNumber')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Model Number" {...register('modelNumber')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller name="purchaseDate" control={control} render={({ field }) => (
              <DatePickerField fullWidth label="Purchase Date" value={field.value} onChange={field.onChange} />
            )} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth type="number" label="Purchase Cost" {...register('purchaseCost', { valueAsNumber: true })} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline rows={2} label="Remarks" {...register('remarks')} />
          </Grid>
        </Grid>
      </EnterpriseDialog>

      <EnterpriseDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Asset Profile"
        subtitle={selectedAsset?.assetCode}
        icon={<Inventory2 />}
        maxWidth="lg"
        actions={<Button onClick={() => setProfileOpen(false)}>Close</Button>}
      >
        {selectedAsset && (
          <>
            <Tabs value={profileTab} onChange={(_, v) => setProfileTab(v)} sx={{ mb: 2 }}>
              <Tab label="Overview" />
              <Tab label="Timeline" />
              <Tab label="Service History" />
              <Tab label="QR Code" />
            </Tabs>

            {profileTab === 0 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Asset Details</Typography>
                  <Divider sx={{ mb: 1 }} />
                  <List dense>
                    <ListItem><ListItemText primary="Asset ID" secondary={selectedAsset.assetCode} /></ListItem>
                    <ListItem><ListItemText primary="Serial Number" secondary={selectedAsset.serialNumber || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Item" secondary={selectedAsset.item?.itemName} /></ListItem>
                    <ListItem><ListItemText primary="Brand" secondary={selectedAsset.brand?.name || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Model" secondary={selectedAsset.modelNumber || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Condition" secondary={selectedAsset.condition} /></ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Location & Status</Typography>
                  <Divider sx={{ mb: 1 }} />
                  <List dense>
                    <ListItem><ListItemText primary="Status" secondary={selectedAsset.status} /></ListItem>
                    <ListItem><ListItemText primary="Store" secondary={selectedAsset.currentStore?.name || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Room" secondary={selectedAsset.currentRoom?.name || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Department" secondary={selectedAsset.currentDepartment?.name || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Installation Date" secondary={selectedAsset.installationDate ? formatDateDDMMYYYY(new Date(selectedAsset.installationDate)) : '-'} /></ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Purchase & Warranty</Typography>
                  <Divider sx={{ mb: 1 }} />
                  <List dense>
                    <ListItem><ListItemText primary="Purchase Date" secondary={selectedAsset.purchaseDate ? formatDateDDMMYYYY(new Date(selectedAsset.purchaseDate)) : '-'} /></ListItem>
                    <ListItem><ListItemText primary="Purchase Cost" secondary={`₹${Number(selectedAsset.purchaseCost || 0).toLocaleString()}`} /></ListItem>
                    <ListItem><ListItemText primary="Vendor" secondary={selectedAsset.vendor?.vendorName || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Invoice" secondary={selectedAsset.invoiceNumber || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Warranty End" secondary={selectedAsset.warrantyEnd ? formatDateDDMMYYYY(new Date(selectedAsset.warrantyEnd)) : '-'} /></ListItem>
                    <ListItem><ListItemText primary="AMC End" secondary={selectedAsset.amcEnd ? formatDateDDMMYYYY(new Date(selectedAsset.amcEnd)) : '-'} /></ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Health & Maintenance</Typography>
                  <Divider sx={{ mb: 1 }} />
                  <Box mb={2}>
                    <Typography variant="body2" gutterBottom>Health Score: {selectedAsset.healthScore}%</Typography>
                    <LinearProgress variant="determinate" value={selectedAsset.healthScore}
                      sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': { bgcolor: selectedAsset.healthScore > 70 ? 'success.main' : selectedAsset.healthScore > 40 ? 'warning.main' : 'error.main' } }} />
                  </Box>
                  <List dense>
                    <ListItem><ListItemText primary="Repairs" secondary={`${selectedAsset.repairCount} (Total: ₹${Number(selectedAsset.totalRepairCost || 0).toLocaleString()})`} /></ListItem>
                    <ListItem><ListItemText primary="Expected Life" secondary={`${selectedAsset.expectedLifeYears || 0} years ${selectedAsset.expectedLifeMonths || 0} months`} /></ListItem>
                  </List>
                </Grid>
              </Grid>
            )}

            {profileTab === 1 && (
              <Box>
                {(selectedAsset.timeline || []).length > 0 ? (
                  (selectedAsset.timeline || []).map((event: any) => (
                    <TimelineItem key={event.id} event={event} />
                  ))
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>No timeline events yet.</Typography>
                )}
              </Box>
            )}

            {profileTab === 2 && (
              <Box>
                {(selectedAsset.services || []).length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Engineer</TableCell>
                          <TableCell>Cost</TableCell>
                          <TableCell>Condition</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedAsset.services.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell>{formatDateDDMMYYYY(new Date(s.serviceDate))}</TableCell>
                            <TableCell><Chip size="small" label={s.serviceType} /></TableCell>
                            <TableCell>{s.description || '-'}</TableCell>
                            <TableCell>{s.engineerName || '-'}</TableCell>
                            <TableCell>₹{Number(s.cost).toLocaleString()}</TableCell>
                            <TableCell>{s.conditionAfter || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>No service history yet.</Typography>
                )}
              </Box>
            )}

            {profileTab === 3 && (
              <Box textAlign="center" sx={{ py: 4 }}>
                <Typography variant="h6" gutterBottom>QR Code</Typography>
                <QRCodeSection assetId={selectedAsset.id} assetCode={selectedAsset.assetCode} />
                <Typography variant="body2" color="text.secondary" mt={2}>
                  Scan this QR code to view asset details, location, warranty, and repair history.
                </Typography>
              </Box>
            )}
          </>
        )}
      </EnterpriseDialog>
    </Box>
  );
}

function TimelineItem({ event }: { event: any }) {
  const iconMap: Record<string, React.ReactNode> = {
    PURCHASED: <Inventory2 color="primary" />, RECEIVED: <Inventory2 color="success" />,
    STORED: <LocationOn color="info" />, ISSUED: <LocalShipping color="warning" />,
    TRANSFERRED: <SwapHoriz color="secondary" />, INSTALLED: <Build color="primary" />,
    UNINSTALLED: <RestartAlt color="warning" />, REPAIRED: <Engineering color="success" />,
    DAMAGED: <Warning color="error" />, RETURNED: <AssignmentReturn color="info" />,
    REPLACED: <RestartAlt color="secondary" />, SCRAPPED: <EventBusy color="action" />,
    DISPOSED: <EventBusy color="disabled" />, LOST: <Warning color="error" />,
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
      <Avatar sx={{ bgcolor: 'grey.100', width: 36, height: 36 }}>
        {iconMap[event.eventType] || <History />}
      </Avatar>
      <Box flex={1}>
        <Typography variant="body2" fontWeight={600}>{event.eventType}</Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDateTimeDDMMYYYY(event.eventDate)}
          {event.performedBy && ` by ${event.performedBy}`}
        </Typography>
        {event.remarks && <Typography variant="body2" color="text.secondary">{event.remarks}</Typography>}
      </Box>
    </Box>
  );
}

function QRCodeSection({ assetId, assetCode }: { assetId: number; assetCode: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data: qrResult } = useQuery({
    queryKey: ['assetQR', assetId],
    queryFn: () => window.electronAPI.generateAssetQR(assetId),
    enabled: !!assetId,
  });

  React.useEffect(() => {
    if (qrResult?.qrDataUrl) setQrDataUrl(qrResult.qrDataUrl);
  }, [qrResult]);

  const handlePrint = async () => {
    await window.electronAPI.printAssetQR(assetId);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR-${assetCode}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <Box>
      <Paper sx={{ display: 'inline-block', p: 3, mb: 2, border: '2px dashed #ddd' }}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR for ${assetCode}`} style={{ width: 200, height: 200 }} />
        ) : (
          <Box sx={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading QR...</Typography>
          </Box>
        )}
      </Paper>
      <Box display="flex" justifyContent="center" gap={1}>
        <Button size="small" variant="outlined" startIcon={<QrCode />} onClick={handlePrint}>Print QR</Button>
        <Button size="small" variant="outlined" onClick={handleDownload} disabled={!qrDataUrl}>Download PNG</Button>
        <Tooltip title={assetCode}>
          <Button size="small" variant="outlined" onClick={() => { navigator.clipboard.writeText(assetCode); toast.success('Copied'); }}>Copy Code</Button>
        </Tooltip>
      </Box>
    </Box>
  );
}

function FileUploadButton({ assetId, assetCode, fileType, onUploaded }: {
  assetId: number; assetCode: string; fileType: 'photo' | 'document'; onUploaded: () => void;
}) {
  const queryClient = useQueryClient();

  const handleUpload = async () => {
    const file = await window.electronAPI.selectAssetFile({ type: fileType });
    if (!file) return;
    const subfolder = fileType === 'photo' ? 'photos' : 'documents';
    const saved = await window.electronAPI.copyAssetFileToStorage(file.filePath, assetCode, subfolder);
    if (!saved) return;
    if (fileType === 'photo') {
      await window.electronAPI.addAssetPhoto(assetId, 'PURCHASED', saved.fileName, saved.savedPath, file.fileSize, file.mimeType, '', 'admin');
    } else {
      await window.electronAPI.addAssetDocument(assetId, 'INVOICE', saved.fileName, saved.savedPath, file.fileSize, file.mimeType, '', 'admin');
    }
    toast.success(`${fileType === 'photo' ? 'Photo' : 'Document'} uploaded`);
    onUploaded();
  };

  return (
    <Button size="small" variant="outlined" component="span" startIcon={fileType === 'photo' ? <PhotoCamera /> : <AttachFile />} onClick={handleUpload}>
      Upload {fileType === 'photo' ? 'Photo' : 'Document'}
    </Button>
  );
}
