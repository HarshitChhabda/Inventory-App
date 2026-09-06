import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Card, CardContent,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Autocomplete, Chip, Divider, Tabs, Tab,
} from '@mui/material';
import { Add, Delete, Save, Send, CheckCircle, Cancel, Assignment, ArrowBack } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCompany } from '../../../../context/CompanyContext';
import { useAuth } from '../../../../context/AuthContext';
import DatePickerField from '../../../../components/DatePickerField';
import { useUnsavedChangesWarning, suppressUnsavedWarning } from '../../../../hooks/useUnsavedChangesWarning';

const grnSchema = z.object({
  vendorId: z.union([z.number(), z.literal('')]),
  storeId: z.union([z.number(), z.literal('')]),
  poHeaderId: z.union([z.number(), z.literal('')]),
  receiptDate: z.string().optional(),
  invoiceDate: z.string().optional(),
  invoiceNumber: z.string().optional(),
  sourceType: z.string().optional(),
  remarks: z.string(),
});

type GRNFormData = z.infer<typeof grnSchema>;

interface GRNItem {
  itemId: number; itemName: string; itemCode: string; receivedQty: number;
  unitId?: number; unitName: string; rate: number; batchNumber: string; condition: string; remarks: string;
}

export default function GoodsReceiptFormPage() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { currentUser } = useAuth();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const [items, setItems] = useState<GRNItem[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [qcGRNId, setQcGRNId] = useState<number | null>(null);
  const [qcItems, setQcItems] = useState<any[]>([]);

  const [receiptDate, setReceiptDate] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [sourceType, setSourceType] = useState('VENDOR');

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(0);
  const [itemBatch, setItemBatch] = useState('');
  const [itemCondition, setItemCondition] = useState('GOOD');
  const [itemRemarks, setItemRemarks] = useState('');

  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<GRNFormData>({
    resolver: zodResolver(grnSchema),
    mode: 'onChange',
    defaultValues: {
      vendorId: '',
      storeId: '',
      poHeaderId: '',
      remarks: '',
    },
  });

  useUnsavedChangesWarning({ isDirty: isDirty || items.length > 0 });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => window.electronAPI.searchVendorsP({ companyId, limit: 200 }),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: itemsList } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: financialYear } = useQuery({
    queryKey: ['currentFY'],
    queryFn: () => window.electronAPI.dbQuery('financialYear', 'findFirst', { where: { isClosed: false }, orderBy: { startDate: 'desc' } }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.createGRN(data),
    onSuccess: (result: any) => {
      toast.success(`GRN ${result.grnNumber} created`);
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      suppressUnsavedWarning();
      navigate('/procurement/grn');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create goods receipt')),
  });

  const postMutation = useMutation({
    mutationFn: ({ grnId, postedBy }: any) => window.electronAPI.postGRNToInventory(grnId, postedBy),
    onSuccess: () => {
      toast.success('Posted to inventory');
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to post GRN to inventory')),
  });

  const qcMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.recordQC(data),
    onSuccess: () => { toast.success('QC recorded'); queryClient.invalidateQueries({ queryKey: ['grns'] }); setQcDialogOpen(false); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to record quality check')),
  });

  const handleAddItem = () => {
    if (!selectedItem) { toast.error('Select item'); return; }
    if (itemQty <= 0) { toast.error('Invalid qty'); return; }
    const newItem: GRNItem = {
      itemId: selectedItem.id, itemName: selectedItem.itemName, itemCode: selectedItem.itemCode,
      receivedQty: itemQty, unitId: selectedItem.unitId || selectedItem.unit?.id, unitName: selectedItem.unit?.name || '', rate: itemRate,
      batchNumber: itemBatch, condition: itemCondition, remarks: itemRemarks,
    };
    if (editingIdx !== null) { const u = [...items]; u[editingIdx] = newItem; setItems(u); }
    else { setItems([...items, newItem]); }
    resetItemForm();
  };

  const resetItemForm = () => {
    setSelectedItem(null); setItemQty(1); setItemRate(0); setItemBatch('');
    setItemCondition('GOOD'); setItemRemarks(''); setEditingIdx(null); setItemDialogOpen(false);
  };

  const handleEditItem = (idx: number) => {
    const item = items[idx];
    setSelectedItem(itemsList?.find((i: any) => i.id === item.itemId));
    setItemQty(item.receivedQty); setItemRate(item.rate); setItemBatch(item.batchNumber);
    setItemCondition(item.condition); setItemRemarks(item.remarks);
    setEditingIdx(idx); setItemDialogOpen(true);
  };

  const onSubmit = async (data: GRNFormData) => {
    if (!data.vendorId) { toast.error('Select vendor'); return; }
    if (!data.storeId) { toast.error('Select store'); return; }
    if (items.length === 0) { toast.error('Add items'); return; }
    if (!financialYear) { toast.error('No active FY'); return; }

    await createMutation.mutateAsync({
      companyId, financialYearId: financialYear.id, vendorId: Number(data.vendorId),
      storeId: Number(data.storeId), poHeaderId: data.poHeaderId || undefined,
      receiptDate: receiptDate || undefined,
      invoiceDate: invoiceDate || undefined,
      invoiceNumber: invoiceNumber || undefined,
      sourceType: sourceType || undefined,
      receivedBy: currentUser?.fullName || currentUser?.username || 'system', remarks: data.remarks, items,
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/procurement/grn')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700}>New Goods Receipt</Typography>
          <Typography variant="body2" color="text.secondary">Record incoming goods from vendor</Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Receipt Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="vendorId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small" error={!!errors.vendorId}>
                      <InputLabel>Source Name</InputLabel>
                      <Select {...field} label="Source Name">
                        <MenuItem value="">Select Source</MenuItem>
                        {vendors?.data?.map((v: any) => <MenuItem key={v.id} value={v.id}>{v.vendorCode} — {v.vendorName}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Source Type</InputLabel>
                  <Select value={sourceType} label="Source Type" onChange={e => setSourceType(e.target.value)}>
                    <MenuItem value="VENDOR">Vendor</MenuItem>
                    <MenuItem value="SUPPLIER">Supplier</MenuItem>
                    <MenuItem value="DEPARTMENT">Department</MenuItem>
                    <MenuItem value="STORE">Store</MenuItem>
                    <MenuItem value="OTHER">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="storeId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small" error={!!errors.storeId}>
                      <InputLabel>Store</InputLabel>
                      <Select {...field} label="Store">
                        <MenuItem value="">Select Store</MenuItem>
                        {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePickerField label="Receipt Date" value={receiptDate} onChange={(v) => setReceiptDate(v)} fullWidth size="small" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePickerField label="Invoice Date" value={invoiceDate} onChange={(v) => setInvoiceDate(v)} fullWidth size="small" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Invoice Number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="remarks"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth size="small" label="Remarks" multiline rows={2} />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Summary</Typography>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Items:</Typography><Typography fontWeight={600}>{items.length}</Typography></Box>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Total Qty:</Typography><Typography>{items.reduce((s, i) => s + i.receivedQty, 0)}</Typography></Box>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Amount:</Typography><Typography>₹{items.reduce((s, i) => s + i.receivedQty * i.rate, 0).toLocaleString()}</Typography></Box>
              <Divider sx={{ my: 2 }} />
              <Button fullWidth variant="contained" startIcon={<Send />} onClick={handleSubmit(onSubmit)} disabled={items.length === 0 || createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Create GRN'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Items</Typography>
              <Button startIcon={<Add />} variant="outlined" onClick={() => { resetItemForm(); setItemDialogOpen(true); }}>Add Item</Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>#</TableCell><TableCell>Code</TableCell><TableCell>Item</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Rate</TableCell><TableCell>Batch</TableCell><TableCell>Condition</TableCell><TableCell align="center">Actions</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell align="right">{item.receivedQty}</TableCell>
                      <TableCell align="right">₹{item.rate}</TableCell>
                      <TableCell>{item.batchNumber || '-'}</TableCell>
                      <TableCell><Chip size="small" label={item.condition} color={item.condition === 'GOOD' ? 'success' : 'error'} /></TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleEditItem(idx)}><Add fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Delete fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No items added.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Add Item Dialog */}
      <Dialog open={itemDialogOpen} onClose={resetItemForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingIdx !== null ? 'Edit Item' : 'Add Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete options={itemsList || []} getOptionLabel={(o: any) => `${o.itemCode} — ${o.itemName}`}
                value={selectedItem} onChange={(_, val) => setSelectedItem(val)}
                renderInput={(params) => <TextField {...params} label="Select Item" size="small" />} />
            </Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Qty" type="number" value={itemQty} onChange={e => setItemQty(Number(e.target.value))} inputProps={{ min: 1 }} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Rate (₹)" type="number" value={itemRate} onChange={e => setItemRate(Number(e.target.value))} inputProps={{ min: 0 }} /></Grid>
            <Grid item xs={4}><TextField fullWidth size="small" label="Batch" value={itemBatch} onChange={e => setItemBatch(e.target.value)} /></Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small"><InputLabel>Condition</InputLabel>
                <Select value={itemCondition} label="Condition" onChange={e => setItemCondition(e.target.value)}>
                  <MenuItem value="GOOD">Good</MenuItem><MenuItem value="DAMAGED">Damaged</MenuItem><MenuItem value="DEFECTIVE">Defective</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Remarks" value={itemRemarks} onChange={e => setItemRemarks(e.target.value)} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetItemForm}>Cancel</Button>
          <Button variant="contained" onClick={handleAddItem}>{editingIdx !== null ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
