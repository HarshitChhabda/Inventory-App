import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Stack, Tooltip, alpha, useTheme, TableSortLabel,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { Add, Edit, Delete, Search, Category } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', prefix: '', departmentId: 0 as number | '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<any>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const exportColumns = [
    { header: 'Name', key: 'name' },
    { header: 'Prefix', key: 'prefix' },
    { header: 'DepartmentId', key: 'departmentId' },
    { header: 'Active', key: 'isActive' },
  ];

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data: categories } = useQuery({
    queryKey: ['categories', debouncedSearch],
    queryFn: () => {
      const where: any = {};
      if (debouncedSearch) where.name = { contains: debouncedSearch };
      return window.electronAPI.dbQuery('itemCategory', 'findMany', { where, orderBy: { name: 'asc' } });
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });
  const storeDepts = departments?.filter((d: any) => d.departmentType === 'Store') || [];

  const getExportData = useCallback(() => (categories || []).map((c: any) => ({
    name: c.name, prefix: c.prefix || '', departmentId: c.departmentId || '',
    isActive: c.isActive ? 'Yes' : 'No',
  })), [categories, departments]);

  const handleImportCategories = async (rows: any[]) => {
    try {
      let created = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        const name = row['Name'] || row['name'] || '';
        if (!name) { skipped++; continue; }
        const prefix = row['Prefix'] || row['prefix'] || '';
        const isActive = (row['Active'] || row['isActive'] || 'Yes') !== 'No';
        const existing = await window.electronAPI.dbQuery('itemCategory', 'findFirst', { where: { name } });
        if (existing) {
          await window.electronAPI.updateCategory(existing.id, { prefix, isActive });
          updated++;
        } else {
          await window.electronAPI.createCategory({ name, prefix: prefix || name.substring(0, 2).toUpperCase(), isActive });
          created++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a: any, b: any) => {
      let valA: any, valB: any;
      if (sortBy === 'name') { valA = a.name; valB = b.name; }
      else if (sortBy === 'prefix') { valA = a.prefix || ''; valB = b.prefix || ''; }
      else if (sortBy === 'isActive') { valA = a.isActive ? 1 : 0; valB = b.isActive ? 1 : 0; }
      else return 0;
      if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [categories, sortBy, sortOrder]);

  const handleSort = useCallback((field: string) => {
    setSortOrder((prev) => sortBy === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortBy(field);
  }, [sortBy]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const api = window.electronAPI;
      if (editing) return api.updateCategory(editing.id, data);
      return api.createCategory(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDialogOpen(false); setEditing(null); setFormData({ name: '', prefix: '', departmentId: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const itemCount = await api.dbQuery('item', 'count', { where: { categoryId: id } });
      if (itemCount > 0) {
        throw new Error('Cannot delete category: it has items assigned to it. Move or delete items first.');
      }
      return api.deleteCategory(id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDeleteDialogOpen(false); setDeletingCategory(null); },
    onError: (error: any) => { alert(error.message || 'Failed to delete category'); },
  });

  const columns = [
    { id: 'name', label: 'Name' },
    { id: 'prefix', label: 'Prefix' },
    { id: 'department', label: 'Store' },
    { id: 'isActive', label: 'Status' },
  ];

  return (
    <Box>
      <PageHeader
        title="Item Categories"
        subtitle="Organize items by category"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons data={getExportData()} columns={exportColumns} fileName="categories" onImport={handleImportCategories} />
            <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setFormData({ name: '', prefix: '', departmentId: '' }); setDialogOpen(true); }}>
              Add Category
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          variant="outlined"
          size="small"
        />
      </Paper>

      <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
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
              <TableCell align="right"><Typography variant="body2" fontWeight={600}>Actions</Typography></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedCategories.map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: alpha(theme.palette.secondary.main, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Category sx={{ fontSize: 16, color: 'secondary.main' }} />
                    </Box>
                    <Typography fontWeight={500}>{c.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell><Typography variant="body2" fontWeight={600} color="primary.main">{c.prefix || '-'}</Typography></TableCell>
                <TableCell><Typography fontSize="0.8125rem" color="text.primary">{storeDepts.find((d: any) => d.id === c.departmentId)?.name || '-'}</Typography></TableCell>
                <TableCell><Typography color={c.isActive ? 'success.main' : 'text.secondary'} fontWeight={500} fontSize="0.8125rem">{c.isActive ? 'Active' : 'Inactive'}</Typography></TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => { setEditing(c); setFormData({ name: c.name, prefix: c.prefix || '', departmentId: c.departmentId || '' }); setDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => { setDeletingCategory(c); setDeleteDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {sortedCategories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState icon={<Category />} title="No categories found" description="Create your first category to organize items" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Category' : 'Add New Category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Category Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth required />
            <TextField label="Prefix (e.g., BL, IM, JS)" value={formData.prefix} onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })} fullWidth required helperText="2-3 character code used for auto-generating item codes" inputProps={{ maxLength: 3 }} />
            <FormControl size="small" fullWidth>
              <InputLabel>Store (Optional)</InputLabel>
              <Select
                value={formData.departmentId}
                label="Store (Optional)"
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : '' })}
              >
                <MenuItem value="">None</MenuItem>
                {storeDepts.map((d: any) => (
                  <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(formData)} disabled={!formData.name || !formData.prefix}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete "<strong>{deletingCategory?.name}</strong>"?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
