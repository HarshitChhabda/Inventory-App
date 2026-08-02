import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, alpha, useTheme,
  Checkbox, FormControlLabel, Divider,
} from '@mui/material';
import { Add, LockOpen, Lock, CalendarMonth, Warning } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import DatePickerField from '../../components/DatePickerField';

export default function FinancialYearPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFy, setEditingFy] = useState<any>(null);
  const [closeDialog, setCloseDialog] = useState<{ open: boolean; fy: any; confirmed: boolean }>({ open: false, fy: null, confirmed: false });
  const [formData, setFormData] = useState({ label: '', startDate: '', endDate: '' });

  const { data: financialYears, isLoading } = useQuery({
    queryKey: ['financialYears', company?.id],
    queryFn: () => window.electronAPI.dbQuery('financialYear', 'findMany', {
      where: { companyId: company?.id },
      orderBy: { startDate: 'desc' },
    }),
    enabled: !!company?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!company?.id) throw new Error('Pehle Company banao');
      if (editingFy) {
        return window.electronAPI.updateFinancialYear(editingFy.id, {
          label: data.label, startDate: new Date(data.startDate), endDate: new Date(data.endDate),
        });
      }
      return window.electronAPI.createFinancialYear({
        ...data, companyId: company.id, startDate: new Date(data.startDate), endDate: new Date(data.endDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
      setDialogOpen(false);
      setEditingFy(null);
      setFormData({ label: '', startDate: '', endDate: '' });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (fy: any) => {
      return window.electronAPI.closeFinancialYear(fy.id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financialYears'] }); setCloseDialog({ open: false, fy: null, confirmed: false }); },
  });

  return (
    <Box>
      <PageHeader
        title="Financial Years"
        subtitle="Manage fiscal year periods"
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            New Financial Year
          </Button>
        }
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {financialYears?.map((fy: any) => (
              <TableRow key={fy.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CalendarMonth sx={{ fontSize: 16, color: 'primary.main' }} />
                    </Box>
                    <Typography fontWeight={700}>{fy.label}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(fy.startDate)}</TableCell>
                <TableCell>{formatDateDDMMYYYY(fy.endDate)}</TableCell>
                <TableCell>
                  <Chip
                    icon={fy.isClosed ? <Lock sx={{ fontSize: 14 }} /> : <LockOpen sx={{ fontSize: 14 }} />}
                    label={fy.isClosed ? 'Closed' : 'Open'}
                    color={fy.isClosed ? 'default' : 'success'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => {
                    setEditingFy(fy);
                    setFormData({ label: fy.label, startDate: fy.startDate?.split('T')[0] || '', endDate: fy.endDate?.split('T')[0] || '' });
                    setDialogOpen(true);
                  }}>
                    Edit
                  </Button>
                  {!fy.isClosed && (
                    <Button size="small" color="warning" onClick={() => setCloseDialog({ open: true, fy, confirmed: false })}>
                      Close FY
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!financialYears || financialYears.length === 0) && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState icon={<CalendarMonth />} title="No financial years" description="Create your first financial year to start tracking inventory" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingFy(null); setFormData({ label: '', startDate: '', endDate: '' }); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFy ? 'Edit Financial Year' : 'New Financial Year'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Label (e.g. 2025-26)" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} fullWidth />
            <DatePickerField label="Start Date" value={formData.startDate} onChange={(v) => setFormData({ ...formData, startDate: v })} fullWidth />
            <DatePickerField label="End Date" value={formData.endDate} onChange={(v) => setFormData({ ...formData, endDate: v })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createMutation.mutate(formData)} disabled={!formData.label || !formData.startDate || !formData.endDate}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeDialog.open} onClose={() => setCloseDialog({ open: false, fy: null, confirmed: false })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Close Financial Year
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            This action cannot be undone.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            You are about to close FY <strong>{closeDialog.fy?.label}</strong>. This will:
          </Typography>
          <Stack spacing={1} sx={{ mb: 2, pl: 1 }}>
            <Typography variant="body2">1. Calculate closing balances for all items across all stores, dharamshalas, and rooms.</Typography>
            <Typography variant="body2">2. Create opening stock entries in the next FY with the same quantities and rates.</Typography>
            <Typography variant="body2">3. Mark this FY as closed — no further transactions will be allowed.</Typography>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            <strong>Important:</strong> Any incorrect entries, test data, or unposted challans in this FY <em>will be propagated</em> to the next FY. Verify your data before closing.
          </Alert>
          <FormControlLabel
            control={
              <Checkbox
                checked={closeDialog.confirmed}
                onChange={(e) => setCloseDialog({ ...closeDialog, confirmed: e.target.checked })}
              />
            }
            label="I understand the closing balances will be carried forward and this cannot be undone"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialog({ open: false, fy: null, confirmed: false })}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!closeDialog.confirmed}
            onClick={() => closeDialog.fy && closeMutation.mutate(closeDialog.fy)}
          >
            Close Financial Year
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
