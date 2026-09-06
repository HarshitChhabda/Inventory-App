import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Card, CardContent,
  FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Autocomplete, Chip, Divider,
} from '@mui/material';
import { Add, Delete, Send, Save, ArrowBack } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCompany } from '../../../context/CompanyContext';
import DatePickerField from '../../../components/DatePickerField';
import { useUnsavedChangesWarning, suppressUnsavedWarning } from '../../../hooks/useUnsavedChangesWarning';

const requisitionSchema = z.object({
  requestType: z.string(),
  priority: z.string(),
  departmentId: z.union([z.number(), z.literal('')]),
  sourceStoreId: z.union([z.number(), z.literal('')]),
  destStoreId: z.union([z.number(), z.literal('')]),
  requiredDate: z.string(),
  remarks: z.string(),
});

type RequisitionFormData = z.infer<typeof requisitionSchema>;

const REQUEST_TYPES = [
  { value: 'ISSUE', label: 'Issue Request' },
  { value: 'TRANSFER', label: 'Transfer Request' },
  { value: 'INSTALLATION', label: 'Installation Request' },
  { value: 'REPAIR', label: 'Repair Request' },
  { value: 'REPLACEMENT', label: 'Replacement Request' },
  { value: 'DAMAGE', label: 'Damage Report' },
  { value: 'ADJUSTMENT', label: 'Adjustment Request' },
  { value: 'PURCHASE', label: 'Purchase Request' },
  { value: 'RETURN', label: 'Return Request' },
  { value: 'SCRAP', label: 'Scrap Request' },
];

const PRIORITIES = [
  { value: 'EMERGENCY', label: 'Emergency', color: '#DC2626' },
  { value: 'HIGH', label: 'High', color: '#F97316' },
  { value: 'MEDIUM', label: 'Medium', color: '#F59E0B' },
  { value: 'LOW', label: 'Low', color: '#22C55E' },
];

interface RequisitionItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  requestedQty: number;
  unitName: string;
  reason: string;
  remarks: string;
}

export default function RequisitionCreatePage() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const [items, setItems] = useState<RequisitionItem[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemReason, setItemReason] = useState('');
  const [itemRemarks, setItemRemarks] = useState('');

  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<RequisitionFormData>({
    resolver: zodResolver(requisitionSchema),
    mode: 'onChange',
    defaultValues: {
      requestType: 'ISSUE',
      priority: 'MEDIUM',
      departmentId: '',
      sourceStoreId: '',
      destStoreId: '',
      requiredDate: '',
      remarks: '',
    },
  });

  useUnsavedChangesWarning({ isDirty: isDirty || items.length > 0 });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: itemsList } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true, brand: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: financialYear } = useQuery({
    queryKey: ['currentFY'],
    queryFn: () => window.electronAPI.dbQuery('financialYear', 'findFirst', { where: { isClosed: false }, orderBy: { startDate: 'desc' } }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.createRequisition(data),
    onSuccess: (result: any) => {
      toast.success(`Requisition ${result.requisitionNumber} created`);
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      suppressUnsavedWarning();
      navigate('/requisition/list');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create requisition')),
  });

  const handleAddItem = () => {
    if (!selectedItem) { toast.error('Select an item'); return; }
    if (itemQty <= 0) { toast.error('Invalid quantity'); return; }

    const newItem: RequisitionItem = {
      itemId: selectedItem.id,
      itemName: selectedItem.itemName,
      itemCode: selectedItem.itemCode,
      requestedQty: itemQty,
      unitName: selectedItem.unit?.name || '',
      reason: itemReason,
      remarks: itemRemarks,
    };

    if (editingIdx !== null) {
      const updated = [...items];
      updated[editingIdx] = newItem;
      setItems(updated);
    } else {
      setItems([...items, newItem]);
    }
    resetItemForm();
  };

  const resetItemForm = () => {
    setSelectedItem(null);
    setItemQty(1);
    setItemReason('');
    setItemRemarks('');
    setEditingIdx(null);
    setItemDialogOpen(false);
  };

  const handleEditItem = (idx: number) => {
    const item = items[idx];
    setSelectedItem(itemsList?.find((i: any) => i.id === item.itemId));
    setItemQty(item.requestedQty);
    setItemReason(item.reason);
    setItemRemarks(item.remarks);
    setEditingIdx(idx);
    setItemDialogOpen(true);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const onSubmit = async (data: RequisitionFormData) => {
    if (!data.requestType) { toast.error('Select request type'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    if (!financialYear) { toast.error('No active financial year'); return; }

    const dept = departments?.find((d: any) => d.id === data.departmentId);
    const srcStore = stores?.find((s: any) => s.id === data.sourceStoreId);
    const dstStore = stores?.find((s: any) => s.id === data.destStoreId);

    await createMutation.mutateAsync({
      companyId,
      financialYearId: financialYear.id,
      requestType: data.requestType,
      requestedById: 1,
      requestedByName: 'Admin',
      departmentId: data.departmentId || undefined,
      departmentName: dept?.name,
      sourceStoreId: data.sourceStoreId || undefined,
      sourceStoreName: srcStore?.name,
      destStoreId: data.destStoreId || undefined,
      destStoreName: dstStore?.name,
      requiredDate: data.requiredDate || undefined,
      priority: data.priority,
      remarks: data.remarks,
      items,
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/requisition/list')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700}>New Requisition</Typography>
          <Typography variant="body2" color="text.secondary">Create a new inventory request</Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Request Info */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Request Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="requestType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Request Type</InputLabel>
                      <Select {...field} label="Request Type">
                        {REQUEST_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Priority</InputLabel>
                      <Select {...field} label="Priority">
                        {PRIORITIES.map(p => (
                          <MenuItem key={p.value} value={p.value}>
                            <Chip size="small" label={p.label} sx={{ bgcolor: p.color + '20', color: p.color, fontWeight: 600 }} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="departmentId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Department</InputLabel>
                      <Select {...field} label="Department">
                        <MenuItem value="">None</MenuItem>
                        {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="requiredDate"
                  control={control}
                  render={({ field }) => (
                    <DatePickerField fullWidth size="small" label="Required Date" value={field.value} onChange={field.onChange} />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="sourceStoreId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Source Store</InputLabel>
                      <Select {...field} label="Source Store">
                        <MenuItem value="">None</MenuItem>
                        {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="destStoreId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Destination Store</InputLabel>
                      <Select {...field} label="Destination Store">
                        <MenuItem value="">None</MenuItem>
                        {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
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

        {/* Summary */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Summary</Typography>
              <Typography variant="body2" color="text.secondary">Items: {items.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Qty: {items.reduce((sum, i) => sum + i.requestedQty, 0)}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Button fullWidth variant="contained" startIcon={<Send />} onClick={handleSubmit(onSubmit)}
                disabled={items.length === 0 || createMutation.isPending}>
                {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Items */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Items</Typography>
              <Button startIcon={<Add />} variant="outlined" onClick={() => { resetItemForm(); setItemDialogOpen(true); }}>
                Add Item
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell align="right">{item.requestedQty}</TableCell>
                      <TableCell>{item.unitName}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleEditItem(idx)}><Add fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}><Delete fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>No items added. Click "Add Item" to begin.</TableCell></TableRow>
                  )}
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
              <Autocomplete
                options={itemsList || []}
                getOptionLabel={(opt: any) => `${opt.itemCode} — ${opt.itemName}`}
                value={selectedItem}
                onChange={(_, val) => setSelectedItem(val)}
                renderInput={(params) => <TextField {...params} label="Select Item" size="small" />}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Quantity" type="number"
                value={itemQty} onChange={e => setItemQty(Number(e.target.value))} inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Unit" value={selectedItem?.unit?.name || ''} disabled />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Reason" value={itemReason} onChange={e => setItemReason(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Remarks" value={itemRemarks} onChange={e => setItemRemarks(e.target.value)} />
            </Grid>
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
