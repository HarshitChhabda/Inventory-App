import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, TablePagination, Stack, Tooltip, alpha, useTheme,
  FormControl, InputLabel, Select, MenuItem, Chip, Divider, Alert, TableSortLabel,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, Search, Apartment, Store, HomeWork, AddCircle, Check, BusinessCenter } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import toast from 'react-hot-toast';

const PREDEFINED_STORES = [
  { name: 'बिजली स्टोर', code: 'BS', departmentType: 'Store' },
  { name: 'इमारत स्टोर', code: 'IS', departmentType: 'Store' },
  { name: 'जर्नल स्टोर', code: 'JS', departmentType: 'Store' },
];

const PREDEFINED_DHARAMSHALAS = [
  { name: 'लाला उमराव सिह जैन', code: 'LUSJ', departmentType: 'Dharamshala' },
  { name: 'श्री दिगंबर जैन अतिशय क्षेत्र', code: 'SDJAK', departmentType: 'Dharamshala' },
  { name: 'अतिवीर अतिथि गृह', code: 'AAG', departmentType: 'Dharamshala' },
  { name: 'अतिवीर गेस्ट हाउस', code: 'AGH', departmentType: 'Dharamshala' },
  { name: 'कटला उत्तरी विंग', code: 'KUW', departmentType: 'Dharamshala' },
  { name: 'कटला चांदनी', code: 'KC', departmentType: 'Dharamshala' },
  { name: 'कटला दक्षिण विंग', code: 'KDW', departmentType: 'Dharamshala' },
  { name: 'कटला पश्चिम विंग', code: 'KPW', departmentType: 'Dharamshala' },
  { name: 'कटला पूर्वी विंग', code: 'KPVW', departmentType: 'Dharamshala' },
  { name: 'कटला रथखाना', code: 'KR', departmentType: 'Dharamshala' },
  { name: 'कुन्द कुन्द निलय', code: 'KKN', departmentType: 'Dharamshala' },
  { name: 'चरण चिन्ह्', code: 'CC', departmentType: 'Dharamshala' },
  { name: 'बाजार बी ब्लाक', code: 'BBB', departmentType: 'Dharamshala' },
  { name: 'राष्ट्रपति भवन', code: 'RB', departmentType: 'Dharamshala' },
  { name: 'वर्धमान', code: 'V', departmentType: 'Dharamshala' },
  { name: 'वर्धमान गेस्ट हाउस', code: 'VGH', departmentType: 'Dharamshala' },
  { name: 'वैशाली यात्री निवास', code: 'VYN', departmentType: 'Dharamshala' },
  { name: 'सन्मति', code: 'SM', departmentType: 'Dharamshala' },
  { name: 'मंदिर', code: 'M', departmentType: 'Dharamshala' },
  { name: 'धर्मशाला', code: 'DH', departmentType: 'Dharamshala' },
  { name: 'भोजनशाला', code: 'BH', departmentType: 'Dharamshala' },
  { name: 'जल प्लांट', code: 'JP', departmentType: 'Dharamshala' },
];

const ALL_DEPT_NAMES = [...PREDEFINED_STORES, ...PREDEFINED_DHARAMSHALAS].map(d => d.name);

export default function DepartmentsPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', code: '', departmentType: 'Store' });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState<any>(null);

  const exportColumns = useMemo(() => [
    { header: 'Name', key: 'name' },
    { header: 'Code', key: 'code' },
    { header: 'Type', key: 'departmentType' },
    { header: 'Active', key: 'isActive' },
  ], []);

  const [exportData, setExportData] = useState<any[]>([]);
  const fetchExportRef = useRef(false);

  const fetchExportData = useCallback(async () => {
    if (fetchExportRef.current || exportData.length > 0) return;
    fetchExportRef.current = true;
    try {
      const all = await window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id }, orderBy: { name: 'asc' } });
      setExportData(all);
    } catch { fetchExportRef.current = false; }
  }, [company?.id, exportData.length]);

  const getExportData = useCallback(() => exportData.map((d: any) => ({
    name: d.name, code: d.code, departmentType: d.departmentType || 'Store', isActive: d.isActive ? 'Yes' : 'No',
  })), [exportData]);

  const handleImportDepartments = async (rows: any[]) => {
    try {
      let created = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        const name = row['Name'] || row['name'] || '';
        if (!name) { skipped++; continue; }
        const payload = { name, code: row['Code'] || row['code'] || '', departmentType: row['Type'] || row['departmentType'] || 'Store', companyId: company!.id, isActive: (row['Active'] || row['isActive'] || 'Yes') !== 'No' };
        const existing = await window.electronAPI.dbQuery('department', 'findFirst', { where: { name, companyId: company!.id } });
        if (existing) { await window.electronAPI.updateDepartment(existing.id, payload); updated++; }
        else { await window.electronAPI.createDepartment(payload); created++; }
      }
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data } = useQuery({
    queryKey: ['departments', company?.id, page, rowsPerPage, debouncedSearch, sortBy, sortOrder],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = { companyId: company!.id };
      if (debouncedSearch) where.OR = [{ name: { contains: debouncedSearch } }, { code: { contains: debouncedSearch } }];
      let orderBy: any = {};
      if (sortBy === 'departmentType') orderBy = { departmentType: sortOrder };
      else orderBy = { [sortBy]: sortOrder };
      const [depts, total] = await Promise.all([
        api.dbQuery('department', 'findMany', { where, skip: page * rowsPerPage, take: rowsPerPage, orderBy }),
        api.dbQuery('department', 'count', { where }),
      ]);
      return { depts, total };
    },
    enabled: !!company?.id,
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
      const payload = { ...data, companyId: company!.id };
      if (editing) return api.updateDepartment(editing.id, payload);
      return api.createDepartment(payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setDialogOpen(false); setEditing(null); setFormData({ name: '', code: '', departmentType: 'Store' }); },
  });

  const [allNamesLoading, setAllNamesLoading] = useState(false);
  const [allNames, setAllNames] = useState<Set<string>>(new Set());

  const fetchAllNames = useCallback(async () => {
    if (allNames.size > 0) return;
    setAllNamesLoading(true);
    try {
      const all = await window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id }, select: { name: true } }) as any[];
      setAllNames(new Set(all.map((d: any) => d.name)));
    } finally { setAllNamesLoading(false); }
  }, [company?.id, allNames.size]);

  const bulkCreateMutation = useMutation({
    mutationFn: async (departments: Array<{ name: string; code: string; departmentType: string }>) => {
      const api = window.electronAPI;
      const toCreate = departments.filter(d => !allNames.has(d.name));
      for (const dept of toCreate) { await api.createDepartment({ ...dept, companyId: company!.id }); }
      return toCreate.length;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setQuickAddOpen(false); setAllNames(new Set()); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const issueCount = await api.dbQuery('issueChallan', 'count', { where: { departmentId: id } });
      if (issueCount > 0) {
        throw new Error('Cannot delete department: it is used in issue challans. Remove or reassign them first.');
      }
      const receiptCount = await api.dbQuery('receiptChallan', 'count', { where: { departmentId: id } });
      if (receiptCount > 0) {
        throw new Error('Cannot delete department: it is used in receipt challans. Remove or reassign them first.');
      }
      const transferFromCount = await api.dbQuery('transferChallan', 'count', { where: { fromDepartmentId: id } });
      if (transferFromCount > 0) {
        throw new Error('Cannot delete department: it is used as source in transfer challans.');
      }
      const transferToCount = await api.dbQuery('transferChallan', 'count', { where: { toDepartmentId: id } });
      if (transferToCount > 0) {
        throw new Error('Cannot delete department: it is used as destination in transfer challans.');
      }
      const txnCount = await api.dbQuery('stockTransaction', 'count', { where: { departmentId: id } });
      if (txnCount > 0) {
        throw new Error('Cannot delete department: it has stock transactions associated with it.');
      }
      return api.deleteDepartment(id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setDeleteDialogOpen(false); setDeletingDepartment(null); },
    onError: (error: any) => { toast.error(error.message || 'Failed to delete department'); },
  });

  const typeColor = (t: string) => { switch (t) { case 'Store': return 'primary'; case 'Dharamshala': return 'secondary'; case 'Department': return 'success'; default: return 'default'; } };

  const columns = useMemo(() => [
    { id: 'name', label: 'Name' },
    { id: 'departmentType', label: 'Type' },
    { id: 'code', label: 'Code' },
    { id: 'isActive', label: 'Status' },
  ], []);

  return (
    <Box>
      <PageHeader
        title="Departments & Dharamshalas"
        subtitle="Manage stores (बिजली, इमारत, जर्नल) and Dharamshalas"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons data={getExportData()} columns={exportColumns} fileName="departments" onImport={handleImportDepartments} onExportOpen={fetchExportData} showExport={exportData.length > 0} />
            <Button variant="outlined" startIcon={<AddCircle />} onClick={() => { setQuickAddOpen(true); fetchAllNames(); }}>Quick Add All</Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setFormData({ name: '', code: '', departmentType: 'Store' }); setDialogOpen(true); }}>Add Custom</Button>
          </Stack>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField fullWidth placeholder="Search departments..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} variant="outlined" size="small" />
      </Paper>

      <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id} sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => handleSort(col.id)}>
                  <TableSortLabel active={sortBy === col.id} direction={sortBy === col.id ? sortOrder : 'asc'}>
                    <Typography variant="body2" fontWeight={600}>{col.label}</Typography>
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell align="right"><Typography variant="body2" fontWeight={600}>Actions</Typography></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.depts?.map((d: any) => (
              <TableRow key={d.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: alpha(theme.palette[d.departmentType === 'Dharamshala' ? 'secondary' : d.departmentType === 'Department' ? 'success' : 'primary'].main, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {d.departmentType === 'Dharamshala' ? <HomeWork sx={{ fontSize: 16, color: 'secondary.main' }} /> : d.departmentType === 'Department' ? <BusinessCenter sx={{ fontSize: 16, color: 'success.main' }} /> : <Store sx={{ fontSize: 16, color: 'primary.main' }} />}
                    </Box>
                    <Typography fontWeight={500}>{d.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell><Chip label={d.departmentType || 'Store'} size="small" color={typeColor(d.departmentType || 'Store') as any} variant="outlined" /></TableCell>
                <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.code}</Typography></TableCell>
                <TableCell><Typography color={d.isActive ? 'success.main' : 'text.secondary'} fontWeight={500} fontSize="0.8125rem">{d.isActive ? 'Active' : 'Inactive'}</Typography></TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => { setEditing(d); setFormData({ name: d.name, code: d.code || '', departmentType: d.departmentType || 'Store' }); setDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => { setDeletingDepartment(d); setDeleteDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {(!data?.depts || data.depts.length === 0) && (
              <TableRow><TableCell colSpan={5}><EmptyState icon={<Apartment />} title="No departments found" description="Click 'Quick Add All' to add predefined stores and dharamshalas" /></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination component="div" count={data?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Department' : 'Add New Department'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Department Type</InputLabel>
              <Select value={formData.departmentType} label="Department Type" onChange={(e) => setFormData({ ...formData, departmentType: e.target.value })}>
                <MenuItem value="Store">Store (Stores)</MenuItem>
                <MenuItem value="Dharamshala">Dharamshala</MenuItem>
                <MenuItem value="Department">Department</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Department Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth required />
            <TextField label="Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(formData)} disabled={!formData.name}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Quick Add Predefined Departments</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>Select which departments to add. Already existing ones will be skipped.</Typography>
          {allNamesLoading ? (
            <Stack alignItems="center" py={3}><CircularProgress size={24} /></Stack>
          ) : (
            <>
              <Typography variant="subtitle1" fontWeight={700} mt={2} mb={1}><Store sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Stores (3)</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                {PREDEFINED_STORES.map((s) => {
                  const exists = allNames.has(s.name);
                  return (<Chip key={s.name} label={s.name} color={exists ? 'default' : 'primary'} variant={exists ? 'filled' : 'outlined'} icon={exists ? <Check /> : undefined} onClick={() => { if (!exists) bulkCreateMutation.mutate([s]); }} disabled={exists} sx={{ fontWeight: 500 }} />);
                })}
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight={700} mt={2} mb={1}><HomeWork sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Dharamshalas ({PREDEFINED_DHARAMSHALAS.length})</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                {PREDEFINED_DHARAMSHALAS.map((d) => {
                  const exists = allNames.has(d.name);
                  return (<Chip key={d.name} label={d.name} color={exists ? 'default' : 'secondary'} variant={exists ? 'filled' : 'outlined'} icon={exists ? <Check /> : undefined} onClick={() => { if (!exists) bulkCreateMutation.mutate([d]); }} disabled={exists} sx={{ fontWeight: 500 }} />);
                })}
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight={700} mt={2} mb={1}><BusinessCenter sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} /> Add Custom Department</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>Use "Add Custom" button to create departments with type "Department"</Typography>
              {allNames.size > 0 && <Alert severity="info" sx={{ mt: 1 }}>Gray chips = already added. Click colored chips to add them.</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickAddOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => { const allNew = [...PREDEFINED_STORES, ...PREDEFINED_DHARAMSHALAS].filter(d => !allNames.has(d.name)); if (allNew.length > 0) bulkCreateMutation.mutate(allNew); }} disabled={allNames.size === 0 || [...PREDEFINED_STORES, ...PREDEFINED_DHARAMSHALAS].every(d => allNames.has(d.name))}>Add All Missing</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Department</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete "<strong>{deletingDepartment?.name}</strong>"?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deletingDepartment && deleteMutation.mutate(deletingDepartment.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
