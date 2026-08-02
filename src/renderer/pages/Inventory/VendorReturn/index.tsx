import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, Autocomplete, Grid, alpha, useTheme,
} from '@mui/material';
import { Add, Search, Undo } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, parseDateDDMMYYYY, todayISO } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function VendorReturnPage() {
  const { company, financialYear } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [formData, setFormData] = useState({
    vendorId: 0, departmentId: null as number | null, date: todayISO(), reason: '', returnedBy: '', remarks: '',
    items: [] as Array<{ itemId: number; quantity: number; rate: number }>,
  });

  const exportColumns = [
    { header: 'Challan No', key: 'challanNo' },
    { header: 'Date', key: 'date' },
    { header: 'Vendor', key: 'vendorName' },
    { header: 'Items Count', key: 'itemsCount' },
    { header: 'Reason', key: 'reason' },
    { header: 'Status', key: 'status' },
  ];

  const getExportData = () => (allReturns || []).map((vrc: any) => ({
    challanNo: vrc.challanNo,
    date: formatDateDDMMYYYY(vrc.date),
    vendorName: vrc.vendor?.name || '',
    itemsCount: vrc.items?.length || 0,
    reason: vrc.reason || '',
    status: vrc.status,
  }));

  const { data: allReturns } = useQuery({
    queryKey: ['vendorReturns', company?.id, financialYear?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('vendorReturnChallan', 'findMany', {
      where: { companyId: company!.id, financialYearId: financialYear!.id },
      include: { vendor: true, items: { include: { item: true } } },
      orderBy: { date: 'desc' },
    }),
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => window.electronAPI.dbQuery('vendor', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
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
        window.electronAPI.dbQuery('vendorReturnChallan', 'findMany', {
          where: { companyId: company!.id, financialYearId: financialYear!.id },
          include: { vendor: true, items: { include: { item: true } } },
          skip: page * rowsPerPage, take: rowsPerPage, orderBy: { date: 'desc' },
        }),
        window.electronAPI.dbQuery('vendorReturnChallan', 'count', { where: { companyId: company!.id, financialYearId: financialYear!.id } }),
      ]);
      return { data, total };
    },
    refetchOnMount: true,
  });

  const handleImportReturns = async (rows: any[]) => {
    try {
      let created = 0, skipped = 0;
      for (const row of rows) {
        const vendorName = row['Vendor'] || row['vendorName'] || '';
        if (!vendorName) { skipped++; continue; }
        const vendor = vendors?.find((v: any) => v.name === vendorName);
        if (!vendor) { skipped++; continue; }
        const challan = await window.electronAPI.createVendorReturn({
          companyId: company!.id, financialYearId: financialYear!.id,
          vendorId: vendor.id, date: (() => { const raw = row['Date'] || row['date'] || ''; const d = parseDateDDMMYYYY(raw); return d || new Date(); })(),
          reason: row['Reason'] || row['reason'] || '', returnedBy: row['Returned By'] || row['returnedBy'] || '',
          items: [],
        });
        if (challan?.id) {
          await window.electronAPI.postVendorReturn(challan.id);
        }
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ['vendorReturns'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const addItem = () => setFormData((prev) => ({ ...prev, items: [...prev.items, { itemId: 0, quantity: 1, rate: 0 }] }));
  const updateItem = (index: number, field: string, value: any) => {
    setFormData((prev) => { const items = [...prev.items]; (items[index] as any)[field] = value; return { ...prev, items }; });
  };
  const removeItem = (index: number) => setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const challan = await window.electronAPI.createVendorReturn({
        companyId: company!.id, financialYearId: financialYear!.id,
        vendorId: formData.vendorId, departmentId: formData.departmentId,
        date: new Date(formData.date), reason: formData.reason,
        returnedBy: formData.returnedBy, remarks: formData.remarks,
        items: formData.items.filter((i) => i.itemId > 0),
      });
      if (challan?.id) {
        await window.electronAPI.postVendorReturn(challan.id, formData.departmentId);
      }
      return challan;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendorReturns'] }); queryClient.invalidateQueries({ queryKey: ['stockTransactions'] }); queryClient.invalidateQueries({ queryKey: ['stockLedger'] }); queryClient.invalidateQueries({ queryKey: ['stockBalance'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); queryClient.invalidateQueries({ queryKey: ['report'] }); setDialogOpen(false); },
  });

  return (
    <Box>
      <PageHeader
        title="Vendor Returns"
        subtitle="Manage material returns to vendors"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Challan No</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returns?.data?.map((vrc: any) => (
              <TableRow key={vrc.id} hover>
                <TableCell>
                  <Chip label={vrc.challanNo} size="small" color="warning" variant="outlined" sx={{ fontWeight: 600, fontFamily: 'monospace' }} />
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(vrc.date)}</TableCell>
                <TableCell>{vrc.vendor?.name}</TableCell>
                <TableCell><Typography fontWeight={600}>{vrc.items?.length || 0}</Typography></TableCell>
                <TableCell>{vrc.reason}</TableCell>
                <TableCell><Chip label={vrc.status} size="small" color={vrc.status === 'Posted' ? 'success' : 'warning'} variant="outlined" /></TableCell>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Vendor Return Challan</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete options={vendors || []} getOptionLabel={(o: any) => o.name}
                  disablePortal
                  onChange={(_, v: any) => setFormData({ ...formData, vendorId: v?.id || 0 })}
                  renderInput={(params) => <TextField {...params} label="Vendor" />} />
              </Grid>
              <Grid item xs={12} md={6}><DatePickerField label="Date" value={formData.date} onChange={(val) => setFormData({ ...formData, date: val })} fullWidth /></Grid>
              <Grid item xs={12} md={6}><TextField label="Reason" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} fullWidth required /></Grid>
              <Grid item xs={12} md={6}><TextField label="Returned By" value={formData.returnedBy} onChange={(e) => setFormData({ ...formData, returnedBy: e.target.value })} fullWidth required /></Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Department (Optional)</InputLabel>
                  <Select value={formData.departmentId || ''} label="Department (Optional)" onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : null })}>
                    <MenuItem value=""><em>None (Derive from Receipt)</em></MenuItem>
                    {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Typography variant="subtitle1" fontWeight={600} mt={1}>Items to Return</Typography>
            {formData.items.map((item, idx) => (
              <Stack key={idx} direction="row" spacing={1} alignItems="center">
                <Autocomplete size="small" options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
                  disablePortal
                  onChange={(_, v: any) => updateItem(idx, 'itemId', v?.id || 0)}
                  renderInput={(params) => <TextField {...params} placeholder="Item" />} sx={{ flex: 3 }} />
                <TextField size="small" type="number" label="Qty" value={item.quantity} onChange={(e) => {
                  const selectedItem = items?.find((i: any) => i.id === item.itemId);
                  const unitName = selectedItem?.unit?.name;
                  const val = Number(e.target.value);
                  const adjusted = isIntegerOnlyUnit(unitName) ? Math.round(val) : val;
                  updateItem(idx, 'quantity', adjusted);
                }} inputProps={{ min: 0.01, step: isIntegerOnlyUnit(items?.find((i: any) => i.id === item.itemId)?.unit?.name) ? 1 : 0.01 }} sx={{ flex: 1 }} />
                <TextField size="small" type="number" label="Rate" value={item.rate} onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))} inputProps={{ min: 0 }} sx={{ flex: 1 }} />
                <Button size="small" color="error" onClick={() => removeItem(idx)}>Remove</Button>
              </Stack>
            ))}
            <Button startIcon={<Add />} onClick={addItem} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>Add Item</Button>
            <TextField label="Remarks" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!formData.vendorId || !formData.reason || !formData.returnedBy || formData.items.length === 0}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
