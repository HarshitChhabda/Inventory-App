import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, TextField, Stack, Tooltip, alpha, useTheme, TableSortLabel,
  Select, MenuItem, FormControl, FormControlLabel, InputLabel, TablePagination, CircularProgress,
  Checkbox, Link, Chip, Grid,
} from '@mui/material';
import { Add, Edit, Delete, Search, Place, OpenInNew, Store as StoreIcon, FilterList, Clear } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ConfirmDialog from '../../../components/ConfirmDialog';
import ImportExportButtons from '../../../components/ImportExportButtons';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import FormSection from '../../../components/FormSection';
import { useDebouncedSearch, useTableSort } from '../../../hooks';
import { TableSkeleton } from '../../../components/LoadingSkeleton';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import { GuideButton } from '../../../components/GuideSystem';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../../components/ImportProgressDialog';
import { PHYSICAL_LOCATION_TYPES, MASTER_LOCATION_TYPES } from '@shared/zod-schemas';

const physicalLocationSchema = z.object({
  storeId: z.number().int().positive('Store is required'),
  locationType: z.enum(['Room', 'Office', 'Hall', 'Workshop', 'StoreArea']),
  name: z.string().min(1, 'Location name is required'),
  parentId: z.number().nullable(),
  isActive: z.boolean(),
});

type LocationFormData = z.infer<typeof physicalLocationSchema>;

interface Location {
  id: number;
  locationType: string;
  name: string;
  parentId: number | null;
  storeId: number;
  isActive: boolean;
  store?: { id: number; name: string; storeType: string } | null;
  parent?: { id: number; name: string; locationType?: string } | null;
  _count?: { rooms: number };
}

const LOCATION_TYPE_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info'> = {
  Room: 'primary',
  Office: 'secondary',
  Hall: 'success',
  Workshop: 'warning',
  StoreArea: 'info',
};

const EXPORT_COLUMNS = [
  { header: 'Type', key: 'locationType' },
  { header: 'Name', key: 'name' },
  { header: 'Store', key: 'storeName' },
  { header: 'Status', key: 'isActive' },
];

const TABLE_COLUMNS = [
  { id: 'locationType', label: 'Type' },
  { id: 'name', label: 'Location Name' },
  { id: 'storeName', label: 'Store' },
  { id: 'parentName', label: 'Parent/Hierarchy' },
  { id: 'isActive', label: 'Status' },
];

const LocationTable = React.memo(function LocationTable({
  locations,
  isLoading,
  theme,
  onEdit,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
  navigate,
}: {
  locations: Location[];
  isLoading: boolean;
  theme: any;
  onEdit: (l: Location) => void;
  onDelete: (l: Location) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  navigate: any;
}) {
  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === 'locationType') { valA = a.locationType; valB = b.locationType; }
      else if (sortBy === 'name') { valA = a.name; valB = b.name; }
      else if (sortBy === 'storeName') {
        valA = a.store?.name || '';
        valB = b.store?.name || '';
      }
      else if (sortBy === 'parentName') {
        valA = a.parent?.name || '';
        valB = b.parent?.name || '';
      }
      else if (sortBy === 'isActive') { valA = a.isActive ? 1 : 0; valB = b.isActive ? 1 : 0; }
      else return 0;
      if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [locations, sortBy, sortOrder]);

  const buildHierarchy = (loc: Location) => {
    const parts: string[] = [];
    if (loc.store) parts.push(loc.store.name);
    if (loc.parent) parts.push(loc.parent.name);
    parts.push(loc.name);
    return parts.join(' → ');
  };

  return (
    <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {TABLE_COLUMNS.map((col) => (
              <TableCell
                key={col.id}
                sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => onSort(col.id)}
              >
                <TableSortLabel active={sortBy === col.id} direction={sortBy === col.id ? sortOrder : 'asc'}>
                  <Typography variant="body2" fontWeight={600}>{col.label}</Typography>
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell align="right">
              <Typography variant="body2" fontWeight={600}>Actions</Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
                <Box sx={{ py: 2 }}>
                  <TableSkeleton rows={5} columns={6} />
                </Box>
              </TableCell>
            </TableRow>
          ) : sortedLocations.map((l) => (
            <TableRow key={l.id} hover>
              <TableCell>
                <Chip
                  label={l.locationType}
                  size="small"
                  color={LOCATION_TYPE_COLORS[l.locationType] || 'default'}
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                />
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Place sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography fontWeight={500}>{l.name}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                {l.store ? (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <StoreIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => navigate(`/enterprise/stores?storeId=${l.store!.id}`)}
                      sx={{ fontWeight: 500, cursor: 'pointer' }}
                    >
                      {l.store.name}
                    </Link>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {buildHierarchy(l)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography color={l.isActive ? 'success.main' : 'text.secondary'} fontWeight={500} fontSize="0.8125rem">
                  {l.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="View Installed Items">
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/enterprise/location-items?locationId=${l.id}`)}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'info.main', bgcolor: alpha(theme.palette.info.main, 0.08) } }}
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={() => onEdit(l)}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={() => onDelete(l)}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && sortedLocations.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState
                  icon={<Place />}
                  title="No physical locations found"
                  description="Define physical locations (rooms, offices, halls, workshops) within your stores"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

const LocationDialog = React.memo(function LocationDialog({
  open, editing, allLocations, stores, onClose, onSaved, saving, loadingAll,
}: {
  open: boolean;
  editing: Location | null;
  allLocations: Location[];
  stores: any[];
  onClose: () => void;
  onSaved: (data: LocationFormData) => void;
  saving: boolean;
  loadingAll: boolean;
}) {
  const { control, register, handleSubmit, reset, watch, formState: { isValid } } = useForm<LocationFormData>({
    resolver: zodResolver(physicalLocationSchema),
    mode: 'onChange',
    defaultValues: { storeId: 0, locationType: 'Room', name: '', parentId: null, isActive: true },
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          storeId: editing.storeId,
          locationType: editing.locationType as any,
          name: editing.name,
          parentId: editing.parentId,
          isActive: editing.isActive,
        });
      } else {
        reset({ storeId: 0, locationType: 'Room', name: '', parentId: null, isActive: true });
      }
    }
  }, [open, editing, reset]);

  const locationType = watch('locationType');
  const selectedStoreId = watch('storeId');

  const parentLocations = useMemo(() => {
    return allLocations.filter((l) => {
      if (editing && l.id === editing.id) return false;
      // Room must have Dharamshala/Store/Department parent (auto-created master records)
      if (locationType === 'Room') {
        return l.locationType === 'Dharamshala' || l.locationType === 'Store' || l.locationType === 'Department';
      }
      // Other physical types can optionally have a parent
      return true;
    }).filter((l) => {
      if (selectedStoreId) return l.storeId === selectedStoreId;
      return true;
    });
  }, [allLocations, editing, locationType, selectedStoreId]);

  return (
    <EnterpriseDialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Location' : 'Add New Location'}
      subtitle={editing ? `Update details for ${editing.name}` : 'Create a new physical location'}
      icon={<Place />}
      maxWidth="sm"
      loading={saving}
      actions={
        <>
          <Button onClick={onClose} sx={{ fontWeight: 500 }}>Cancel</Button>
          <Button type="submit" form="location-form" variant="contained" disabled={!isValid || saving} sx={{ fontWeight: 600 }}>
            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSaved)} id="location-form">
        <FormSection title="Location Details" divider={false}>
          <Stack spacing={2.5}>
            <Controller
              name="storeId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small" required>
                  <InputLabel>Store *</InputLabel>
                  <Select
                    value={field.value || ''}
                    label="Store *"
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                  >
                    <MenuItem value="">
                      <em>Select a store</em>
                    </MenuItem>
                    {stores.map((s: any) => (
                      <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="locationType"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small" required>
                  <InputLabel>Location Type *</InputLabel>
                  <Select {...field} label="Location Type *">
                    {PHYSICAL_LOCATION_TYPES.map((t: string) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <TextField label="Location Name" {...register('name')} fullWidth required autoFocus size="small" />
            <Controller
              name="parentId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>{locationType === 'Room' ? 'Parent Location *' : 'Parent Location (Optional)'}</InputLabel>
                  {loadingAll ? (
                    <TextField placeholder="Loading locations..." InputProps={{ readOnly: true, startAdornment: <CircularProgress size={16} sx={{ mr: 1 }} /> }} size="small" />
                  ) : (
                    <Select
                      value={field.value !== null ? String(field.value) : ''}
                      label={locationType === 'Room' ? 'Parent Location *' : 'Parent Location (Optional)'}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    >
                      <MenuItem value="">None</MenuItem>
                      {parentLocations.map((l) => (
                        <MenuItem key={l.id} value={String(l.id)}>
                          {l.locationType} - {l.name}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </FormControl>
              )}
            />
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Active"
                />
              )}
            />
          </Stack>
        </FormSection>
      </form>
    </EnterpriseDialog>
  );
});

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { company } = useCompany();
  const { search, setSearch, debouncedSearch } = useDebouncedSearch();
  const { sortBy, sortOrder, handleSort } = useTableSort('locationType');

  const initialStoreId = searchParams.get('storeId') ? Number(searchParams.get('storeId')) : 0;
  const [filterStoreId, setFilterStoreId] = useState<number>(initialStoreId);
  const [filterType, setFilterType] = useState<string>('');

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.listStores(company!.id),
    enabled: !!company?.id,
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);

  const [exportData, setExportData] = useState<Location[]>([]);
  const fetchExportRef = useRef(false);

  const fetchExportData = useCallback(async () => {
    if (fetchExportRef.current || exportData.length > 0) return;
    fetchExportRef.current = true;
    try {
      const all = await window.electronAPI.dbQuery('location', 'findMany', {
        where: { locationType: { in: PHYSICAL_LOCATION_TYPES } },
        orderBy: { name: 'asc' },
        include: { store: { select: { id: true, name: true } } },
      });
      setExportData(all);
    } catch {
      fetchExportRef.current = false;
    }
  }, [exportData.length]);

  const getExportData = useCallback(
    () => exportData.map((l) => ({
      locationType: l.locationType,
      name: l.name,
      storeName: l.store?.name || '',
      isActive: l.isActive ? 'Yes' : 'No',
    })),
    [exportData]
  );

  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const fetchAllRef = useRef(false);

  const fetchAllLocations = useCallback(async () => {
    if (fetchAllRef.current || allLocations.length > 0) return;
    fetchAllRef.current = true;
    setLoadingAll(true);
    try {
      // Fetch ALL location types - physical types for display, master types for parent dropdown
      const all = await window.electronAPI.dbQuery('location', 'findMany', {
        orderBy: { name: 'asc' },
        include: { store: { select: { id: true, name: true, storeType: true } } },
      });
      setAllLocations(all);
    } finally {
      setLoadingAll(false);
    }
  }, [allLocations.length]);

  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImportLocations = async (rows: any[]) => {
    const total = rows.length;
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const locationName = row['Name'] || row['locationName'] || '';
          const locationType = row['Type'] || row['locationType'] || 'Room';
          const storeName = row['Store'] || row['storeName'] || '';
          const parentName = row['Parent'] || row['parentName'] || '';
          if (!locationName) { skipped++; errors.push(`Row ${i + 1}: Missing name`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }

          if (!PHYSICAL_LOCATION_TYPES.includes(locationType as any)) {
            skipped++;
            errors.push(`Row ${i + 1} (${locationName}): Invalid type "${locationType}"`);
            setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors }));
            continue;
          }

          let storeId = 0;
          if (storeName) {
            const store = await window.electronAPI.dbQuery('store', 'findFirst', { where: { name: storeName } });
            if (store) storeId = store.id;
          }
          if (!storeId) { skipped++; errors.push(`Row ${i + 1} (${locationName}): Store "${storeName}" not found`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }

          let parentId = null;
          if (parentName) {
            const parentLoc = await window.electronAPI.dbQuery('location', 'findFirst', {
              where: { name: parentName, storeId, isActive: true },
            });
            if (parentLoc) parentId = parentLoc.id;
          } else if (locationType === 'Room') {
            const existingParent = await window.electronAPI.dbQuery('location', 'findFirst', {
              where: { storeId, locationType: { in: MASTER_LOCATION_TYPES as any }, isActive: true },
            });
            if (existingParent) {
              parentId = existingParent.id;
            } else {
              const store = await window.electronAPI.dbQuery('store', 'findUnique', { where: { id: storeId } });
              const parentLoc = await window.electronAPI.createLocation({
                storeId, locationType: 'Store', name: store?.name || `Store ${storeId}`, parentId: null, isActive: true,
              });
              parentId = parentLoc?.id;
            }
          }

          const payload = { storeId, locationType, name: locationName, parentId, isActive: (row['Active'] || row['isActive'] || 'Yes') !== 'No' };

          const existing = await window.electronAPI.dbQuery('location', 'findFirst', { where: { name: locationName, storeId } });
          if (existing) {
            await window.electronAPI.updateLocation(existing.id, payload);
            updated++;
          } else {
            await window.electronAPI.createLocation(payload);
            created++;
          }
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1, created, updated, skipped, errors }));
      }
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error('Import failed: ' + err.message);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['locations', debouncedSearch, page, rowsPerPage, sortBy, sortOrder, filterStoreId, filterType],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = {
        locationType: { in: PHYSICAL_LOCATION_TYPES },
      };

      if (filterStoreId) where.storeId = filterStoreId;
      if (filterType) where.locationType = filterType;

      if (debouncedSearch) {
        where.OR = [
          { name: { contains: debouncedSearch } },
          { store: { name: { contains: debouncedSearch } } },
          { locationType: { contains: debouncedSearch } },
        ];
      }

      let orderBy: any = {};
      if (sortBy === 'locationType') orderBy = { locationType: sortOrder };
      else if (sortBy === 'name') orderBy = { name: sortOrder };
      else if (sortBy === 'isActive') orderBy = { isActive: sortOrder };
      else if (sortBy === 'storeName') orderBy = { store: { name: sortOrder } };
      else if (sortBy === 'parentName') orderBy = { parent: { name: sortOrder } };
      else orderBy = { [sortBy]: sortOrder };

      const [locs, total] = await Promise.all([
        api.dbQuery('location', 'findMany', {
          where,
          skip: page * rowsPerPage,
          take: rowsPerPage,
          orderBy,
          include: {
            store: { select: { id: true, name: true, storeType: true } },
            parent: { select: { id: true, name: true, locationType: true } },
          },
        }),
        api.dbQuery('location', 'count', { where }),
      ]);
      return { locs, total };
    },
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: LocationFormData) => {
      if (editing) return window.electronAPI.updateLocation(editing.id, formData);
      return window.electronAPI.createLocation(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setDialogOpen(false);
      setEditing(null);
      fetchAllRef.current = false;
      setAllLocations([]);
      toast.success(editing ? 'Location updated' : 'Location created');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to save location'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const checks = [
        { model: 'location', field: 'parentId', msg: 'it has child locations' },
        { model: 'ledgerEntry', field: 'locationId', msg: 'it has ledger entries' },
        { model: 'transactionHeader', field: 'fromLocationId', msg: 'it is used in transactions' },
        { model: 'room', field: 'locationId', msg: 'it has rooms' },
        { model: 'assetProfile', field: 'currentLocationId', msg: 'it has assets' },
      ];
      for (const check of checks) {
        const count = await api.dbQuery(check.model, 'count', { where: { [check.field]: id } });
        if (count > 0) throw new Error(`Cannot delete location: ${check.msg}. Deactivate instead.`);
      }
      return api.deleteLocation(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setDeleteDialogOpen(false);
      setDeleting(null);
      fetchAllRef.current = false;
      setAllLocations([]);
      toast.success('Location deleted');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete location'));
    },
  });

  const handleEdit = useCallback((l: Location) => {
    setEditing(l);
    setDialogOpen(true);
    fetchAllLocations();
  }, [fetchAllLocations]);

  const handleAdd = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
    fetchAllLocations();
  }, [fetchAllLocations]);

  const handleFilterStoreChange = useCallback((value: number) => {
    setFilterStoreId(value);
    setPage(0);
    if (value) {
      searchParams.set('storeId', String(value));
    } else {
      searchParams.delete('storeId');
    }
    setSearchParams(searchParams);
  }, [searchParams, setSearchParams]);

  const handleFilterTypeChange = useCallback((value: string) => {
    setFilterType(value);
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilterStoreId(0);
    setFilterType('');
    setSearch('');
    setPage(0);
    searchParams.delete('storeId');
    setSearchParams(searchParams);
  }, [search, searchParams, setSearchParams]);

  const hasActiveFilters = filterStoreId || filterType || debouncedSearch;

  return (
    <Box>
      <PageHeader
        title="Locations"
        subtitle="Manage physical locations (rooms, offices, halls, workshops) within stores"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="locations" />
            <ImportExportButtons
              data={getExportData()}
              columns={EXPORT_COLUMNS}
              fileName="locations"
              onImport={handleImportLocations}
              onExportOpen={fetchExportData}
              showExport={exportData.length > 0}
              importColumns={['Type', 'Name', 'Store', 'Parent', 'Active']}
            />
            <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>Add Location</Button>
          </Stack>
        }
      />

      {/* Filters */}
      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search by name, store, or type..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Store</InputLabel>
              <Select
                value={filterStoreId || ''}
                label="Store"
                onChange={(e) => handleFilterStoreChange(Number(e.target.value))}
              >
                <MenuItem value={0}>All Stores</MenuItem>
                {stores.map((s: any) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={(e) => handleFilterTypeChange(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                {PHYSICAL_LOCATION_TYPES.map((t: string) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            {hasActiveFilters && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Clear />}
                onClick={clearFilters}
                size="small"
              >
                Clear Filters
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      <LocationTable
        locations={data?.locs || []}
        isLoading={isLoading}
        theme={theme}
        onEdit={handleEdit}
        onDelete={(l) => { setDeleting(l); setDeleteDialogOpen(true); }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        navigate={navigate}
      />

      <TablePagination
        component="div"
        count={data?.total || 0}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
      />

      <LocationDialog
        open={dialogOpen}
        editing={editing}
        allLocations={allLocations}
        stores={stores}
        onClose={() => setDialogOpen(false)}
        onSaved={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
        loadingAll={loadingAll}
      />

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="locations" />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Location"
        message={`Are you sure you want to delete "${deleting?.name}"? This will fail if the location has child locations, transactions, ledger entries, rooms, or assets.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => { setDeleteDialogOpen(false); setDeleting(null); }}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
