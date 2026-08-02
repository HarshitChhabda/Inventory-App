import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Autocomplete,
  Divider, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem,
  Chip, alpha, useTheme,
} from '@mui/material';
import { Add, Delete, Save, ArrowBack, Transform, Inventory2 } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { isIntegerOnlyUnit } from '../../../utils/unitUtils';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, todayISO } from '../../../utils/dateUtils';

export default function TransferChallanForm() {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isEdit = id && id !== 'new';

  const [formData, setFormData] = useState({
    date: todayISO(),
    fromDepartmentId: 0,
    toDepartmentId: 0,
    transferredBy: '',
    approvedBy: '',
    remarks: '',
    items: [] as Array<{ itemId: number; quantity: number; rate: number; remarks: string; fromLocationId: number | null; toLocationId: number | null }>,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company!.id, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: allLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', { where: { isActive: true }, orderBy: { locationName: 'asc' } }),
  });

  const { data: stockBalances } = useQuery({
    queryKey: ['stockBalanceTransfer', company?.id, financialYear?.id],
    queryFn: async () => {
      const txns = await window.electronAPI.dbQuery('stockTransaction', 'findMany', {
        where: { companyId: company!.id, financialYearId: financialYear!.id },
        select: { itemId: true, departmentId: true, locationId: true, quantityIn: true, quantityOut: true, transactionType: true },
      });
      const bal: Record<string, number> = {};
      txns.forEach((t: any) => {
        if (!t.departmentId) return;
        const qtyIn = Number(t.quantityIn || 0);
        const qtyOut = Number(t.quantityOut || 0);
        const key = `${t.itemId}-${t.departmentId}-${t.locationId ?? 'null'}`;
        if (!bal[key]) bal[key] = 0;
        bal[key] += qtyIn - qtyOut;
      });
      return bal;
    },
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const selectedFromDept = departments?.find((d: any) => d.id === formData.fromDepartmentId);
  const selectedToDept = departments?.find((d: any) => d.id === formData.toDepartmentId);
  const isFromDharamshala = selectedFromDept?.departmentType === 'Dharamshala';
  const isToDharamshala = selectedToDept?.departmentType === 'Dharamshala';

  const deptStockMap = useMemo(() => {
    if (!stockBalances) return {};
    const map: Record<number, number> = {};
    Object.entries(stockBalances).forEach(([key, bal]) => {
      const [itemIdStr, deptIdStr] = key.split('-');
      const itemId = Number(itemIdStr);
      const deptId = Number(deptIdStr);
      if (formData.fromDepartmentId && deptId === formData.fromDepartmentId) {
        if (!map[itemId]) map[itemId] = 0;
        map[itemId] += bal;
      }
    });
    return map;
  }, [stockBalances, formData.fromDepartmentId]);

  const roomsWithStock = useMemo(() => {
    if (!stockBalances || !formData.fromDepartmentId) return new Set<number>();
    const roomIds = new Set<number>();
    Object.entries(stockBalances).forEach(([key, bal]) => {
      const parts = key.split('-');
      const deptId = Number(parts[1]);
      const locId = parts[2] === 'null' ? null : Number(parts[2]);
      if (deptId === formData.fromDepartmentId && locId && bal > 0) {
        roomIds.add(locId);
      }
    });
    return roomIds;
  }, [stockBalances, formData.fromDepartmentId]);

  const getItemStock = useCallback((itemId: number, locationId: number | null | undefined) => {
    if (!stockBalances || !formData.fromDepartmentId) return 0;
    const locKey = locationId != null ? String(locationId) : 'null';
    const key = `${itemId}-${formData.fromDepartmentId}-${locKey}`;
    return stockBalances[key] || 0;
  }, [stockBalances, formData.fromDepartmentId]);

  const availableItems = useMemo(() => {
    if (!formData.fromDepartmentId || !items) return [];
    return items.filter((item: any) => (deptStockMap[item.id] || 0) > 0);
  }, [items, deptStockMap, formData.fromDepartmentId]);

  const fromRoomLocations = useMemo(() => {
    if (!allLocations || !selectedFromDept) return [];
    const deptName = selectedFromDept.name.trim();
    const parentLoc = allLocations.find((l: any) =>
      (l.locationType === 'Dharamshala' || l.locationType === 'Store') && l.locationName.trim() === deptName
    );
    if (parentLoc) {
      const allRooms = allLocations.filter((l: any) => l.parentId === parentLoc.id && l.locationType === 'Room');
      if (roomsWithStock.size > 0) return allRooms.filter((l: any) => roomsWithStock.has(l.id));
      return allRooms;
    }
    const allRooms = allLocations.filter((l: any) => l.locationType === 'Room');
    if (roomsWithStock.size > 0) return allRooms.filter((l: any) => roomsWithStock.has(l.id));
    return allRooms;
  }, [allLocations, selectedFromDept, roomsWithStock]);

  const toRoomLocations = useMemo(() => {
    if (!allLocations || !selectedToDept) return [];
    const deptName = selectedToDept.name.trim();
    const parentLoc = allLocations.find((l: any) =>
      (l.locationType === 'Dharamshala' || l.locationType === 'Store') && l.locationName.trim() === deptName
    );
    if (parentLoc) return allLocations.filter((l: any) => l.parentId === parentLoc.id && l.locationType === 'Room');
    return allLocations.filter((l: any) => l.locationType === 'Room');
  }, [allLocations, selectedToDept]);

  const recentItemIds = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('recentTransferItems') || '[]'); } catch { return []; }
  })[0];

  const addItem = () => setFormData((prev) => ({
    ...prev,
    items: [...prev.items, { itemId: 0, quantity: 1, rate: 0, remarks: '', fromLocationId: null, toLocationId: null }],
  }));

  const updateItem = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      (items[index] as any)[field] = value;
      return { ...prev, items };
    });
  };

  const removeItem = (index: number) => setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  useEffect(() => {
    if (isEdit) {
      window.electronAPI.dbQuery('transferChallan', 'findUnique', {
        where: { id: Number(id) },
        include: { items: { include: { item: true, location: true, toLocation: true } } },
      }).then((tc: any) => {
        if (tc) {
          setFormData({
            date: tc.date.split('T')[0],
            fromDepartmentId: tc.fromDepartmentId,
            toDepartmentId: tc.toDepartmentId,
            transferredBy: tc.transferredBy,
            approvedBy: tc.approvedBy || '',
            remarks: tc.remarks || '',
            items: tc.items.map((i: any) => ({
              itemId: i.itemId, quantity: Number(i.quantity), rate: Number(i.rate), remarks: i.remarks || '',
              fromLocationId: i.locationId || null, toLocationId: i.toLocationId || null,
            })),
          });
        }
      });
    }
  }, [id, isEdit]);

  const saveMutation = useMutation({
    mutationFn: async (status: 'Draft' | 'Posted') => {
      const api = window.electronAPI;
      const formattedItems = formData.items.map(i => ({
        itemId: i.itemId, quantity: i.quantity, rate: 0, remarks: i.remarks,
        locationId: i.fromLocationId || null,
        toLocationId: i.toLocationId || null,
      }));

      const payload = {
        date: formData.date,
        fromDepartmentId: formData.fromDepartmentId,
        toDepartmentId: formData.toDepartmentId,
        transferredBy: formData.transferredBy,
        approvedBy: formData.approvedBy,
        remarks: formData.remarks,
        companyId: company!.id,
        financialYearId: financialYear!.id,
        status: 'Draft' as const,
      };

      let savedChallan: any;
      if (isEdit) {
        savedChallan = await api.saveTransferChallan(payload, formattedItems, true, Number(id));
      } else {
        const challans = await api.dbQuery('transferChallan', 'findMany', {
          where: { companyId: company!.id, financialYearId: financialYear!.id },
          orderBy: { id: 'desc' }, take: 1,
        });
        const lastNo = challans.length > 0 ? parseInt(challans[0].challanNo.replace('TC-', '')) + 1 : 1;
        const challanNo = `TC-${String(lastNo).padStart(5, '0')}`;
        savedChallan = await api.saveTransferChallan({ ...payload, challanNo }, formattedItems, false);
      }

      if (status === 'Posted' && savedChallan) {
        await api.postTransferChallan(savedChallan.id);
      }
      return savedChallan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferChallans'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['itemHistory'] });
      queryClient.invalidateQueries({ queryKey: ['locationBalances'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      navigate('/inventory/transfer-challan');
    },
    onError: (error: any) => {
      alert(error?.message || 'Failed to save transfer challan');
    },
  });

  const hasInsufficientStock = formData.fromDepartmentId > 0 && formData.items.some(
    i => i.itemId > 0 && i.quantity > getItemStock(i.itemId, i.fromLocationId)
  );

  return (
    <Box>
      <PageHeader
        title={isEdit ? 'Edit Transfer Challan' : 'New Transfer Challan'}
        subtitle="Store to Store transfer, or Department return to Store"
        breadcrumbs={[
          { label: 'Inventory', path: '/inventory/transfer-challan' },
          { label: 'Transfer Challans', path: '/inventory/transfer-challan' },
          { label: isEdit ? 'Edit' : 'New Challan' },
        ]}
        actions={
          <IconButton onClick={() => navigate('/inventory/transfer-challan')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <ArrowBack fontSize="small" />
          </IconButton>
        }
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <Transform sx={{ fontSize: 16, color: 'primary.main' }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>Transfer Details</Typography>
            {isFromDharamshala && (
              <Chip label={`${selectedFromDept?.name} — ${fromRoomLocations.length} rooms`} size="small" color="warning" variant="outlined" />
            )}
            {isToDharamshala && (
              <Chip label={`${selectedToDept?.name} — ${toRoomLocations.length} rooms`} size="small" color="info" variant="outlined" />
            )}
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <DatePickerField
                label="Transfer Date"
                value={formData.date}
                onChange={(val) => setFormData({ ...formData, date: val })}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl size="small" fullWidth required>
                <InputLabel>From Department</InputLabel>
                <Select
                  size="small"
                  value={formData.fromDepartmentId || ''}
                  label="From Department"
                  onChange={(e) => {
                    const newFromId = Number(e.target.value);
                    setFormData({
                      ...formData,
                      fromDepartmentId: newFromId,
                      toDepartmentId: 0,
                      items: formData.items.map(i => ({ ...i, fromLocationId: null, toLocationId: null })),
                    });
                  }}
                >
                  <MenuItem value="">Select Source</MenuItem>
                  {departments?.filter((d: any) => d.departmentType === 'Store').map((d: any) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name} (Store)
                    </MenuItem>
                  ))}
                  {departments?.filter((d: any) => d.departmentType === 'Dharamshala').map((d: any) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name} (Dharamshala)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl size="small" fullWidth required>
                <InputLabel>To Department</InputLabel>
                <Select
                  size="small"
                  value={formData.toDepartmentId || ''}
                  label="To Department"
                  onChange={(e) => {
                    const newToId = Number(e.target.value);
                    setFormData({
                      ...formData,
                      toDepartmentId: newToId,
                      items: formData.items.map(i => ({ ...i, toLocationId: null })),
                    });
                  }}
                >
                  <MenuItem value="">Select Destination</MenuItem>
                  {selectedFromDept?.departmentType === 'Store'
                    ? departments?.filter((d: any) => d.departmentType === 'Store').map((d: any) => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name} (Store)
                        </MenuItem>
                      ))
                    : departments?.map((d: any) => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name} {d.departmentType === 'Dharamshala' ? '(Dharamshala)' : '(Store)'}
                        </MenuItem>
                      ))
                  }
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Transferred By"
                value={formData.transferredBy}
                onChange={(e) => setFormData({ ...formData, transferredBy: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Approved By"
                value={formData.approvedBy}
                onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                fullWidth
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
        </CardContent>
      </Card>

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

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }}>#</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>From Room</TableCell>
                  <TableCell sx={{ width: 110 }}>Quantity</TableCell>
                  <TableCell>To Room</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.items.map((item, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="text.secondary">{idx + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Autocomplete
                        size="small"
                        options={formData.fromDepartmentId && Object.keys(deptStockMap).length > 0 ? availableItems : (items || [])}
                        getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
                        value={items?.find((i: any) => i.id === item.itemId) || null}
                        onChange={(_, v: any) => updateItem(idx, 'itemId', v?.id || 0)}
                        renderOption={(props, option: any) => {
                          const itemStock = getItemStock(option.id, item.fromLocationId);
                          return (
                            <li {...props} key={option.id}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{option.itemCode} - {option.itemName}</span>
                                <Chip
                                  label={`${itemStock} ${option.unit?.name || ''}`}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.65rem', ml: 1, backgroundColor: itemStock > 0 ? alpha('#16A34A', 0.1) : alpha('#DC2626', 0.1), color: itemStock > 0 ? '#16A34A' : '#DC2626' }}
                                />
                              </Box>
                            </li>
                          );
                        }}
                        renderInput={(params) => <TextField {...params} placeholder={formData.fromDepartmentId ? "Search items in dept..." : "Search & select item..."} />}
                        sx={{ minWidth: 260 }}
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={item.fromLocationId || ''}
                          onChange={(e) => updateItem(idx, 'fromLocationId', e.target.value ? Number(e.target.value) : null)}
                          displayEmpty
                        >
                          <MenuItem value=""><em>Dept Level</em></MenuItem>
                          {fromRoomLocations.map((loc: any) => (
                            <MenuItem key={loc.id} value={loc.id}>{loc.locationName}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        {(() => {
                          const itemStock = getItemStock(item.itemId, item.fromLocationId);
                          return (
                            <>
                              <TextField
                                size="small"
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const selectedItem = items?.find((i: any) => i.id === item.itemId);
                                  const unitName = selectedItem?.unit?.name;
                                  const val = Number(e.target.value);
                                  const adjusted = isIntegerOnlyUnit(unitName) ? Math.round(val) : val;
                                  updateItem(idx, 'quantity', adjusted);
                                }}
                                inputProps={{ min: 0.01, step: isIntegerOnlyUnit(items?.find((i: any) => i.id === item.itemId)?.unit?.name) ? 1 : 0.01 }}
                                sx={{ width: 90 }}
                                error={item.itemId > 0 && formData.fromDepartmentId > 0 && item.quantity > itemStock}
                              />
                              {item.itemId > 0 && formData.fromDepartmentId > 0 && (
                                <Chip
                                  label={`${itemStock} avail`}
                                  size="small"
                                  sx={{
                                    height: 20, fontSize: '0.6rem', fontWeight: 600,
                                    backgroundColor: item.quantity > itemStock
                                      ? alpha('#DC2626', 0.1) : alpha('#16A34A', 0.1),
                                    color: item.quantity > itemStock
                                      ? '#DC2626' : '#16A34A',
                                  }}
                                />
                              )}
                            </>
                          );
                        })()}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={item.toLocationId || ''}
                          onChange={(e) => updateItem(idx, 'toLocationId', e.target.value ? Number(e.target.value) : null)}
                          displayEmpty
                        >
                          <MenuItem value=""><em>Select Room</em></MenuItem>
                          {toRoomLocations.map((loc: any) => (
                            <MenuItem key={loc.id} value={loc.id}>{loc.locationName}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
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
                ))}
                {formData.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
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

      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1.5, position: 'sticky', bottom: 16, border: '1px solid', borderColor: 'divider', boxShadow: 4 }}>
        <Button variant="outlined" onClick={() => navigate('/inventory/transfer-challan')}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={() => saveMutation.mutate('Draft')}
          disabled={!formData.fromDepartmentId || !formData.toDepartmentId || !formData.transferredBy || formData.items.length === 0}
        >
          Save Draft
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => saveMutation.mutate('Posted')}
          disabled={!formData.fromDepartmentId || !formData.toDepartmentId || !formData.transferredBy || formData.items.length === 0 || hasInsufficientStock}
        >
          Post Transfer
        </Button>
      </Paper>
    </Box>
  );
}
