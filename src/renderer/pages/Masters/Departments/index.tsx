import React, { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, TextField, TablePagination, Stack, Tooltip, alpha, useTheme,
  FormControl, InputLabel, Select, MenuItem, Chip, Divider, Alert, TableSortLabel,
  CircularProgress, Link,
} from '@mui/material';
import { Add, Edit, Delete, Search, Apartment, Store, HomeWork, AddCircle, Check, BusinessCenter, CheckCircle, Cancel, OpenInNew, LocationOn } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
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

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().optional(),
  departmentType: z.enum(['Dharamshala', 'Store', 'Department']),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface Department {
  id: number;
  name: string;
  code: string | null;
  departmentType: string;
  isActive: boolean;
  companyId: number;
}

const PREDEFINED_STORES = [
  { name: 'Bijli Store', code: 'BS', departmentType: 'Store' },
  { name: 'Imarat Store', code: 'IS', departmentType: 'Store' },
  { name: 'Journal Store', code: 'JS', departmentType: 'Store' },
];

const PREDEFINED_DHARAMSHALAS = [
  { name: 'Lala Umrao Singh Jain', code: 'LUSJ', departmentType: 'Dharamshala' },
  { name: 'Shri Digambar Jain Atishay Kshetra', code: 'SDJAK', departmentType: 'Dharamshala' },
  { name: 'Ativeer Atithi Griha', code: 'AAG', departmentType: 'Dharamshala' },
  { name: 'Ativeer Guest House', code: 'AGH', departmentType: 'Dharamshala' },
  { name: 'Katla North Wing', code: 'KUW', departmentType: 'Dharamshala' },
  { name: 'Katla Chandni', code: 'KC', departmentType: 'Dharamshala' },
  { name: 'Katla South Wing', code: 'KDW', departmentType: 'Dharamshala' },
  { name: 'Katla West Wing', code: 'KPW', departmentType: 'Dharamshala' },
  { name: 'Katla East Wing', code: 'KPVW', departmentType: 'Dharamshala' },
  { name: 'Katla Rathkhana', code: 'KR', departmentType: 'Dharamshala' },
  { name: 'Kund Kund Nilaya', code: 'KKN', departmentType: 'Dharamshala' },
  { name: 'Charan Chinh', code: 'CC', departmentType: 'Dharamshala' },
  { name: 'Bazaar B Block', code: 'BBB', departmentType: 'Dharamshala' },
  { name: 'Rashtrapati Bhavan', code: 'RB', departmentType: 'Dharamshala' },
  { name: 'Vardhman', code: 'V', departmentType: 'Dharamshala' },
  { name: 'Vardhman Guest House', code: 'VGH', departmentType: 'Dharamshala' },
  { name: 'Vaishali Yatri Niwas', code: 'VYN', departmentType: 'Dharamshala' },
  { name: 'Sanmati', code: 'SM', departmentType: 'Dharamshala' },
  { name: 'Mandir', code: 'M', departmentType: 'Dharamshala' },
  { name: 'Dharamshala', code: 'DH', departmentType: 'Dharamshala' },
  { name: 'Bhojanashala', code: 'BH', departmentType: 'Dharamshala' },
  { name: 'Jal Plant', code: 'JP', departmentType: 'Dharamshala' },
];

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Code', key: 'code' },
  { header: 'Type', key: 'departmentType' },
  { header: 'Active', key: 'isActive' },
];

const TABLE_COLUMNS = [
  { id: 'name', label: 'Name' },
  { id: 'departmentType', label: 'Type' },
  { id: 'code', label: 'Code' },
  { id: 'linkedStore', label: 'Linked Store' },
  { id: 'isActive', label: 'Status' },
];

const typeColor = (t: string) => {
  switch (t) {
    case 'Store': return 'primary';
    case 'Dharamshala': return 'secondary';
    case 'Department': return 'success';
    default: return 'default';
  }
};

const DeptIcon = ({ type, sx }: { type: string; sx?: any }) => {
  switch (type) {
    case 'Dharamshala': return <HomeWork sx={{ fontSize: 16, color: 'secondary.main', ...sx }} />;
    case 'Department': return <BusinessCenter sx={{ fontSize: 16, color: 'success.main', ...sx }} />;
    default: return <Store sx={{ fontSize: 16, color: 'primary.main', ...sx }} />;
  }
};

export default function DepartmentsPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const navigate = useNavigate();
  const { search, setSearch, debouncedSearch } = useDebouncedSearch();
  const { sortBy, sortOrder, handleSort } = useTableSort('name');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    mode: 'onChange',
    defaultValues: { name: '', code: '', departmentType: 'Store' },
  });

  const [allNames, setAllNames] = useState<Set<string>>(new Set());
  const [allNamesLoading, setAllNamesLoading] = useState(false);

  const fetchAllNames = useCallback(async () => {
    if (allNames.size > 0) return;
    setAllNamesLoading(true);
    try {
      const all = await window.electronAPI.dbQuery('department', 'findMany', {
        where: { companyId: company!.id },
        select: { name: true },
      }) as any[];
      setAllNames(new Set(all.map((d: any) => d.name)));
    } finally {
      setAllNamesLoading(false);
    }
  }, [company?.id, allNames.size]);

  const [exportData, setExportData] = useState<any[]>([]);
  const fetchExportRef = React.useRef(false);

  const fetchExportData = useCallback(async () => {
    if (fetchExportRef.current || exportData.length > 0) return;
    fetchExportRef.current = true;
    try {
      const all = await window.electronAPI.dbQuery('department', 'findMany', {
        where: { companyId: company!.id },
        orderBy: { name: 'asc' },
      });
      setExportData(all);
    } catch {
      fetchExportRef.current = false;
    }
  }, [company?.id, exportData.length]);

  const getExportData = useCallback(
    () => exportData.map((d: any) => ({
      name: d.name,
      code: d.code,
      departmentType: d.departmentType || 'Store',
      isActive: d.isActive ? 'Yes' : 'No',
    })),
    [exportData]
  );

  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImportDepartments = async (rows: any[]) => {
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
          const payload = {
            name,
            code: row['Code'] || row['code'] || '',
            departmentType: row['Type'] || row['departmentType'] || 'Store',
            companyId: company!.id,
            isActive: (row['Active'] || row['isActive'] || 'Yes') !== 'No',
          };
          const existing = await window.electronAPI.dbQuery('department', 'findFirst', { where: { name, companyId: company!.id } });
          if (existing) {
            await window.electronAPI.updateDepartment(existing.id, payload);
            updated++;
          } else {
            await window.electronAPI.createDepartment(payload);
            created++;
          }
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1, created, updated, skipped, errors }));
      }
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error('Import failed: ' + err.message);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['departments', company?.id, page, rowsPerPage, debouncedSearch, sortBy, sortOrder],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = { companyId: company!.id };
      if (debouncedSearch) {
        where.OR = [
          { name: { contains: debouncedSearch } },
          { code: { contains: debouncedSearch } },
        ];
      }
      const orderBy = sortBy === 'departmentType'
        ? { departmentType: sortOrder }
        : sortBy === 'linkedStore'
        ? { name: sortOrder }
        : { [sortBy]: sortOrder };
      const [depts, total] = await Promise.all([
        api.dbQuery('department', 'findMany', { where, skip: page * rowsPerPage, take: rowsPerPage, orderBy }),
        api.dbQuery('department', 'count', { where }),
      ]);

      // Fetch linked stores for these departments
      const deptIds = depts.map((d: any) => d.id);
      const linkedStores = deptIds.length > 0
        ? await api.dbQuery('store', 'findMany', {
            where: { companyId: company!.id, departmentId: { in: deptIds } },
            select: { id: true, name: true, departmentId: true, storeType: true },
          })
        : [];
      const storeMap = new Map(linkedStores.map((s: any) => [s.departmentId, s]));

      // Fetch location counts for linked stores
      const storeIds = linkedStores.map((s: any) => s.id);
      const locationCounts = storeIds.length > 0
        ? await api.dbQuery('location', 'groupBy', {
            by: ['storeId'],
            where: { storeId: { in: storeIds }, locationType: { in: ['Room', 'Office', 'Hall', 'Workshop', 'StoreArea'] } },
            _count: { id: true },
          })
        : [];
      const locationCountMap = new Map(locationCounts.map((lc: any) => [lc.storeId, lc._count.id]));

      const deptsWithStores = depts.map((d: any) => {
        const store = storeMap.get(d.id) as any;
        return {
          ...d,
          linkedStore: store ? { ...store, locationCount: locationCountMap.get(store.id) || 0 } : null,
        };
      });

      return { depts: deptsWithStores, total };
    },
    enabled: !!company?.id,
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: DepartmentFormData) => {
      const payload = { ...formData, companyId: company!.id };
      if (editing) return window.electronAPI.updateDepartment(editing.id, payload);
      return window.electronAPI.createDepartment(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDialogOpen(false);
      setEditing(null);
      reset({ name: '', code: '', departmentType: 'Store' });
      toast.success(editing ? 'Department updated' : 'Department created');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to save department'));
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (departments: Array<{ name: string; code: string; departmentType: string }>) => {
      const api = window.electronAPI;
      const toCreate = departments.filter(d => !allNames.has(d.name));
      for (const dept of toCreate) {
        await api.createDepartment({ ...dept, companyId: company!.id });
      }
      return toCreate.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setQuickAddOpen(false);
      setAllNames(new Set());
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to create departments'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const txCount = await api.dbQuery('transactionHeader', 'count', { where: { departmentId: id } });
      if (txCount > 0) throw new Error('Cannot delete department: it is used in transactions. Deactivate instead.');
      return api.deleteDepartment(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeleteDialogOpen(false);
      setDeleting(null);
      toast.success('Department deleted');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete department'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.toggleDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department status updated');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to toggle department'));
    },
  });

  const handleEdit = useCallback((dept: Department) => {
    setEditing(dept);
    reset({ name: dept.name, code: dept.code || '', departmentType: (dept.departmentType as any) || 'Store' });
    setDialogOpen(true);
  }, [reset]);

  const handleAdd = useCallback(() => {
    setEditing(null);
    reset({ name: '', code: '', departmentType: 'Store' });
    setDialogOpen(true);
  }, [reset]);

  const allPredefined = useMemo(() => [...PREDEFINED_STORES, ...PREDEFINED_DHARAMSHALAS], []);
  const allMissing = useMemo(() => allPredefined.filter(d => !allNames.has(d.name)), [allPredefined, allNames]);

  return (
    <Box>
      <PageHeader
        title="Departments & Dharamshalas"
        subtitle="Manage stores (Bijli, Imarat, Journal) and Dharamshalas"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="departments" />
            <ImportExportButtons
              data={getExportData()}
              columns={EXPORT_COLUMNS}
              fileName="departments"
              onImport={handleImportDepartments}
              onExportOpen={fetchExportData}
              showExport={exportData.length > 0}
            />
            <Button variant="outlined" startIcon={<AddCircle />} onClick={() => { setQuickAddOpen(true); fetchAllNames(); }}>
              Quick Add All
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>
              Add Custom
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          placeholder="Search departments..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          variant="outlined"
          size="small"
        />
      </Paper>

      <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {TABLE_COLUMNS.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => handleSort(col.id)}
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
            ) : data?.depts?.map((d: any) => (
              <TableRow key={d.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 1.5,
                      bgcolor: alpha(
                        theme.palette[d.departmentType === 'Dharamshala' ? 'secondary' : d.departmentType === 'Department' ? 'success' : 'primary'].main,
                        0.08
                      ),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <DeptIcon type={d.departmentType || 'Store'} />
                    </Box>
                    <Typography fontWeight={500}>{d.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={d.departmentType || 'Store'} size="small" color={typeColor(d.departmentType || 'Store') as any} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.code}</Typography>
                </TableCell>
                <TableCell>
                  {d.linkedStore ? (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Link
                        component="button"
                        variant="body2"
                        onClick={() => navigate(`/enterprise/stores?storeId=${d.linkedStore.id}`)}
                        sx={{ fontWeight: 500, cursor: 'pointer' }}
                      >
                        {d.linkedStore.name}
                      </Link>
                      {d.linkedStore.locationCount > 0 && (
                        <Tooltip title={`${d.linkedStore.locationCount} physical locations`}>
                          <Chip
                            label={`${d.linkedStore.locationCount} loc`}
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/masters/locations?storeId=${d.linkedStore.id}`)}
                            sx={{ height: 20, fontSize: '0.7rem', cursor: 'pointer' }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography color={d.isActive ? 'success.main' : 'text.secondary'} fontWeight={500} fontSize="0.8125rem">
                    {d.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={d.isActive ? 'Disable' : 'Enable'}>
                    <IconButton
                      size="small"
                      onClick={() => toggleMutation.mutate(d.id)}
                      sx={{ color: d.isActive ? 'success.main' : 'text.secondary', '&:hover': { bgcolor: alpha(d.isActive ? '#22c55e' : '#94a3b8', 0.08) } }}
                    >
                      {d.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(d)}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => { setDeleting(d); setDeleteDialogOpen(true); }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (!data?.depts || data.depts.length === 0) && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={<Apartment />} title="No departments found" description="Click 'Quick Add All' to add predefined stores and dharamshalas" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={data?.total || 0}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
      />

      {/* Add/Edit Dialog */}
      <EnterpriseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit Department' : 'Add New Department'}
        subtitle={editing ? `Update details for ${editing.name}` : 'Create a new department or store'}
        icon={<Apartment />}
        maxWidth="sm"
        loading={saveMutation.isPending}
        actions={
          <>
            <Button onClick={() => setDialogOpen(false)} sx={{ fontWeight: 500 }}>Cancel</Button>
            <Button type="submit" form="department-form" variant="contained" disabled={!isValid || saveMutation.isPending} sx={{ fontWeight: 600 }}>
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} id="department-form">
          <FormSection title="Department Details" divider={false}>
            <Stack spacing={2.5}>
              <Controller
                name="departmentType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Department Type</InputLabel>
                    <Select {...field} label="Department Type">
                      <MenuItem value="Store">Store (Stores)</MenuItem>
                      <MenuItem value="Dharamshala">Dharamshala</MenuItem>
                      <MenuItem value="Department">Department</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
              <TextField
                label="Department Name"
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
                fullWidth
                size="small"
              />
              <TextField
                label="Code"
                {...register('code')}
                error={!!errors.code}
                helperText={errors.code?.message}
                fullWidth
                size="small"
              />
            </Stack>
          </FormSection>
        </form>
      </EnterpriseDialog>

      {/* Quick Add Dialog */}
      <EnterpriseDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Quick Add Predefined Departments"
        subtitle="Select which departments to add. Already existing ones will be skipped."
        icon={<AddCircle />}
        maxWidth="md"
        actions={
          <>
            <Button onClick={() => setQuickAddOpen(false)} sx={{ fontWeight: 500 }}>Close</Button>
            <Button
              variant="contained"
              onClick={() => bulkCreateMutation.mutate(allMissing)}
              disabled={allNames.size === 0 || allMissing.length === 0}
              sx={{ fontWeight: 600 }}
            >
              Add All Missing
            </Button>
          </>
        }
      >
          {allNamesLoading ? (
            <Stack alignItems="center" py={3}><CircularProgress size={24} /></Stack>
          ) : (
            <>
              <Typography variant="subtitle1" fontWeight={700} mt={1} mb={1}>
                <Store sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Stores ({PREDEFINED_STORES.length})
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                {PREDEFINED_STORES.map((s) => {
                  const exists = allNames.has(s.name);
                  return (
                    <Chip
                      key={s.name}
                      label={s.name}
                      color={exists ? 'default' : 'primary'}
                      variant={exists ? 'filled' : 'outlined'}
                      icon={exists ? <Check /> : undefined}
                      onClick={() => { if (!exists) bulkCreateMutation.mutate([s]); }}
                      disabled={exists}
                      sx={{ fontWeight: 500 }}
                    />
                  );
                })}
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight={700} mt={2} mb={1}>
                <HomeWork sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Dharamshalas ({PREDEFINED_DHARAMSHALAS.length})
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                {PREDEFINED_DHARAMSHALAS.map((d) => {
                  const exists = allNames.has(d.name);
                  return (
                    <Chip
                      key={d.name}
                      label={d.name}
                      color={exists ? 'default' : 'secondary'}
                      variant={exists ? 'filled' : 'outlined'}
                      icon={exists ? <Check /> : undefined}
                      onClick={() => { if (!exists) bulkCreateMutation.mutate([d]); }}
                      disabled={exists}
                      sx={{ fontWeight: 500 }}
                    />
                  );
                })}
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight={700} mt={2} mb={1}>
                <BusinessCenter sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Add Custom Department
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Use "Add Custom" button to create departments with type "Department"
              </Typography>
              {allNames.size > 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>Gray chips = already added. Click colored chips to add them.</Alert>
              )}
            </>
          )}
      </EnterpriseDialog>

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="departments" />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Department"
        message={`Are you sure you want to delete "${deleting?.name}"? This will fail if the department is referenced by challans or transactions.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => { setDeleteDialogOpen(false); setDeleting(null); }}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
