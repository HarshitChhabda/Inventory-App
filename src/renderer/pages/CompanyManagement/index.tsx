import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, alpha, useTheme, IconButton, Tooltip, Chip,
  LinearProgress, Grid,
} from '@mui/material';
import { Add, Edit, Business, CheckCircle, Cancel, DeleteForever, Warning } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { GuideButton } from '../../components/GuideSystem';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  address: z.string(),
  phone: z.string(),
});
type CompanyFormData = z.infer<typeof companySchema>;

export default function CompanyManagementPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [toggleTarget, setToggleTarget] = useState<{ id: number; activate: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const { company: activeCompany, setCompany: setActiveCompany } = useCompany();
  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    mode: 'onChange',
    defaultValues: { name: '', address: '', phone: '' },
  });

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies', 'all'],
    queryFn: () => window.electronAPI.dbQuery('company', 'findMany', { orderBy: { name: 'asc' } }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editing) return window.electronAPI.updateCompany(editing.id, data);
      return window.electronAPI.createCompany(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDialogOpen(false);
      setEditing(null);
      reset({ name: '', address: '', phone: '' });
    },
    onError: (err: any) => { toast.error(getErrorMessage(err, 'Failed to save company')); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.toggleCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: any) => { toast.error(getErrorMessage(err, 'Failed to toggle company')); },
  });

  const dependencyQuery = useQuery({
    queryKey: ['companyDeletionDependencies', deleteTarget?.id],
    queryFn: () => window.electronAPI.getCompanyDeletionDependencyInfo(deleteTarget!.id),
    enabled: !!deleteTarget,
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: ({ id, confirmName }: { id: number; confirmName: string }) =>
      window.electronAPI.permanentDeleteCompany(id, confirmName),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['companies', 'active'] });
      if (activeCompany?.id === variables.id) {
        setActiveCompany(null);
      }
      toast.success(`Company "${variables.confirmName}" permanently deleted`);
      setDeleteTarget(null);
      setDeleteConfirmName('');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to delete company'));
    },
  });

  return (
    <Box>
      <PageHeader
        title="Company Management"
        subtitle="Manage your organization branches"
        actions={
          <Box display="flex" gap={1}>
            <GuideButton pageId="company-management" />
            <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); reset({ name: '', address: '', phone: '' }); setDialogOpen(true); }}>
              Add Company
            </Button>
          </Box>
        }
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
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
                <TableCell>
                  <Chip
                    icon={c.isActive ? <CheckCircle /> : <Cancel />}
                    label={c.isActive ? 'Active' : 'Inactive'}
                    color={c.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={c.isActive ? 'Disable' : 'Enable'}>
                    <IconButton
                      size="small"
                      onClick={() => setToggleTarget({ id: c.id, activate: !c.isActive })}
                      sx={{ color: c.isActive ? 'success.main' : 'text.secondary', '&:hover': { bgcolor: alpha(c.isActive ? '#22c55e' : '#94a3b8', 0.08) } }}
                    >
                      {c.isActive ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => { setEditing(c); reset({ name: c.name, address: c.address || '', phone: c.phone || '' }); setDialogOpen(true); }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Permanently Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { setDeleteTarget(c); setDeleteConfirmName(''); }}
                    >
                      <DeleteForever fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {(!companies || companies.length === 0) && (
              <TableRow>
                <TableCell colSpan={5}>
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
            <TextField label="Company Name" {...register('name')} error={!!errors.name} helperText={errors.name?.message} fullWidth required />
            <TextField label="Address" {...register('address')} fullWidth multiline rows={2} />
            <TextField label="Phone" {...register('phone')} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit((data) => saveMutation.mutate(data))} disabled={!isValid}>{editing ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!toggleTarget} onClose={() => setToggleTarget(null)}>
        <DialogTitle>Confirm Toggle</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {toggleTarget?.activate ? 'activate' : 'deactivate'} this company? Users assigned to this company may lose access.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToggleTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={toggleTarget?.activate ? 'success' : 'warning'}
            onClick={() => {
              if (toggleTarget) toggleMutation.mutate(toggleTarget.id);
              setToggleTarget(null);
            }}
          >
            {toggleTarget?.activate ? 'Activate' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <Warning color="error" />
          Permanently Delete Company
        </DialogTitle>
        <DialogContent>
          {dependencyQuery.isLoading ? (
            <Stack alignItems="center" py={4}>
              <LinearProgress sx={{ width: '100%' }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Analyzing company data...
              </Typography>
            </Stack>
          ) : dependencyQuery.data ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: alpha('#ef4444', 0.05), borderRadius: 1, border: '1px solid', borderColor: alpha('#ef4444', 0.2) }}>
                <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                  This action permanently deletes <strong>{dependencyQuery.data.companyName}</strong> and ALL associated data. This action cannot be undone.
                </Typography>
              </Box>
              <Typography variant="subtitle2" color="text.secondary">
                The following data will be deleted:
              </Typography>
              <Grid container spacing={1}>
                {[
                  { label: 'Financial Years', value: dependencyQuery.data.financialYears },
                  { label: 'Transactions', value: dependencyQuery.data.transactions },
                  { label: 'Ledger Entries', value: dependencyQuery.data.ledgerEntries },
                  { label: 'Requisitions', value: dependencyQuery.data.requisitions },
                  { label: 'Purchase Orders', value: dependencyQuery.data.purchaseOrders },
                  { label: 'Goods Receipts', value: dependencyQuery.data.goodsReceipts },
                  { label: 'Assets', value: dependencyQuery.data.assets },
                  { label: 'Stores', value: dependencyQuery.data.stores },
                  { label: 'Vendors', value: dependencyQuery.data.vendors },
                  { label: 'Departments', value: dependencyQuery.data.departments },
                  { label: 'Employees', value: dependencyQuery.data.employees },
                  { label: 'Work Orders', value: dependencyQuery.data.workOrders },
                  { label: 'Service Requests', value: dependencyQuery.data.serviceRequests },
                  { label: 'Roles', value: dependencyQuery.data.roles },
                  { label: 'Users', value: dependencyQuery.data.users },
                  { label: 'Quotations', value: dependencyQuery.data.quotations },
                  { label: 'AMC Agreements', value: dependencyQuery.data.amcAgreements },
                  { label: 'Approval Workflows', value: dependencyQuery.data.approvalWorkflows },
                  { label: 'Warranty Claims', value: dependencyQuery.data.warrantyClaims },
                  { label: 'Audit Logs', value: dependencyQuery.data.auditLogs },
                ].filter(item => item.value > 0).map(item => (
                  <Grid item xs={6} sm={4} key={item.label}>
                    <Chip label={`${item.label}: ${item.value}`} size="small" variant="outlined" color="error" sx={{ width: '100%' }} />
                  </Grid>
                ))}
              </Grid>
              <TextField
                label={`Type "${deleteTarget?.name}" to confirm`}
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                fullWidth
                size="small"
                error={deleteConfirmName.length > 0 && deleteConfirmName !== deleteTarget?.name}
                helperText={deleteConfirmName.length > 0 && deleteConfirmName !== deleteTarget?.name ? 'Company name does not match' : ''}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForever />}
            disabled={deleteConfirmName !== deleteTarget?.name || permanentDeleteMutation.isPending}
            onClick={() => {
              if (deleteTarget && deleteConfirmName === deleteTarget.name) {
                permanentDeleteMutation.mutate({ id: deleteTarget.id, confirmName: deleteConfirmName });
              }
            }}
          >
            {permanentDeleteMutation.isPending ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
