import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, Autocomplete, Grid, alpha, useTheme,
} from '@mui/material';
import { Add, Search, Warning } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, parseDateDDMMYYYY, todayISO } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

const DAMAGE_REASONS = ['Damaged', 'Lost', 'Broken', 'Scrap', 'Expired'];

export default function DamageEntryPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [formData, setFormData] = useState({
    itemId: 0, departmentId: null as number | null, locationId: null as number | null, date: todayISO(),
    quantity: 1, reason: 'Damaged', reportedBy: '', remarks: '',
  });

  const exportColumns = [
    { header: 'Date', key: 'date' },
    { header: 'Item', key: 'itemName' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Reason', key: 'reason' },
    { header: 'Location', key: 'location' },
    { header: 'Reported By', key: 'reportedBy' },
    { header: 'Original Vendor', key: 'originalVendorName' },
    { header: 'Original Rate', key: 'originalRate' },
  ];

  const { data: allDamages } = useQuery({
    queryKey: ['damages', company?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('damageEntry', 'findMany', {
      where: { companyId: company?.id },
      include: { item: true, location: true },
      orderBy: { date: 'desc' },
    }),
    enabled: !!company?.id,
    refetchOnMount: true,
  });

  const getExportData = () => (allDamages || []).map((d: any) => ({
    date: formatDateDDMMYYYY(d.date),
    itemName: d.item?.itemName || '',
    quantity: d.quantity,
    reason: d.reason,
    location: d.location ? `${d.location.locationType} - ${d.location.locationName}` : '',
    reportedBy: d.reportedBy || '',
    originalVendorName: d.originalVendorName || '',
    originalRate: d.originalRate || '',
  }));

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', { where: { isActive: true }, orderBy: { locationName: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company?.id, isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!company?.id,
  });

  const { data: purchaseHistory } = useQuery({
    queryKey: ['purchaseHistory', formData.itemId, company?.id],
    queryFn: () => window.electronAPI.dbQuery('stockTransaction', 'findMany', {
      where: { companyId: company!.id, itemId: formData.itemId, transactionType: 'PURCHASE' },
      orderBy: { date: 'desc' },
    }),
    enabled: formData.itemId > 0,
  });

  const { data: damages, isLoading } = useQuery({
    queryKey: ['damages', company?.id, page, rowsPerPage],
    queryFn: async () => {
      const [data, total] = await Promise.all([
        window.electronAPI.dbQuery('damageEntry', 'findMany', {
          where: { companyId: company?.id },
          include: { item: true, location: true },
          skip: page * rowsPerPage, take: rowsPerPage, orderBy: { date: 'desc' },
        }),
        window.electronAPI.dbQuery('damageEntry', 'count', { where: { companyId: company?.id } }),
      ]);
      return { data, total };
    },
    refetchOnMount: true,
  });

  const handleImportDamages = async (rows: any[]) => {
    try {
      let created = 0, skipped = 0;
      for (const row of rows) {
        const itemName = row['Item'] || row['itemName'] || '';
        if (!itemName) { skipped++; continue; }
        const item = items?.find((i: any) => i.itemName === itemName);
        if (!item) { skipped++; continue; }
        await window.electronAPI.createDamageEntry({
            itemId: item.itemId || item.id, companyId: company?.id,
            date: (() => { const raw = row['Date'] || row['date'] || ''; const d = parseDateDDMMYYYY(raw); return d || new Date(); })(),
            quantity: Number(row['Quantity'] || row['quantity'] || 1),
            reason: row['Reason'] || row['reason'] || 'Damaged',
            reportedBy: row['Reported By'] || row['reportedBy'] || '',
          });
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return window.electronAPI.createDamageEntry({
        ...data, companyId: company?.id, date: new Date(data.date),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['damages'] }); queryClient.invalidateQueries({ queryKey: ['stockTransactions'] }); queryClient.invalidateQueries({ queryKey: ['stockLedger'] }); queryClient.invalidateQueries({ queryKey: ['stockBalance'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); setDialogOpen(false); setFormData({ itemId: 0, departmentId: null, locationId: null, date: todayISO(), quantity: 1, reason: 'Damaged', reportedBy: '', remarks: '' }); },
  });

  return (
    <Box>
      <PageHeader
        title="Damage Entries"
        subtitle="Record damaged, lost, or scrapped items"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons
              data={getExportData()}
              columns={exportColumns}
              fileName="damage-entries"
              onImport={handleImportDamages}
            />
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New Damage Entry</Button>
          </Stack>
        }
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Reported By</TableCell>
              <TableCell>Original Vendor</TableCell>
              <TableCell>Original Rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {damages?.data?.map((d: any) => (
              <TableRow key={d.id} hover>
                <TableCell>{formatDateDDMMYYYY(d.date)}</TableCell>
                <TableCell>{d.item?.itemName}</TableCell>
                <TableCell>{d.quantity}</TableCell>
                <TableCell>
                  <Box sx={{
                    display: 'inline-flex', px: 1, py: 0.25, borderRadius: 1,
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    color: 'error.main', fontWeight: 500, fontSize: '0.75rem',
                  }}>
                    {d.reason}
                  </Box>
                </TableCell>
                <TableCell>{d.location ? `${d.location.locationType} - ${d.location.locationName}` : '-'}</TableCell>
                <TableCell>{d.reportedBy}</TableCell>
                <TableCell>{d.originalVendorName || '-'}</TableCell>
                <TableCell>{d.originalRate ? `₹${Number(d.originalRate).toFixed(2)}` : '-'}</TableCell>
              </TableRow>
            ))}
            {(!damages?.data || damages.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState icon={<Warning />} title="No damage entries" description="Record your first damage entry" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination component="div" count={damages?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Damage Entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Autocomplete options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`} disablePortal onChange={(_, v: any) => setFormData({ ...formData, itemId: v?.id || 0 })} renderInput={(params) => <TextField {...params} label="Item" />} />
            {purchaseHistory && purchaseHistory.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: alpha(theme.palette.info.main, 0.04), border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`, borderRadius: 2 }}>
                <Typography variant="caption" color="info.main" display="block" mb={0.5} fontWeight={600}>Purchase History (Latest First):</Typography>
                {purchaseHistory.slice(0, 3).map((ph: any) => (
                  <Typography key={ph.id} variant="caption" display="block" color="text.secondary">
                    {formatDateDDMMYYYY(ph.date)} - Qty: {ph.quantity} @ ₹{Number(ph.rate).toFixed(2)} {ph.vendorName ? `(${ph.vendorName})` : ''} {ph.challanNo ? `[${ph.challanNo}]` : ''}
                  </Typography>
                ))}
              </Paper>
            )}
            <DatePickerField label="Date" value={formData.date} onChange={(val) => setFormData({ ...formData, date: val })} />
            <TextField label="Quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} inputProps={{ min: 0.01 }} />
            <FormControl fullWidth>
              <InputLabel>Department (Optional)</InputLabel>
              <Select value={formData.departmentId || ''} label="Department (Optional)" onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : null })}>
                <MenuItem value=""><em>None (Global)</em></MenuItem>
                {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Reason</InputLabel>
              <Select value={formData.reason} label="Reason" onChange={(e) => setFormData({ ...formData, reason: e.target.value })}>
                {DAMAGE_REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
            <Autocomplete options={locations || []} getOptionLabel={(o: any) => `${o.locationType} - ${o.locationName}`} disablePortal onChange={(_, v: any) => setFormData({ ...formData, locationId: v?.id || null })} renderInput={(params) => <TextField {...params} label="Location (Optional)" />} />
            <TextField label="Reported By" value={formData.reportedBy} onChange={(e) => setFormData({ ...formData, reportedBy: e.target.value })} required />
            <TextField label="Remarks" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(formData)} disabled={!formData.itemId || !formData.reportedBy}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
