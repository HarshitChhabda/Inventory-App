import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Card, CardContent,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Autocomplete, Chip, Divider,
} from '@mui/material';
import { Add, Delete, Save, Send, ArrowBack } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCompany } from '../../../../context/CompanyContext';
import DatePickerField from '../../../../components/DatePickerField';
import { toISODateIST } from '../../../../utils/dateUtils';
import EnterpriseDialog from '../../../../components/EnterpriseDialog';
import { useUnsavedChangesWarning, suppressUnsavedWarning } from '../../../../hooks/useUnsavedChangesWarning';

const poSchema = z.object({
  vendorId: z.union([z.number(), z.literal('')]),
  expectedDelivery: z.string(),
  paymentTerms: z.string(),
  remarks: z.string(),
});

type POFormData = z.infer<typeof poSchema>;

interface POItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  orderedQty: number;
  unitName: string;
  rate: number;
  discount: number;
  discountType: string;
  taxRate: number;
  remarks: string;
}

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const [items, setItems] = useState<POItem[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(0);
  const [itemDiscount, setItemDiscount] = useState(0);
  const [itemDiscountType, setItemDiscountType] = useState('PERCENT');
  const [itemTaxRate, setItemTaxRate] = useState(18);
  const [itemRemarks, setItemRemarks] = useState('');

  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<POFormData>({
    resolver: zodResolver(poSchema),
    mode: 'onChange',
    defaultValues: {
      vendorId: '',
      expectedDelivery: '',
      paymentTerms: 'NET30',
      remarks: '',
    },
  });

  useUnsavedChangesWarning({ isDirty: isDirty || items.length > 0 });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => window.electronAPI.searchVendorsP({ companyId, limit: 200 }),
  });

  const { data: itemsList } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true, brand: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: financialYear } = useQuery({
    queryKey: ['currentFY'],
    queryFn: () => window.electronAPI.dbQuery('financialYear', 'findFirst', { where: { isClosed: false }, orderBy: { startDate: 'desc' } }),
  });

  const { data: existingPO } = useQuery({
    queryKey: ['po', id],
    queryFn: () => window.electronAPI.getPO(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingPO) {
      reset({
        vendorId: existingPO.vendorId,
        expectedDelivery: toISODateIST(existingPO.expectedDelivery) || '',
        paymentTerms: existingPO.paymentTerms || 'NET30',
        remarks: existingPO.remarks || '',
      });
      setItems(existingPO.details?.map((d: any) => ({
        itemId: d.itemId, itemName: d.itemName, itemCode: d.itemCode || '',
        orderedQty: d.orderedQty, unitName: d.unitName || '', rate: d.rate,
        discount: d.discount, discountType: d.discountType || 'PERCENT',
        taxRate: d.taxRate, remarks: '',
      })) || []);
    }
  }, [existingPO, reset]);

  const createMutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? window.electronAPI.updatePO(Number(id), data)
      : window.electronAPI.createPO(data),
    onSuccess: (result: any) => {
      toast.success(isEdit ? 'PO updated' : `PO ${result.poNumber} created`);
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      suppressUnsavedWarning();
      navigate('/procurement/po');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to save purchase order')),
  });

  const handleAddItem = () => {
    if (!selectedItem) { toast.error('Select an item'); return; }
    if (itemQty <= 0) { toast.error('Invalid quantity'); return; }
    if (itemRate <= 0) { toast.error('Invalid rate'); return; }

    const newItem: POItem = {
      itemId: selectedItem.id, itemName: selectedItem.itemName,
      itemCode: selectedItem.itemCode, orderedQty: itemQty,
      unitName: selectedItem.unit?.name || '', rate: itemRate,
      discount: itemDiscount, discountType: itemDiscountType,
      taxRate: itemTaxRate, remarks: itemRemarks,
    };

    if (editingIdx !== null) {
      const updated = [...items]; updated[editingIdx] = newItem; setItems(updated);
    } else {
      setItems([...items, newItem]);
    }
    resetItemForm();
  };

  const resetItemForm = () => {
    setSelectedItem(null); setItemQty(1); setItemRate(0); setItemDiscount(0);
    setItemDiscountType('PERCENT'); setItemTaxRate(18); setItemRemarks('');
    setEditingIdx(null); setItemDialogOpen(false);
  };

  const handleEditItem = (idx: number) => {
    const item = items[idx];
    setSelectedItem(itemsList?.find((i: any) => i.id === item.itemId));
    setItemQty(item.orderedQty); setItemRate(item.rate); setItemDiscount(item.discount);
    setItemDiscountType(item.discountType); setItemTaxRate(item.taxRate); setItemRemarks(item.remarks);
    setEditingIdx(idx); setItemDialogOpen(true);
  };

  const handleRemoveItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const calcTotals = () => {
    let total = 0, discount = 0, tax = 0;
    items.forEach(item => {
      const gross = item.orderedQty * item.rate;
      const disc = item.discountType === 'AMOUNT' ? item.discount : gross * (item.discount / 100);
      const afterDisc = gross - disc;
      const t = afterDisc * (item.taxRate / 100);
      total += gross; discount += disc; tax += t;
    });
    return { total, discount, tax, net: total - discount + tax };
  };

  const onSubmit = async (data: POFormData) => {
    if (!data.vendorId) { toast.error('Select vendor'); return; }
    if (items.length === 0) { toast.error('Add items'); return; }
    if (!financialYear) { toast.error('No active FY'); return; }

    await createMutation.mutateAsync({
      companyId, financialYearId: financialYear.id, vendorId: Number(data.vendorId),
      expectedDelivery: data.expectedDelivery || undefined, paymentTerms: data.paymentTerms,
      remarks: data.remarks, items,
    });
  };

  const totals = calcTotals();

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/procurement/po')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700}>{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</Typography>
          <Typography variant="body2" color="text.secondary">{isEdit ? `Editing ${existingPO?.poNumber || ''}` : 'Create a new purchase order'}</Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>PO Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="vendorId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small" error={!!errors.vendorId}>
                      <InputLabel>Vendor</InputLabel>
                      <Select {...field} label="Vendor">
                        <MenuItem value="">Select Vendor</MenuItem>
                        {vendors?.data?.map((v: any) => <MenuItem key={v.id} value={v.id}>{v.vendorCode} — {v.vendorName}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="expectedDelivery"
                  control={control}
                  render={({ field }) => (
                    <DatePickerField fullWidth size="small" label="Expected Delivery" value={field.value} onChange={field.onChange} />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="paymentTerms"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Terms</InputLabel>
                      <Select {...field} label="Payment Terms">
                        <MenuItem value="COD">COD</MenuItem><MenuItem value="NET15">NET 15</MenuItem>
                        <MenuItem value="NET30">NET 30</MenuItem><MenuItem value="NET60">NET 60</MenuItem>
                        <MenuItem value="ADVANCE">Advance</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
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
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Total:</Typography><Typography>₹{totals.total.toLocaleString()}</Typography></Box>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Discount:</Typography><Typography color="error">-₹{totals.discount.toLocaleString()}</Typography></Box>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Tax:</Typography><Typography>₹{totals.tax.toLocaleString()}</Typography></Box>
              <Divider sx={{ my: 1 }} />
              <Box display="flex" justifyContent="space-between"><Typography fontWeight={700}>Net:</Typography><Typography fontWeight={700} color="primary">₹{totals.net.toLocaleString()}</Typography></Box>
              <Divider sx={{ my: 2 }} />
              <Button fullWidth variant="contained" startIcon={<Send />} onClick={handleSubmit(onSubmit)} disabled={items.length === 0 || createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : isEdit ? 'Update PO' : 'Create PO'}
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
                  <TableRow>
                    <TableCell>#</TableCell><TableCell>Code</TableCell><TableCell>Item</TableCell>
                    <TableCell align="right">Qty</TableCell><TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Disc</TableCell><TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Amount</TableCell><TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => {
                    const gross = item.orderedQty * item.rate;
                    const disc = item.discountType === 'AMOUNT' ? item.discount : gross * (item.discount / 100);
                    const net = gross - disc + (gross - disc) * (item.taxRate / 100);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{item.itemCode}</TableCell>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell align="right">{item.orderedQty}</TableCell>
                        <TableCell align="right">₹{item.rate}</TableCell>
                        <TableCell align="right">{item.discountType === 'PERCENT' ? `${item.discount}%` : `₹${item.discount}`}</TableCell>
                        <TableCell align="right">{item.taxRate}%</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>₹{net.toLocaleString()}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => handleEditItem(idx)}><Add fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}><Delete fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>No items added.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <EnterpriseDialog
        open={itemDialogOpen}
        onClose={resetItemForm}
        title={editingIdx !== null ? 'Edit Item' : 'Add Item'}
        icon={<Add />}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={resetItemForm}>Cancel</Button>
            <Button variant="contained" onClick={handleAddItem}>{editingIdx !== null ? 'Update' : 'Add'}</Button>
          </>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Autocomplete options={itemsList || []} getOptionLabel={(o: any) => `${o.itemCode} — ${o.itemName}`}
              value={selectedItem} onChange={(_, val) => setSelectedItem(val)}
              renderInput={(params) => <TextField {...params} label="Select Item" size="small" />} />
          </Grid>
          <Grid item xs={4}><TextField fullWidth size="small" label="Qty" type="number" value={itemQty} onChange={e => setItemQty(Number(e.target.value))} inputProps={{ min: 1 }} /></Grid>
          <Grid item xs={4}><TextField fullWidth size="small" label="Rate (₹)" type="number" value={itemRate} onChange={e => setItemRate(Number(e.target.value))} inputProps={{ min: 0 }} /></Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small"><InputLabel>Disc Type</InputLabel>
              <Select value={itemDiscountType} label="Disc Type" onChange={e => setItemDiscountType(e.target.value)}>
                <MenuItem value="PERCENT">%</MenuItem><MenuItem value="AMOUNT">₹</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}><TextField fullWidth size="small" label="Discount" type="number" value={itemDiscount} onChange={e => setItemDiscount(Number(e.target.value))} inputProps={{ min: 0 }} /></Grid>
          <Grid item xs={4}><TextField fullWidth size="small" label="Tax %" type="number" value={itemTaxRate} onChange={e => setItemTaxRate(Number(e.target.value))} inputProps={{ min: 0 }} /></Grid>
          <Grid item xs={4}><TextField fullWidth size="small" label="Unit" value={selectedItem?.unit?.name || ''} disabled /></Grid>
          <Grid item xs={12}><TextField fullWidth size="small" label="Remarks" value={itemRemarks} onChange={e => setItemRemarks(e.target.value)} /></Grid>
        </Grid>
      </EnterpriseDialog>
    </Box>
  );
}
