import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Stack, Tooltip, alpha, useTheme, TableSortLabel,
  Select, MenuItem, FormControl, InputLabel, TablePagination, CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, Search, Place } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import toast from 'react-hot-toast';

const LOCATION_TYPES = ['Room', 'Dharamshala', 'Store', 'Department'];

const LocationTable = React.memo(function LocationTable({
  locations,
  theme,
  onEdit,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}: {
  locations: any[];
  theme: any;
  onEdit: (l: any) => void;
  onDelete: (l: any) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const parentMap = useMemo(() => {
    const map = new Map<number, string>();
    locations.forEach((l: any) => map.set(l.id, l.locationName));
    return map;
  }, [locations]);

  const columns = useMemo(() => [
    { id: 'locationType', label: 'Type' },
    { id: 'locationName', label: 'Name' },
    { id: 'parentName', label: 'Parent' },
    { id: 'isActive', label: 'Status' },
  ], []);

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a: any, b: any) => {
      let valA: any, valB: any;
      if (sortBy === 'locationType') { valA = a.locationType; valB = b.locationType; }
      else if (sortBy === 'locationName') { valA = a.locationName; valB = b.locationName; }
      else if (sortBy === 'parentName') {
        valA = parentMap.get(a.parentId) || '';
        valB = parentMap.get(b.parentId) || '';
      }
      else if (sortBy === 'isActive') { valA = a.isActive ? 1 : 0; valB = b.isActive ? 1 : 0; }
      else return 0;
      if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [locations, sortBy, sortOrder, parentMap]);

  return (
    <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.id} sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => onSort(col.id)}>
                <TableSortLabel active={sortBy === col.id} direction={sortBy === col.id ? sortOrder : 'asc'}>
                  <Typography variant="body2" fontWeight={600}>{col.label}</Typography>
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Actions</Typography></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedLocations.map((l: any) => (
            <TableRow key={l.id} hover>
              <TableCell>
                <Box sx={{ display: 'inline-flex', px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha(theme.palette.info.main, 0.08), color: 'info.main', fontWeight: 600, fontSize: '0.75rem' }}>
                  {l.locationType}
                </Box>
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Place sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography fontWeight={500}>{l.locationName}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {parentMap.get(l.parentId) || '-'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography color={l.isActive ? 'success.main' : 'text.secondary'} fontWeight={500} fontSize="0.8125rem">
                  {l.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => onEdit(l)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={() => onDelete(l)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {sortedLocations.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState icon={<Place />} title="No locations found" description="Define storage and installation locations" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

const LocationDialog = React.memo(function LocationDialog({
  open, editing, formData, allLocations, onFormChange, onClose, onSave, saving, loadingAll,
}: {
  open: boolean; editing: any; formData: { locationType: string; locationName: string; parentId: number | null };
  allLocations: any[]; onFormChange: (data: { locationType: string; locationName: string; parentId: number | null }) => void;
  onClose: () => void; onSave: () => void; saving: boolean; loadingAll: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { width: '100%', maxWidth: 520 } }}>
      <DialogTitle>{editing ? 'Edit Location' : 'Add New Location'}</DialogTitle>
      <DialogContent sx={{ minHeight: 180 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Location Type</InputLabel>
            <Select value={formData.locationType} label="Location Type" onChange={(e) => onFormChange({ ...formData, locationType: e.target.value })}>
              {LOCATION_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Location Name" value={formData.locationName} onChange={(e) => onFormChange({ ...formData, locationName: e.target.value })} fullWidth required autoFocus size="small" />
          <FormControl fullWidth size="small">
            <InputLabel>{formData.locationType === 'Room' ? 'Parent (Dharamshala/Store) *' : 'Parent Location (Optional)'}</InputLabel>
            {loadingAll ? (
              <TextField placeholder="Loading locations..." InputProps={{ readOnly: true, startAdornment: <CircularProgress size={16} sx={{ mr: 1 }} /> }} size="small" />
            ) : (
              <Select value={formData.parentId !== null ? String(formData.parentId) : ''} label={formData.locationType === 'Room' ? 'Parent (Dharamshala/Store/Department) *' : 'Parent Location (Optional)'} onChange={(e) => onFormChange({ ...formData, parentId: e.target.value ? Number(e.target.value) : null })}>
                <MenuItem value="">None</MenuItem>
                {allLocations?.filter((l: any) => {
                  if (l.id === editing?.id) return false;
                  // Room can be under Dharamshala, Store, or Department
                  if (formData.locationType === 'Room') {
                    return l.locationType === 'Dharamshala' || l.locationType === 'Store' || l.locationType === 'Department';
                  }
                  // Dharamshala/Store/Department has no parent
                  return true;
                }).map((l: any) => (
                  <MenuItem key={l.id} value={String(l.id)}>{l.locationType} - {l.locationName}</MenuItem>
                ))}
              </Select>
            )}
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={!formData.locationName || saving}>{editing ? 'Update' : 'Create'}</Button>
      </DialogActions>
    </Dialog>
  );
});

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ locationType: 'Room', locationName: '', parentId: null as number | null });
  const [sortBy, setSortBy] = useState('locationType');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<any>(null);

  const exportColumns = useMemo(() => [
    { header: 'Type', key: 'locationType' },
    { header: 'Name', key: 'locationName' },
    { header: 'Active', key: 'isActive' },
  ], []);

  const [exportData, setExportData] = useState<any[]>([]);
  const fetchExportRef = useRef(false);

  const fetchExportData = useCallback(async () => {
    if (fetchExportRef.current || exportData.length > 0) return;
    fetchExportRef.current = true;
    try {
      const all = await window.electronAPI.dbQuery('location', 'findMany', { orderBy: { locationName: 'asc' } });
      setExportData(all);
    } catch { fetchExportRef.current = false; }
  }, [exportData.length]);

  const getExportData = useCallback(() => exportData.map((l: any) => ({
    locationType: l.locationType, locationName: l.locationName, isActive: l.isActive ? 'Yes' : 'No',
  })), [exportData]);

  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const fetchAllRef = useRef(false);

  const fetchAllLocations = useCallback(async () => {
    if (fetchAllRef.current || allLocations.length > 0) return;
    fetchAllRef.current = true;
    setLoadingAll(true);
    try {
      const all = await window.electronAPI.dbQuery('location', 'findMany', { orderBy: { locationName: 'asc' } });
      setAllLocations(all);
    } finally { setLoadingAll(false); }
  }, [allLocations.length]);

  const handleImportLocations = async (rows: any[]) => {
    try {
      let created = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        const locationName = row['Name'] || row['locationName'] || '';
        const locationType = row['Type'] || row['locationType'] || 'Room';
        if (!locationName) { skipped++; continue; }
        const payload = { locationType, locationName, isActive: (row['Active'] || row['isActive'] || 'Yes') !== 'No' };
        const existing = await window.electronAPI.dbQuery('location', 'findFirst', { where: { locationName } });
        if (existing) { await window.electronAPI.updateLocation(existing.id, payload); updated++; }
        else { await window.electronAPI.createLocation(payload); created++; }
      }
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data } = useQuery({
    queryKey: ['locations', debouncedSearch, page, rowsPerPage, sortBy, sortOrder],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = {};
      if (debouncedSearch) where.locationName = { contains: debouncedSearch };
      let orderBy: any = {};
      if (sortBy === 'locationType') orderBy = { locationType: sortOrder };
      else if (sortBy === 'locationName') orderBy = { locationName: sortOrder };
      else if (sortBy === 'isActive') orderBy = { isActive: sortOrder };
      else orderBy = { [sortBy]: sortOrder };
      const [locs, total] = await Promise.all([
        api.dbQuery('location', 'findMany', { where, skip: page * rowsPerPage, take: rowsPerPage, orderBy }),
        api.dbQuery('location', 'count', { where }),
      ]);
      return { locs, total };
    },
    placeholderData: keepPreviousData,
  });

  const handleSort = useCallback((field: string) => {
    setSortOrder((prev) => sortBy === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortBy(field);
    setPage(0);
  }, [sortBy]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const api = window.electronAPI;
      if (editing) return api.updateLocation(editing.id, data);
      return api.createLocation(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setDialogOpen(false); setEditing(null); setFormData({ locationType: 'Room', locationName: '', parentId: null });
      fetchAllRef.current = false; setAllLocations([]);
    },
  });

  const handleEdit = useCallback((l: any) => { setEditing(l); setFormData({ locationType: l.locationType, locationName: l.locationName, parentId: l.parentId }); setDialogOpen(true); fetchAllLocations(); }, [fetchAllLocations]);
  const handleAdd = useCallback(() => { setEditing(null); setFormData({ locationType: 'Room', locationName: '', parentId: null }); setDialogOpen(true); fetchAllLocations(); }, [fetchAllLocations]);
  const handleDelete = useCallback((l: any) => { setDeletingLocation(l); setDeleteDialogOpen(true); }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const childCount = await api.dbQuery('location', 'count', { where: { parentId: id } });
      if (childCount > 0) {
        throw new Error('Cannot delete location: it has child locations. Move or delete them first.');
      }
      const txnCount = await api.dbQuery('stockTransaction', 'count', { where: { locationId: id } });
      if (txnCount > 0) {
        throw new Error('Cannot delete location: it has stock transactions associated with it.');
      }
      const assetCount = await api.dbQuery('assetInstallation', 'count', { where: { locationId: id } });
      if (assetCount > 0) {
        throw new Error('Cannot delete location: it has asset installations. Remove them first.');
      }
      return api.deleteLocation(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setDeleteDialogOpen(false); setDeletingLocation(null);
      fetchAllRef.current = false; setAllLocations([]);
    },
    onError: (error: any) => { toast.error(error.message || 'Failed to delete location'); },
  });

  return (
    <Box>
      <PageHeader
        title="Locations"
        subtitle="Manage storage and installation locations"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons data={getExportData()} columns={exportColumns} fileName="locations" onImport={handleImportLocations} onExportOpen={fetchExportData} showExport={exportData.length > 0} />
            <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>Add Location</Button>
          </Stack>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField fullWidth placeholder="Search locations..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} variant="outlined" size="small" />
      </Paper>

      <LocationTable locations={data?.locs || []} theme={theme} onEdit={handleEdit} onDelete={handleDelete} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />

      <TablePagination component="div" count={data?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <LocationDialog open={dialogOpen} editing={editing} formData={formData} allLocations={allLocations} onFormChange={setFormData} onClose={() => setDialogOpen(false)} onSave={() => saveMutation.mutate(formData)} saving={saveMutation.isPending} loadingAll={loadingAll} />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete "<strong>{deletingLocation?.locationName}</strong>"?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deletingLocation && deleteMutation.mutate(deletingLocation.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
