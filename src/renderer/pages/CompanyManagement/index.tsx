import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, alpha, useTheme,
} from '@mui/material';
import { Add, Edit, Business } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

export default function CompanyManagementPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '' });

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => window.electronAPI.dbQuery('company', 'findMany', { orderBy: { name: 'asc' } }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editing) return window.electronAPI.updateCompany(editing.id, data);
      return window.electronAPI.createCompany(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setDialogOpen(false); setEditing(null); setFormData({ name: '', address: '', phone: '' }); },
  });

  return (
    <Box>
      <PageHeader
        title="Company Management"
        subtitle="Manage your organization branches"
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setFormData({ name: '', address: '', phone: '' }); setDialogOpen(true); }}>
            Add Company
          </Button>
        }
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies?.map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'primary.main', fontWeight: 700, fontSize: '0.875rem',
                    }}>
                      {c.name?.charAt(0)?.toUpperCase()}
                    </Box>
                    <Typography fontWeight={600}>{c.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{c.address || '-'}</TableCell>
                <TableCell>{c.phone || '-'}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => { setEditing(c); setFormData({ name: c.name, address: c.address || '', phone: c.phone || '' }); setDialogOpen(true); }}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!companies || companies.length === 0) && (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState icon={<Business />} title="No companies found" description="Add your first company branch" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Company' : 'Add New Company'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Company Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} fullWidth required />
            <TextField label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} fullWidth multiline rows={2} />
            <TextField label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(formData)} disabled={!formData.name}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
