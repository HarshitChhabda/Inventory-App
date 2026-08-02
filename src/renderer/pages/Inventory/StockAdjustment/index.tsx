import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, Autocomplete, Chip, alpha, useTheme,
} from '@mui/material';
import { Add, Search, Tune } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, parseDateDDMMYYYY, todayISO } from '../../../utils/dateUtils';

const AdjustmentsTable = React.memo(function AdjustmentsTable({
  adjustments,
}: {
  adjustments: any;
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
          {adjustments?.data?.map((adj: any) => (
            <TableRow key={adj.id} hover>
              <TableCell>{formatDateDDMMYYYY(adj.date)}</TableCell>
              <TableCell>{adj.item?.itemName}</TableCell>
              <TableCell>
                <Chip
                  label={adj.adjustmentType}
                  size="small"
                  color={adj.adjustmentType === 'INCREASE' ? 'success' : 'error'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell><Typography fontWeight={600}>{adj.quantity}</Typography></TableCell>
              <TableCell>{adj.reason}</TableCell>
              <TableCell>{adj.adjustedBy}</TableCell>
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
  formData,
  items,
  departments,
  onFormChange,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  formData: any;
  items: any[];
  departments: any[];
  onFormChange: (data: any) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { width: '100%', maxWidth: 520 } }}>
      <DialogTitle>New Stock Adjustment</DialogTitle>
      <DialogContent sx={{ minHeight: 320 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
            onChange={(_, v: any) => onFormChange({ ...formData, itemId: v?.id || 0 })}
            renderInput={(params) => <TextField {...params} label="Item" size="small" />} />
          <DatePickerField label="Date" value={formData.date} onChange={(val) => onFormChange({ ...formData, date: val })} size="small" />
          <FormControl fullWidth size="small">
            <InputLabel>Adjustment Type</InputLabel>
            <Select value={formData.adjustmentType} label="Adjustment Type" onChange={(e) => onFormChange({ ...formData, adjustmentType: e.target.value })}>
              <MenuItem value="INCREASE">INCREASE (Add Stock)</MenuItem>
              <MenuItem value="DECREASE">DECREASE (Remove Stock)</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Quantity" type="number" value={formData.quantity} onChange={(e) => onFormChange({ ...formData, quantity: Number(e.target.value) })} inputProps={{ min: 0.01 }} size="small" />
          <FormControl fullWidth size="small">
            <InputLabel>Department (Optional)</InputLabel>
            <Select value={formData.departmentId || ''} label="Department (Optional)" onChange={(e) => onFormChange({ ...formData, departmentId: e.target.value ? Number(e.target.value) : null })}>
              <MenuItem value=""><em>None (Global)</em></MenuItem>
              {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Reason</InputLabel>
            <Select value={formData.reason} label="Reason" onChange={(e) => onFormChange({ ...formData, reason: e.target.value })}>
              <MenuItem value="Physical Verification">Physical Verification</MenuItem>
              <MenuItem value="Correction">Correction</MenuItem>
              <MenuItem value="Damage Write-off">Damage Write-off</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Adjusted By" value={formData.adjustedBy} onChange={(e) => onFormChange({ ...formData, adjustedBy: e.target.value })} size="small" />
          <TextField label="Approved By" value={formData.approvedBy} onChange={(e) => onFormChange({ ...formData, approvedBy: e.target.value })} size="small" />
          <TextField label="Remarks" value={formData.remarks} onChange={(e) => onFormChange({ ...formData, remarks: e.target.value })} multiline rows={2} size="small" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={!formData.itemId || !formData.adjustedBy || !formData.reason || saving}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
});

export default function StockAdjustmentPage() {
  const { company, financialYear } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [formData, setFormData] = useState({
    itemId: 0, departmentId: null as number | null, date: todayISO(),
    adjustmentType: 'INCREASE', quantity: 1, reason: '', adjustedBy: '', approvedBy: '', remarks: '',
  });

  const exportColumns = [
    { header: 'Date', key: 'date' },
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
      include: { item: true }, orderBy: { date: 'desc' },
    }),
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const getExportData = () => (allAdjustments || []).map((adj: any) => ({
    date: formatDateDDMMYYYY(adj.date),
    itemName: adj.item?.itemName || '',
    adjustmentType: adj.adjustmentType,
    quantity: adj.quantity,
    reason: adj.reason || '',
    adjustedBy: adj.adjustedBy || '',
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
          include: { item: true }, skip: page * rowsPerPage, take: rowsPerPage, orderBy: { date: 'desc' },
        }),
        window.electronAPI.dbQuery('stockAdjustment', 'count', { where: { companyId: company!.id, financialYearId: financialYear!.id } }),
      ]);
      return { data, total };
    },
    refetchOnMount: true,
  });

  const handleImportAdjustments = async (rows: any[]) => {
    try {
      let created = 0, skipped = 0;
      for (const row of rows) {
        const itemName = row['Item'] || row['itemName'] || '';
        if (!itemName) { skipped++; continue; }
        const item = items?.find((i: any) => i.itemName === itemName);
        if (!item) { skipped++; continue; }
        await window.electronAPI.createStockAdjustment({
            itemId: item.itemId || item.id,
            companyId: company!.id,
            financialYearId: financialYear!.id,
            date: (() => { const raw = row['Date'] || row['date'] || ''; const d = parseDateDDMMYYYY(raw); return d || new Date(); })(),
            adjustmentType: row['Type'] || row['adjustmentType'] || 'INCREASE',
            quantity: Number(row['Quantity'] || row['quantity'] || 1),
            reason: row['Reason'] || row['reason'] || '',
            adjustedBy: row['Adjusted By'] || row['adjustedBy'] || '',
          });
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
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
      setDialogOpen(false);
      setFormData({ itemId: 0, departmentId: null, date: todayISO(), adjustmentType: 'INCREASE', quantity: 1, reason: '', adjustedBy: '', approvedBy: '', remarks: '' });
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate(formData);
  }, [saveMutation, formData]);

  return (
    <Box>
      <PageHeader
        title="Stock Adjustments"
        subtitle="Correct stock quantities via adjustments"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
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

      <AdjustmentsTable adjustments={adjustments} />

      <TablePagination component="div" count={adjustments?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <AdjustmentDialog
        open={dialogOpen}
        formData={formData}
        items={items || []}
        departments={departments || []}
        onFormChange={setFormData}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />
    </Box>
  );
}
