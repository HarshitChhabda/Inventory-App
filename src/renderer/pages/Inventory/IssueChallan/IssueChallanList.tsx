import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Stack, TextField, TablePagination,
  IconButton, Tooltip, alpha, useTheme,
} from '@mui/material';
import { Add, Visibility, CheckCircle, Cancel, Search, Assignment, Edit, Delete, Outbox, Refresh } from '@mui/icons-material';
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

const STATUS_FILTERS = ['All', 'DRAFT', 'POSTED', 'CANCELLED'] as const;

export default function IssueChallanList() {
  const c = useChallanList({
    queryKey: 'issueChallans',
    listKey: 'issue-challans',
    model: 'issueChallan',
    include: { department: true, sourceStore: true, fromStore: true, toStore: true, items: { include: { item: { include: { unit: true } } } } },
    searchFields: ['voucherNo', 'purpose'],
    newRoute: '/inventory/issue-challan/new',
    postFn: (id) => window.electronAPI.postIssueChallan(id),
    deleteFn: (id) => window.electronAPI.deleteIssueChallan(id),
    cancelFn: (id, reason) => window.electronAPI.cancelIssueChallan(id, reason),
    voucherTypeFilter: ['OB', 'IC'],
    exportColumns: [
      { header: 'Voucher No', key: 'voucherNo' },
      { header: 'Date', key: 'date' },
      { header: 'Department', key: 'department' },
      { header: 'Store', key: 'storeName' },
      { header: 'Issued By', key: 'issuedBy' },
      { header: 'Items Count', key: 'itemsCount' },
      { header: 'Status', key: 'status' },
    ],
    getExportRow: (ic) => ({
      voucherNo: ic.voucherNo || '-',
      date: formatDateDDMMYYYY(ic.transactionDate),
      department: ic.department?.name || ic.toStore?.name || '',
      storeName: ic.fromStore?.name || ic.toStore?.name || '-',
      issuedBy: ic.issuedBy || '',
      itemsCount: ic.items?.length || 0,
      status: ic.approvalStatus,
    }),
    statusFilter: true,
  });

  const { items, viewDlg, setViewDlg, delDlg, setDelDlg, cancelDlg, setCancelDlg, statusFilter, onStatusFilter, isLoading, isError, refetch } = c;
  const viewData = viewDlg.data;
  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImport = async (rows: any[]) => {
    const grouped = rows.reduce((acc: any, row: any) => {
      const challanNo = row['Challan No'] || row['challanNo'] || row['Voucher No'] || row['voucherNo'] || '';
      if (!challanNo) return acc;
      if (!acc[challanNo]) {
        acc[challanNo] = {
          challanNo,
          date: row['Date'] || row['date'] || '',
          issuedBy: row['Issued By'] || row['issuedBy'] || '',
          status: row['Status'] || row['status'] || 'Draft',
          purpose: row['Purpose'] || row['purpose'] || '',
          storeName: row['Store'] || row['storeName'] || '',
          department: row['Department'] || row['department'] || '',
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
        await window.electronAPI.createIssueChallanImport({
          challanNo, companyId: c.company!.id, financialYearId: c.financialYear!.id,
          date: transactionDate, issuedBy: data.issuedBy, status: data.status,
          purpose: data.purpose, storeName: data.storeName, department: data.department, items: data.items
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

  if (isLoading) return <PageLoader message="Loading challans..." />;

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
        title="Store Issue"
        subtitle="Issue material from one store to another store or location"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="issue-challan" />
            <ImportExportButtons data={c.getExportData()} columns={c.exportColumns} fileName="issue-challans" onImport={handleImport} />
            <Button variant="contained" startIcon={<Add />} onClick={() => c.navigate(c.newRoute)}>New Store Issue</Button>
          </Stack>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            placeholder="Search challans..."
            value={c.search}
            onChange={(e) => c.onSearch(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
            size="small"
            sx={{ flex: 1 }}
          />
          <Stack direction="row" spacing={0.5}>
            {STATUS_FILTERS.map((s) => (
              <Chip
                key={s}
                label={s}
                size="small"
                clickable
                color={statusFilter === s || (s === 'All' && !statusFilter) ? 'primary' : 'default'}
                variant={statusFilter === s || (s === 'All' && !statusFilter) ? 'filled' : 'outlined'}
                onClick={() => onStatusFilter(s === 'All' ? '' : s)}
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
              <TableCell sx={{ fontWeight: 700 }}>Demand No</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Store</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Issued By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((ic: any) => (
              <TableRow key={ic.id} hover>
                <TableCell>
                  <Chip label={ic.voucherNo || '-'} size="small" color="secondary" variant="outlined" sx={{ fontWeight: 600, fontFamily: 'monospace' }} />
                </TableCell>
                <TableCell>{formatDateDDMMYYYY(ic.transactionDate || ic.createdAt)}</TableCell>
                <TableCell>
                  {ic.demandAllocations && ic.demandAllocations.length > 0 ? (
                    <Chip
                      label={ic.demandAllocations[0]?.materialDemandItem?.serviceRequest?.physicalDemandNo || ic.demandAllocations[0]?.materialDemandItem?.serviceRequest?.requestNumber || '?'}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">General Issue</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography fontWeight={500} fontSize="0.8125rem">{ic.department?.name || ic.toStore?.name || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={500} fontSize="0.8125rem">{ic.fromStore?.name || ic.toStore?.name || '-'}</Typography>
                </TableCell>
                <TableCell>{ic.issuedBy}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                    <Chip label={`${ic.items?.length || 0} items`} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ic.items?.map((it: any) => it.item?.itemName).filter(Boolean).join(', ')}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <StatusBadge status={ic.approvalStatus} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => setViewDlg({ open: true, data: ic })} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}><Visibility fontSize="small" /></IconButton>
                  </Tooltip>
                  {ic.approvalStatus === 'DRAFT' && (
                    <>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => c.navigate(`/inventory/issue-challan/${ic.id}`)} sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Post">
                        <IconButton size="small" color="success" onClick={() => c.postMut.mutate(ic.id)}><CheckCircle fontSize="small" /></IconButton>
                      </Tooltip>
                      {c.hasPermission('delete_challan') && (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDelDlg({ open: true, id: ic.id, label: ic.voucherNo })}><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                  {ic.approvalStatus === 'POSTED' && ic.voucherType !== 'RV' && (
                    <>
                      {c.hasPermission('delete_challan') && (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDelDlg({ open: true, id: ic.id, label: ic.voucherNo })}><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {c.hasPermission('cancel_challan') && (
                        <Tooltip title="Cancel">
                          <IconButton size="small" color="error" onClick={() => setCancelDlg({ open: true, id: ic.id })}><Cancel fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7}>                <EmptyState icon={<Assignment />} title="No store issues" description="Create your first store issue to track material dispatches" /></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination component="div" count={c.total} page={c.page} onPageChange={(_, p) => c.setPage(p)} rowsPerPage={c.rpp} onRowsPerPageChange={(e) => { c.setRpp(parseInt(e.target.value)); c.setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="issue challans" />

      {/* Cancel Dialog */}
      <EnterpriseDialog
        open={cancelDlg.open}
        onClose={() => setCancelDlg({ open: false, id: null })}
        title="Cancel Store Issue"
        subtitle="Provide a reason for cancellation"
        icon={<Cancel />}
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setCancelDlg({ open: false, id: null })}>Close</Button>
            <Button variant="contained" color="error" onClick={() => cancelDlg.id && c.cancelMut.mutate({ id: cancelDlg.id, reason: c.cancelReason })} disabled={!c.cancelReason}>Cancel Challan</Button>
          </>
        }
      >
        <TextField fullWidth multiline rows={3} label="Cancel Reason" value={c.cancelReason} onChange={(e) => c.setCancelReason(e.target.value)} />
      </EnterpriseDialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={delDlg.open}
        title="Delete Store Issue"
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

      {/* View Dialog */}
      <EnterpriseDialog
        open={viewDlg.open}
        onClose={() => setViewDlg({ open: false, data: null })}
        title="Store Issue Details"
        subtitle={viewData?.voucherNo}
        icon={<Outbox />}
        maxWidth="md"
        actions={
          <>
            {viewData?.approvalStatus === 'DRAFT' && <Button variant="contained" startIcon={<Edit />} onClick={() => { setViewDlg({ open: false, data: null }); c.navigate(`/inventory/issue-challan/${viewData.id}`); }}>Edit Challan</Button>}
            <Button onClick={() => setViewDlg({ open: false, data: null })}>Close</Button>
          </>
        }
      >
        {viewData && (
          <TransactionViewPopup type="Issue" data={viewData} />
        )}
      </EnterpriseDialog>
    </Box>
  );
}
