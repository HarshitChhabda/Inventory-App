import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, TablePagination, Stack, Tooltip, alpha, useTheme, TableSortLabel,
} from '@mui/material';
import { Add, Edit, Delete, Search, Business } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import toast from 'react-hot-toast';

export default function VendorsPage() {
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
  const [formData, setFormData] = useState({ name: '', contactPerson: '', phone: '', address: '', gstNumber: '' });
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState<any>(null);

  const exportColumns = useMemo(() => [
    { header: 'Name', key: 'name' },
    { header: 'Contact Person', key: 'contactPerson' },
    { header: 'Phone', key: 'phone' },
    { header: 'Address', key: 'address' },
    { header: 'GST Number', key: 'gstNumber' },
    { header: 'Active', key: 'isActive' },
  ], []);

  const { data: allVendorsData } = useQuery({
    queryKey: ['vendors', 'all'],
    queryFn: () => window.electronAPI.dbQuery('vendor', 'findMany', { orderBy: { name: 'asc' } }),
  });

  const getExportData = useCallback(() => (allVendorsData || []).map((v: any) => ({
    name: v.name, contactPerson: v.contactPerson || '', phone: v.phone || '',
    address: v.address || '', gstNumber: v.gstNumber || '', isActive: v.isActive ? 'Yes' : 'No',
  })), [allVendorsData]);

  const handleImportVendors = async (rows: any[]) => {
    try {
      let created = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        const name = row['Name'] || row['name'] || '';
        if (!name) { skipped++; continue; }
        const payload = { name, contactPerson: row['Contact Person'] || row['contactPerson'] || '', phone: row['Phone'] || row['phone'] || '', address: row['Address'] || row['address'] || '', gstNumber: row['GST Number'] || row['gstNumber'] || '', isActive: (row['Active'] || row['isActive'] || 'Yes') !== 'No' };
        const existing = await window.electronAPI.dbQuery('vendor', 'findFirst', { where: { name } });
        if (existing) { await window.electronAPI.updateVendor(existing.id, payload); updated++; }
        else { await window.electronAPI.createVendor(payload); created++; }
      }
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data } = useQuery({
    queryKey: ['vendors', page, rowsPerPage, debouncedSearch, sortBy, sortOrder],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = {};
      if (debouncedSearch) where.OR = [{ name: { contains: debouncedSearch } }, { contactPerson: { contains: debouncedSearch } }];
      let orderBy: any = { [sortBy]: sortOrder };
      const [vendors, total] = await Promise.all([
        api.dbQuery('vendor', 'findMany', { where, skip: page * rowsPerPage, take: rowsPerPage, orderBy }),
        api.dbQuery('vendor', 'count', { where }),
      ]);
      return { vendors, total };
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
      if (editing) return api.updateVendor(editing.id, data);
      return api.createVendor(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); setDialogOpen(false); setEditing(null); setFormData({ name: '', contactPerson: '', phone: '', address: '', gstNumber: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const receiptCount = await api.dbQuery('receiptChallan', 'count', { where: { vendorId: id } });
      if (receiptCount > 0) {
        throw new Error('Cannot delete vendor: it is used in receipt challans. Remove or reassign them first.');
      }
      const returnCount = await api.dbQuery('vendorReturnChallan', 'count', { where: { vendorId: id } });
      if (returnCount > 0) {
        throw new Error('Cannot delete vendor: it has vendor return challans. Remove them first.');
      }
      return api.deleteVendor(id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); setDeleteDialogOpen(false); setDeletingVendor(null); },
    onError: (error: any) => { toast.error(error.message || 'Failed to delete vendor'); },
  });

  const columns = useMemo(() => [
    { id: 'name', label: 'Name' },
    { id: 'contactPerson', label: 'Contact Person' },
    { id: 'phone', label: 'Phone' },
    { id: 'gstNumber', label: 'GST Number' },
    { id: 'isActive', label: 'Status' },
  ], []);

  return (
    <Box>
      <PageHeader
        title="Vendors"
        subtitle="Manage your suppliers and vendors"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons data={getExportData()} columns={exportColumns} fileName="vendors" onImport={handleImportVendors} />
            <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setFormData({ name: '', contactPerson: '', phone: '', address: '', gstNumber: '' }); setDialogOpen(true); }}>Add Vendor</Button>
          </Stack>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField fullWidth placeholder="Search vendors..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} variant="outlined" size="small" />
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
            {data?.vendors?.map((v: any) => (
              <TableRow key={v.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: alpha(theme.palette.warning.main, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'warning.main', fontWeight: 700, fontSize: '0.8125rem' }}>
                      {v.name?.charAt(0)?.toUpperCase()}
                    </Box>
                    <Typography fontWeight={500}>{v.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{v.contactPerson || '-'}</TableCell>
                <TableCell>{v.phone || '-'}</TableCell>
                <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{v.gstNumber || '-'}</Typography></TableCell>
                <TableCell><Typography color={v.isActive ? 'success.main' : 'text.secondary'} fontWeight={500} fontSize="0.8125rem">{v.isActive ? 'Active' : 'Inactive'}</Typography></TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => { setEditing(v); setFormData({ name: v.name, contactPerson: v.contactPerson || '', phone: v.phone || '', address: v.address || '', gstNumber: v.gstNumber || '' }); setDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => { setDeletingVendor(v); setDeleteDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {(!data?.vendors || data.vendors.length === 0) && (
              <TableRow><TableCell colSpan={6}><EmptyState icon={<Business />} title="No vendors found" description="Add your first vendor to get started" /></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination component="div" count={data?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Vendor Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth required />
            <TextField label="Contact Person" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} fullWidth />
            <TextField label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} fullWidth />
            <TextField label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} fullWidth multiline rows={2} />
            <TextField label="GST Number" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(formData)} disabled={!formData.name}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Vendor</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete "<strong>{deletingVendor?.name}</strong>"?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deletingVendor && deleteMutation.mutate(deletingVendor.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
