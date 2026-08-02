import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Autocomplete,
  Divider, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem,
  Chip, alpha, useTheme,
} from '@mui/material';
import { Add, Delete, Save, ArrowBack, LocalShipping, Inventory2 } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, todayISO } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function IssueChallanForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isEdit = id && id !== 'new';

  const [formData, setFormData] = useState({
    date: todayISO(),
    serialNo: '',
    sourceStoreId: null as number | null,
    departmentId: 0,
    issuedBy: '',
    approvedBy: '',
    purpose: '',
    remarks: '',
    items: [] as Array<{ itemId: number; unitId: number; quantity: number; locationId: number | null; usedAt: string; purpose: string; remarks: string }>,
  });

  const { data: allDepartments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });
  const departments = allDepartments;

  const { data: allItems } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true, category: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: allLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', { where: { isActive: true }, include: { parent: true }, orderBy: { locationName: 'asc' } }),
  });

  // Stock balances for current FY — per source store department
  const { data: stockBalances } = useQuery({
    queryKey: ['stockBalance', 'issue', company?.id, financialYear?.id, formData.sourceStoreId],
    queryFn: async () => {
      const where: any = { companyId: company!.id, financialYearId: financialYear!.id };
      if (formData.sourceStoreId) where.departmentId = formData.sourceStoreId;
      const txns = await window.electronAPI.dbQuery('stockTransaction', 'findMany', {
        where,
        select: { itemId: true, quantityIn: true, quantityOut: true, locationId: true, transactionType: true },
      });
      const bal: Record<number, number> = {};
      txns.forEach((t: any) => {
        if (!bal[t.itemId]) bal[t.itemId] = 0;
        if (t.transactionType === 'ISSUE' && t.locationId != null) return;
        bal[t.itemId] += Number(t.quantityIn || 0) - Number(t.quantityOut || 0);
      });
      return bal;
    },
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  // Recent items from localStorage
  const [recentItemIds, setRecentItemIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('recentIssueItems') || '[]'); } catch { return []; }
  });

  const storeDepts = departments?.filter((d: any) => d.departmentType === 'Store' || d.departmentType === 'Dharamshala') || [];
  const selectedStore = storeDepts.find((d: any) => d.id === formData.sourceStoreId);
  const selectedDept = departments?.find((d: any) => d.id === formData.departmentId);
  const showLocationColumn = !!selectedDept;

  // Get locations for the selected destination department — match by department name to location name
  const destinationLocations = useMemo(() => {
    if (!allLocations || !selectedDept) return [];
    const deptName = selectedDept.name.trim();
    const parentLoc = allLocations.find((l: any) =>
      (l.locationType === 'Dharamshala' || l.locationType === 'Store' || l.locationType === 'Department') && l.locationName.trim() === deptName
    );
    if (!parentLoc) return [];
    const childRooms = allLocations.filter((l: any) => l.parentId === parentLoc.id && l.locationType === 'Room');
    // If department has child rooms, show them; otherwise show the department's own location
    return childRooms.length > 0 ? childRooms : [parentLoc];
  }, [allLocations, selectedDept]);

  const filteredItems = useMemo(() => {
    return allItems || [];
  }, [allItems]);

  // Aggregate total quantity per itemId across all rows (for stock validation)
  const totalQtyPerItem = useMemo(() => {
    const map: Record<number, number> = {};
    formData.items.forEach((i) => {
      if (i.itemId > 0) {
        map[i.itemId] = (map[i.itemId] || 0) + i.quantity;
      }
    });
    return map;
  }, [formData.items]);

  // In edit mode, build a combined list: filteredItems + any existing items that might not be in the filter
  const allItemsForEdit = useMemo(() => {
    if (!isEdit || !allItems) return filteredItems;
    const existingItemIds = new Set(formData.items.map(i => i.itemId));
    const existingItems = allItems.filter((i: any) => existingItemIds.has(i.id));
    // Merge: existing items + filtered items, deduped
    const merged = new Map<number, any>();
    for (const item of [...existingItems, ...filteredItems]) {
      merged.set(item.id, item);
    }
    return Array.from(merged.values());
  }, [isEdit, allItems, filteredItems, formData.items]);

  // Load existing challan data in edit mode
  useEffect(() => {
    if (isEdit) {
      window.electronAPI.dbQuery('issueChallan', 'findUnique', {
        where: { id: Number(id) },
        include: {
          items: { include: { item: { include: { unit: true, category: true } }, location: true } },
        },
      }).then((ic: any) => {
        if (ic) {
          setFormData({
            date: ic.date.split('T')[0],
            serialNo: ic.serialNo || '',
            sourceStoreId: (ic as any).sourceStoreId || null,
            departmentId: ic.departmentId,
            issuedBy: ic.issuedBy,
            approvedBy: ic.approvedBy || '',
            purpose: ic.purpose || '',
            remarks: ic.remarks || '',
            items: ic.items.map((i: any) => ({
              itemId: i.itemId,
              unitId: i.unitId,
              quantity: Number(i.quantity),
              locationId: i.locationId,
              usedAt: i.usedAt || i.location?.locationName || '',
              purpose: i.purpose || '',
              remarks: i.remarks || '',
            })),
          });
        }
      });
    }
  }, [id, isEdit]);

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: 0, unitId: 0, quantity: 1, locationId: null, usedAt: '', purpose: '', remarks: '' }],
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      (items[index] as any)[field] = value;
      if (field === 'itemId') {
        const itemData = allItemsForEdit.find((i: any) => i.id === value);
        if (itemData) items[index].unitId = itemData.unitId;
      }
      return { ...prev, items };
    });
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const saveMutation = useMutation({
    mutationFn: async (status: 'Draft' | 'Posted') => {
      const api = window.electronAPI;
      const formattedItems = formData.items.map(i => ({
        itemId: i.itemId,
        unitId: i.unitId,
        quantity: i.quantity,
        locationId: i.locationId,
        usedAt: i.usedAt,
        purpose: i.purpose,
        remarks: i.remarks
      }));

      const payload = {
        date: formData.date,
        serialNo: formData.serialNo || null,
        departmentId: formData.departmentId,
        sourceStoreId: formData.sourceStoreId,
        issuedBy: formData.issuedBy,
        approvedBy: formData.approvedBy,
        purpose: formData.purpose,
        remarks: formData.remarks,
        companyId: company!.id,
        financialYearId: financialYear!.id,
        status: 'Draft' as const,
      };

      let savedChallan: any;
      if (isEdit) {
        savedChallan = await api.saveIssueChallan(payload, formattedItems, true, Number(id));
      } else {
        const challans = await api.dbQuery('issueChallan', 'findMany', {
          where: { companyId: company!.id, financialYearId: financialYear!.id },
          orderBy: { id: 'desc' }, take: 1,
        });
        const lastNo = challans.length > 0 ? parseInt(challans[0].challanNo.replace('IC-', '')) + 1 : 1;
        const challanNo = `IC-${String(lastNo).padStart(5, '0')}`;
        savedChallan = await api.saveIssueChallan({ ...payload, challanNo }, formattedItems, false);
      }

      if (status === 'Posted' && savedChallan) {
        await api.postIssueChallan(savedChallan.id);
      }
      return savedChallan;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['issueChallans'] }),
        queryClient.invalidateQueries({ queryKey: ['stockTransactions'] }),
        queryClient.invalidateQueries({ queryKey: ['stockBalance'] }),
        queryClient.invalidateQueries({ queryKey: ['stockLedger'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['itemHistory'] }),
        queryClient.invalidateQueries({ queryKey: ['locationBalances'] }),
        queryClient.invalidateQueries({ queryKey: ['report'] }),
      ]);
      navigate('/inventory/issue-challan');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save issue challan');
    },
  });

  const canSave = formData.sourceStoreId && formData.departmentId && formData.issuedBy && formData.items.length > 0
    && formData.items.every(i => i.itemId > 0 && i.unitId > 0 && i.quantity > 0)
    && Object.entries(totalQtyPerItem).every(([itemId, totalQty]) => totalQty <= (stockBalances?.[Number(itemId)] || 0));

  return (
    <Box>
      <PageHeader
        title={isEdit ? 'Edit Issue Challan' : 'New Issue Challan (Kharch)'}
        subtitle="Issue material from store to dharamshala or department"
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/issue-challan' },
          { label: 'Issue Challans', path: '/inventory/issue-challan' },
          { label: isEdit ? 'Edit' : 'New Challan' },
        ]}
        actions={
          <IconButton onClick={() => navigate('/inventory/issue-challan')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <ArrowBack fontSize="small" />
          </IconButton>
        }
      />

      {/* Challan Details */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <LocalShipping sx={{ fontSize: 16, color: 'primary.main' }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>Challan Details</Typography>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <DatePickerField
                label="Issue Date"
                value={formData.date}
                onChange={(val) => setFormData({ ...formData, date: val })}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Serial Number"
                value={formData.serialNo}
                onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                fullWidth
                placeholder="e.g. INV-001, Bill-123..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl size="small" fullWidth required>
                <InputLabel>Source Store (कहाँ से)</InputLabel>
                <Select
                  size="small"
                  value={formData.sourceStoreId || ''}
                  label="Source Store (कहाँ से)"
                  onChange={(e) => setFormData({ ...formData, sourceStoreId: e.target.value ? Number(e.target.value) : null })}
                >
                  <MenuItem value="">Select Store</MenuItem>
                  {storeDepts.map((d: any) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name} <Typography component="span" variant="caption" sx={{ ml: 0.5, opacity: 0.6 }}>({d.departmentType})</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl size="small" fullWidth required>
                <InputLabel>Issue To (कहाँ जाएगा)</InputLabel>
                <Select
                  size="small"
                  value={formData.departmentId || ''}
                  label="Issue To (कहाँ जाएगा)"
                  onChange={(e) => setFormData({ ...formData, departmentId: Number(e.target.value) })}
                >
                  <MenuItem value="">Select Destination</MenuItem>
                  {departments?.map((d: any) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name} <Typography component="span" variant="caption" sx={{ ml: 0.5, opacity: 0.6 }}>({d.departmentType})</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Issued By"
                value={formData.issuedBy}
                onChange={(e) => setFormData({ ...formData, issuedBy: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Approved By"
                value={formData.approvedBy}
                onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Purpose"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                fullWidth
                placeholder="e.g. Room maintenance, Festival supplies..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                fullWidth
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
            {selectedStore && (
              <Chip
                label={`📦 ${selectedStore.name} se ${filteredItems.length} items available`}
                size="small"
                color="info"
                variant="outlined"
              />
            )}
            {showLocationColumn && (
              <Chip
                label={`🏚️ ${selectedDept?.name} — ${destinationLocations.length} rooms`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
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
            <Button startIcon={<Add />} onClick={addItem} variant="outlined" size="small" disabled={!formData.sourceStoreId}>
              Add Item
            </Button>
          </Stack>

          {/* Recent Items Chips */}
          {recentItemIds.length > 0 && formData.sourceStoreId && (
            <Stack direction="row" spacing={0.5} mb={1.5} useFlexGap flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5 }}>Recent:</Typography>
              {recentItemIds.slice(0, 5).map((rid) => {
                const ri = filteredItems.find((i: any) => i.id === rid) || allItems?.find((i: any) => i.id === rid);
                if (!ri) return null;
                const bal = stockBalances?.[rid] || 0;
                if (bal <= 0) return null;
                return (
                  <Chip
                    key={rid}
                    label={`${ri.itemCode || ri.itemName} (${bal})`}
                    size="small"
                    onClick={() => {
                      if (formData.items.some(i => i.itemId === rid)) return;
                      setFormData(prev => ({
                        ...prev,
                        items: [...prev.items, { itemId: rid, unitId: ri.unitId, quantity: 1, locationId: null, usedAt: '', purpose: '', remarks: '' }],
                      }));
                    }}
                    disabled={formData.items.some(i => i.itemId === rid)}
                    sx={{ fontSize: '0.7rem', height: 24 }}
                  />
                );
              })}
            </Stack>
          )}

          {!formData.sourceStoreId ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <LocalShipping sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">Please select a Source Store first to see available items.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }}>#</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell sx={{ width: 80 }}>Unit</TableCell>
                    <TableCell sx={{ width: 100 }}>Quantity</TableCell>
                    {showLocationColumn && <TableCell>Location / स्थान</TableCell>}
                    <TableCell>Purpose</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell sx={{ width: 50 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formData.items.map((item, idx) => {
                    // Try to find item in filtered list first, then in all items
                    const selectedItem = allItemsForEdit.find((i: any) => i.id === item.itemId)
                      || allItems?.find((i: any) => i.id === item.itemId);
                    return (
                      <TableRow key={idx} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} color="text.secondary">{idx + 1}</Typography>
                        </TableCell>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={stockBalances !== undefined ? allItemsForEdit.filter((o: any) => (stockBalances?.[o.id] || 0) > 0) : allItemsForEdit}
                            getOptionLabel={(o: any) => `${o.itemCode || ''} - ${o.itemName}`}
                            value={selectedItem || null}
                            onChange={(_, v: any) => {
                              updateItem(idx, 'itemId', v?.id || 0);
                              if (v?.id) {
                                const newRecent = [v.id, ...recentItemIds.filter(r => r !== v.id)].slice(0, 8);
                                setRecentItemIds(newRecent);
                                localStorage.setItem('recentIssueItems', JSON.stringify(newRecent));
                              }
                            }}
                            renderOption={(props, option: any) => {
                              const bal = stockBalances?.[option.id] || 0;
                              return (
                                <li {...props} key={option.id}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                    <span>{option.itemCode || ''} - {option.itemName}</span>
                                    <Chip
                                      label={`${bal} ${option.unit?.name || ''}`}
                                      size="small"
                                      sx={{ height: 20, fontSize: '0.65rem', ml: 1, backgroundColor: alpha('#16A34A', 0.1), color: '#16A34A' }}
                                    />
                                  </Box>
                                </li>
                              );
                            }}
                            renderInput={(params) => <TextField {...params} placeholder="Search & select item..." />}
                            sx={{ minWidth: 260 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" fontWeight={500}>
                            {selectedItem?.unit?.name || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
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
                              error={item.itemId > 0 && (totalQtyPerItem[item.itemId] || 0) > (stockBalances?.[item.itemId] || 0)}
                            />
                            {item.itemId > 0 && (
                              <Chip
                                label={`${totalQtyPerItem[item.itemId] || 0} / ${stockBalances?.[item.itemId] || 0}`}
                                size="small"
                                sx={{
                                  height: 20, fontSize: '0.6rem', fontWeight: 600,
                                  backgroundColor: (totalQtyPerItem[item.itemId] || 0) > (stockBalances?.[item.itemId] || 0)
                                    ? alpha('#DC2626', 0.1) : alpha('#16A34A', 0.1),
                                  color: (totalQtyPerItem[item.itemId] || 0) > (stockBalances?.[item.itemId] || 0)
                                    ? '#DC2626' : '#16A34A',
                                }}
                              />
                            )}
                          </Stack>
                        </TableCell>
                        {showLocationColumn && (
                          <TableCell>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={item.locationId || ''}
                                onChange={(e) => {
                                  const locId = e.target.value ? Number(e.target.value) : null;
                                  const loc = destinationLocations.find((l: any) => l.id === locId);
                                  updateItem(idx, 'locationId', locId);
                                  updateItem(idx, 'usedAt', loc?.locationName || '');
                                }}
                                displayEmpty
                              >
                                <MenuItem value="">
                                  <em>Select Location</em>
                                </MenuItem>
                                {destinationLocations.map((loc: any) => (
                                  <MenuItem key={loc.id} value={loc.id}>{loc.locationName}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                        )}
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.purpose}
                            onChange={(e) => updateItem(idx, 'purpose', e.target.value)}
                            placeholder="Use for..."
                            sx={{ width: 150 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.remarks}
                            onChange={(e) => updateItem(idx, 'remarks', e.target.value)}
                            placeholder="Note..."
                            sx={{ width: 150 }}
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
                      <TableCell colSpan={showLocationColumn ? 8 : 7}>
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
          )}

          {/* Validation warnings */}
          {formData.items.length > 0 && formData.items.some(i => i.itemId > 0 && (i.quantity <= 0 || i.quantity > (stockBalances?.[i.itemId] || 0))) && (
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: alpha('#DC2626', 0.06), border: '1px solid', borderColor: alpha('#DC2626', 0.2) }}>
              <Stack spacing={0.5}>
                {formData.items.filter(i => i.itemId > 0 && i.quantity <= 0).map((i) => {
                  const item = allItems?.find((it: any) => it.id === i.itemId);
                  return <Typography key={i.itemId} variant="caption" color="error.main" fontWeight={500}>"{item?.itemName}" - Quantity must be greater than 0</Typography>;
                })}
                {formData.items.filter(i => i.itemId > 0 && i.quantity > (stockBalances?.[i.itemId] || 0)).map((i) => {
                  const item = allItems?.find((it: any) => it.id === i.itemId);
                  const bal = stockBalances?.[i.itemId] || 0;
                  return <Typography key={i.itemId} variant="caption" color="error.main" fontWeight={500}>"{item?.itemName}" - Requested {i.quantity} but only {bal} available in stock</Typography>;
                })}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Action Bar */}
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1.5, position: 'sticky', bottom: 16, border: '1px solid', borderColor: 'divider', boxShadow: 4 }}>
        <Button variant="outlined" onClick={() => navigate('/inventory/issue-challan')}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={() => saveMutation.mutate('Draft')}
          disabled={!canSave}
        >
          Save Draft
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => saveMutation.mutate('Posted')}
          disabled={!canSave}
        >
          Post Challan
        </Button>
      </Paper>
    </Box>
  );
}
