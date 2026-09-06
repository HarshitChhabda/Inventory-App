import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, TextField,
  InputAdornment, Button, Grid, FormControl, InputLabel, Select, MenuItem,
  Tooltip, Card, CardContent, Divider,
} from '@mui/material';
import { Add, Search, Visibility, CheckCircle, Cancel, Send, ShoppingCart, Refresh } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { useCompany } from '../../../../context/CompanyContext';
import { useAuth } from '../../../../context/AuthContext';
import { useListState } from '../../../../hooks/useListState';
import EmptyState from '../../../../components/EmptyState';
import { TableSkeleton } from '../../../../components/LoadingSkeleton';
import EnterpriseDialog from '../../../../components/EnterpriseDialog';
import { formatDateDDMMYYYY } from '../../../../utils/dateUtils';
import StatusBadge from '../../../../components/StatusBadge';
import ConfirmDialog from '../../../../components/ConfirmDialog';

const STATUS_OPTIONS = [
  'DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED',
  'COMPLETED', 'CANCELLED', 'CLOSED',
];

export default function PurchaseOrderListPage() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { currentUser } = useAuth();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const {
    state: ls, setSearch: setLsSearch, setPage: setLsPage, setPageSize: setLsPageSize, setFilter,
  } = useListState('purchase-orders', { pageSize: 25 });

  const [page, setPage] = useState(ls.page);
  const [rowsPerPage, setRowsPerPage] = useState(ls.pageSize);
  const [search, setSearchLocal] = useState(ls.search);
  const [statusFilter, setStatusFilterLocal] = useState(ls.filters.status || '');
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);

  const handleSearchChange = (v: string) => {
    setSearchLocal(v);
    setLsSearch(v);
  };
  const handleStatusChange = (v: string) => {
    setStatusFilterLocal(v);
    setFilter('status', v);
  };
  const handlePageChange = (_: any, newPage: number) => {
    setPage(newPage);
    setLsPage(newPage);
  };
  const handleRowsPerPageChange = (e: any) => {
    const val = parseInt(e.target.value, 10);
    setRowsPerPage(val);
    setLsPageSize(val);
    setPage(0);
  };

  const { data: result, isLoading, isError, refetch } = useQuery({
    queryKey: ['pos', companyId, page, rowsPerPage, search, statusFilter],
    queryFn: () => window.electronAPI.searchPOs({
      companyId, page: page + 1, limit: rowsPerPage,
      search: search || undefined, status: statusFilter || undefined,
    }),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['poDashboard', companyId],
    queryFn: () => window.electronAPI.getPODashboard(companyId),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, by }: any) => window.electronAPI.approvePO(id, by),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pos'] }); toast.success('PO Approved'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to approve purchase order')),
  });

  const orderMutation = useMutation({
    mutationFn: ({ id, by }: any) => window.electronAPI.orderPO(id, by),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pos'] }); toast.success('PO Ordered'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to submit purchase order')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.cancelPO(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pos'] }); toast.success('PO Cancelled'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to cancel purchase order')),
  });

  const handleViewProfile = async (po: any) => {
    const full = await window.electronAPI.getPO(po.id);
    setSelectedPO(full);
    setProfileOpen(true);
  };

  const pos = result?.data || [];

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Purchase Orders</Typography>
          <Typography variant="body2" color="text.secondary">Create, approve, and track purchase orders</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/procurement/po/new')}>New PO</Button>
      </Box>

      {dashboard && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Pending', value: dashboard.pendingPOs, color: 'warning.main' },
            { label: 'Ordered', value: dashboard.orderedPOs, color: 'info.main' },
            { label: 'Partial', value: dashboard.partialPOs, color: 'purple' },
            { label: 'Completed', value: dashboard.completedPOs, color: 'success.main' },
            { label: 'Late', value: dashboard.latePOs, color: 'error.main' },
            { label: 'Monthly Value', value: `₹${dashboard.monthlyValue?.toLocaleString()}`, color: 'primary.main' },
          ].map((s) => (
            <Grid item xs={6} sm={4} md={2} key={s.label}>
              <Card><CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h6" fontWeight={700} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" placeholder="Search POs..." value={search} onChange={e => handleSearchChange(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={e => handleStatusChange(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>PO Number</TableCell><TableCell>Vendor</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell>Date</TableCell>
                <TableCell>Expected</TableCell><TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ p: 0, border: 'none' }}>
                    <Box sx={{ py: 2 }}>
                      <TableSkeleton rows={5} columns={5} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="error" fontWeight={600}>Failed to load purchase orders</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Please check your connection and try again.</Typography>
                    <IconButton onClick={() => refetch()} sx={{ border: '1px solid', borderColor: 'divider' }}><Refresh fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ) : pos.map((po: any) => (
                <TableRow key={po.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{po.poNumber}</TableCell>
                  <TableCell>{po.vendor?.vendorName || '-'}</TableCell>
                  <TableCell align="right">₹{po.netAmount?.toLocaleString()}</TableCell>
                  <TableCell>{formatDateDDMMYYYY(new Date(po.orderDate))}</TableCell>
                  <TableCell>{po.expectedDelivery ? formatDateDDMMYYYY(new Date(po.expectedDelivery)) : '-'}</TableCell>
                  <TableCell><StatusBadge status={po.status} /></TableCell>
                  <TableCell align="center">
                    <Tooltip title="View"><IconButton size="small" onClick={() => handleViewProfile(po)}><Visibility fontSize="small" /></IconButton></Tooltip>
                     {po.status === 'DRAFT' && <Tooltip title="Submit"><IconButton size="small" color="primary" onClick={() => orderMutation.mutate({ id: po.id, by: currentUser?.fullName || currentUser?.username || 'system' })}><Send fontSize="small" /></IconButton></Tooltip>}
                     {po.status === 'PENDING' && <Tooltip title="Approve"><IconButton size="small" color="success" onClick={() => approveMutation.mutate({ id: po.id, by: currentUser?.fullName || currentUser?.username || 'system' })}><CheckCircle fontSize="small" /></IconButton></Tooltip>}
                    {['DRAFT', 'PENDING'].includes(po.status) && <Tooltip title="Cancel"><IconButton size="small" color="error" onClick={() => setCancelTarget(po)}><Cancel fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && pos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState icon={<ShoppingCart />} title="No purchase orders found" description="Create your first purchase order to get started" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={result?.total || 0} page={page} rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange} onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50]} />
      </Paper>

      <EnterpriseDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Purchase Order Details"
        subtitle={selectedPO?.vendor?.vendorName}
        icon={<ShoppingCart />}
        actions={<Button onClick={() => setProfileOpen(false)}>Close</Button>}
      >
        {selectedPO && (
          <Grid container spacing={2} mb={2}>
            <Grid item xs={4}><Typography variant="subtitle2">Status</Typography><StatusBadge status={selectedPO.status} /></Grid>
            <Grid item xs={4}><Typography variant="subtitle2">Net Amount</Typography><Typography fontWeight={700}>₹{selectedPO.netAmount?.toLocaleString()}</Typography></Grid>
            <Grid item xs={4}><Typography variant="subtitle2">Payment</Typography><Typography>{selectedPO.paymentTerms}</Typography></Grid>
            <Grid item xs={12}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead><TableRow><TableCell>Item</TableCell><TableCell align="right">Ordered</TableCell><TableCell align="right">Received</TableCell><TableCell align="right">Rate</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                  <TableBody>
                    {selectedPO.details?.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.itemName}</TableCell><TableCell align="right">{d.orderedQty}</TableCell>
                        <TableCell align="right">{d.receivedQty}</TableCell><TableCell align="right">₹{d.rate}</TableCell>
                        <TableCell align="right">₹{d.netAmount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        )}
      </EnterpriseDialog>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Purchase Order"
        message={`Cancel purchase order ${cancelTarget?.poNumber || ''}? This cannot be reversed.`}
        confirmText="Cancel PO"
        confirmColor="error"
        onConfirm={() => {
          if (cancelTarget) {
            cancelMutation.mutate(cancelTarget.id);
            setCancelTarget(null);
          }
        }}
        onCancel={() => setCancelTarget(null)}
        loading={cancelMutation.isPending}
      />
    </Box>
  );
}
