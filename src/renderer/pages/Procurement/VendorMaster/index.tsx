import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Chip, TextField,
  InputAdornment, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Tooltip, Avatar,
  Card, CardContent, Tabs, Tab, Rating,
} from '@mui/material';
import {
  Add, Search, Edit, Delete, Visibility, Star, StarBorder,
  Phone, Email, LocationOn, Business, AttachFile,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getErrorMessage } from '../../../utils/errorUtils';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useCompany } from '../../../context/CompanyContext';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import EmptyState from '../../../components/EmptyState';
import { TableSkeleton } from '../../../components/LoadingSkeleton';

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: '#6366F1', PREFERRED: '#22C55E', STRATEGIC: '#F59E0B', BLACKLISTED: '#EF4444',
};

const vendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  gstNumber: z.string(),
  panNumber: z.string(),
  contactPerson: z.string(),
  mobile: z.string(),
  email: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  bankName: z.string(),
  bankAccountNo: z.string(),
  bankIfsc: z.string(),
  paymentTerms: z.string(),
  creditDays: z.number(),
  vendorCategory: z.string(),
  remarks: z.string(),
});
type VendorFormData = z.infer<typeof vendorSchema>;

export default function VendorMasterPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [profileTab, setProfileTab] = useState(0);

  // Form state
  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    mode: 'onChange',
    defaultValues: { vendorName: '', gstNumber: '', panNumber: '', contactPerson: '', mobile: '', email: '', address: '', city: '', state: '', bankName: '', bankAccountNo: '', bankIfsc: '', paymentTerms: 'NET30', creditDays: 30, vendorCategory: 'GENERAL', remarks: '' },
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ['vendors', companyId, page, rowsPerPage, search, categoryFilter],
    queryFn: () => window.electronAPI.searchVendorsP({
      companyId, page: page + 1, limit: rowsPerPage,
      search: search || undefined, category: categoryFilter || undefined,
    }),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['vendorDashboard', companyId],
    queryFn: () => window.electronAPI.getVendorPDashboard(companyId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.createVendorP(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); queryClient.invalidateQueries({ queryKey: ['vendorDashboard'] }); toast.success('Vendor created'); setDialogOpen(false); resetForm(); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create vendor')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => window.electronAPI.updateVendorP(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); queryClient.invalidateQueries({ queryKey: ['vendorDashboard'] }); toast.success('Updated'); setDialogOpen(false); resetForm(); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update vendor')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.deleteVendorP(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); queryClient.invalidateQueries({ queryKey: ['vendorDashboard'] }); toast.success('Deleted'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to delete vendor')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: any) => window.electronAPI.toggleVendorP(id, isActive),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); queryClient.invalidateQueries({ queryKey: ['vendorDashboard'] }); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to toggle vendor')),
  });

  const resetForm = () => {
    reset({ vendorName: '', gstNumber: '', panNumber: '', contactPerson: '', mobile: '', email: '', address: '', city: '', state: '', bankName: '', bankAccountNo: '', bankIfsc: '', paymentTerms: 'NET30', creditDays: 30, vendorCategory: 'GENERAL', remarks: '' });
    setEditingVendor(null);
  };

  const handleOpenDialog = (vendor?: any) => {
    if (vendor) {
      setEditingVendor(vendor);
      reset({ vendorName: vendor.vendorName || '', gstNumber: vendor.gstNumber || '', panNumber: vendor.panNumber || '', contactPerson: vendor.contactPerson || '', mobile: vendor.mobile || '', email: vendor.email || '', address: vendor.address || '', city: vendor.city || '', state: vendor.state || '', bankName: vendor.bankName || '', bankAccountNo: vendor.bankAccountNo || '', bankIfsc: vendor.bankIfsc || '', paymentTerms: vendor.paymentTerms || 'NET30', creditDays: vendor.creditDays || 30, vendorCategory: vendor.vendorCategory || 'GENERAL', remarks: vendor.remarks || '' });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = handleSubmit((data) => {
    const payload = { companyId, ...data };
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  });

  const handleViewProfile = async (vendor: any) => {
    const full = await window.electronAPI.getVendorP(vendor.id);
    setSelectedVendor(full);
    setProfileOpen(true);
  };

  const vendors = result?.data || [];
  const total = result?.total || 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Vendor Master</Typography>
          <Typography variant="body2" color="text.secondary">Manage vendor profiles, documents, and performance</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>New Vendor</Button>
      </Box>

      {/* Dashboard Stats */}
      {dashboard && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Total Vendors', value: dashboard.totalVendors, color: 'primary.main' },
            { label: 'Active', value: dashboard.activeVendors, color: 'success.main' },
            { label: 'Pending POs', value: dashboard.pendingPOs, color: 'warning.main' },
            { label: 'Pending Delivery', value: dashboard.pendingDeliveries, color: 'info.main' },
            { label: 'Late Delivery', value: dashboard.lateDeliveries, color: 'error.main' },
          ].map((stat) => (
            <Grid item xs={6} sm={4} md={2.4} key={stat.label}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="h5" fontWeight={700} color={stat.color}>{stat.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" placeholder="Search vendors..."
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={categoryFilter} label="Category" onChange={e => setCategoryFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {Object.keys(CATEGORY_COLORS).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ p: 0, border: 'none' }}>
                    <Box sx={{ py: 2 }}>
                      <TableSkeleton rows={5} columns={5} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : vendors.map((v: any) => (
                <TableRow key={v.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.vendorCode}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: 14 }}>
                        {v.vendorName?.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{v.vendorName}</Typography>
                        {v.contactPerson && <Typography variant="caption" color="text.secondary">{v.contactPerson}</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{v.contactPerson || '-'}</TableCell>
                  <TableCell>{v.mobile || '-'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={v.vendorCategory}
                      sx={{ bgcolor: (CATEGORY_COLORS[v.vendorCategory] || '#6B7280') + '20', color: CATEGORY_COLORS[v.vendorCategory] || '#6B7280', fontWeight: 600, fontSize: 10 }} />
                  </TableCell>
                  <TableCell>
                    <Rating value={v.vendorRating || 0} readOnly size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={v.isActive ? 'Active' : 'Inactive'}
                      color={v.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View"><IconButton size="small" onClick={() => handleViewProfile(v)}><Visibility fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => handleOpenDialog(v)}><Edit fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={v.isActive ? 'Deactivate' : 'Activate'}>
                      <IconButton size="small" onClick={() => toggleMutation.mutate({ id: v.id, isActive: !v.isActive })}>
                        {v.isActive ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => { if (confirm(`Are you sure you want to delete vendor "${v.vendorName}" (${v.vendorCode})? This action cannot be undone and all associated purchase orders and records will be affected.`)) deleteMutation.mutate(v.id); }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && vendors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState icon={<Business />} title="No vendors found" description="Add your first vendor to get started" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]} />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingVendor ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Vendor Name" {...register('vendorName')} error={!!errors.vendorName} helperText={errors.vendorName?.message} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Contact Person" {...register('contactPerson')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="GST Number" {...register('gstNumber')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="PAN Number" {...register('panNumber')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Mobile" {...register('mobile')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Email" {...register('email')} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Address" {...register('address')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="City" {...register('city')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="State" {...register('state')} /></Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="vendorCategory" control={control} render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select {...field} label="Category">
                    {Object.keys(CATEGORY_COLORS).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Bank Name" {...register('bankName')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Account No" {...register('bankAccountNo')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="IFSC" {...register('bankIfsc')} /></Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="paymentTerms" control={control} render={({ field }) => (
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Terms</InputLabel>
                  <Select {...field} label="Payment Terms">
                    <MenuItem value="COD">COD</MenuItem>
                    <MenuItem value="NET15">NET 15</MenuItem>
                    <MenuItem value="NET30">NET 30</MenuItem>
                    <MenuItem value="NET45">NET 45</MenuItem>
                    <MenuItem value="NET60">NET 60</MenuItem>
                    <MenuItem value="ADVANCE">Advance</MenuItem>
                  </Select>
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Credit Days" type="number" {...register('creditDays', { valueAsNumber: true })} /></Grid>
            <Grid item xs={12}><TextField fullWidth size="small" label="Remarks" multiline rows={2} {...register('remarks')} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!isValid || createMutation.isPending || updateMutation.isPending}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="md" fullWidth>
        {selectedVendor && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>{selectedVendor.vendorName?.charAt(0)}</Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>{selectedVendor.vendorName}</Typography>
                <Typography variant="caption" color="text.secondary">{selectedVendor.vendorCode}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Tabs value={profileTab} onChange={(_, v) => setProfileTab(v)} sx={{ mb: 2 }}>
                <Tab label="Overview" />
                <Tab label="Contact" />
                <Tab label="Bank" />
                <Tab label="Performance" />
                <Tab label="Purchase History" />
              </Tabs>
              {profileTab === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={6}><Typography variant="subtitle2">Category</Typography><Chip label={selectedVendor.vendorCategory} /></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Rating</Typography><Rating value={selectedVendor.vendorRating || 0} readOnly /></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Payment Terms</Typography><Typography>{selectedVendor.paymentTerms}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Credit Days</Typography><Typography>{selectedVendor.creditDays}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Status</Typography><Chip label={selectedVendor.isActive ? 'Active' : 'Inactive'} color={selectedVendor.isActive ? 'success' : 'default'} /></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Documents</Typography><Typography>{selectedVendor.documents?.length || 0}</Typography></Grid>
                </Grid>
              )}
              {profileTab === 1 && (
                <Grid container spacing={2}>
                  <Grid item xs={6}><Typography variant="subtitle2">Contact Person</Typography><Typography>{selectedVendor.contactPerson || '-'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Mobile</Typography><Typography>{selectedVendor.mobile || '-'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Email</Typography><Typography>{selectedVendor.email || '-'}</Typography></Grid>
                  <Grid item xs={12}><Typography variant="subtitle2">Address</Typography><Typography>{selectedVendor.address || '-'}, {selectedVendor.city || ''}, {selectedVendor.state || ''}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">GST Number</Typography><Typography>{selectedVendor.gstNumber || '-'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">PAN Number</Typography><Typography>{selectedVendor.panNumber || '-'}</Typography></Grid>
                </Grid>
              )}
              {profileTab === 2 && (
                <Grid container spacing={2}>
                  <Grid item xs={6}><Typography variant="subtitle2">Bank Name</Typography><Typography>{selectedVendor.bankName || '-'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">Account No</Typography><Typography>{selectedVendor.bankAccountNo || '-'}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="subtitle2">IFSC</Typography><Typography>{selectedVendor.bankIfsc || '-'}</Typography></Grid>
                </Grid>
              )}
              {profileTab === 3 && (
                <Box>
                  <Typography variant="subtitle2" mb={1}>Performance Summary</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h6">{selectedVendor.purchaseOrders?.length || 0}</Typography><Typography variant="caption">Total POs</Typography></CardContent></Card></Grid>
                    <Grid item xs={4}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h6">{selectedVendor.goodsReceipts?.length || 0}</Typography><Typography variant="caption">GRNs</Typography></CardContent></Card></Grid>
                    <Grid item xs={4}><Card variant="outlined"><CardContent sx={{ textAlign: 'center' }}><Typography variant="h6">{selectedVendor.itemMappings?.length || 0}</Typography><Typography variant="caption">Items</Typography></CardContent></Card></Grid>
                  </Grid>
                </Box>
              )}
              {profileTab === 4 && (
                <Box>
                  {selectedVendor.purchaseHistory?.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow><TableCell>Date</TableCell><TableCell>Item</TableCell><TableCell>Qty</TableCell><TableCell>Rate</TableCell><TableCell>Amount</TableCell></TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedVendor.purchaseHistory.map((h: any) => (
                            <TableRow key={h.id}>
                              <TableCell>{formatDateDDMMYYYY(new Date(h.purchaseDate))}</TableCell>
                              <TableCell>{h.itemId}</TableCell>
                              <TableCell>{h.quantity}</TableCell>
                              <TableCell>₹{h.rate}</TableCell>
                              <TableCell>₹{h.totalAmount?.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : <Typography color="text.secondary">No purchase history.</Typography>}
                </Box>
              )}
            </DialogContent>
            <DialogActions><Button onClick={() => setProfileOpen(false)}>Close</Button></DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
