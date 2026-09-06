import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination,
  IconButton, Tooltip, Chip, alpha, useTheme,
} from '@mui/material';
import {
  Add, Visibility, Search, Edit, Delete, CheckCircle, Cancel, SwapHoriz, Refresh,
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { PageLoader } from '../../components/LoadingSkeleton';
import EnterpriseDialog from '../../components/EnterpriseDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusBadge from '../../components/StatusBadge';
import TransactionViewPopup from '../../components/TransactionViewPopup';
import { GuideButton } from '../../components/GuideSystem';
import ImportExportButtons from '../../components/ImportExportButtons';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { useChallanList } from './hooks/useChallanList';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Posted', value: 'POSTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

interface ShiftChallanListProps {
  forcedShiftType?: 'DS' | 'DP';
}

export default function ShiftChallanList({ forcedShiftType }: ShiftChallanListProps) {
  const { type } = useParams<{ type: string }>();
  const shiftType = forcedShiftType || ((type === 'dp' ? 'DP' : 'DS') as 'DS' | 'DP');
  const isDS = shiftType === 'DS';

  const c = useChallanList({
    queryKey: `${shiftType.toLowerCase()}Challans`,
    listKey: `${shiftType.toLowerCase()}-challans`,
    model: 'transactionHeader',
    include: {
      fromStore: true,
      toStore: true,
      items: { include: { item: { include: { unit: true } }, fromLocation: true, toLocation: true } },
    },
    searchFields: ['voucherNo', 'issuedBy'],
    filterExtra: { voucherType: shiftType },
    newRoute: `/inventory/${shiftType.toLowerCase()}/new`,
    postFn: (id) => window.electronAPI.postShiftChallan(id),
    deleteFn: (id) => window.electronAPI.deleteShiftChallan(id),
    cancelFn: (id, reason) => window.electronAPI.cancelShiftChallan(id, reason),
    exportColumns: [
      { header: 'Voucher No', key: 'voucherNo' },
      { header: 'Date', key: 'transactionDate' },
      { header: 'Source', key: 'fromStore' },
      { header: 'Destination', key: 'toStore' },
      { header: 'Shifted By', key: 'issuedBy' },
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

  if (isLoading) return <PageLoader message="Loading shift challans..." />;

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
        title={isDS ? 'Dharmshala Shift' : 'Department Shift'}
        subtitle={isDS ? 'Transfer installed/issued material between rooms' : 'Transfer items between Department Store and Locations'}
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId={`${shiftType.toLowerCase()}-challan`} />
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => c.navigate(c.newRoute)}
            >
              {isDS ? 'New Dharmshala Shift' : 'New Department Shift'}
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            placeholder="Search by voucher no or shifted by..."
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
                role="button"
                tabIndex={0}
                aria-label={`Filter by ${opt.label} status`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') c.onStatusFilter(opt.value); }}
                sx={{ fontWeight: 500, cursor: 'pointer' }}
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
              <TableCell sx={{ fontWeight: 700 }}>{isDS ? 'Source' : 'From Store'}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{isDS ? 'Destination' : 'To Store'}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Shifted By</TableCell>
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
                      {c.hasPermission('edit_challan') && (
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => c.navigate(`/inventory/${shiftType.toLowerCase()}/${tc.id}`)}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {c.hasPermission('post_challan') && (
                        <Tooltip title="Post">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => c.postMut.mutate(tc.id)}
                          >
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
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
                    icon={<SwapHoriz />}
                    title={isDS ? 'No Dharmshala Shift challans' : 'No Department Shift challans'}
                    description={isDS ? 'Create your first Dharmshala Shift to move items between rooms' : 'Create your first Department Shift to move items between locations'}
                    action={{
                      label: isDS ? 'Create Dharmshala Shift' : 'Create Department Shift',
                      onClick: () => c.navigate(c.newRoute),
                    }}
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

      <EnterpriseDialog
        open={viewDlg.open}
        onClose={() => setViewDlg({ open: false, data: null })}
        title={isDS ? 'Dharmshala Shift Details' : 'Department Shift Details'}
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
                  c.navigate(`/inventory/${shiftType.toLowerCase()}/${viewData.id}`);
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

      <ConfirmDialog
        open={delDlg.open}
        title={isDS ? 'Delete Dharmshala Shift' : 'Delete Department Shift'}
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

      <EnterpriseDialog
        open={cancelDlg.open}
        onClose={() => setCancelDlg({ open: false, id: null })}
        title={isDS ? 'Cancel Dharmshala Shift' : 'Cancel Department Shift'}
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
