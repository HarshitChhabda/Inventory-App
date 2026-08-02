import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Autocomplete,
  Divider, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem,
  Chip, alpha, useTheme, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Tooltip,
} from '@mui/material';
import { Add, Delete, Save, ArrowBack, Receipt, Inventory2, Summarize, AddCircleOutline, Close } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import DatePickerField from '../../../components/DatePickerField';
import { todayISO } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function ReceiptChallanForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isEdit = id && id !== 'new';

  const [formData, setFormData] = useState({
    date: todayISO(),
    sourceType: 'Vendor',
    vendorId: null as number | null,
    sourceName: '',
    invoiceNumber: '',
    invoiceDate: '',
    vehicleNumber: '',
    receivedBy: '',
    departmentId: null as number | null,
    categoryId: null as number | null,
    remarks: '',
    items: [] as Array<{ itemId: number; unitId: number; quantity: number; rate: number; remarks: string }>,
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => window.electronAPI.dbQuery('vendor', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true, category: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: () => window.electronAPI.dbQuery('unit', 'findMany', { orderBy: { name: 'asc' } }),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => window.electronAPI.dbQuery('itemCategory', 'findMany', { orderBy: { name: 'asc' } }),
  });

  const { data: allDepartments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  // Recent items from localStorage
  const [recentItemIds, setRecentItemIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('recentReceiptItems') || '[]'); } catch { return []; }
  });

  // Quick Add Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [addItemRowIndex, setAddItemRowIndex] = useState<number | null>(null);
  const [newItemForm, setNewItemForm] = useState({
    itemName: '', categoryId: 0, unitId: 0, minimumStockLevel: 0,
  });
  const [newUnitName, setNewUnitName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Quick Add Vendor dialog state
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState({
    name: '', contactPerson: '', phone: '', address: '', gstNumber: '',
  });

  const departments = allDepartments?.filter((d: any) => d.departmentType === 'Store');

  // Filter items by selected category OR selected store (show all if no filter)
  const filteredItems = (() => {
    if (!items) return items;
    let result = items;
    if (formData.categoryId) {
      result = result.filter((i: any) => i.categoryId === formData.categoryId);
    }
    if (formData.departmentId) {
      const matched = result.filter((i: any) => i.category?.departmentId === formData.departmentId);
      if (matched.length > 0) result = matched;
    }
    return result;
  })();

  useEffect(() => {
    if (isEdit) {
      window.electronAPI.dbQuery('receiptChallan', 'findUnique', {
        where: { id: Number(id) },
        include: { vendor: true, items: true },
      }).then((rc: any) => {
        if (rc) {
          setFormData({
            date: rc.date.split('T')[0],
            sourceType: rc.sourceType,
            vendorId: rc.vendorId,
            sourceName: rc.sourceName || '',
            invoiceNumber: rc.invoiceNumber || '',
            invoiceDate: rc.invoiceDate ? rc.invoiceDate.split('T')[0] : '',
            vehicleNumber: rc.vehicleNumber || '',
            receivedBy: rc.receivedBy,
            departmentId: rc.departmentId,
            categoryId: null,
            remarks: rc.remarks || '',
            items: rc.items.map((i: any) => ({
              itemId: i.itemId, unitId: i.unitId, quantity: Number(i.quantity),
              rate: Number(i.rate), remarks: i.remarks || '',
            })),
          });
        }
      });
    }
  }, [id, isEdit]);

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: 0, unitId: 0, quantity: 1, rate: 0, remarks: '' }],
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      (items[index] as any)[field] = value;
      if (field === 'itemId') {
        const item = items.find((i) => i.itemId === value);
        if (item) items[index].unitId = item.unitId;
      }
      return { ...prev, items };
    });
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const openItemDialog = (rowIndex: number) => {
    setAddItemRowIndex(rowIndex);
    setNewItemForm({ itemName: '', categoryId: 0, unitId: 0, minimumStockLevel: 0 });
    setNewUnitName('');
    setNewCategoryName('');
    setItemDialogOpen(true);
  };

  const createItemMutation = useMutation({
    mutationFn: async () => {
      const api = window.electronAPI;
      let unitId = newItemForm.unitId;
      let categoryId = newItemForm.categoryId;
      let categoryPrefix = '';

      // Create unit if user typed a new name instead of selecting existing
      if (!unitId && newUnitName.trim()) {
        const existingUnit = units?.find((u: any) => u.name.toLowerCase() === newUnitName.trim().toLowerCase());
        if (existingUnit) {
          unitId = existingUnit.id;
        } else {
          const created: any = await api.createUnit({ name: newUnitName.trim() });
          unitId = created.id;
          queryClient.invalidateQueries({ queryKey: ['units'] });
        }
      }

      // Create category if user typed a new name instead of selecting existing
      if (!categoryId && newCategoryName.trim()) {
        const existingCat = categories?.find((c: any) => c.name.toLowerCase() === newCategoryName.trim().toLowerCase());
        if (existingCat) {
          categoryId = existingCat.id;
          categoryPrefix = existingCat.prefix;
        } else {
          // Auto-generate prefix from category name (first 2 chars uppercase)
          const autoPrefix = newCategoryName.trim().substring(0, 2).toUpperCase();
          const created: any = await api.createCategory({ name: newCategoryName.trim(), prefix: autoPrefix });
          categoryId = created.id;
          categoryPrefix = autoPrefix;
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
      } else if (categoryId) {
        const cat = categories?.find((c: any) => c.id === categoryId);
        categoryPrefix = cat?.prefix || 'GEN';
      }

      if (!unitId) throw new Error('Unit is required');
      if (!categoryId) throw new Error('Category is required');
      if (!categoryPrefix) throw new Error('Category prefix is required');

      // Get ALL existing item codes for this category (to find lowest available number - no gaps)
      const existingItems: any[] = await api.dbQuery('item', 'findMany', {
        where: { categoryId },
        select: { itemCode: true },
        orderBy: { itemCode: 'asc' },
      });

      // Extract all existing numbers and detect padding length
      const existingNumbers = new Set<number>();
      let maxPadLength = 4; // default 4 digits
      for (const item of existingItems) {
        const numStr = item.itemCode.replace(`${categoryPrefix}-`, '');
        const num = parseInt(numStr);
        if (!isNaN(num)) {
          existingNumbers.add(num);
          // Detect padding from actual string length (e.g., "518" = 3 digits, "0518" = 4 digits)
          if (numStr.length > maxPadLength) maxPadLength = numStr.length;
        }
      }

      // Find lowest available number (no gaps)
      let nextNo = 1;
      while (existingNumbers.has(nextNo)) {
        nextNo++;
      }

      const itemCode = `${categoryPrefix}-${String(nextNo).padStart(maxPadLength, '0')}`;

      const createdItem: any = await api.createItem({
        itemCode,
        itemName: newItemForm.itemName,
        categoryId,
        unitId,
        minimumStockLevel: newItemForm.minimumStockLevel || 0,
        isActive: true,
      });

      queryClient.invalidateQueries({ queryKey: ['items'] });
      return { ...createdItem, unitId, categoryId };
    },
    onSuccess: (createdItem: any) => {
      // Auto-select the newly created item in the row
      if (addItemRowIndex !== null) {
        setFormData((prev) => {
          const newItems = [...prev.items];
          if (addItemRowIndex < newItems.length) {
            newItems[addItemRowIndex] = {
              ...newItems[addItemRowIndex],
              itemId: createdItem.id,
              unitId: createdItem.unitId,
            };
          }
          return { ...prev, items: newItems };
        });
      }
      setItemDialogOpen(false);
      setAddItemRowIndex(null);
      toast.success('Item created successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create item');
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: async () => {
      const api = window.electronAPI;
      const created: any = await api.createVendor(newVendorForm);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      return created;
    },
    onSuccess: (createdVendor: any) => {
      setFormData({ ...formData, vendorId: createdVendor.id, sourceName: '' });
      setVendorDialogOpen(false);
      setNewVendorForm({ name: '', contactPerson: '', phone: '', address: '', gstNumber: '' });
      toast.success('Vendor created successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create vendor');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (status: 'Draft' | 'Posted') => {
      const api = window.electronAPI;
      const validItems = formData.items.filter(i => i.itemId > 0 && i.unitId > 0);
      const formattedItems = validItems.map(i => ({
        itemId: i.itemId, unitId: i.unitId, quantity: i.quantity, rate: i.rate,
        amount: i.quantity * i.rate, remarks: i.remarks,
      }));

      const payload = {
        date: formData.date,
        sourceType: formData.sourceType,
        vendorId: formData.vendorId || null,
        sourceName: formData.sourceName,
        invoiceNumber: formData.invoiceNumber || null,
        invoiceDate: formData.invoiceDate || null,
        vehicleNumber: formData.vehicleNumber || null,
        receivedBy: formData.receivedBy,
        departmentId: formData.departmentId || null,
        remarks: formData.remarks || null,
        companyId: company!.id,
        financialYearId: financialYear!.id,
        status: 'Draft' as const,
      };

      let savedChallan: any;
      if (isEdit) {
        savedChallan = await api.saveReceiptChallan(payload, formattedItems, true, Number(id));
      } else {
        const challans = await api.dbQuery('receiptChallan', 'findMany', {
          where: { companyId: company!.id, financialYearId: financialYear!.id },
          orderBy: { id: 'desc' },
          take: 1,
        });
        const lastNo = challans.length > 0 ? parseInt(challans[0].challanNo.replace('RC-', '')) + 1 : 1;
        const challanNo = `RC-${String(lastNo).padStart(5, '0')}`;
        savedChallan = await api.saveReceiptChallan({ ...payload, challanNo }, formattedItems, false);
      }

      if (status === 'Posted' && savedChallan) {
        await api.postReceiptChallan(savedChallan.id);
      }
      return savedChallan;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['receiptChallans'] }),
        queryClient.invalidateQueries({ queryKey: ['stockTransactions'] }),
        queryClient.invalidateQueries({ queryKey: ['stockBalance'] }),
        queryClient.invalidateQueries({ queryKey: ['stockLedger'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['itemHistory'] }),
        queryClient.invalidateQueries({ queryKey: ['locationBalances'] }),
        queryClient.invalidateQueries({ queryKey: ['report'] }),
      ]);
      navigate('/inventory/receipt-challan');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save receipt challan');
    },
  });

  const totalAmount = formData.items.reduce((sum, i) => sum + i.quantity * i.rate, 0);

  return (
    <Box>
      <PageHeader
        title={isEdit ? 'Edit Receipt Challan' : 'New Receipt Challan (Aamad)'}
        subtitle="Create a new material receipt challan from vendor or other sources"
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/receipt-challan' },
          { label: 'Receipt Challans', path: '/inventory/receipt-challan' },
          { label: isEdit ? 'Edit' : 'New Challan' },
        ]}
        actions={
          <IconButton onClick={() => navigate('/inventory/receipt-challan')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <ArrowBack fontSize="small" />
          </IconButton>
        }
      />

      {/* Challan Details */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <Receipt sx={{ fontSize: 16, color: 'primary.main' }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>Challan Details</Typography>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <DatePickerField
                label="Receipt Date"
                value={formData.date}
                onChange={(v) => setFormData({ ...formData, date: v })}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Source Type</InputLabel>
                <Select
                  value={formData.sourceType}
                  label="Source Type"
                  size="small"
                  onChange={(e) => setFormData({ ...formData, sourceType: e.target.value, vendorId: e.target.value === 'Vendor' ? formData.vendorId : null })}
                >
                  <MenuItem value="Vendor">Vendor</MenuItem>
                  <MenuItem value="JaipurOffice">Jaipur Office</MenuItem>
                  <MenuItem value="OtherBranch">Other Branch</MenuItem>
                  <MenuItem value="Donation">Donation</MenuItem>
                  <MenuItem value="Transfer">Transfer</MenuItem>
                  <MenuItem value="DepartmentReturn">Department Return</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {formData.sourceType === 'Vendor' ? (
              <Grid item xs={12} md={3}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Autocomplete
                    freeSolo
                    options={vendors || []}
                    getOptionLabel={(o) => typeof o === 'string' ? o : o.name}
                    value={vendors?.find((v: any) => v.id === formData.vendorId) || null}
                    onChange={(_, v) => {
                      if (typeof v === 'string') {
                        const match = vendors?.find((vd: any) => vd.name.toLowerCase() === v.toLowerCase());
                        setFormData({ ...formData, vendorId: match?.id || null, sourceName: match ? '' : v });
                      } else {
                        setFormData({ ...formData, vendorId: v?.id || null, sourceName: '' });
                      }
                    }}
                    renderInput={(params) => <TextField {...params} label="Vendor Name" />}
                    sx={{ flex: 1 }}
                  />
                  <Tooltip title="Add new vendor">
                    <IconButton
                      size="small"
                      onClick={() => {
                        const typed = vendors?.find((v: any) => v.id === formData.vendorId) ? '' : formData.sourceName || '';
                        setNewVendorForm({ name: typed, contactPerson: '', phone: '', address: '', gstNumber: '' });
                        setVendorDialogOpen(true);
                      }}
                      sx={{ color: 'primary.main', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                    >
                      <AddCircleOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
            ) : (
              <Grid item xs={12} md={3}>
                <TextField
                  label="Source Name"
                  value={formData.sourceName}
                  onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })}
                  fullWidth
                />
              </Grid>
            )}
            <Grid item xs={12} md={3}>
              <TextField
                label="Invoice Number"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePickerField
                label="Invoice Date"
                value={formData.invoiceDate}
                onChange={(v) => setFormData({ ...formData, invoiceDate: v })}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Vehicle Number"
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Received By"
                value={formData.receivedBy}
                onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth required size="small">
                <InputLabel>Store</InputLabel>
                <Select
                  value={formData.departmentId || ''}
                  label="Store"
                  size="small"
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : null })}
                >
                  <MenuItem value="">Select Store</MenuItem>
                  {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Autocomplete
                options={categories || []}
                getOptionLabel={(o: any) => o.name}
                value={categories?.find((c: any) => c.id === formData.categoryId) || null}
                onChange={(_, v) => setFormData({ ...formData, categoryId: v?.id || null })}
                renderInput={(params) => <TextField {...params} label="Filter by Category" placeholder="All categories" />}
                size="small"
                fullWidth
                clearOnEscape
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                <Inventory2 sx={{ fontSize: 16, color: 'primary.main' }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600}>Items</Typography>
              {formData.items.length > 0 && (
                <Chip label={`${formData.items.length} item${formData.items.length !== 1 ? 's' : ''}`} size="small" color="primary" variant="outlined" />
              )}
            </Stack>
            <Button startIcon={<Add />} onClick={addItem} variant="outlined" size="small">
              Add Item
            </Button>
          </Stack>

          {/* Recent Items Chips */}
          {recentItemIds.length > 0 && (
            <Stack direction="row" spacing={0.5} mb={1.5} useFlexGap flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5 }}>Recent:</Typography>
              {recentItemIds.slice(0, 5).map((rid) => {
                const ri = items?.find((i: any) => i.id === rid);
                if (!ri) return null;
                return (
                  <Chip
                    key={rid}
                    label={`${ri.itemCode} - ${ri.itemName}`}
                    size="small"
                    onClick={() => {
                      if (formData.items.some(i => i.itemId === rid)) return;
                      setFormData(prev => ({
                        ...prev,
                        items: [...prev.items, { itemId: rid, unitId: ri.unitId, quantity: 1, rate: 0, remarks: '' }],
                      }));
                    }}
                    disabled={formData.items.some(i => i.itemId === rid)}
                    sx={{ fontSize: '0.7rem', height: 24 }}
                  />
                );
              })}
            </Stack>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }}>#</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell sx={{ width: 100 }}>Unit</TableCell>
                  <TableCell sx={{ width: 110 }}>Quantity</TableCell>
                  <TableCell sx={{ width: 130 }}>Rate (₹)</TableCell>
                  <TableCell sx={{ width: 130 }}>Amount (₹)</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.items.map((item, idx) => {
                  const selectedItem = items?.find((i: any) => i.id === item.itemId);
                  return (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.secondary">{idx + 1}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Autocomplete
                            size="small"
                            options={filteredItems || []}
                          getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
                          value={items?.find((i: any) => i.id === item.itemId) || null}
                          onChange={(_, v: any) => {
                            setFormData((prev) => {
                              const newItems = [...prev.items];
                              newItems[idx] = { ...newItems[idx], itemId: v?.id || 0, unitId: v?.unitId || v?.unit?.id || 0 };
                              return { ...prev, items: newItems };
                            });
                            if (v?.id) {
                              const newRecent = [v.id, ...recentItemIds.filter(r => r !== v.id)].slice(0, 8);
                              setRecentItemIds(newRecent);
                              localStorage.setItem('recentReceiptItems', JSON.stringify(newRecent));
                            }
                          }}
                            renderInput={(params) => <TextField {...params} placeholder="Search & select item..." />}
                            sx={{ minWidth: 240 }}
                          />
                          <Tooltip title="Add new item">
                            <IconButton
                              size="small"
                              onClick={() => openItemDialog(idx)}
                              sx={{
                                color: 'primary.main',
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                              }}
                            >
                              <AddCircleOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" fontWeight={500}>
                          {selectedItem?.unit?.name || '-'}
                        </Typography>
                      </TableCell>
                       <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const unitName = selectedItem?.unit?.name;
                            const val = Number(e.target.value);
                            const adjusted = isIntegerOnlyUnit(unitName) ? Math.round(val) : val;
                            updateItem(idx, 'quantity', adjusted);
                          }}
                          inputProps={{ min: 0.01, step: isIntegerOnlyUnit(selectedItem?.unit?.name) ? 1 : 0.01 }}
                          sx={{ width: 90 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))}
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ width: 110 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          ₹{(item.quantity * item.rate).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={item.remarks}
                          onChange={(e) => updateItem(idx, 'remarks', e.target.value)}
                          placeholder="Note..."
                          sx={{ width: 130 }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => removeItem(idx)} sx={{ '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {formData.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Inventory2 sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">No items added yet. Click "Add Item" to begin.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Total Summary */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={3}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Summarize sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">₹{totalAmount.toFixed(2)}</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1.5, position: 'sticky', bottom: 16, border: '1px solid', borderColor: 'divider', boxShadow: 4 }}>
        <Button variant="outlined" onClick={() => navigate('/inventory/receipt-challan')}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={() => saveMutation.mutate('Draft')}
        disabled={!formData.receivedBy || !formData.departmentId || formData.items.length === 0 || formData.items.some(i => !i.itemId || !i.unitId)}
      >
        Save Draft
      </Button>
      <Button
        variant="contained"
        color="success"
        onClick={() => saveMutation.mutate('Posted')}
        disabled={!formData.receivedBy || !formData.departmentId || formData.items.length === 0 || formData.items.some(i => !i.itemId || !i.unitId)}
        >
          Post Challan
        </Button>
      </Paper>

      {/* Quick Add Item Dialog */}
      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
            <AddCircleOutline sx={{ fontSize: 20, color: 'primary.main' }} />
          </Box>
          Add New Item
          <IconButton onClick={() => setItemDialogOpen(false)} sx={{ ml: 'auto' }} size="small">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Stack spacing={2}>
            <TextField
              label="Item Name"
              value={newItemForm.itemName}
              onChange={(e) => setNewItemForm({ ...newItemForm, itemName: e.target.value })}
              fullWidth
              required
              autoFocus
              size="small"
            />
            <Autocomplete
              freeSolo
              options={categories || []}
              getOptionLabel={(o) => typeof o === 'string' ? o : o.name}
              value={categories?.find((c: any) => c.id === newItemForm.categoryId) || (newCategoryName ? { id: 0, name: newCategoryName } as any : null)}
              inputValue={newCategoryName}
              onInputChange={(_, v) => setNewCategoryName(v)}
              onChange={(_, v) => {
                if (typeof v === 'string') {
                  const match = categories?.find((c: any) => c.name.toLowerCase() === v.toLowerCase());
                  setNewItemForm({ ...newItemForm, categoryId: match?.id || 0 });
                  setNewCategoryName(match ? '' : v);
                } else {
                  setNewItemForm({ ...newItemForm, categoryId: v?.id || 0 });
                  setNewCategoryName('');
                }
              }}
              renderInput={(params) => <TextField {...params} label="Category" placeholder="Select or type new..." size="small" />}
              size="small"
            />
            <Autocomplete
              freeSolo
              options={units || []}
              getOptionLabel={(o) => typeof o === 'string' ? o : o.name}
              value={units?.find((u: any) => u.id === newItemForm.unitId) || (newUnitName ? { id: 0, name: newUnitName } as any : null)}
              inputValue={newUnitName}
              onInputChange={(_, v) => setNewUnitName(v)}
              onChange={(_, v) => {
                if (typeof v === 'string') {
                  const match = units?.find((u: any) => u.name.toLowerCase() === v.toLowerCase());
                  setNewItemForm({ ...newItemForm, unitId: match?.id || 0 });
                  setNewUnitName(match ? '' : v);
                } else {
                  setNewItemForm({ ...newItemForm, unitId: v?.id || 0 });
                  setNewUnitName('');
                }
              }}
              renderInput={(params) => <TextField {...params} label="Unit" placeholder="Select or type new..." size="small" />}
              size="small"
            />
            <TextField
              label="Minimum Stock Level"
              type="number"
              value={newItemForm.minimumStockLevel}
              onChange={(e) => setNewItemForm({ ...newItemForm, minimumStockLevel: Number(e.target.value) })}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setItemDialogOpen(false)} disabled={createItemMutation.isPending}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={createItemMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Add />}
            onClick={() => createItemMutation.mutate()}
            disabled={!newItemForm.itemName || (!newItemForm.unitId && !newUnitName.trim()) || (!newItemForm.categoryId && !newCategoryName.trim()) || createItemMutation.isPending}
          >
            {createItemMutation.isPending ? 'Creating...' : 'Create Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Add Vendor Dialog */}
      <Dialog open={vendorDialogOpen} onClose={() => setVendorDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 1, bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
            <AddCircleOutline sx={{ fontSize: 20, color: 'warning.main' }} />
          </Box>
          Add New Vendor
          <IconButton onClick={() => setVendorDialogOpen(false)} sx={{ ml: 'auto' }} size="small">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Stack spacing={2}>
            <TextField
              label="Vendor Name"
              value={newVendorForm.name}
              onChange={(e) => setNewVendorForm({ ...newVendorForm, name: e.target.value })}
              fullWidth
              required
              autoFocus
              size="small"
            />
            <TextField
              label="Contact Person"
              value={newVendorForm.contactPerson}
              onChange={(e) => setNewVendorForm({ ...newVendorForm, contactPerson: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Phone"
              value={newVendorForm.phone}
              onChange={(e) => setNewVendorForm({ ...newVendorForm, phone: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Address"
              value={newVendorForm.address}
              onChange={(e) => setNewVendorForm({ ...newVendorForm, address: e.target.value })}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <TextField
              label="GST Number"
              value={newVendorForm.gstNumber}
              onChange={(e) => setNewVendorForm({ ...newVendorForm, gstNumber: e.target.value })}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVendorDialogOpen(false)} disabled={createVendorMutation.isPending}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={createVendorMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Add />}
            onClick={() => createVendorMutation.mutate()}
            disabled={!newVendorForm.name || createVendorMutation.isPending}
          >
            {createVendorMutation.isPending ? 'Creating...' : 'Create Vendor'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
