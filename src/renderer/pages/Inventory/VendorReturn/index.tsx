import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination, Chip,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Grid, alpha, useTheme,
  CircularProgress, Tooltip, IconButton,
} from '@mui/material';
import { Add, Search, Undo, ArrowBack } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCompany } from '../../../context/CompanyContext';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
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
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import StatusBadge from '../../../components/StatusBadge';
import PostConfirmationDialog from '../../../components/PostConfirmationDialog';

const formSchema = z.object({
  vendorId: z.number().min(1, 'Vendor is required'),
  date: z.string().min(1, 'Date is required'),
  reason: z.string().min(1, 'Reason is required'),
  remarks: z.string().optional(),
  departmentId: z.number().optional(),
  storeId: z.number().optional(),
  items: z.array(z.object({
    itemId: z.number().min(1, 'Item is required'),
    quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
    unitId: z.number().optional(),
  })).min(1, 'At least one item is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function VendorReturnPage() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormValues | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const { control, handleSubmit, register, reset, watch, formState: { isValid, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorId: 0,
      date: todayISO(),
      reason: '',
      remarks: '',
      departmentId: undefined,
      storeId: undefined,
      items: [],
    },
    mode: 'onChange',
  });

  useUnsavedChangesWarning({ isDirty });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const itemsValue = watch('items');

  const exportColumns = [
    { header: 'Challan No', key: 'challanNo' },
    { header: 'Date', key: 'date' },
    { header: 'Vendor', key: 'vendorName' },
    { header: 'Items Count', key: 'itemsCount' },
    { header: 'Reason', key: 'reason' },
    { header: 'Status', key: 'status' },
  ];

  const getExportData = () => (allReturns || []).map((vrc: any) => ({
    challanNo: vrc.voucherNo,
    date: formatDateDDMMYYYY(vrc.transactionDate),
    vendorName: vrc.vendor?.vendorName || '',
    itemsCount: vrc.details?.length || 0,
    reason: vrc.purpose || '',
    status: vrc.approvalStatus,
  }));

  const { data: allReturns } = useQuery({
    queryKey: ['vendorReturns', company?.id, financialYear?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('transactionHeader', 'findMany', {
      where: { companyId: company!.id, financialYearId: financialYear!.id, voucherType: 'VR' },
      include: { vendor: true, details: { include: { item: true } } },
      orderBy: { transactionDate: 'desc' },
    }),
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => window.electronAPI.dbQuery('vendor', 'findMany', { where: { isActive: true }, orderBy: { vendorName: 'asc' } }),
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company?.id, isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!company?.id,
  });

  const { data: returns, isLoading } = useQuery({
    queryKey: ['vendorReturns', company?.id, financialYear?.id, page, rowsPerPage],
    queryFn: async () => {
      const [data, total] = await Promise.all([
        window.electronAPI.dbQuery('transactionHeader', 'findMany', {
          where: { companyId: company!.id, financialYearId: financialYear!.id, voucherType: 'VR' },
          include: { vendor: true, details: { include: { item: true } } },
          skip: page * rowsPerPage, take: rowsPerPage, orderBy: { transactionDate: 'desc' },
        }),
        window.electronAPI.dbQuery('transactionHeader', 'count', { where: { companyId: company!.id, financialYearId: financialYear!.id, voucherType: 'VR' } }),
      ]);
      return { data, total };
    },
    refetchOnMount: true,
  });

  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImportReturns = async (rows: any[]) => {
    const total = rows.length;
    let created = 0, skipped = 0;
    const errors: string[] = [];
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const vendorName = row['Vendor'] || row['vendorName'] || '';
          if (!vendorName) { skipped++; errors.push(`Row ${i + 1}: Missing vendor`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const vendor = vendors?.find((v: any) => v.vendorName === vendorName);
          if (!vendor) { skipped++; errors.push(`Row ${i + 1}: Vendor "${vendorName}" not found`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const transactionDate = normalizeDate(row['Date'] || row['date'] || '');
          if (!transactionDate) {
            skipped++;
            errors.push(`Row ${i + 1}: Invalid date for vendor "${vendorName}"`);
            setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors }));
            continue;
          }
          const challan = await window.electronAPI.createVendorReturn({
            companyId: company!.id, financialYearId: financialYear!.id,
            vendorId: vendor.id, date: transactionDate,
            reason: row['Reason'] || row['reason'] || '', returnedBy: row['Returned By'] || row['returnedBy'] || '',
            items: [],
          });
          if (challan?.id) {
            await window.electronAPI.postVendorReturn(challan.id);
          }
          created++;
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1, created, skipped, errors }));
      }
      queryClient.invalidateQueries({ queryKey: ['vendorReturns'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error('Import failed: ' + err.message);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const challan = await window.electronAPI.createVendorReturn({
        companyId: company!.id, financialYearId: financialYear!.id,
        vendorId: data.vendorId, departmentId: data.departmentId,
        date: new Date(data.date), reason: data.reason,
        remarks: data.remarks || '',
        items: data.items.filter((i) => i.itemId > 0),
      });
      if (challan?.id) {
        await window.electronAPI.postVendorReturn(challan.id, data.departmentId);
      }
      return challan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorReturns'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      suppressUnsavedWarning();
      setDialogOpen(false);
      reset();
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to save vendor return'));
    },
  });

  const onSubmit = (data: FormValues) => {
    setPendingFormData(data);
    setShowPostConfirm(true);
  };

  return (
    <Box>
      <PageHeader
        title="Vendor Returns"
        subtitle="Manage material returns to vendors"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="vendor-return" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <ImportExportButtons
              data={getExportData()}
              columns={exportColumns}
              fileName="vendor-returns"
              onImport={handleImportReturns}
            />
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New Vendor Return</Button>
          </Stack>
        }
      />

      <TableContainer
        component={Paper}
        sx={{
          borderRadius: '16px',
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          '& .MuiTableCell-root': { fontSize: '0.8125rem' },
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Challan No</TableCell>
              <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Vendor</TableCell>
              <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Items</TableCell>
              <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Reason</TableCell>
              <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem', color: 'text.secondary', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returns?.data?.map((vrc: any) => (
              <TableRow
                key={vrc.id}
                hover
                sx={{
                  '&:nth-of-type(odd)': { bgcolor: alpha(theme.palette.action.hover, 0.02) },
                  '&:hover': { bgcolor: `${alpha(theme.palette.primary.main, 0.04)} !important` },
                  transition: 'background-color 150ms ease-out',
                }}
              >
                <TableCell>
                  <Chip label={vrc.voucherNo} size="small" color="warning" variant="outlined" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.6875rem' }} />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{formatDateDDMMYYYY(vrc.transactionDate)}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{vrc.vendor?.vendorName}</TableCell>
                <TableCell>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 24,
                      height: 24,
                      borderRadius: '6px',
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: 'primary.main',
                    }}
                  >
                    {vrc.details?.length || 0}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vrc.purpose}</TableCell>
                <TableCell>
                  <StatusBadge status={vrc.approvalStatus || 'UNKNOWN'} />
                </TableCell>
              </TableRow>
            ))}
            {(!returns?.data || returns.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={<Undo />} title="No vendor returns" description="Create your first vendor return challan" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination component="div" count={returns?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="vendor returns" />

      <EnterpriseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="New Vendor Return Challan"
        icon={<Undo />}
        maxWidth="md"
        actions={
          <>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="vendor-return-form" variant="contained" disabled={!isValid || saveMutation.isPending} startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
              {saveMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="vendor-return-form" onSubmit={handleSubmit(onSubmit)}>
          <FormSection title="Return Details" subtitle="Vendor, date, and reason">
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Controller
                  control={control}
                  name="vendorId"
                  render={({ field }) => (
                    <Autocomplete
                      options={vendors || []}
                      getOptionLabel={(o: any) => o.vendorName}
                      value={vendors?.find((v: any) => v.id === field.value) || null}
                      onChange={(_, v: any) => field.onChange(v?.id || 0)}
                      renderInput={(params) => <TextField {...params} label="Vendor" />}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  control={control}
                  name="date"
                  render={({ field }) => (
                    <DatePickerField label="Date" value={field.value} onChange={(val) => field.onChange(val)} fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Reason" {...register('reason')} fullWidth required />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Department (Optional)</InputLabel>
                  <Controller
                    control={control}
                    name="departmentId"
                    render={({ field }) => (
                      <Select
                        value={field.value || ''}
                        label="Department (Optional)"
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                      >
                        <MenuItem value=""><em>None (Derive from Receipt)</em></MenuItem>
                        {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                      </Select>
                    )}
                  />
                </FormControl>
              </Grid>
            </Grid>
          </FormSection>
          <FormSection title="Items to Return" subtitle="Add items being returned">
            <Stack spacing={2}>
              {fields.map((field, idx) => (
                <Stack key={field.id} direction="row" spacing={1} alignItems="center">
                  <Controller
                    control={control}
                    name={`items.${idx}.itemId`}
                    render={({ field: itemField }) => (
                      <Autocomplete
                        size="small"
                        options={items || []}
                        getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
                        value={items?.find((i: any) => i.id === itemField.value) || null}
                        onChange={(_, v: any) => {
                          itemField.onChange(v?.id || 0);
                          if (v?.id) {
                            const existingItem = itemsValue[idx];
                            if (existingItem && existingItem.unitId === undefined) {
                              const unitId = v.unit?.id;
                              if (unitId) {
                                control._formValues.items[idx].unitId = unitId;
                              }
                            }
                          }
                        }}
                        renderInput={(params) => <TextField {...params} placeholder="Item" />}
                        sx={{ flex: 3 }}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`items.${idx}.quantity`}
                    render={({ field: qtyField }) => {
                      const selectedItem = items?.find((i: any) => i.id === itemsValue[idx]?.itemId);
                      const unitName = selectedItem?.unit?.name;
                      return (
                        <TextField
                          size="small"
                          type="number"
                          label="Qty"
                          value={qtyField.value}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const adjusted = isIntegerOnlyUnit(unitName) ? Math.round(val) : val;
                            qtyField.onChange(adjusted);
                          }}
                          inputProps={{ min: 0.01, step: isIntegerOnlyUnit(unitName) ? 1 : 0.01 }}
                          sx={{ flex: 1 }}
                        />
                      );
                    }}
                  />
                  <Button size="small" color="error" onClick={() => remove(idx)}>Remove</Button>
                </Stack>
              ))}
              <Button startIcon={<Add />} onClick={() => append({ itemId: 0, quantity: 1, unitId: undefined })} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>Add Item</Button>
            </Stack>
          </FormSection>
          <FormSection title="Additional Notes" divider={false}>
            <TextField label="Remarks" {...register('remarks')} multiline rows={2} fullWidth />
          </FormSection>
        </form>
      </EnterpriseDialog>

      <PostConfirmationDialog
        open={showPostConfirm}
        title="Post Vendor Return"
        summary={[
          { label: 'Date', value: pendingFormData?.date || '—' },
          { label: 'Reason', value: pendingFormData?.reason || '—' },
          { label: 'Items', value: `${pendingFormData?.items.length || 0} item(s)` },
          { label: 'Remarks', value: pendingFormData?.remarks || '—' },
        ]}
        onConfirm={() => {
          setShowPostConfirm(false);
          if (pendingFormData) saveMutation.mutate(pendingFormData);
          setPendingFormData(null);
        }}
        onCancel={() => {
          setShowPostConfirm(false);
          setPendingFormData(null);
        }}
        loading={saveMutation.isPending}
        confirmLabel="Post Return"
      />
    </Box>
  );
}
