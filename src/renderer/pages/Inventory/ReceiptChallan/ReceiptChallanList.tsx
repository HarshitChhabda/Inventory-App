import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Stack, TextField, TablePagination,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  alpha, useTheme, Divider, Grid,
} from '@mui/material';
import { Add, Visibility, Print, CheckCircle, Cancel, Search, Receipt, Edit, Delete, Close } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { useAuth } from '../../../context/AuthContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, parseDateDDMMYYYY } from '../../../utils/dateUtils';
import toast from 'react-hot-toast';

export default function ReceiptChallanList() {
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
    { header: 'Invoice No', key: 'invoiceNumber' },
    { header: 'Date', key: 'date' },
    { header: 'Source Type', key: 'sourceType' },
    { header: 'Source Name', key: 'sourceName' },
    { header: 'Vendor', key: 'vendorName' },
    { header: 'Items', key: 'items' },
    { header: 'Qty', key: 'qty' },
    { header: 'Total Amount', key: 'totalAmount' },
    { header: 'Store', key: 'store' },
    { header: 'Status', key: 'status' },
  ];

  const { data: allReceiptChallans } = useQuery({
    queryKey: ['receiptChallans', company?.id, financialYear?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('receiptChallan', 'findMany', {
      where: { companyId: company!.id, financialYearId: financialYear!.id },
      include: { vendor: true, department: true, items: { include: { item: true, unit: true } } },
      orderBy: { date: 'desc' },
    }),
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const getExportData = () => (allReceiptChallans || []).map((rc: any) => ({
    invoiceNumber: rc.invoiceNumber || '-',
    date: formatDateDDMMYYYY(rc.date),
    sourceType: rc.sourceType,
    sourceName: rc.sourceName || '',
    vendorName: rc.vendor?.name || rc.sourceName || '',
    items: rc.items?.map((i: any) => i.item?.itemName).join(', ') || '',
    qty: rc.items?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0) || 0,
    totalAmount: rc.items?.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0).toFixed(2),
    store: rc.department?.name || '-',
    status: rc.status,
  }));

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 500);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['receiptChallans', company?.id, financialYear?.id, page, rowsPerPage, debouncedSearch, statusFilter],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = { companyId: company!.id, financialYearId: financialYear!.id };
      if (debouncedSearch) where.OR = [{ challanNo: { contains: debouncedSearch } }, { invoiceNumber: { contains: debouncedSearch } }];
      if (statusFilter) where.status = statusFilter;

      const [data, total] = await Promise.all([
        api.dbQuery('receiptChallan', 'findMany', {
          where,
          include: { vendor: true, department: true, items: { include: { item: true, unit: true } } },
          skip: page * rowsPerPage,
          take: rowsPerPage,
          orderBy: { date: 'desc' },
        }),
        api.dbQuery('receiptChallan', 'count', { where }),
      ]);
      return { data, total };
    },
    enabled: !!company?.id && !!financialYear?.id,
    refetchOnMount: true,
  });

  const handleImportReceipts = async (rows: any[]) => {
    try {
      let created = 0, skipped = 0;
      for (const row of rows) {
        const challanNo = row['Challan No'] || row['challanNo'] || '';
        if (!challanNo) { skipped++; continue; }
        const vendorName = row['Vendor'] || row['vendorName'] || '';
        let vendorId = 0;
        if (vendorName) {
          const vendor = await window.electronAPI.dbQuery('vendor', 'findFirst', { where: { name: vendorName } });
          vendorId = vendor?.id || 0;
        }
        await window.electronAPI.createReceiptChallanImport({
          challanNo, companyId: company!.id, financialYearId: financialYear!.id,
          vendorId, date: (() => { const raw = row['Date'] || row['date'] || ''; const d = parseDateDDMMYYYY(raw); return d || new Date(); })(),
          sourceType: row['Source Type'] || row['sourceType'] || 'PURCHASE',
          sourceName: row['Source Name'] || row['sourceName'] || '',
          status: row['Status'] || row['status'] || 'Draft',
        });
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ['receiptChallans'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return window.electronAPI.cancelReceiptChallan(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receiptChallans'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['itemHistory'] });
      queryClient.invalidateQueries({ queryKey: ['locationBalances'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      setCancelDialog({ open: false, id: null });
      setCancelReason('');
    },
    onError: (err: any) => { toast.error(err.message || 'Failed to cancel challan'); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return window.electronAPI.deleteReceiptChallan(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receiptChallans'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['itemHistory'] });
      queryClient.invalidateQueries({ queryKey: ['locationBalances'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
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

  const viewData = viewDialog.data;

  return (
    <Box>
      <PageHeader
        title="Receipt Challans (Aamad)"
        subtitle="Track incoming material receipts"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ImportExportButtons
              data={getExportData()}
              columns={exportColumns}
              fileName="receipt-challans"
              onImport={handleImportReceipts}
            />
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/inventory/receipt-challan/new')}>
              New Receipt Challan
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
              <TableCell>Invoice No</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Total Qty</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Store</TableCell>
              <TableCell>Posted At</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data?.map((rc: any) => (
              <TableRow key={rc.id} hover>
                <TableCell>
                  <Typography fontWeight={600} fontFamily="monospace" fontSize="0.85rem" color="text.primary">
                    {rc.invoiceNumber || <Typography component="span" color="text.secondary" fontSize="0.8rem">—</Typography>}
                  </Typography>
                </TableCell>
                <TableCell><Typography color="text.primary">{formatDateDDMMYYYY(rc.date)}</Typography></TableCell>
                <TableCell>
                  <Box sx={{
                    display: 'inline-flex', px: 1, py: 0.25, borderRadius: 1,
                    bgcolor: alpha(theme.palette.info.main, 0.08),
                    color: 'info.main', fontWeight: 500, fontSize: '0.75rem',
                  }}>
                    {rc.sourceType}
                  </Box>
                </TableCell>
                <TableCell><Typography color="text.primary">{rc.vendor?.name || rc.sourceName || '-'}</Typography></TableCell>
                <TableCell>
                  <Stack spacing={0.25}>
                    {rc.items?.slice(0, 3).map((item: any, idx: number) => (
                      <Typography key={idx} variant="caption" fontWeight={500} color="text.primary">
                        {item.item?.itemName || `Item #${item.itemId}`}
                      </Typography>
                    ))}
                    {(rc.items?.length || 0) > 3 && (
                      <Typography variant="caption" color="text.secondary">+{rc.items.length - 3} more</Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600} color="text.primary">{rc.items?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600} color="text.primary">₹{rc.items?.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0).toFixed(2)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">{rc.department?.name || '-'}</Typography>
                </TableCell>
                <TableCell><Typography color="text.primary">{formatDateTimeDDMMYYYY(rc.postedAt)}</Typography></TableCell>
                <TableCell>
                  <Chip label={rc.status} size="small" color={statusColor(rc.status) as any} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => setViewDialog({ open: true, data: rc })} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {rc.status === 'Draft' && (
                    <>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => navigate(`/inventory/receipt-challan/${rc.id}`)} sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Post">
                        <IconButton size="small" color="success" onClick={async () => {
                          try {
                            await window.electronAPI.postReceiptChallan(rc.id);
                            await Promise.all([
                              queryClient.invalidateQueries({ queryKey: ['receiptChallans'] }),
                              queryClient.invalidateQueries({ queryKey: ['stockTransactions'] }),
                              queryClient.invalidateQueries({ queryKey: ['stockLedger'] }),
                              queryClient.invalidateQueries({ queryKey: ['stockBalance'] }),
                              queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                              queryClient.invalidateQueries({ queryKey: ['itemHistory'] }),
                              queryClient.invalidateQueries({ queryKey: ['locationBalances'] }),
                              queryClient.invalidateQueries({ queryKey: ['report'] }),
                            ]);
                            toast.success('Challan posted successfully');
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to post challan');
                          }
                        }}><CheckCircle fontSize="small" /></IconButton>
                      </Tooltip>
                       {hasPermission('delete_challan') && (
                       <Tooltip title="Delete">
                         <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: rc.id, challanNo: rc.challanNo })}><Delete fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                     </>
                   )}
                   {rc.status === 'Posted' && (
                     <>
                       {hasPermission('delete_challan') && (
                       <Tooltip title="Delete">
                         <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: rc.id, challanNo: rc.challanNo })}><Delete fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                       {hasPermission('cancel_challan') && (
                       <Tooltip title="Cancel">
                         <IconButton size="small" color="error" onClick={() => setCancelDialog({ open: true, id: rc.id })}><Cancel fontSize="small" /></IconButton>
                       </Tooltip>
                       )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!data?.data || data.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={11}>
                  <EmptyState icon={<Receipt />} title="No receipt challans" description="Create your first receipt challan to track incoming materials" />
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
            <Typography variant="h6" fontWeight={700}>Receipt Challan Details</Typography>
            <Typography variant="caption" color="text.secondary">{viewData?.challanNo}</Typography>
          </Box>
          <IconButton onClick={() => setViewDialog({ open: false, data: null })} size="small"><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewData && (
            <Stack spacing={2.5}>
              {/* Header Info */}
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Invoice No</Typography>
                  <Typography fontWeight={600}>{viewData.invoiceNumber || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography fontWeight={600}>{formatDateDDMMYYYY(viewData.date)}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Source Type</Typography>
                  <Typography fontWeight={600}>{viewData.sourceType}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Vendor</Typography>
                  <Typography fontWeight={600}>{viewData.vendor?.name || viewData.sourceName || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Store</Typography>
                  <Typography fontWeight={600}>{viewData.department?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Received By</Typography>
                  <Typography fontWeight={600}>{viewData.receivedBy || '-'}</Typography>
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
                {viewData.invoiceNumber && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Invoice Date</Typography>
                    <Typography fontWeight={600}>{viewData.invoiceDate ? formatDateDDMMYYYY(viewData.invoiceDate) : '-'}</Typography>
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

              {/* Items Table */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>Items ({viewData.items?.length || 0})</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Item Name</TableCell>
                        <TableCell>Qty</TableCell>
                        <TableCell>Rate</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Store</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewData.items?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography fontWeight={500}>{item.item?.itemName || `Item #${item.itemId}`}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.item?.itemCode}</Typography>
                          </TableCell>
                          <TableCell>{Number(item.quantity)}</TableCell>
                          <TableCell>₹{Number(item.rate).toFixed(2)}</TableCell>
                          <TableCell><Typography fontWeight={600}>₹{Number(item.amount).toFixed(2)}</Typography></TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">{viewData.department?.name || '-'}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Total */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ textAlign: 'right', bgcolor: alpha(theme.palette.primary.main, 0.05), p: 1.5, borderRadius: 1, minWidth: 200 }}>
                  <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    ₹{viewData.items?.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          {viewData?.status === 'Draft' && (
            <Button variant="contained" startIcon={<Edit />} onClick={() => { setViewDialog({ open: false, data: null }); navigate(`/inventory/receipt-challan/${viewData.id}`); }}>
              Edit Challan
            </Button>
          )}
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, id: null })}>
        <DialogTitle>Cancel Receipt Challan</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label="Cancel Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, id: null })}>Close</Button>
          <Button variant="contained" color="error" onClick={() => cancelDialog.id && cancelMutation.mutate({ id: cancelDialog.id, reason: cancelReason })} disabled={!cancelReason}>Cancel Challan</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null, challanNo: '' })}>
        <DialogTitle>Delete Receipt Challan</DialogTitle>
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
    </Box>
  );
}
