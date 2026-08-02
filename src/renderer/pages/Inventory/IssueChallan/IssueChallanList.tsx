import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Stack, TextField, TablePagination,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  alpha, useTheme, Grid, Divider, CircularProgress,
} from '@mui/material';
import { Add, Visibility, CheckCircle, Cancel, Search, Assignment, Edit, Delete, Close } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { useAuth } from '../../../context/AuthContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, parseDateDDMMYYYY } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function IssueChallanList() {
  const { company, financialYear } = useCompany();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [cancelReason, setCancelReason] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number | null; challanNo: string }>({ open: false, id: null, challanNo: '' });
  const [viewDialog, setViewDialog] = useState<{ open: boolean; data: any }>({ open: false, data: null });

  const exportColumns = [
    { header: 'Serial Number', key: 'serialNo' },
    { header: 'Date', key: 'date' },
    { header: 'From Store', key: 'sourceStore' },
    { header: 'To Department', key: 'department' },
    { header: 'Items Count', key: 'itemsCount' },
    { header: 'Issued By', key: 'issuedBy' },
    { header: 'Status', key: 'status' },
  ];

  const { data: allIssueChallans } = useQuery({
    queryKey: ['issueChallans', company?.id, financialYear?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('issueChallan', 'findMany', {
      where: { companyId: company!.id, financialYearId: financialYear!.id },
      include: { department: true, sourceStore: true, items: { include: { item: true, unit: true, location: true } } },
      orderBy: { date: 'desc' },
    }),
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const getExportData = () => (allIssueChallans || []).map((ic: any) => ({
    serialNo: ic.serialNo || ic.challanNo,
    date: formatDateDDMMYYYY(ic.date),
    sourceStore: ic.sourceStore?.name || '',
    department: ic.department?.name || '',
    itemsCount: ic.items?.length || 0,
    issuedBy: ic.issuedBy || '',
    status: ic.status,
  }));

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 500);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['issueChallans', company?.id, financialYear?.id, page, rowsPerPage, debouncedSearch, statusFilter],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = { companyId: company!.id, financialYearId: financialYear!.id };
      if (debouncedSearch) where.OR = [{ challanNo: { contains: debouncedSearch } }, { purpose: { contains: debouncedSearch } }];
      if (statusFilter) where.status = statusFilter;

      const [data, total] = await Promise.all([
        api.dbQuery('issueChallan', 'findMany', {
          where,
          include: { department: true, sourceStore: true, items: { include: { item: true, unit: true, location: true } } },
          skip: page * rowsPerPage,
          take: rowsPerPage,
          orderBy: { date: 'desc' },
        }),
        api.dbQuery('issueChallan', 'count', { where }),
      ]);
      return { data, total };
    },
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const handleImportIssues = async (rows: any[]) => {
    try {
      let created = 0, skipped = 0;
      for (const row of rows) {
        const challanNo = row['Challan No'] || row['challanNo'] || '';
        if (!challanNo) { skipped++; continue; }
        await window.electronAPI.createIssueChallanImport({
          challanNo, companyId: company!.id, financialYearId: financialYear!.id,
          date: (() => { const raw = row['Date'] || row['date'] || ''; const d = parseDateDDMMYYYY(raw); return d || new Date(); })(),
          issuedBy: row['Issued By'] || row['issuedBy'] || '',
          status: row['Status'] || row['status'] || 'Draft',
        });
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ['issueChallans'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return window.electronAPI.cancelIssueChallan(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issueChallans'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['itemHistory'] });
      queryClient.invalidateQueries({ queryKey: ['locationBalances'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      queryClient.invalidateQueries({ queryKey: ['buildingIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomInstallations'] });
      queryClient.invalidateQueries({ queryKey: ['buildingInstallations'] });
      setCancelDialog({ open: false, id: null });
      setCancelReason('');
    },
    onError: (err: any) => { toast.error(err.message || 'Failed to cancel challan'); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return window.electronAPI.deleteIssueChallan(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issueChallans'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['itemHistory'] });
      queryClient.invalidateQueries({ queryKey: ['locationBalances'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      queryClient.invalidateQueries({ queryKey: ['buildingIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomInstallations'] });
      queryClient.invalidateQueries({ queryKey: ['buildingInstallations'] });
      setDeleteDialog({ open: false, id: null, challanNo: '' });
      toast.success('Challan deleted successfully');
    },
    onError: (err: any) => { toast.error(err.message || 'Failed to delete challan'); },
  });

  const statusColor = (s: string) => {
    switch (s) {
      case 'Draft': return 'warning';
      case 'Posted': return 'success';
      case 'Cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <PageHeader
        title="Issue Challans (Kharch)"
        subtitle="Track outgoing material issues"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons
              data={getExportData()}
              columns={exportColumns}
              fileName="issue-challans"
              onImport={handleImportIssues}
            />
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/inventory/issue-challan/new')}>
              New Issue Challan
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            placeholder="Search challan..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 150 }}
            SelectProps={{ native: true }}
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Posted">Posted</option>
            <option value="Cancelled">Cancelled</option>
          </TextField>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Serial Number</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>From Store</TableCell>
              <TableCell>To Department</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Room</TableCell>
              <TableCell>Issued By</TableCell>
              <TableCell>Posted At</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((ic: any) => (
              <TableRow key={ic.id} hover>
                <TableCell>
                  <Chip label={ic.serialNo || ic.challanNo} size="small" color="secondary" variant="outlined" sx={{ fontWeight: 600, fontFamily: 'monospace' }} />
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(ic.date)}</TableCell>
                <TableCell>{ic.sourceStore?.name || '-'}</TableCell>
                <TableCell>{ic.department?.name}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                    <Chip label={`${ic.items?.length || 0} items`} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ic.items?.map((it: any) => it.item?.itemName).filter(Boolean).join(', ')}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  {(() => {
                    const rooms = ic.items?.map((it: any) => it.location?.locationName).filter(Boolean);
                    const unique = [...new Set(rooms)];
                    return unique.length > 0 ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {unique.map((r: any, i: number) => (
                          <Chip key={i} label={r} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                        ))}
                      </Stack>
                    ) : <Typography variant="body2" color="text.secondary">-</Typography>;
                  })()}
                </TableCell>
                <TableCell>{ic.issuedBy}</TableCell>
                <TableCell>{formatDateTimeDDMMYYYY(ic.postedAt)}</TableCell>
                <TableCell>
                  <Chip label={ic.status} size="small" color={statusColor(ic.status) as any} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View">
                    <IconButton size="small" onClick={() => setViewDialog({ open: true, data: ic })} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {ic.status === 'Draft' && (
                    <>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => navigate(`/inventory/issue-challan/${ic.id}`)} sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                        <Tooltip title="Post">
                        <IconButton size="small" color="success" onClick={async () => {
                          try {
                            await window.electronAPI.postIssueChallan(ic.id);
                            await Promise.all([
                              queryClient.invalidateQueries({ queryKey: ['issueChallans'] }),
                              queryClient.invalidateQueries({ queryKey: ['stockTransactions'] }),
                              queryClient.invalidateQueries({ queryKey: ['stockLedger'] }),
                              queryClient.invalidateQueries({ queryKey: ['stockBalance'] }),
                              queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                              queryClient.invalidateQueries({ queryKey: ['itemHistory'] }),
                              queryClient.invalidateQueries({ queryKey: ['locationBalances'] }),
                              queryClient.invalidateQueries({ queryKey: ['report'] }),
                              queryClient.invalidateQueries({ queryKey: ['buildingIssues'] }),
                              queryClient.invalidateQueries({ queryKey: ['roomIssues'] }),
                              queryClient.invalidateQueries({ queryKey: ['roomInstallations'] }),
                              queryClient.invalidateQueries({ queryKey: ['buildingInstallations'] }),
                            ]);
                            toast.success('Challan posted successfully');
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to post challan');
                          }
                        }}><CheckCircle fontSize="small" /></IconButton>
                      </Tooltip>
                       {hasPermission('delete_challan') && (
                       <Tooltip title="Delete">
                         <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: ic.id, challanNo: ic.challanNo })}><Delete fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                     </>
                   )}
                   {ic.status === 'Posted' && (
                     <>
                       {hasPermission('delete_challan') && (
                       <Tooltip title="Delete">
                         <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: ic.id, challanNo: ic.challanNo })}><Delete fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                       {hasPermission('cancel_challan') && (
                       <Tooltip title="Cancel">
                         <IconButton size="small" color="error" onClick={() => setCancelDialog({ open: true, id: ic.id })}><Cancel fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={10}>
                  <EmptyState icon={<Assignment />} title="No issue challans" description="Create your first issue challan to track material dispatches" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination component="div" count={data?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, id: null })}>
        <DialogTitle>Cancel Issue Challan</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label="Cancel Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, id: null })}>Close</Button>
          <Button variant="contained" color="error" onClick={() => cancelDialog.id && cancelMutation.mutate({ id: cancelDialog.id, reason: cancelReason })} disabled={!cancelReason}>Cancel Challan</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null, challanNo: '' })}>
        <DialogTitle>Delete Issue Challan</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>Are you sure you want to delete challan <strong>{deleteDialog.challanNo}</strong>?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Stock transactions will be reversed automatically. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null, challanNo: '' })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteDialog.id && deleteMutation.mutate(deleteDialog.id)}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* View Challan Dialog */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Issue Challan Details</Typography>
            <Typography variant="caption" color="text.secondary">{viewDialog.data?.serialNo || viewDialog.data?.challanNo}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={viewDialog.data?.status} size="small" color={statusColor(viewDialog.data?.status) as any} />
            <IconButton onClick={() => setViewDialog({ open: false, data: null })} size="small"><Close fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewDialog.data && (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Serial Number</Typography>
                  <Typography fontWeight={600}>{viewDialog.data.serialNo || viewDialog.data.challanNo}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography fontWeight={600}>{formatDateDDMMYYYY(viewDialog.data.date)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">From Store</Typography>
                  <Typography fontWeight={600}>{viewDialog.data.sourceStore?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Issue To</Typography>
                  <Typography fontWeight={600}>{viewDialog.data.department?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Issued By</Typography>
                  <Typography fontWeight={600}>{viewDialog.data.issuedBy || '-'}</Typography>
                </Grid>
                {viewDialog.data.approvedBy && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Approved By</Typography>
                    <Typography fontWeight={600}>{viewDialog.data.approvedBy}</Typography>
                  </Grid>
                )}
                {viewDialog.data.purpose && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Purpose</Typography>
                    <Typography fontWeight={600}>{viewDialog.data.purpose}</Typography>
                  </Grid>
                )}
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box><Chip label={viewDialog.data.status} size="small" color={statusColor(viewDialog.data.status) as any} /></Box>
                </Grid>
                {viewDialog.data.postedAt && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Posted At</Typography>
                    <Typography fontWeight={600}>{formatDateTimeDDMMYYYY(viewDialog.data.postedAt)}</Typography>
                  </Grid>
                )}
              </Grid>

              {viewDialog.data.remarks && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Remarks</Typography>
                  <Typography fontWeight={500}>{viewDialog.data.remarks}</Typography>
                </Box>
              )}

              <Divider />

              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>Items ({viewDialog.data.items?.length || 0})</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Item Name</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell>Qty</TableCell>
                        <TableCell>Room</TableCell>
                        <TableCell>Purpose</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewDialog.data.items?.map((it: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography fontWeight={500}>{it.item?.itemName || '-'}</Typography>
                            <Typography variant="caption" color="text.secondary">{it.item?.itemCode}</Typography>
                          </TableCell>
                          <TableCell>{it.unit?.name || '-'}</TableCell>
                          <TableCell>{Number(it.quantity)}</TableCell>
                          <TableCell>{it.location?.locationName || '-'}</TableCell>
                          <TableCell>{it.purpose || '-'}</TableCell>
                          <TableCell>{it.remarks || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          {viewDialog.data?.status === 'Draft' && (
            <Button variant="contained" startIcon={<Edit />} onClick={() => { setViewDialog({ open: false, data: null }); navigate(`/inventory/issue-challan/${viewDialog.data.id}`); }}>
              Edit Challan
            </Button>
          )}
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
