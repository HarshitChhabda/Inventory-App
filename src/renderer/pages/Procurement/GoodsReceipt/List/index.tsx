import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Chip, TextField,
  InputAdornment, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Tooltip, Card, CardContent,
  Tabs, Tab,
} from '@mui/material';
import { Add, Search, Visibility, CheckCircle, Cancel, LocalShipping, Assignment, Refresh } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { useCompany } from '../../../../context/CompanyContext';
import { useAuth } from '../../../../context/AuthContext';
import { useListState } from '../../../../hooks/useListState';
import EmptyState from '../../../../components/EmptyState';
import { TableSkeleton } from '../../../../components/LoadingSkeleton';
import { formatDateDDMMYYYY } from '../../../../utils/dateUtils';
import StatusBadge from '../../../../components/StatusBadge';

const STATUS_OPTIONS = [
  'RECEIVED', 'QC_PENDING', 'QC_PASSED', 'QC_FAILED',
  'PARTIALLY_ACCEPTED', 'COMPLETED', 'CANCELLED',
];

export default function GoodsReceiptListPage() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { currentUser } = useAuth();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const {
    state: ls, setSearch: setLsSearch, setPage: setLsPage, setPageSize: setLsPageSize, setFilter,
  } = useListState('goods-receipts', { pageSize: 25 });

  const [page, setPage] = useState(ls.page);
  const [rowsPerPage, setRowsPerPage] = useState(ls.pageSize);
  const [search, setSearchLocal] = useState(ls.search);
  const [statusFilter, setStatusFilterLocal] = useState(ls.filters.status || '');
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState(0);

  // Post to inventory confirmation
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [postGRN, setPostGRN] = useState<any>(null);

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

  // QC Dialog
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [qcGRN, setQcGRN] = useState<any>(null);
  const [qcAcceptedQty, setQcAcceptedQty] = useState(0);
  const [qcRejectedQty, setQcRejectedQty] = useState(0);
  const [qcRemarks, setQcRemarks] = useState('');
  const [qcDetailIdx, setQcDetailIdx] = useState(0);

  const { data: result, isLoading, isError, refetch } = useQuery({
    queryKey: ['grns', companyId, page, rowsPerPage, search, statusFilter],
    queryFn: () => window.electronAPI.searchGRNs({
      companyId, page: page + 1, limit: rowsPerPage,
      search: search || undefined, status: statusFilter || undefined,
    }),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['grnDashboard', companyId],
    queryFn: () => window.electronAPI.getGRNDashboard(companyId),
  });

  const postMutation = useMutation({
    mutationFn: ({ grnId, by }: any) => window.electronAPI.postGRNToInventory(grnId, by),
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

  const handleViewProfile = async (grn: any) => {
    const full = await window.electronAPI.getGRN(grn.id);
    setSelectedGRN(full);
    setProfileTab(0);
    setProfileOpen(true);
  };

  const handleOpenQC = (grn: any) => {
    setQcGRN(grn);
    setQcDetailIdx(0);
    setQcAcceptedQty(grn.details?.[0]?.receivedQty || 0);
    setQcRejectedQty(0);
    setQcRemarks('');
    setQcDialogOpen(true);
  };

  const handleSubmitQC = async () => {
    if (!qcGRN || !qcGRN.details) return;
    const detail = qcGRN.details[qcDetailIdx];
    const total = qcAcceptedQty + qcRejectedQty;
    if (total > detail.receivedQty) return;
    await qcMutation.mutateAsync({
      grnHeaderId: qcGRN.id,
      lineNumber: detail.lineNumber,
      itemId: detail.itemId,
      itemName: detail.itemName,
      receivedQty: detail.receivedQty,
      inspectedQty: detail.receivedQty,
      acceptedQty: qcAcceptedQty,
      rejectedQty: qcRejectedQty,
      inspectorName: currentUser?.fullName || currentUser?.username || 'system',
      result: qcRejectedQty === 0 ? 'ACCEPT' : qcAcceptedQty === 0 ? 'REJECT' : 'PARTIAL',
      remarks: qcRemarks,
    });
  };

  const grns = result?.data || [];

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Goods Receipt</Typography>
          <Typography variant="body2" color="text.secondary">Record incoming goods and quality inspection</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/procurement/grn/new')}>New GRN</Button>
      </Box>

      {dashboard && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Total GRNs', value: dashboard.totalGRNs, color: 'primary.main' },
            { label: 'Pending QC', value: dashboard.pendingQC, color: 'warning.main' },
            { label: 'QC Passed', value: dashboard.qcPassed, color: 'success.main' },
            { label: 'Completed', value: dashboard.completed, color: 'info.main' },
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
            <TextField fullWidth size="small" placeholder="Search GRNs..." value={search} onChange={e => handleSearchChange(e.target.value)}
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
                <TableCell>GRN Number</TableCell><TableCell>Source Name</TableCell><TableCell>Invoice #</TableCell><TableCell>Store</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell>
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
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="error" fontWeight={600}>Failed to load goods receipts</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Please check your connection and try again.</Typography>
                    <IconButton onClick={() => refetch()} sx={{ border: '1px solid', borderColor: 'divider' }}><Refresh fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ) : grns.map((grn: any) => (
                <TableRow key={grn.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{grn.grnNumber}</TableCell>
                  <TableCell>{grn.vendor?.vendorName || '-'}</TableCell>
                  <TableCell>{grn.invoiceNumber || '-'}</TableCell>
                  <TableCell>{grn.store?.name || '-'}</TableCell>
                  <TableCell align="right">₹{grn.totalAmount?.toLocaleString()}</TableCell>
                  <TableCell>{formatDateDDMMYYYY(grn.receiptDate)}</TableCell>
                  <TableCell><StatusBadge status={grn.status} /></TableCell>
                  <TableCell align="center">
                    <Tooltip title="View"><IconButton size="small" onClick={() => handleViewProfile(grn)}><Visibility fontSize="small" /></IconButton></Tooltip>
                    {grn.status === 'RECEIVED' && <Tooltip title="Record QC"><IconButton size="small" color="warning" onClick={() => handleOpenQC(grn)}><Assignment fontSize="small" /></IconButton></Tooltip>}
                    {(grn.status === 'QC_PASSED' || grn.status === 'PARTIALLY_ACCEPTED' || grn.status === 'RECEIVED') && (
                       <Tooltip title="Post to Inventory"><IconButton size="small" color="success" onClick={() => { setPostGRN(grn); setPostConfirmOpen(true); }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && grns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState icon={<LocalShipping />} title="No goods receipts found" description="Record your first goods receipt to get started" />
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

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="md" fullWidth>
        {selectedGRN && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LocalShipping /><Box><Typography variant="h6" fontWeight={700}>{selectedGRN.grnNumber}</Typography>
              <Typography variant="caption" color="text.secondary">{selectedGRN.vendor?.vendorName} → {selectedGRN.store?.name}{selectedGRN.invoiceNumber ? ` | Inv# ${selectedGRN.invoiceNumber}` : ''}</Typography></Box>
            </DialogTitle>
            <DialogContent dividers>
              <Tabs value={profileTab} onChange={(_, v) => setProfileTab(v)} sx={{ mb: 2 }}>
                <Tab label="Items" /><Tab label="QC Results" />
              </Tabs>
              {profileTab === 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Item</TableCell><TableCell align="right">Received</TableCell><TableCell align="right">Accepted</TableCell><TableCell align="right">Rejected</TableCell><TableCell align="right">Rate</TableCell><TableCell>Batch</TableCell></TableRow></TableHead>
                    <TableBody>
                      {selectedGRN.details?.map((d: any) => (
                        <TableRow key={d.id}><TableCell>{d.itemName}</TableCell><TableCell align="right">{d.receivedQty}</TableCell>
                          <TableCell align="right">{d.acceptedQty}</TableCell><TableCell align="right">{d.rejectedQty}</TableCell>
                          <TableCell align="right">₹{d.rate}</TableCell><TableCell>{d.batchNumber || '-'}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {profileTab === 1 && (
                selectedGRN.qualityChecks?.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead><TableRow><TableCell>Item</TableCell><TableCell>Result</TableCell><TableCell>Accepted</TableCell><TableCell>Rejected</TableCell><TableCell>Inspector</TableCell></TableRow></TableHead>
                      <TableBody>
                        {selectedGRN.qualityChecks.map((qc: any) => (
                          <TableRow key={qc.id}><TableCell>{qc.itemName}</TableCell>
                            <TableCell><Chip size="small" label={qc.result} color={qc.result === 'ACCEPT' ? 'success' : qc.result === 'REJECT' ? 'error' : 'warning'} /></TableCell>
                            <TableCell>{qc.acceptedQty}</TableCell><TableCell>{qc.rejectedQty}</TableCell><TableCell>{qc.inspectorName}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : <Typography color="text.secondary">No QC records.</Typography>
              )}
            </DialogContent>
            <DialogActions><Button onClick={() => setProfileOpen(false)}>Close</Button></DialogActions>
          </>
        )}
      </Dialog>

      {/* QC Dialog */}
      <Dialog open={qcDialogOpen} onClose={() => setQcDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Quality Check — {qcGRN?.grnNumber}</DialogTitle>
        <DialogContent>
          {qcGRN?.details && qcGRN.details[qcDetailIdx] && (
            <Box>
              <Typography variant="body2" fontWeight={600} mb={1}>
                Item: {qcGRN.details[qcDetailIdx].itemName} (Received: {qcGRN.details[qcDetailIdx].receivedQty})
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {(() => {
                  const det = qcGRN.details[qcDetailIdx];
                  const maxAccepted = det.receivedQty - qcRejectedQty;
                  const maxRejected = det.receivedQty - qcAcceptedQty;
                  const total = qcAcceptedQty + qcRejectedQty;
                  const overLimit = total > det.receivedQty;
                  return (<>
                    <Grid item xs={6}><TextField fullWidth size="small" label="Accepted Qty" type="number" value={qcAcceptedQty} onChange={e => setQcAcceptedQty(Math.max(0, Math.min(Number(e.target.value), maxAccepted)))} inputProps={{ min: 0, max: maxAccepted }} error={overLimit} helperText={overLimit ? `Max: ${maxAccepted}` : ''} /></Grid>
                    <Grid item xs={6}><TextField fullWidth size="small" label="Rejected Qty" type="number" value={qcRejectedQty} onChange={e => setQcRejectedQty(Math.max(0, Math.min(Number(e.target.value), maxRejected)))} inputProps={{ min: 0, max: maxRejected }} error={overLimit} helperText={overLimit ? `Max: ${maxRejected}` : ''} /></Grid>
                    <Grid item xs={12}><TextField fullWidth size="small" label="Remarks" multiline rows={2} value={qcRemarks} onChange={e => setQcRemarks(e.target.value)} /></Grid>
                  </>);
                })()}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQcDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitQC} disabled={qcMutation.isPending || (qcGRN?.details?.[qcDetailIdx] && (qcAcceptedQty + qcRejectedQty > qcGRN.details[qcDetailIdx].receivedQty))}>Submit QC</Button>
        </DialogActions>
      </Dialog>

      {/* Post to Inventory Confirmation */}
      <Dialog open={postConfirmOpen} onClose={() => setPostConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Post to Inventory</DialogTitle>
        <DialogContent>
          <Typography>
            Post this Goods Receipt to inventory? This will add items to stock and cannot be easily reversed.
          </Typography>
          {postGRN && (
            <Box mt={2} p={1.5} sx={{ bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight={600}>{postGRN.grnNumber}</Typography>
              <Typography variant="caption" color="text.secondary">
                {postGRN.vendor?.vendorName || '-'} | ₹{postGRN.totalAmount?.toLocaleString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPostConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={() => {
            if (postGRN) postMutation.mutate({ grnId: postGRN.id, by: currentUser?.username || 'system' });
            setPostConfirmOpen(false);
          }}>Post to Inventory</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
