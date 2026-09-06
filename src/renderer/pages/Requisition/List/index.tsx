import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Chip, TextField,
  InputAdornment, Button, Grid, FormControl, InputLabel, Select, MenuItem,
  Tooltip, Tabs, Tab, Card, CardContent, LinearProgress, Avatar,
} from '@mui/material';
import {
  Add, Search, Visibility, Send, Cancel, CheckCircle, Block,
  RestartAlt, Forward, Warning, PriorityHigh, Assignment, Refresh,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCompany } from '../../../context/CompanyContext';
import { getErrorMessage } from '../../../utils/errorUtils';
import { useListState } from '../../../hooks/useListState';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateUtils';
import StatusBadge from '../../../components/StatusBadge';
import { PageLoader } from '../../../components/LoadingSkeleton';
import ConfirmDialog from '../../../components/ConfirmDialog';

const STATUS_OPTIONS = [
  'DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED',
  'REJECTED', 'CANCELLED', 'COMPLETED', 'CLOSED',
];

const PRIORITY_COLORS: Record<string, string> = {
  EMERGENCY: '#DC2626', HIGH: '#F97316', MEDIUM: '#F59E0B', LOW: '#22C55E',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  ISSUE: 'Issue', TRANSFER: 'Transfer', INSTALLATION: 'Installation',
  REPAIR: 'Repair', REPLACEMENT: 'Replacement', DAMAGE: 'Damage',
  ADJUSTMENT: 'Adjustment', PURCHASE: 'Purchase', RETURN: 'Return', SCRAP: 'Scrap',
};

export default function RequisitionListPage() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const {
    state: ls, setSearch, setPage: setLsPage, setPageSize, setFilter, resetState,
  } = useListState('requisitions', { pageSize: 25 });

  const [page, setPage] = useState(ls.page);
  const [rowsPerPage, setRowsPerPage] = useState(ls.pageSize);
  const [search, setSearchLocal] = useState(ls.search);
  const [statusFilter, setStatusFilter] = useState(ls.filters.status || '');
  const [typeFilter, setTypeFilter] = useState(ls.filters.type || '');
  const [priorityFilter, setPriorityFilter] = useState(ls.filters.priority || '');
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalQty, setApprovalQty] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<any>(null);

  const handleSearchChange = (v: string) => {
    setSearchLocal(v);
    setSearch(v);
  };
  const handleStatusFilter = (v: string) => {
    setStatusFilter(v);
    setFilter('status', v);
  };
  const handleTypeFilter = (v: string) => {
    setTypeFilter(v);
    setFilter('type', v);
  };
  const handlePriorityFilter = (v: string) => {
    setPriorityFilter(v);
    setFilter('priority', v);
  };
  const handlePageChange = (_: any, newPage: number) => {
    setPage(newPage);
    setLsPage(newPage);
  };
  const handleRowsPerPageChange = (e: any) => {
    const val = parseInt(e.target.value, 10);
    setRowsPerPage(val);
    setPageSize(val);
    setPage(0);
  };

  const { data: result, isLoading, isError, refetch } = useQuery({
    queryKey: ['requisitions', companyId, page, rowsPerPage, search, statusFilter, typeFilter, priorityFilter],
    queryFn: () => window.electronAPI.searchRequisitions({
      companyId,
      page: page + 1,
      limit: rowsPerPage,
      search: search || undefined,
      status: statusFilter || undefined,
      requestType: typeFilter || undefined,
      priority: priorityFilter || undefined,
    }),
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pendingApprovals', companyId],
    queryFn: () => window.electronAPI.getPendingApprovals(1, companyId),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['reqDashboard', companyId],
    queryFn: () => window.electronAPI.getRequisitionDashboard(companyId),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.submitRequisition(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['requisitions'] }); toast.success('Submitted'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to submit')),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: any) => window.electronAPI.cancelRequisition(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['requisitions'] }); toast.success('Cancelled'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to cancel')),
  });

  const approveMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.approveRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      toast.success('Approved');
      setApprovalDialogOpen(false);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to approve')),
  });

  const rejectMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.rejectRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      toast.success('Rejected');
      setApprovalDialogOpen(false);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to reject')),
  });

  const handleViewProfile = async (req: any) => {
    const full = await window.electronAPI.getRequisition(req.id);
    setSelectedReq(full);
    setProfileOpen(true);
  };

  const handleOpenApproval = (req: any, action: string) => {
    setSelectedReq(req);
    setApprovalAction(action);
    setApprovalRemarks('');
    setApprovalQty(req.details?.[0]?.requestedQty || 0);
    setApprovalDialogOpen(true);
  };

  const handleApproval = async () => {
    const data = {
      requisitionId: selectedReq.id,
      actionById: 1,
      actionByName: 'Admin',
      action: approvalAction,
      remarks: approvalRemarks,
      quantity: approvalQty,
    };
    if (approvalAction === 'APPROVE' || approvalAction === 'PARTIAL') {
      await approveMutation.mutateAsync(data);
    } else {
      await rejectMutation.mutateAsync(data);
    }
  };

  const requests = result?.data || [];
  const total = result?.total || 0;

  if (isLoading) return <PageLoader message="Loading requisitions..." />;

  if (isError) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="40vh" gap={2}>
        <Typography variant="h6" color="error" fontWeight={600}>Failed to load data</Typography>
        <Typography variant="body2" color="text.secondary">Please check your connection and try again.</Typography>
        <IconButton onClick={() => refetch()} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Refresh />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Requisitions</Typography>
          <Typography variant="body2" color="text.secondary">Manage inventory requests and approvals</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/requisition/create')}>
          New Request
        </Button>
      </Box>

      {/* Dashboard Stats */}
      {dashboard && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Total', value: dashboard.totalRequests, color: 'primary.main' },
            { label: 'Pending', value: dashboard.pendingRequests, color: 'warning.main' },
            { label: 'Approved Today', value: dashboard.approvedToday, color: 'success.main' },
            { label: 'Rejected Today', value: dashboard.rejectedToday, color: 'error.main' },
            { label: 'Urgent', value: dashboard.urgentRequests, color: '#DC2626' },
            { label: 'Overdue', value: dashboard.overdueRequests, color: '#F97316' },
          ].map((stat) => (
            <Grid item xs={6} sm={4} md={2} key={stat.label}>
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

      {/* Pending Approvals */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, borderLeft: '4px solid #F59E0B' }}>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            Pending Approvals ({pendingApprovals.length})
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {pendingApprovals.slice(0, 5).map((req: any) => (
              <Chip key={req.id}
                label={`${req.requisitionNumber} — ${req.requestedByName}`}
                onClick={() => handleViewProfile(req)}
                onDelete={() => handleOpenApproval(req, 'APPROVE')}
                color="warning" variant="outlined" />
            ))}
          </Box>
        </Paper>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField fullWidth size="small" placeholder="Search requests..."
              value={search} onChange={e => handleSearchChange(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={e => handleStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={typeFilter} label="Type" onChange={e => handleTypeFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select value={priorityFilter} label="Priority" onChange={e => handlePriorityFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {Object.keys(PRIORITY_COLORS).map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
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
                <TableCell>Req #</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Requested By</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req: any) => (
                <TableRow key={req.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{req.requisitionNumber}</TableCell>
                  <TableCell><Chip size="small" label={REQUEST_TYPE_LABELS[req.requestType] || req.requestType} /></TableCell>
                  <TableCell>{req.requestedByName}</TableCell>
                  <TableCell>{req.departmentName || '-'}</TableCell>
                  <TableCell>{req.details?.length || 0}</TableCell>
                  <TableCell>
                    <Chip size="small" label={req.priority}
                      sx={{ bgcolor: PRIORITY_COLORS[req.priority] + '20', color: PRIORITY_COLORS[req.priority], fontWeight: 600, fontSize: 10 }} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={req.status} />
                  </TableCell>
                  <TableCell>{formatDateDDMMYYYY(new Date(req.requestDate))}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="View"><IconButton size="small" onClick={() => handleViewProfile(req)}><Visibility fontSize="small" /></IconButton></Tooltip>
                    {req.status === 'DRAFT' && (
                      <Tooltip title="Submit"><IconButton size="small" color="primary" onClick={() => submitMutation.mutate(req.id)}><Send fontSize="small" /></IconButton></Tooltip>
                    )}
                    {req.status === 'DRAFT' && (
                      <Tooltip title="Cancel"><IconButton size="small" color="error" onClick={() => setCancelTarget(req)}><Cancel fontSize="small" /></IconButton></Tooltip>
                    )}
                    {(req.status === 'SUBMITTED' || req.status === 'PENDING') && (
                      <Tooltip title="Approve"><IconButton size="small" color="success" onClick={() => handleOpenApproval(req, 'APPROVE')}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                    )}
                    {(req.status === 'SUBMITTED' || req.status === 'PENDING') && (
                      <Tooltip title="Reject"><IconButton size="small" color="error" onClick={() => handleOpenApproval(req, 'REJECT')}><Block fontSize="small" /></IconButton></Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>No requisitions found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange} onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50]} />
      </Paper>

      <EnterpriseDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Requisition Details"
        subtitle={selectedReq ? `${REQUEST_TYPE_LABELS[selectedReq.requestType]} — ${selectedReq.requestedByName}` : undefined}
        icon={<Assignment />}
        actions={<Button onClick={() => setProfileOpen(false)}>Close</Button>}
      >
        {selectedReq && (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" gutterBottom>Status</Typography>
              <StatusBadge status={selectedReq.status} />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" gutterBottom>Priority</Typography>
              <Chip label={selectedReq.priority}
                sx={{ bgcolor: PRIORITY_COLORS[selectedReq.priority] + '20', color: PRIORITY_COLORS[selectedReq.priority], fontWeight: 600 }} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Requested</TableCell>
                      <TableCell align="right">Approved</TableCell>
                      <TableCell align="right">Issued</TableCell>
                      <TableCell align="right">Pending</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedReq.details?.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.itemName}</TableCell>
                        <TableCell align="right">{d.requestedQty}</TableCell>
                        <TableCell align="right">{d.approvedQty}</TableCell>
                        <TableCell align="right">{d.issuedQty}</TableCell>
                        <TableCell align="right">{d.pendingQty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {selectedReq.approvals?.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Approval History</Typography>
                {selectedReq.approvals.map((a: any) => (
                  <Box key={a.id} display="flex" gap={2} alignItems="center" mb={1}>
                    <Chip size="small" label={a.action}
                      color={a.action === 'APPROVE' ? 'success' : a.action === 'REJECT' ? 'error' : 'default'} />
                    <Typography variant="body2">{a.actionByName}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDateTimeDDMMYYYY(a.actionDate)}</Typography>
                    {a.remarks && <Typography variant="caption" color="text.secondary">— {a.remarks}</Typography>}
                  </Box>
                ))}
              </Grid>
            )}
          </Grid>
        )}
      </EnterpriseDialog>

      <EnterpriseDialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        title="Approve/Reject Requisition"
        subtitle={approvalAction === 'APPROVE' ? 'Approve Request' : approvalAction === 'PARTIAL' ? 'Partial Approval' : 'Reject Request'}
        icon={<CheckCircle />}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
            {approvalAction === 'APPROVE' && (
              <Button variant="contained" color="success" onClick={handleApproval}
                disabled={approveMutation.isPending}>Approve</Button>
            )}
            {approvalAction === 'PARTIAL' && (
              <Button variant="contained" color="warning" onClick={handleApproval}
                disabled={approveMutation.isPending}>Partial Approve</Button>
            )}
            {approvalAction === 'REJECT' && (
              <Button variant="contained" color="error" onClick={handleApproval}
                disabled={rejectMutation.isPending}>Reject</Button>
            )}
          </>
        }
      >
        {selectedReq && (
          <Box mb={2}>
            <Typography variant="body2" fontWeight={600}>{selectedReq.requisitionNumber}</Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedReq.requestedByName} — {selectedReq.details?.length} items
            </Typography>
          </Box>
        )}
        <TextField fullWidth label="Remarks" value={approvalRemarks} onChange={e => setApprovalRemarks(e.target.value)}
          multiline rows={2} sx={{ mb: 2 }} />
        {approvalAction === 'PARTIAL' && (
          <TextField fullWidth label="Approve Quantity" type="number" value={approvalQty}
            onChange={e => setApprovalQty(Number(e.target.value))} inputProps={{ min: 1 }} />
        )}
      </EnterpriseDialog>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Requisition"
        message={`Cancel requisition ${cancelTarget?.requisitionNumber || ''}? This cannot be reversed.`}
        confirmText="Cancel Requisition"
        confirmColor="error"
        onConfirm={() => {
          if (cancelTarget) {
            cancelMutation.mutate({ id: cancelTarget.id });
            setCancelTarget(null);
          }
        }}
        onCancel={() => setCancelTarget(null)}
        loading={cancelMutation.isPending}
      />
    </Box>
  );
}
