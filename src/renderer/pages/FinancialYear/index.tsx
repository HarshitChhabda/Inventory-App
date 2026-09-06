import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Stack, TextField, Alert, alpha, useTheme,
  Checkbox, FormControlLabel, Divider, LinearProgress, List, ListItem, ListItemIcon, ListItemText,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { Add, LockOpen, Lock, CalendarMonth, Warning, CheckCircle, ErrorOutline, Delete, Archive, DeleteForever } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import EnterpriseDialog from '../../components/EnterpriseDialog';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import DatePickerField from '../../components/DatePickerField';
import { GuideButton } from '../../components/GuideSystem';
import PostConfirmationDialog from '../../components/PostConfirmationDialog';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';

const fySchema = z.object({
  label: z.string().min(1, 'Label is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
});
type FYFormData = z.infer<typeof fySchema>;

export default function FinancialYearPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFy, setEditingFy] = useState<any>(null);
  const [closeDialog, setCloseDialog] = useState<{ open: boolean; fy: any; confirmed: boolean }>({ open: false, fy: null, confirmed: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; fy: any; confirmed: boolean }>({ open: false, fy: null, confirmed: false });
  const [deleteDepInfo, setDeleteDepInfo] = useState<any>(null);
  const [loadingDepInfo, setLoadingDepInfo] = useState(false);
  const [permDeleteDialog, setPermDeleteDialog] = useState<{ open: boolean; fy: any; confirmLabel: string }>({ open: false, fy: null, confirmLabel: '' });
  const [permDeleteDepInfo, setPermDeleteDepInfo] = useState<any>(null);
  const [loadingPermDepInfo, setLoadingPermDepInfo] = useState(false);
  const [companyDeleteDialog, setCompanyDeleteDialog] = useState<{ open: boolean; fy: any }>({ open: false, fy: null });
  const [fyCompanyInfo, setFyCompanyInfo] = useState<any[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
  const [loadingFyCompanies, setLoadingFyCompanies] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isValid } } = useForm<FYFormData>({
    resolver: zodResolver(fySchema),
    mode: 'onChange',
    defaultValues: { label: '', startDate: '', endDate: '' },
  });
  const [validationResult, setValidationResult] = useState<{ canClose: boolean; issues: string[] } | null>(null);
  const [validating, setValidating] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<any>(null);

  const { data: financialYears, isLoading } = useQuery({
    queryKey: ['financialYears', company?.id],
    queryFn: () => window.electronAPI.findAllFY(company?.id),
    enabled: !!company?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FYFormData) => {
      if (!company?.id) throw new Error('Please select a company first');
      if (editingFy) {
        return window.electronAPI.updateFY(editingFy.id, {
          label: data.label, startDate: data.startDate, endDate: data.endDate,
        });
      }
      return window.electronAPI.createFY({
        companyId: company.id, label: data.label, startDate: data.startDate, endDate: data.endDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
      setDialogOpen(false);
      setEditingFy(null);
      reset({ label: '', startDate: '', endDate: '' });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to save financial year'));
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (fy: any) => {
      return window.electronAPI.closeFY(fy.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
      setCloseDialog({ open: false, fy: null, confirmed: false });
      setValidationResult(null);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to close financial year'));
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (fyId: number) => {
      return window.electronAPI.reopenFY(fyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to reopen financial year'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fyId: number) => {
      return window.electronAPI.deleteDuplicateFY(fyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
      setDeleteDialog({ open: false, fy: null, confirmed: false });
      toast.success('Duplicate financial year deleted');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete financial year'));
    },
  });

  const permDeleteMutation = useMutation({
    mutationFn: async ({ fyId, confirmLabel }: { fyId: number; confirmLabel: string }) => {
      return window.electronAPI.permanentDeleteFY(fyId, confirmLabel);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['fys', company?.id] });
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
      setPermDeleteDialog({ open: false, fy: null, confirmLabel: '' });
      toast.success(`Financial year "${result?.deletedFy}" permanently deleted`);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to permanently delete financial year'));
    },
  });

  const fyCompanyDeleteMutation = useMutation({
    mutationFn: async ({ fyLabel, companyIds }: { fyLabel: string; companyIds: number[] }) => {
      return window.electronAPI.deleteFYFromCompanies(fyLabel, companyIds);
    },
    onSuccess: (results: any[]) => {
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      const deleted = results.filter((r: any) => r.deleted);
      const failed = results.filter((r: any) => !r.deleted);
      if (deleted.length > 0) {
        toast.success(`Deleted FY from: ${deleted.map((r: any) => r.companyName).join(', ')}`);
      }
      if (failed.length > 0) {
        toast.error(`Failed for: ${failed.map((r: any) => `${r.companyName} (${r.error})`).join(', ')}`);
      }
      setCompanyDeleteDialog({ open: false, fy: null });
      setSelectedCompanyIds([]);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete financial year'));
    },
  });

  const handleOpenCompanyDeleteDialog = async (fy: any) => {
    setCompanyDeleteDialog({ open: true, fy });
    setSelectedCompanyIds([]);
    setLoadingFyCompanies(true);
    try {
      const info = await window.electronAPI.getFYCompanyInfo(fy.label);
      setFyCompanyInfo(info);
    } catch (err) {
      setFyCompanyInfo([]);
    } finally {
      setLoadingFyCompanies(false);
    }
  };

  const handleOpenCloseDialog = async (fy: any) => {
    setCloseDialog({ open: true, fy, confirmed: false });
    setValidationResult(null);
    setValidating(true);
    try {
      const result = await window.electronAPI.validateClosingFY(fy.id);
      setValidationResult(result);
    } catch (err) {
      setValidationResult({ canClose: false, issues: ['Failed to validate closing'] });
    } finally {
      setValidating(false);
    }
  };

  const handleDeleteDuplicate = async (fy: any) => {
    setDeleteDialog({ open: true, fy, confirmed: false });
    setDeleteDepInfo(null);
    setLoadingDepInfo(true);
    try {
      const info = await window.electronAPI.getFYDeletionDependencyInfo(fy.id);
      setDeleteDepInfo(info);
    } catch (err) {
      setDeleteDepInfo({ canDelete: false, blockReason: 'Unable to check dependencies' });
    } finally {
      setLoadingDepInfo(false);
    }
  };

  const handleOpenPermDeleteDialog = async (fy: any) => {
    setPermDeleteDialog({ open: true, fy, confirmLabel: '' });
    setPermDeleteDepInfo(null);
    setLoadingPermDepInfo(true);
    try {
      const info = await window.electronAPI.getFYFullDeletionDependencyInfo(fy.id);
      setPermDeleteDepInfo(info);
    } catch (err) {
      setPermDeleteDepInfo(null);
    } finally {
      setLoadingPermDepInfo(false);
    }
  };

  const [hasManageFyPerm, setHasManageFyPerm] = useState(false);
  React.useEffect(() => {
    window.electronAPI.hasPermission('MANAGE_FINANCIAL_YEAR').then(setHasManageFyPerm).catch(() => {});
  }, []);

  return (
    <Box>
      <PageHeader
        title="Financial Years"
        subtitle="Manage fiscal year periods, opening balances, and closing"
        actions={
          <Box display="flex" gap={1}>
            <GuideButton pageId="financial-year" />
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
              New Financial Year
            </Button>
          </Box>
        }
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Transactions</TableCell>
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
                <TableCell>{fy._count?.transactions || 0}</TableCell>
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
                  {!fy.isClosed && (
                    <Button size="small" onClick={() => {
                      setEditingFy(fy);
                      reset({ label: fy.label, startDate: fy.startDate?.split('T')[0] || '', endDate: fy.endDate?.split('T')[0] || '' });
                      setDialogOpen(true);
                    }}>Edit</Button>
                  )}
                  {!fy.isClosed && (
                    <Button size="small" color="warning" onClick={() => handleOpenCloseDialog(fy)}>Close FY</Button>
                  )}
                  {fy.isClosed && (
                    <Button size="small" color="info" onClick={() => setReopenTarget(fy)}
                      disabled={reopenMutation.isPending}>Reopen</Button>
                  )}
                  {!fy.isClosed && (fy._count?.transactions || 0) === 0 && (
                    <Tooltip title="Delete this financial year (no transactions)">
                      <Button size="small" color="error" onClick={() => handleDeleteDuplicate(fy)}>
                        Delete
                      </Button>
                    </Tooltip>
                  )}
                  {hasManageFyPerm && (
                    <Tooltip title="Select which company's FY to delete">
                      <Button size="small" color="warning" onClick={() => handleOpenCompanyDeleteDialog(fy)}>
                        Delete from Companies
                      </Button>
                    </Tooltip>
                  )}
                  {hasManageFyPerm && (
                    <Tooltip title="Permanently delete this FY and ALL associated data">
                      <Button size="small" color="error" startIcon={<DeleteForever sx={{ fontSize: 16 }} />} onClick={() => handleOpenPermDeleteDialog(fy)}>
                        Permanent Delete
                      </Button>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!financialYears || financialYears.length === 0) && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={<CalendarMonth />} title="No financial years" description="Create your first financial year to start tracking inventory" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <EnterpriseDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingFy(null); reset({ label: '', startDate: '', endDate: '' }); }}
        title={editingFy ? 'Edit Financial Year' : 'New Financial Year'}
        icon={<CalendarMonth />}
        actions={
          <>
            <Button onClick={() => { setDialogOpen(false); setEditingFy(null); reset({ label: '', startDate: '', endDate: '' }); }}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit((data) => createMutation.mutate(data))} disabled={!isValid}>
              {editingFy ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Label (e.g. 2025-26)" {...register('label')} error={!!errors.label} helperText={errors.label?.message} fullWidth />
          <DatePickerField label="Start Date" value={watch('startDate')} onChange={(v) => setValue('startDate', v, { shouldValidate: true })} fullWidth />
          <DatePickerField label="End Date" value={watch('endDate')} onChange={(v) => setValue('endDate', v, { shouldValidate: true })} fullWidth />
        </Stack>
      </EnterpriseDialog>

      <EnterpriseDialog
        open={closeDialog.open}
        onClose={() => { setCloseDialog({ open: false, fy: null, confirmed: false }); setValidationResult(null); }}
        title="Close Financial Year"
        subtitle={closeDialog.fy?.label}
        icon={<Warning />}
        actions={
          <>
            <Button onClick={() => { setCloseDialog({ open: false, fy: null, confirmed: false }); setValidationResult(null); }}>Cancel</Button>
            <Button variant="contained" color="warning"
              disabled={!closeDialog.confirmed || (validationResult !== null && !validationResult.canClose) || validating}
              onClick={() => closeDialog.fy && closeMutation.mutate(closeDialog.fy)}>
              Close Financial Year
            </Button>
          </>
        }
      >
        {validating && <LinearProgress sx={{ mb: 2 }} />}

        {validationResult && !validationResult.canClose && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Cannot close — resolve these issues first:</Typography>
            <List dense>
              {validationResult.issues.map((issue, i) => (
                <ListItem key={i} sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><ErrorOutline fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText primary={issue} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        {validationResult && validationResult.canClose && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">All checks passed. Ready to close.</Typography>
          </Alert>
        )}

        <Typography variant="body2" sx={{ mb: 2 }}>
          Closing <strong>{closeDialog.fy?.label}</strong> will:
        </Typography>
        <Stack spacing={1} sx={{ mb: 2, pl: 1 }}>
          <Typography variant="body2">1. Calculate closing balances for all items across all stores.</Typography>
          <Typography variant="body2">2. Create opening balance entries in the next FY.</Typography>
          <Typography variant="body2">3. Lock this FY — no further transactions allowed.</Typography>
          <Typography variant="body2">4. Generate a closing report with receipt/issue/transfer counts.</Typography>
        </Stack>

        <FormControlLabel
          control={<Checkbox checked={closeDialog.confirmed} onChange={(e) => setCloseDialog({ ...closeDialog, confirmed: e.target.checked })} />}
          label="I understand this cannot be undone"
          sx={{ mt: 1 }}
        />
      </EnterpriseDialog>

      <PostConfirmationDialog
        open={deleteDialog.open}
        title="Delete Financial Year"
        summary={[
          { label: 'Financial Year', value: deleteDialog.fy?.label || '—' },
          ...(loadingDepInfo
            ? [{ label: 'Status', value: 'Checking dependencies...' }]
            : deleteDepInfo && !deleteDepInfo.canDelete
              ? [{ label: 'Cannot Delete', value: deleteDepInfo.blockReason || 'This financial year contains data that cannot be deleted.' }]
              : [
                  { label: 'Posted Transactions', value: `${deleteDepInfo?.postedTransactions || 0}` },
                  { label: 'Draft Transactions', value: `${deleteDepInfo?.draftTransactions || 0}` },
                  { label: 'Cancelled/Reversed', value: `${(deleteDepInfo?.cancelledTransactions || 0) + (deleteDepInfo?.reversedTransactions || 0)} (retained for audit)` },
                  { label: 'Action', value: 'This will permanently delete this financial year and all its data' },
                ]),
        ]}
        onConfirm={() => {
          if (deleteDialog.fy) deleteMutation.mutate(deleteDialog.fy.id);
        }}
        onCancel={() => setDeleteDialog({ open: false, fy: null, confirmed: false })}
        loading={deleteMutation.isPending}
        confirmLabel="Delete"
        disableConfirm={loadingDepInfo || (deleteDepInfo && !deleteDepInfo.canDelete)}
      />

      <Dialog open={!!reopenTarget} onClose={() => setReopenTarget(null)}>
        <DialogTitle>Reopen Financial Year</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Reopening this financial year will delete all carry-forward entries. Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="info"
            disabled={reopenMutation.isPending}
            onClick={() => {
              if (reopenTarget) {
                reopenMutation.mutate(reopenTarget.id);
                setReopenTarget(null);
              }
            }}
          >
            Reopen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={permDeleteDialog.open}
        onClose={() => setPermDeleteDialog({ open: false, fy: null, confirmLabel: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteForever color="error" />
          Permanently Delete Financial Year
        </DialogTitle>
        <DialogContent>
          {loadingPermDepInfo && <LinearProgress sx={{ mb: 2 }} />}

          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              This action permanently deletes this Financial Year and all data associated with it. This action cannot be undone.
            </Typography>
          </Alert>

          {permDeleteDepInfo && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Data that will be deleted:</Typography>
              <Stack spacing={0.5} sx={{ pl: 1 }}>
                <Typography variant="body2">Transactions: {permDeleteDepInfo.totalTransactions} (Posted: {permDeleteDepInfo.postedTransactions}, Draft: {permDeleteDepInfo.draftTransactions})</Typography>
                <Typography variant="body2">Ledger Entries: {permDeleteDepInfo.ledgerEntries}</Typography>
                <Typography variant="body2">Requisitions: {permDeleteDepInfo.requisitions}</Typography>
                <Typography variant="body2">Purchase Orders: {permDeleteDepInfo.purchaseOrders}</Typography>
                <Typography variant="body2">Goods Receipts: {permDeleteDepInfo.goodsReceipts}</Typography>
                <Typography variant="body2">Work Orders: {permDeleteDepInfo.workOrders}</Typography>
                <Typography variant="body2">Service Requests: {permDeleteDepInfo.serviceRequests}</Typography>
                <Typography variant="body2">Work Completions: {permDeleteDepInfo.completions}</Typography>
                <Typography variant="body2">Voucher Sequences: {permDeleteDepInfo.voucherSequences}</Typography>
                <Typography variant="body2">Import Histories: {permDeleteDepInfo.importHistories}</Typography>
              </Stack>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" sx={{ mb: 1 }}>
            Type <strong>{permDeleteDialog.fy?.label}</strong> to confirm:
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder={permDeleteDialog.fy?.label || ''}
            value={permDeleteDialog.confirmLabel}
            onChange={(e) => setPermDeleteDialog({ ...permDeleteDialog, confirmLabel: e.target.value })}
            error={permDeleteDialog.confirmLabel !== '' && permDeleteDialog.confirmLabel !== permDeleteDialog.fy?.label}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermDeleteDialog({ open: false, fy: null, confirmLabel: '' })}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForever />}
            disabled={
              permDeleteDialog.confirmLabel !== permDeleteDialog.fy?.label ||
              permDeleteMutation.isPending ||
              loadingPermDepInfo
            }
            onClick={() => {
              if (permDeleteDialog.fy) {
                permDeleteMutation.mutate({
                  fyId: permDeleteDialog.fy.id,
                  confirmLabel: permDeleteDialog.confirmLabel,
                });
              }
            }}
          >
            {permDeleteMutation.isPending ? 'Deleting...' : 'Permanently Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Company-aware FY deletion dialog */}
      <Dialog
        open={companyDeleteDialog.open}
        onClose={() => { setCompanyDeleteDialog({ open: false, fy: null }); setSelectedCompanyIds([]); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Delete Financial Year from Companies
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select which companies should have <strong>{companyDeleteDialog.fy?.label}</strong> removed:
          </Typography>

          {loadingFyCompanies ? (
            <LinearProgress sx={{ my: 2 }} />
          ) : fyCompanyInfo.length === 0 ? (
            <Alert severity="info">This financial year is not associated with any company.</Alert>
          ) : (
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedCompanyIds.length === fyCompanyInfo.length}
                    indeterminate={selectedCompanyIds.length > 0 && selectedCompanyIds.length < fyCompanyInfo.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCompanyIds(fyCompanyInfo.map((c: any) => c.companyId));
                      } else {
                        setSelectedCompanyIds([]);
                      }
                    }}
                  />
                }
                label="Select All"
              />
              <Divider />
              {fyCompanyInfo.map((c: any) => (
                <FormControlLabel
                  key={c.companyId}
                  control={
                    <Checkbox
                      checked={selectedCompanyIds.includes(c.companyId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCompanyIds([...selectedCompanyIds, c.companyId]);
                        } else {
                          setSelectedCompanyIds(selectedCompanyIds.filter(id => id !== c.companyId));
                        }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{c.companyName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.isClosed ? 'Closed' : 'Open'} — {c.transactionCount} transaction(s)
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Stack>
          )}

          {selectedCompanyIds.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This will delete <strong>{companyDeleteDialog.fy?.label}</strong> from {selectedCompanyIds.length} company(s).
              Only FYs with no transactions can be deleted.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCompanyDeleteDialog({ open: false, fy: null }); setSelectedCompanyIds([]); }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={selectedCompanyIds.length === 0 || fyCompanyDeleteMutation.isPending}
            onClick={() => {
              if (companyDeleteDialog.fy) {
                fyCompanyDeleteMutation.mutate({
                  fyLabel: companyDeleteDialog.fy.label,
                  companyIds: selectedCompanyIds,
                });
              }
            }}
          >
            {fyCompanyDeleteMutation.isPending ? 'Deleting...' : `Delete from ${selectedCompanyIds.length} Company(s)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
