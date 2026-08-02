import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Stack, Tooltip, alpha, useTheme, TableSortLabel,
} from '@mui/material';
import { Add, Edit, Delete, Search, Straighten } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import toast from 'react-hot-toast';

export default function UnitsPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', symbol: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<any>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const exportColumns = [
    { header: 'Name', key: 'name' },
    { header: 'Symbol', key: 'symbol' },
  ];

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data: units } = useQuery({
    queryKey: ['units', debouncedSearch],
    queryFn: () => {
      const where: any = {};
      if (debouncedSearch) where.OR = [{ name: { contains: debouncedSearch } }, { symbol: { contains: debouncedSearch } }];
      return window.electronAPI.dbQuery('unit', 'findMany', { where, orderBy: { name: 'asc' } });
    },
  });

  const getExportData = useCallback(() => (units || []).map((u: any) => ({ name: u.name, symbol: u.symbol || '' })), [units]);

  const handleImportUnits = async (rows: any[]) => {
    try {
      let created = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        const name = row['Name'] || row['name'] || '';
        if (!name) { skipped++; continue; }
        const symbol = row['Symbol'] || row['symbol'] || '';
        const existing = await window.electronAPI.dbQuery('unit', 'findFirst', { where: { name } });
        if (existing) {
          await window.electronAPI.updateUnit(existing.id, { symbol });
          updated++;
        } else {
          await window.electronAPI.createUnit({ name, symbol });
          created++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const sortedUnits = useMemo(() => {
    if (!units) return [];
    return [...units].sort((a: any, b: any) => {
      let valA: any, valB: any;
      if (sortBy === 'name') { valA = a.name; valB = b.name; }
      else if (sortBy === 'symbol') { valA = a.symbol || ''; valB = b.symbol || ''; }
      else return 0;
      if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [units, sortBy, sortOrder]);

  const handleSort = useCallback((field: string) => {
    setSortOrder((prev) => sortBy === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortBy(field);
  }, [sortBy]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const api = window.electronAPI;
      if (editing) return api.updateUnit(editing.id, data);
      return api.createUnit(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units'] }); setDialogOpen(false); setEditing(null); setFormData({ name: '', symbol: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const itemCount = await api.dbQuery('item', 'count', { where: { unitId: id } });
      if (itemCount > 0) throw new Error('Cannot delete unit: it is used by items. Change item units first.');
      return api.deleteUnit(id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units'] }); setDeleteDialogOpen(false); setDeletingUnit(null); },
    onError: (error: any) => { alert(error.message || 'Failed to delete unit'); },
  });

  const columns = [
    { id: 'name', label: 'Name' },
    { id: 'symbol', label: 'Symbol' },
  ];

  return (
    <Box>
      <PageHeader
        title="Units"
        subtitle="Define measurement units for items"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons data={getExportData()} columns={exportColumns} fileName="units" onImport={handleImportUnits} />
            <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setFormData({ name: '', symbol: '' }); setDialogOpen(true); }}>Add Unit</Button>
          </Stack>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField fullWidth placeholder="Search units..." value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} variant="outlined" size="small" />
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
            {sortedUnits.map((u: any) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: alpha(theme.palette.info.main, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Straighten sx={{ fontSize: 16, color: 'info.main' }} />
                    </Box>
                    <Typography fontWeight={500}>{u.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{u.symbol || '-'}</Typography></TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => { setEditing(u); setFormData({ name: u.name, symbol: u.symbol || '' }); setDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => { setDeletingUnit(u); setDeleteDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {sortedUnits.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <EmptyState icon={<Straighten />} title="No units found" description="Define measurement units like Kg, Meter, Nos" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Unit' : 'Add New Unit'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Unit Name (e.g. Nos, Meter, Kg)" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth />
            <TextField label="Symbol (optional)" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(formData)} disabled={!formData.name}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Unit</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete "<strong>{deletingUnit?.name}</strong>"?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deletingUnit && deleteMutation.mutate(deletingUnit.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
