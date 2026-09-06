import React from 'react';
import { Box, Typography, Grid, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Stack } from '@mui/material';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateUtils';
import { toNumber } from '../../utils/numberUtils';
import StatusBadge from '../StatusBadge';

interface TransactionViewPopupProps {
  type: 'Receipt' | 'Issue' | 'Transfer';
  data: any;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Grid item xs={6} md={3}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={600}>{children}</Typography>
    </Grid>
  );
}

function ItemsTable({ items, columns }: { items: any[]; columns: { key: string; label: string; align?: 'left' | 'center' | 'right'; width?: string; render?: (item: any, idx: number) => React.ReactNode }[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40 }}>#</TableCell>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.align || 'left'} sx={col.width ? { width: col.width } : undefined}>{col.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items?.map((item: any, idx: number) => (
            <TableRow key={idx}>
              <TableCell><Typography variant="body2" color="text.secondary">{idx + 1}</Typography></TableCell>
              {columns.map((col) => (
                <TableCell key={col.key} align={col.align || 'left'}>
                  {col.render ? col.render(item, idx) : (
                    <Typography fontWeight={500} fontSize="0.8125rem">
                      {col.key === 'itemName' ? (item.item?.itemName || `Item #${item.itemId}`) :
                       col.key === 'itemCode' ? (
                        <Chip label={item.item?.itemCode || '-'} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                       ) :
                       col.key === 'quantity' ? toNumber(item.quantity) :
                       col.key === 'rate' ? `₹${toNumber(item.rate).toFixed(2)}` :
                       col.key === 'amount' ? `₹${toNumber(item.amount || toNumber(item.quantity) * toNumber(item.rate)).toFixed(2)}` :
                       col.key === 'unit' ? (item.unit?.name || '-') :
                       col.key === 'location' ? (item.location?.name || '-') :
                       col.key === 'fromLocation' ? (item.fromLocation?.name || '-') :
                       col.key === 'toLocation' ? (item.toLocation?.name || '-') :
                       col.key === 'purpose' ? (item.purpose || '-') :
                       col.key === 'remarks' ? (item.remarks || '-') :
                       String(item[col.key] ?? '-')}
                    </Typography>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function GoodsReceiptView({ data }: { data: any }) {
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Field label="Voucher No">{data.voucherNo}</Field>
        <Field label="Date">{formatDateDDMMYYYY(data.transactionDate || data.createdAt)}</Field>
        <Field label="Vendor / Source">{data.vendor?.vendorName || data.sourceName || '-'}</Field>
        <Field label="Store">{data.toStore?.name || '-'}</Field>
        <Field label="Invoice No">{data.invoiceNumber || '-'}</Field>
        <Field label="Received By">{data.receivedBy || '-'}</Field>
        {data.approvedBy && <Field label="Approved By">{data.approvedBy}</Field>}
        <Field label="Status"><StatusBadge status={data.approvalStatus} /></Field>
        {data.postedAt && <Field label="Posted At">{formatDateTimeDDMMYYYY(data.postedAt)}</Field>}
      </Grid>
      {data.remarks && (
        <Box>
          <Typography variant="caption" color="text.secondary">Remarks</Typography>
          <Typography fontWeight={500}>{data.remarks}</Typography>
        </Box>
      )}
      <Divider />
      <Box>
        <Typography variant="subtitle2" fontWeight={600} mb={1}>Items ({data.items?.length || 0})</Typography>
        <ItemsTable
          items={data.items}
          columns={[
            { key: 'itemName', label: 'Item Name', width: '35%' },
            { key: 'itemCode', label: 'Code', width: '10%' },
            { key: 'quantity', label: 'Qty', align: 'center', width: '10%' },
            { key: 'unit', label: 'Unit', align: 'center', width: '10%' },
            { key: 'rate', label: 'Rate', align: 'right', width: '12%' },
            { key: 'amount', label: 'Amount', align: 'right', width: '12%' },
          ]}
        />
      </Box>
    </Stack>
  );
}

function StoreIssueView({ data }: { data: any }) {
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Field label="Voucher No">{data.voucherNo}</Field>
        <Field label="Date">{formatDateDDMMYYYY(data.transactionDate || data.createdAt)}</Field>
        <Field label="Source Store">{data.fromStore?.name || '-'}</Field>
        <Field label="Destination Store">{data.toStore?.name || '-'}</Field>
        <Field label="Department">{data.department?.name || '-'}</Field>
        <Field label="Issued By">{data.issuedBy || '-'}</Field>
        {data.approvedBy && <Field label="Approved By">{data.approvedBy}</Field>}
        {data.purpose && <Field label="Purpose">{data.purpose}</Field>}
        <Field label="Status"><StatusBadge status={data.approvalStatus} /></Field>
        {data.postedAt && <Field label="Posted At">{formatDateTimeDDMMYYYY(data.postedAt)}</Field>}
      </Grid>
      {data.remarks && (
        <Box>
          <Typography variant="caption" color="text.secondary">Remarks</Typography>
          <Typography fontWeight={500}>{data.remarks}</Typography>
        </Box>
      )}
      <Divider />
      <Box>
        <Typography variant="subtitle2" fontWeight={600} mb={1}>Items ({data.items?.length || 0})</Typography>
        <ItemsTable
          items={data.items}
          columns={[
            { key: 'itemName', label: 'Item Name', width: '30%' },
            { key: 'itemCode', label: 'Code', width: '10%' },
            { key: 'quantity', label: 'Qty', align: 'center', width: '10%' },
            { key: 'unit', label: 'Unit', align: 'center', width: '10%' },
            { key: 'location', label: 'Location / Room', width: '20%' },
            { key: 'purpose', label: 'Purpose', width: '15%' },
          ]}
        />
      </Box>
    </Stack>
  );
}

function StoreTransferView({ data }: { data: any }) {
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Field label="Voucher No">{data.voucherNo}</Field>
        <Field label="Date">{formatDateDDMMYYYY(data.transactionDate)}</Field>
        <Field label="From Store">{data.fromStore?.name || '-'}</Field>
        <Field label="To Store">{data.toStore?.name || '-'}</Field>
        <Field label="Transferred By">{data.issuedBy || data.createdBy || '-'}</Field>
        <Field label="Approved By">{data.receivedBy || '-'}</Field>
        <Field label="Status"><StatusBadge status={data.approvalStatus} /></Field>
        {data.postedAt && <Field label="Posted At">{formatDateTimeDDMMYYYY(data.postedAt)}</Field>}
      </Grid>
      {data.remarks && (
        <Box>
          <Typography variant="caption" color="text.secondary">Remarks</Typography>
          <Typography fontWeight={500}>{data.remarks}</Typography>
        </Box>
      )}
      <Divider />
      <Box>
        <Typography variant="subtitle2" fontWeight={600} mb={1}>Items ({data.items?.length || 0})</Typography>
        <ItemsTable
          items={data.items}
          columns={[
            { key: 'itemName', label: 'Item Name', width: '35%' },
            { key: 'itemCode', label: 'Code', width: '10%' },
            { key: 'quantity', label: 'Qty', align: 'center', width: '12%' },
            { key: 'fromLocation', label: 'From Location', width: '15%' },
            { key: 'toLocation', label: 'To Location', width: '15%' },
            { key: 'remarks', label: 'Remarks', width: '10%' },
          ]}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Box sx={{
          textAlign: 'right', bgcolor: 'action.hover', p: 1.5, borderRadius: 1, minWidth: 200,
        }}>
          <Typography variant="caption" color="text.secondary">Total Items</Typography>
          <Typography variant="h6" fontWeight={700} color="primary.main">{data.items?.length || 0}</Typography>
        </Box>
      </Box>
    </Stack>
  );
}

export default function TransactionViewPopup({ type, data }: TransactionViewPopupProps) {
  if (!data) return null;

  switch (type) {
    case 'Receipt':
      return <GoodsReceiptView data={data} />;
    case 'Issue':
      return <StoreIssueView data={data} />;
    case 'Transfer':
      return <StoreTransferView data={data} />;
    default:
      return null;
  }
}
