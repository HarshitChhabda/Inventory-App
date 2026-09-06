import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination,
  IconButton, Tooltip, Chip, alpha, useTheme,
} from '@mui/material';
import {
  Add, Visibility, Search, Transform, Edit, Delete, CheckCircle, Cancel, SwapHoriz, Refresh,
} from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { PageLoader } from '../../../components/LoadingSkeleton';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import StatusBadge from '../../../components/StatusBadge';
import TransactionViewPopup from '../../../components/TransactionViewPopup';
import { GuideButton } from '../../../components/GuideSystem';
import ImportExportButtons from '../../../components/ImportExportButtons';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../../components/ImportProgressDialog';
import { formatDateDDMMYYYY, normalizeDate } from '../../../utils/dateUtils';
import { useChallanList } from '../hooks/useChallanList';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Posted', value: 'POSTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function TransferChallanList() {
  const c = useChallanList({
    queryKey: 'transferChallans',
    listKey: 'transfer-challans',
    model: 'transferChallan',
    include: {
      fromStore: true,
      toStore: true,
      department: true,
      items: { include: { item: { include: { unit: true } } } },
    },
    searchFields: ['voucherNo', 'issuedBy'],
    newRoute: '/inventory/transfer-challan/new',
    postFn: (id) => window.electronAPI.postTransferChallan(id),
    deleteFn: (id) => window.electronAPI.deleteTransferChallan(id),
    cancelFn: (id, reason) => window.electronAPI.cancelTransferChallan(id, reason),
    exportColumns: [
      { header: 'Voucher No', key: 'voucherNo' },
      { header: 'Date', key: 'transactionDate' },
      { header: 'From Store', key: 'fromStore' },
      { header: 'To Store', key: 'toStore' },
      { header: 'Transferred By', key: 'issuedBy' },
      { header: 'Items Count', key: 'itemsCount' },
      { header: 'Status', key: 'approvalStatus' },
    ],
    getExportRow: (tc) => ({
      voucherNo: tc.voucherNo,
      transactionDate: formatDateDDMMYYYY(tc.transactionDate || tc.createdAt),
      fromStore: tc.fromStore?.name || '',
      toStore: tc.toStore?.name || '',
      issuedBy: tc.issuedBy || tc.createdBy || '',
      itemsCount: tc.items?.length || 0,
      approvalStatus: tc.approvalStatus,
    }),
  });

  const { items, viewDlg, setViewDlg, delDlg, setDelDlg, cancelDlg, setCancelDlg, isLoading, isError, refetch } = c;
  const viewData = viewDlg.data;
  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImport = async (rows: any[]) => {
    const grouped = rows.reduce((acc: any, row: any) => {
      const challanNo = row['Voucher No'] || row['Challan No'] || row['challanNo'] || '';
      if (!challanNo) return acc;
      if (!acc[challanNo]) {
        acc[challanNo] = {
          challanNo,
          date: row['Date'] || row['date'] || '',
          fromDepartment: row['From Department'] || row['fromStore'] || '',
          toDepartment: row['To Department'] || row['toStore'] || '',
          transferredBy: row['Transferred By'] || row['transferredBy'] || '',
          status: row['Status'] || row['status'] || 'Draft',
          remarks: row['Remarks'] || row['remarks'] || '',
          items: []
        };
      }
      if (row['Item Code'] || row['itemCode'] || row['Item Name'] || row['itemName']) {
        acc[challanNo].items.push({
          itemCode: row['Item Code'] || row['itemCode'],
          itemName: row['Item Name'] || row['itemName'],
          quantity: row['Quantity'] || row['quantity'] || 1,
          rate: row['Rate'] || row['rate'] || 0,
        });
      }
      return acc;
    }, {});

    const entries = Object.entries<any>(grouped);
    const total = entries.length;
    let created = 0, skipped = 0;
    const errors: string[] = [];
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });

    for (let i = 0; i < entries.length; i++) {
      const [challanNo, data] = entries[i];
      if (!challanNo) { skipped++; errors.push(`Row ${i + 1}: Missing challan number`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
      const transactionDate = normalizeDate(data.date);
      if (!transactionDate) {
        skipped++;
        errors.push(`${challanNo}: Invalid date`);
        setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors }));
        continue;
      }
      try {
        await window.electronAPI.createTransferChallanImport({
          challanNo, companyId: c.company!.id, financialYearId: c.financialYear!.id,
          date: transactionDate, fromDepartmentName: data.fromDepartment,
          toDepartmentName: data.toDepartment, transferredBy: data.transferredBy,
          status: data.status, remarks: data.remarks, items: data.items
        });
        created++;
      } catch (err: any) {
        skipped++;
        errors.push(`${challanNo}: ${err.message}`);
      }
      setImportProgress(prev => ({ ...prev, current: i + 1, created, skipped, errors }));
    }
    setImportProgress(prev => ({ ...prev, active: false }));
    toast.success(`Import: ${created} created, ${skipped} skipped`);
    c.refetch();
  };

  if (isLoading) return <PageLoader message="Loading transfer challans..." />;

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
    <Box>
      <PageHeader
        title="Store Transfer"
        subtitle="Transfer stock between stores"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="transfer-challan" />
            <ImportExportButtons
              data={c.getExportData()}
              columns={c.exportColumns}
              fileName="transfer-challans"
              onImport={handleImport}
            />
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => c.navigate(c.newRoute)}
            >
              New Store Transfer
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            placeholder="Search by voucher no or transferred by..."
            value={c.search}
            onChange={(e) => c.onSearch(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
            size="small"
          />
          <Stack direction="row" spacing={1}>
            {STATUS_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                size="small"
                color={c.statusFilter === opt.value ? 'primary' : 'default'}
                variant={c.statusFilter === opt.value ? 'filled' : 'outlined'}
                onClick={() => c.onStatusFilter(opt.value)}
                sx={{ fontWeight: 500 }}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(useTheme().palette.primary.main, 0.05) }}>
              <TableCell sx={{ fontWeight: 700 }}>Voucher No</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>From Store</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>To Store</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Transferred By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((tc: any) => (
              <TableRow key={tc.id} hover>
                <TableCell>
                  <Chip
                    label={tc.voucherNo}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                  />
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(tc.transactionDate || tc.createdAt)}</TableCell>
                <TableCell>
                  <Typography fontWeight={500} fontSize="0.8125rem">
                    {tc.fromStore?.name || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={500} fontSize="0.8125rem">
                    {tc.toStore?.name || '-'}
                  </Typography>
                </TableCell>
                <TableCell>{tc.issuedBy || tc.createdBy || '-'}</TableCell>
                <TableCell>
                  <Typography fontWeight={600}>
                    {tc.items?.length || 0}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusBadge status={tc.approvalStatus} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => setViewDlg({ open: true, data: tc })}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {tc.approvalStatus === 'DRAFT' && (
                    <>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => c.navigate(`/inventory/transfer-challan/${tc.id}`)}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Post">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => c.postMut.mutate(tc.id)}
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {c.hasPermission('delete_challan') && (
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDelDlg({ open: true, id: tc.id, label: tc.voucherNo })}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                  {tc.approvalStatus === 'POSTED' && tc.voucherType !== 'RV' && (
                    <>
                      {c.hasPermission('delete_challan') && (
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDelDlg({ open: true, id: tc.id, label: tc.voucherNo })}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {c.hasPermission('cancel_challan') && (
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setCancelDlg({ open: true, id: tc.id })}
                          >
                            <Cancel fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<Transform />}
                    title="No store transfers"
                    description="Create your first store transfer to move materials between stores"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={c.total}
        page={c.page}
        onPageChange={(_, p) => c.setPage(p)}
        rowsPerPage={c.rpp}
        onRowsPerPageChange={(e) => {
          c.setRpp(parseInt(e.target.value));
          c.setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
      />

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="transfer challans" />

      {/* View Dialog */}
      <EnterpriseDialog
        open={viewDlg.open}
        onClose={() => setViewDlg({ open: false, data: null })}
        title="Store Transfer Details"
        subtitle={viewData?.voucherNo}
        icon={<SwapHoriz />}
        maxWidth="md"
        actions={
          <>
            {viewData?.approvalStatus === 'DRAFT' && (
              <Button
                variant="contained"
                startIcon={<Edit />}
                onClick={() => {
                  setViewDlg({ open: false, data: null });
                  c.navigate(`/inventory/transfer-challan/${viewData.id}`);
                }}
              >
                Edit Challan
              </Button>
            )}
            <Button onClick={() => setViewDlg({ open: false, data: null })}>Close</Button>
          </>
        }
      >
        {viewData && (
          <TransactionViewPopup type="Transfer" data={viewData} />
        )}
      </EnterpriseDialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={delDlg.open}
        title="Delete Store Transfer"
        message={
          <>
            Are you sure you want to delete challan <strong>{delDlg.label}</strong>?
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Stock transactions will be reversed automatically. This action cannot be undone.
            </Typography>
          </>
        }
        confirmText="Delete"
        confirmColor="error"
        onConfirm={() => delDlg.id && c.delMut.mutate(delDlg.id)}
        onCancel={() => setDelDlg({ open: false, id: null, label: '' })}
      />

      {/* Cancel Dialog */}
      <EnterpriseDialog
        open={cancelDlg.open}
        onClose={() => setCancelDlg({ open: false, id: null })}
        title="Cancel Store Transfer"
        subtitle="Provide a reason for cancellation"
        icon={<Cancel />}
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setCancelDlg({ open: false, id: null })}>Close</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => cancelDlg.id && c.cancelMut.mutate({ id: cancelDlg.id, reason: c.cancelReason })}
              disabled={!c.cancelReason}
            >
              Cancel Challan
            </Button>
          </>
        }
      >
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Cancel Reason"
          value={c.cancelReason}
          onChange={(e) => c.setCancelReason(e.target.value)}
        />
      </EnterpriseDialog>
    </Box>
  );
}
