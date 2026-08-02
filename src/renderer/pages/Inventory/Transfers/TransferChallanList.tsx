import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Stack, TextField, TablePagination,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  alpha, useTheme, Divider, Grid,
} from '@mui/material';
import { Add, Visibility, Search, Transform, Edit, Delete, CheckCircle, Cancel, Close } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { useAuth } from '../../../context/AuthContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, parseDateDDMMYYYY } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function TransferChallanList() {
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
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number | null; challanNo: string }>({ open: false, id: null, challanNo: '' });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [cancelReason, setCancelReason] = useState('');
  const [viewDialog, setViewDialog] = useState<{ open: boolean; data: any }>({ open: false, data: null });

  const exportColumns = [
    { header: 'Challan No', key: 'challanNo' },
    { header: 'Date', key: 'date' },
    { header: 'From Department', key: 'fromDepartment' },
    { header: 'To Department', key: 'toDepartment' },
    { header: 'Items Count', key: 'itemsCount' },
    { header: 'Total Qty', key: 'totalQty' },
    { header: 'Transferred By', key: 'transferredBy' },
    { header: 'Status', key: 'status' },
  ];

  const { data: allTransferChallans } = useQuery({
    queryKey: ['transferChallans', company?.id, financialYear?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('transferChallan', 'findMany', {
      where: { companyId: company!.id, financialYearId: financialYear!.id },
      include: { fromDepartment: true, toDepartment: true, items: { include: { item: true, location: true, toLocation: true } } },
      orderBy: { date: 'desc' },
    }),
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const getExportData = () => (allTransferChallans || []).map((tc: any) => ({
    challanNo: tc.challanNo,
    date: formatDateDDMMYYYY(tc.date),
    fromDepartment: tc.fromDepartment?.name || '',
    toDepartment: tc.toDepartment?.name || '',
    itemsCount: tc.items?.length || 0,
    totalQty: tc.items?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 0,
    transferredBy: tc.transferredBy || '',
    status: tc.status,
  }));

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 500);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['transferChallans', company?.id, financialYear?.id, page, rowsPerPage, debouncedSearch],
    queryFn: async () => {
      const where: any = { companyId: company!.id, financialYearId: financialYear!.id };
      if (debouncedSearch) where.OR = [{ challanNo: { contains: debouncedSearch } }];
      const [data, total] = await Promise.all([
        window.electronAPI.dbQuery('transferChallan', 'findMany', {
          where, include: { fromDepartment: true, toDepartment: true, items: { include: { item: true, location: true, toLocation: true } } },
          skip: page * rowsPerPage, take: rowsPerPage, orderBy: { date: 'desc' },
        }),
        window.electronAPI.dbQuery('transferChallan', 'count', { where }),
      ]);
      return { data, total };
    },
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const handleImportTransfers = async (rows: any[]) => {
    try {
      let created = 0, skipped = 0;
      for (const row of rows) {
        const challanNo = row['Challan No'] || row['challanNo'] || '';
        if (!challanNo) { skipped++; continue; }
        await window.electronAPI.createTransferChallanImport({
          challanNo, companyId: company!.id, financialYearId: financialYear!.id,
          date: (() => { const raw = row['Date'] || row['date'] || ''; const d = parseDateDDMMYYYY(raw); return d || new Date(); })(),
          transferredBy: row['Transferred By'] || row['transferredBy'] || '',
          status: row['Status'] || row['status'] || 'Draft',
        });
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ['transferChallans'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return window.electronAPI.deleteTransferChallan(id);
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
      queryClient.invalidateQueries({ queryKey: ['buildingIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomInstallations'] });
      queryClient.invalidateQueries({ queryKey: ['buildingInstallations'] });
      setDeleteDialog({ open: false, id: null, challanNo: '' });
      toast.success('Challan deleted successfully');
    },
    onError: (err: any) => { toast.error(err.message || 'Failed to delete challan'); },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return window.electronAPI.cancelTransferChallan(id, reason);
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
      queryClient.invalidateQueries({ queryKey: ['buildingIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomIssues'] });
      queryClient.invalidateQueries({ queryKey: ['roomInstallations'] });
      queryClient.invalidateQueries({ queryKey: ['buildingInstallations'] });
      setCancelDialog({ open: false, id: null });
      setCancelReason('');
      toast.success('Challan cancelled successfully');
    },
    onError: (err: any) => { toast.error(err.message || 'Failed to cancel challan'); },
  });

  const statusColor = (s: string) => { switch (s) { case 'Draft': return 'warning'; case 'Posted': return 'success'; case 'Cancelled': return 'error'; default: return 'default'; } };
  const viewData = viewDialog.data;

  return (
    <Box>
      <PageHeader
        title="Transfer Challans"
        subtitle="Track inter-department material transfers"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons
              data={getExportData()}
              columns={exportColumns}
              fileName="transfer-challans"
              onImport={handleImportTransfers}
            />
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/inventory/transfer-challan/new')}>New Transfer</Button>
          </Stack>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search transfer challans..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          size="small"
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Challan No</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Total Qty</TableCell>
              <TableCell>Transferred By</TableCell>
              <TableCell>Posted At</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((tc: any) => (
              <TableRow key={tc.id} hover>
                <TableCell>
                  <Chip label={tc.challanNo} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600, fontFamily: 'monospace' }} />
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(tc.date)}</TableCell>
                <TableCell>
                  <Typography fontWeight={500} fontSize="0.8125rem">{tc.fromDepartment?.name || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={500} fontSize="0.8125rem">{tc.toDepartment?.name || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Stack spacing={0.25}>
                    {tc.items?.slice(0, 3).map((item: any, idx: number) => (
                      <Typography key={idx} variant="caption" fontWeight={500} color="text.primary">
                        {item.item?.itemName || `Item #${item.itemId}`}
                      </Typography>
                    ))}
                    {(tc.items?.length || 0) > 3 && (
                      <Typography variant="caption" color="text.secondary">+{tc.items.length - 3} more</Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{tc.items?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0)}</Typography>
                </TableCell>
                <TableCell>{tc.transferredBy}</TableCell>
                <TableCell><Typography fontSize="0.8125rem">{formatDateTimeDDMMYYYY(tc.postedAt)}</Typography></TableCell>
                <TableCell><Chip label={tc.status} size="small" color={statusColor(tc.status) as any} variant="outlined" /></TableCell>
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => setViewDialog({ open: true, data: tc })} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {tc.status === 'Draft' && (
                    <>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => navigate(`/inventory/transfer-challan/${tc.id}`)} sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Post">
                        <IconButton size="small" color="success" onClick={async () => {
                          try {
                            await window.electronAPI.postTransferChallan(tc.id);
                            await Promise.all([
                              queryClient.invalidateQueries({ queryKey: ['transferChallans'] }),
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
                         <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: tc.id, challanNo: tc.challanNo })}><Delete fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                     </>
                   )}
                   {tc.status === 'Posted' && (
                     <>
                       {hasPermission('delete_challan') && (
                       <Tooltip title="Delete">
                         <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: tc.id, challanNo: tc.challanNo })}><Delete fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                       {hasPermission('cancel_challan') && (
                       <Tooltip title="Cancel">
                         <IconButton size="small" color="error" onClick={() => setCancelDialog({ open: true, id: tc.id })}><Cancel fontSize="small" /></IconButton>
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
                  <EmptyState icon={<Transform />} title="No transfer challans" description="Create your first transfer challan to move materials between departments" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={data?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      {/* View Details Dialog */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Transfer Challan Details</Typography>
            <Typography variant="caption" color="text.secondary">{viewData?.challanNo}</Typography>
          </Box>
          <IconButton onClick={() => setViewDialog({ open: false, data: null })} size="small"><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewData && (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Challan No</Typography>
                  <Typography fontWeight={600}>{viewData.challanNo}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography fontWeight={600}>{formatDateDDMMYYYY(viewData.date)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">From Department</Typography>
                  <Typography fontWeight={600}>{viewData.fromDepartment?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">To Department</Typography>
                  <Typography fontWeight={600}>{viewData.toDepartment?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Transferred By</Typography>
                  <Typography fontWeight={600}>{viewData.transferredBy || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Approved By</Typography>
                  <Typography fontWeight={600}>{viewData.approvedBy || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box><Chip label={viewData.status} size="small" color={statusColor(viewData.status) as any} /></Box>
                </Grid>
                {viewData.postedAt && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Posted At</Typography>
                    <Typography fontWeight={600}>{formatDateTimeDDMMYYYY(viewData.postedAt)}</Typography>
                  </Grid>
                )}
              </Grid>

              {viewData.remarks && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Remarks</Typography>
                  <Typography fontWeight={500}>{viewData.remarks}</Typography>
                </Box>
              )}

              <Divider />

              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>Items ({viewData.items?.length || 0})</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Item Name</TableCell>
                        <TableCell>Item Code</TableCell>
                        <TableCell>From Room</TableCell>
                        <TableCell>To Room</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewData.items?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography fontWeight={500}>{item.item?.itemName || `Item #${item.itemId}`}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={item.item?.itemCode || '-'} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontSize="0.8125rem">{item.location?.locationName || '-'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontSize="0.8125rem" fontWeight={item.toLocation ? 500 : 400} color={item.toLocation ? 'primary.main' : 'text.secondary'}>
                              {item.toLocation?.locationName || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{Number(item.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ textAlign: 'right', bgcolor: alpha(theme.palette.primary.main, 0.05), p: 1.5, borderRadius: 1, minWidth: 200 }}>
                  <Typography variant="caption" color="text.secondary">Total Quantity</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {viewData.items?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0)}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          {viewData?.status === 'Draft' && (
            <Button variant="contained" startIcon={<Edit />} onClick={() => { setViewDialog({ open: false, data: null }); navigate(`/inventory/transfer-challan/${viewData.id}`); }}>
              Edit Challan
            </Button>
          )}
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null, challanNo: '' })}>
        <DialogTitle>Delete Transfer Challan</DialogTitle>
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

      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, id: null })}>
        <DialogTitle>Cancel Transfer Challan</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label="Cancel Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, id: null })}>Close</Button>
          <Button variant="contained" color="error" onClick={() => cancelDialog.id && cancelMutation.mutate({ id: cancelDialog.id, reason: cancelReason })} disabled={!cancelReason}>Cancel Challan</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
