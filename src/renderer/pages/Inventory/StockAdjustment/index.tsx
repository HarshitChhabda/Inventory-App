import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Chip, alpha, useTheme,
  CircularProgress, Tooltip, IconButton,
} from '@mui/material';
import { Add, Search, Tune, ArrowBack } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TableSkeleton } from '../../../components/LoadingSkeleton';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import FormSection from '../../../components/FormSection';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import { GuideButton } from '../../../components/GuideSystem';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../../components/ImportProgressDialog';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, normalizeDate, todayISO } from '../../../utils/dateUtils';
import { useUnsavedChangesWarning, suppressUnsavedWarning } from '../../../hooks/useUnsavedChangesWarning';

const adjustmentSchema = z.object({
  itemId: z.number().min(1, 'Item is required'),
  date: z.string().min(1, 'Date is required'),
  adjustmentType: z.string().min(1),
  quantity: z.number().min(0.01, 'Quantity must be positive'),
  departmentId: z.number().nullable(),
  reason: z.string().min(1, 'Reason is required'),
  adjustedBy: z.string().min(1, 'Adjusted by is required'),
  approvedBy: z.string(),
  remarks: z.string(),
});
type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

const AdjustmentsTable = React.memo(function AdjustmentsTable({
  adjustments,
  isLoading,
}: {
  adjustments: any;
  isLoading?: boolean;
}) {
  return (
    <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Item</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell>Adjusted By</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
                <Box sx={{ py: 2 }}>
                  <TableSkeleton rows={5} columns={5} />
                </Box>
              </TableCell>
            </TableRow>
          ) : adjustments?.data?.map((adj: any) => (
            <TableRow key={adj.id} hover>
              <TableCell>{formatDateDDMMYYYY(adj.transactionDate || adj.createdAt)}</TableCell>
              <TableCell>{adj.details?.[0]?.item?.itemName}</TableCell>
              <TableCell>
                <Chip
                  label={adj.remarks?.includes('INCREASE') ? 'INCREASE' : 'DECREASE'}
                  size="small"
                  color={adj.remarks?.includes('INCREASE') ? 'success' : 'error'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell><Typography fontWeight={600}>{adj.details?.[0]?.quantity}</Typography></TableCell>
              <TableCell>{adj.remarks?.split('): ')[1]?.split('.')[0] || adj.remarks || ''}</TableCell>
              <TableCell>{adj.createdBy}</TableCell>
            </TableRow>
          ))}
          {(!adjustments?.data || adjustments.data.length === 0) && (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState icon={<Tune />} title="No stock adjustments" description="Create your first stock adjustment" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

const AdjustmentDialog = React.memo(function AdjustmentDialog({
  open,
  items,
  departments,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  items: any[];
  departments: any[];
  onClose: () => void;
  onSave: (data: AdjustmentFormData) => void;
  saving: boolean;
}) {
  const { control, register, handleSubmit, reset, formState: { isValid, isDirty } } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { itemId: 0, date: todayISO(), adjustmentType: 'INCREASE', quantity: 1, departmentId: null, reason: '', adjustedBy: '', approvedBy: '', remarks: '' },
  });

  useUnsavedChangesWarning({ isDirty });

  React.useEffect(() => {
    if (open) {
      reset({ itemId: 0, date: todayISO(), adjustmentType: 'INCREASE', quantity: 1, departmentId: null, reason: '', adjustedBy: '', approvedBy: '', remarks: '' });
    }
  }, [open, reset]);

  return (
    <EnterpriseDialog
      open={open}
      onClose={onClose}
      title="New Stock Adjustment"
      icon={<Tune />}
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit((data) => onSave(data))} disabled={!isValid || saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="stock-adjustment-form">
        <FormSection title="Item & Date" subtitle="Select item and adjustment date">
          <Stack spacing={2.5}>
            <Controller name="itemId" control={control} render={({ field }) => (
              <Autocomplete options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
                value={items?.find((i: any) => i.id === field.value) || null}
                onChange={(_, v: any) => field.onChange(v?.id || 0)}
                renderInput={(params) => <TextField {...params} label="Item" size="small" />} />
            )} />
            <Controller name="date" control={control} render={({ field }) => (
              <DatePickerField label="Date" value={field.value} onChange={field.onChange} size="small" />
            )} />
          </Stack>
        </FormSection>
        <FormSection title="Adjustment Details" subtitle="Type, quantity, and reason">
          <Stack spacing={2.5}>
            <Controller name="adjustmentType" control={control} render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Adjustment Type</InputLabel>
                <Select {...field} label="Adjustment Type" MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                  <MenuItem value="INCREASE">INCREASE (Add Stock)</MenuItem>
                  <MenuItem value="DECREASE">DECREASE (Remove Stock)</MenuItem>
                </Select>
              </FormControl>
            )} />
            <TextField label="Quantity" type="number" {...register('quantity', { valueAsNumber: true })} inputProps={{ min: 0.01 }} size="small" />
            <Controller name="departmentId" control={control} render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Department (Optional)</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Department (Optional)" onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                  <MenuItem value=""><em>None (Global)</em></MenuItem>
                  {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            )} />
            <Controller name="reason" control={control} render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Reason</InputLabel>
                <Select {...field} label="Reason" MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                  <MenuItem value="Physical Verification">Physical Verification</MenuItem>
                  <MenuItem value="Correction">Correction</MenuItem>
                  <MenuItem value="Damage Write-off">Damage Write-off</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            )} />
          </Stack>
        </FormSection>
        <FormSection title="Approval & Notes" divider={false}>
          <Stack spacing={2.5}>
            <TextField label="Adjusted By" {...register('adjustedBy')} size="small" />
            <TextField label="Approved By" {...register('approvedBy')} size="small" />
            <TextField label="Remarks" {...register('remarks')} multiline rows={2} size="small" />
          </Stack>
        </FormSection>
      </form>
    </EnterpriseDialog>
  );
});

export default function StockAdjustmentPage() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const exportColumns = [
    { header: 'Date', key: 'transactionDate' },
    { header: 'Item', key: 'itemName' },
    { header: 'Type', key: 'adjustmentType' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Reason', key: 'reason' },
    { header: 'Adjusted By', key: 'adjustedBy' },
  ];

  const { data: allAdjustments } = useQuery({
    queryKey: ['adjustments', company?.id, financialYear?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('stockAdjustment', 'findMany', {
      where: { companyId: company!.id, financialYearId: financialYear!.id },
      include: { details: { include: { item: true } }, department: true }, orderBy: { transactionDate: 'desc' },
    }),
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const getExportData = () => (allAdjustments || []).map((adj: any) => ({
    transactionDate: formatDateDDMMYYYY(adj.transactionDate || adj.createdAt),
    itemName: adj.details?.[0]?.item?.itemName || '',
    adjustmentType: adj.remarks?.includes('INCREASE') ? 'INCREASE' : 'DECREASE',
    quantity: adj.details?.[0]?.quantity || 0,
    reason: adj.remarks?.split('): ')[1]?.split('.')[0] || '',
    adjustedBy: adj.createdBy || '',
  }));

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company?.id, isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!company?.id,
  });

  const { data: adjustments, isLoading } = useQuery({
    queryKey: ['adjustments', company?.id, financialYear?.id, page, rowsPerPage],
    queryFn: async () => {
      const [data, total] = await Promise.all([
        window.electronAPI.dbQuery('stockAdjustment', 'findMany', {
          where: { companyId: company!.id, financialYearId: financialYear!.id },
          include: { details: { include: { item: true } }, department: true }, skip: page * rowsPerPage, take: rowsPerPage, orderBy: { transactionDate: 'desc' },
        }),
        window.electronAPI.dbQuery('stockAdjustment', 'count', { where: { companyId: company!.id, financialYearId: financialYear!.id } }),
      ]);
      return { data, total };
    },
    refetchOnMount: true,
  });

  const handleImportAdjustments = async (rows: any[]) => {
    const total = rows.length;
    let created = 0, skipped = 0;
    const errors: string[] = [];
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const itemName = row['Item'] || row['itemName'] || '';
          if (!itemName) { skipped++; errors.push(`Row ${i + 1}: Missing item`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const item = items?.find((i: any) => i.itemName === itemName);
          if (!item) { skipped++; errors.push(`Row ${i + 1}: Item "${itemName}" not found`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const transactionDate = normalizeDate(row['Date'] || row['date'] || '');
          if (!transactionDate) {
            skipped++;
            errors.push(`Row ${i + 1} (${itemName}): Invalid date`);
            setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors }));
            continue;
          }
          await window.electronAPI.createStockAdjustment({
            itemId: item.itemId || item.id, companyId: company!.id, financialYearId: financialYear!.id,
            date: transactionDate, adjustmentType: row['Type'] || row['adjustmentType'] || 'INCREASE',
            quantity: Number(row['Quantity'] || row['quantity'] || 1),
            reason: row['Reason'] || row['reason'] || '', adjustedBy: row['Adjusted By'] || row['adjustedBy'] || '',
          });
          created++;
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1, created, skipped, errors }));
      }
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error('Import failed: ' + err.message);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return window.electronAPI.createStockAdjustment({
        ...data, companyId: company!.id, financialYearId: financialYear!.id, date: new Date(data.date),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      suppressUnsavedWarning();
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to save stock adjustment'));
    },
  });

  return (
    <Box>
      <PageHeader
        title="Stock Adjustments"
        subtitle="Correct stock quantities via adjustments"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="stock-adjustment" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <ImportExportButtons
              data={getExportData()}
              columns={exportColumns}
              fileName="stock-adjustments"
              onImport={handleImportAdjustments}
            />
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New Adjustment</Button>
          </Stack>
        }
      />

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="stock adjustments" />

      <AdjustmentsTable adjustments={adjustments} isLoading={isLoading} />

      <TablePagination component="div" count={adjustments?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <AdjustmentDialog
        open={dialogOpen}
        items={items || []}
        departments={departments || []}
        onClose={() => setDialogOpen(false)}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </Box>
  );
}
