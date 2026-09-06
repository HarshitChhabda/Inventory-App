import React from 'react';
import {
  Box, Typography, Paper, Stack, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Card, CardContent, alpha,
  useTheme, Divider, Grid,
} from '@mui/material';
import {
  Download as DownloadIcon, Print as PrintIcon, Assessment,
  TrendingUp, TrendingDown, Warning, Inventory, CheckCircle, Error,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { exportToExcel, ExportColumn, downloadBuffer } from '../../utils/importExport';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/StatusBadge';

const BRAND = 'Shri Mahaveerji Digamber Jain Atishay Kshetra';
const BRAND_Hindi = 'Digambar Jain Atishay Kshetra Shri Mahaveer JI';

const ENTRY_TYPE_LABELS: Record<string, string> = { DAMAGE: 'Damage', VENDOR_RETURN: 'Vendor Return' };
const CONDITION_LABELS: Record<string, string> = { GOOD: 'Good', DAMAGED: 'Damaged', FAIR: 'Fair', POOR: 'Poor' };
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Receipt', ISSUE: 'Issue', TRANSFER: 'Transfer', DAMAGE: 'Damage',
  REVERSAL: 'Reversal', REPAIR_OUT: 'Repair Out', REPAIR_IN: 'Repair In',
  INSTALL: 'Install', UNINSTALL: 'Uninstall', SCRAP: 'Scrap',
  OPENING_BALANCE: 'Opening Balance', PURCHASE: 'Purchase',
};

// ==================== SHARED COMPONENTS ====================

function KpiCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  const theme = useTheme();
  return (
    <Card sx={{ flex: 1, minWidth: 180, border: `1px solid ${alpha(color, 0.2)}`, borderRadius: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(color, 0.1), color, display: 'flex' }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>{title}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ReportHeader({ title, titleHindi, subtitle }: { title: string; titleHindi?: string; subtitle?: string }) {
  return (
    <Box sx={{ textAlign: 'center', mb: 2, py: 2, bgcolor: '#1A365D', color: '#fff', borderRadius: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>{titleHindi || BRAND_Hindi}</Typography>
      <Typography variant="subtitle2" sx={{ mt: 0.5, opacity: 0.9 }}>{title}</Typography>
      {subtitle && <Typography variant="caption" sx={{ mt: 0.5, opacity: 0.7, display: 'block' }}>{subtitle}</Typography>}
    </Box>
  );
}

function PrintFooter() {
  return (
    <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="caption" color="text.secondary">Prepared By: ________________</Typography>
      <Typography variant="caption" color="text.secondary">Verified By: ________________</Typography>
      <Typography variant="caption" color="text.secondary">Date: {formatDateDDMMYYYY(new Date())}</Typography>
    </Box>
  );
}

function ExportPrintButtons({ onExport, onPrint, label }: { onExport: () => void; onPrint: () => void; label: string }) {
  return (
    <Stack direction="row" spacing={1} mb={2}>
      <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={onExport}>Export Excel</Button>
      <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={onPrint}>Print</Button>
      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, alignSelf: 'center' }}>{label}</Typography>
    </Stack>
  );
}

const NAVY = '#1A365D';
const ZEBRA = '#F7FAFC';

function StyledTable({ headers, children, zebra }: { headers: string[]; children: React.ReactNode; zebra?: boolean }) {
  return (
    <TableContainer component={Paper} sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {headers.map((h, i) => (
              <TableCell key={i} sx={{ bgcolor: NAVY, color: '#fff', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>{children}</TableBody>
      </Table>
    </TableContainer>
  );
}

function PaginatedTable({ headers, rows, renderRow, onRowClick, zebra }: {
  headers: string[];
  rows: any[];
  renderRow: (row: any, idx: number) => React.ReactNode;
  onRowClick?: (row: any) => void;
  zebra?: boolean;
}) {
  const [page, setPage] = React.useState(0);
  const perPage = 50;
  const visible = page === -1 ? rows : rows.slice(page * perPage, (page + 1) * perPage);

  return (
    <Box>
      <StyledTable headers={headers} zebra={zebra}>
        {visible.map((row, i) => (
          <TableRow
            key={row._id || row._itemId || i}
            hover
            sx={zebra && i % 2 === 1 ? { bgcolor: ZEBRA } : {}}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: 'pointer' } : {}}
          >
            {renderRow(row, page === -1 ? i : page * perPage + i)}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={headers.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>No data found</TableCell></TableRow>
        )}
      </StyledTable>
      {rows.length > perPage && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {page === -1 ? `All ${rows.length}` : `Showing ${page * perPage + 1}–${Math.min((page + 1) * perPage, rows.length)} of ${rows.length}`}
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Button size="small" variant={page === -1 ? 'contained' : 'outlined'} onClick={() => setPage(page === -1 ? 0 : -1)}>
              {page === -1 ? 'Paginate' : 'All'}
            </Button>
            {page !== -1 && (
              <>
                <Button size="small" disabled={page === 0} onClick={() => setPage(0)}>First</Button>
                <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button size="small" disabled={(page + 1) * perPage >= rows.length} onClick={() => setPage(p => p + 1)}>Next</Button>
                <Button size="small" disabled={(page + 1) * perPage >= rows.length} onClick={() => setPage(Math.ceil(rows.length / perPage) - 1)}>Last</Button>
              </>
            )}
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

// ==================== REPORT 1: CENTRAL STORE SUMMARY ====================

export function CentralStoreSummaryReport({ data, storeName, fyLabel }: { data: any[]; storeName: string; fyLabel: string }) {
  const theme = useTheme();
  const totalInward = data.reduce((s: number, r: any) => s + (r.totalReceived || 0), 0);
  const totalOutward = data.reduce((s: number, r: any) => s + (r.totalIssued || 0), 0);
  const currentBalance = data.reduce((s: number, r: any) => s + (r.currentStock || 0), 0);
  const lowStockCount = data.filter((r: any) => r.stockStatus === 'Low Stock' || r.stockStatus === 'Out of Stock').length;

  const handleExport = async () => {
    try {
      const cols: ExportColumn[] = [
        { header: 'S.No.', key: 'sNo', width: 6 },
        { header: 'Item Code', key: 'itemCode', width: 12 },
        { header: 'Item Name', key: 'itemName', width: 25 },
        { header: 'Category', key: 'categoryName', width: 15 },
        { header: 'Unit', key: 'unitName', width: 8 },
        { header: 'Total Received', key: 'totalReceived', width: 14 },
        { header: 'Total Issued', key: 'totalIssued', width: 14 },
        { header: 'Issued Breakdown', key: 'breakdownText', width: 35 },
        { header: 'Current Stock', key: 'currentStock', width: 14 },
        { header: 'Status', key: 'stockStatus', width: 14 },
      ];
      await exportToExcel(data.map((r, i) => ({ ...r, sNo: i + 1 })), cols, `Central_Store_Summary_${storeName}`);
      toast.success(`Exported ${data.length} items`);
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = data.map((r, i) => `<tr><td>${i + 1}</td><td>${r.itemCode}</td><td>${r.itemName}</td><td>${r.categoryName}</td><td>${r.unitName}</td><td>${r.totalReceived}</td><td>${r.totalIssued}</td><td>${r.breakdownText}</td><td>${r.currentStock}</td><td>${r.stockStatus}</td></tr>`).join('');
    pw.document.write(`<html><head><title>Central Store Summary</title><style>body{font-family:sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:6px 10px;text-align:left;font-size:11px}th{background:#1A365D;color:#fff;font-weight:600}.h{text-align:center;margin-bottom:12px}.h h2{margin:0;font-size:16px;color:#1A365D}.h p{margin:4px 0 0;font-size:12px;color:#64748B}@media print{body{margin:10px}}</style></head><body><div class="h"><h2>${BRAND_Hindi}</h2><p>Central Store Summary — ${storeName} — FY ${fyLabel}</p></div><table><thead><tr><th>#</th><th>Code</th><th>Item</th><th>Category</th><th>Unit</th><th>Received</th><th>Issued</th><th>Breakdown</th><th>Stock</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#64748B"><span>Prepared By: ________</span><span>Verified By: ________</span><span>Date: ${formatDateDDMMYYYY(new Date())}</span></div></body></html>`);
    pw.document.close();
    pw.print();
  };

  return (
    <Box>
      <ReportHeader title="Central Store Stock & Issue Summary" subtitle={`${storeName} — FY ${fyLabel}`} />
      <Stack direction="row" spacing={2} mb={2}>
        <KpiCard title="Total Inward" value={totalInward} icon={<TrendingUp />} color="#16A34A" />
        <KpiCard title="Total Outward" value={totalOutward} icon={<TrendingDown />} color="#D97706" />
        <KpiCard title="Current Balance" value={currentBalance} icon={<Inventory />} color="#2563EB" />
        <KpiCard title="Low Stock Alerts" value={lowStockCount} icon={<Warning />} color="#DC2626" />
      </Stack>
      <ExportPrintButtons onExport={handleExport} onPrint={handlePrint} label={`${data.length} items`} />
      <PaginatedTable
        headers={['#', 'Code', 'Item Name', 'Category', 'Unit', 'Received', 'Issued', 'Issued Breakdown', 'Stock', 'Status']}
        rows={data}
        renderRow={(r, i) => (
          <>
            <TableCell align="center">{i + 1}</TableCell>
            <TableCell>{r.itemCode}</TableCell>
            <TableCell>{r.itemName}</TableCell>
            <TableCell>{r.categoryName}</TableCell>
            <TableCell>{r.unitName}</TableCell>
            <TableCell align="center">{r.totalReceived}</TableCell>
            <TableCell align="center">{r.totalIssued}</TableCell>
            <TableCell sx={{ fontSize: '0.75rem', maxWidth: 250 }}>{r.breakdownText}</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>{r.currentStock}</TableCell>
            <TableCell><StatusBadge status={r.stockStatus} /></TableCell>
          </>
        )}
      />
      <PrintFooter />
    </Box>
  );
}

// ==================== REPORT 2: DHARAMSHALA DISTRIBUTION ====================

export function DharamshalaDistributionReport({ data, deptName, fyLabel }: { data: any[]; deptName: string; fyLabel: string }) {
  const totalReceived = data.reduce((s: number, r: any) => s + (r.totalReceived || 0), 0);
  const totalConsumed = data.reduce((s: number, r: any) => s + (r.consumed || 0), 0);
  const totalBalance = data.reduce((s: number, r: any) => s + (r.balanceQty || 0), 0);

  const handleExport = async () => {
    try {
      const cols: ExportColumn[] = [
        { header: 'S.No.', key: 'sNo', width: 6 },
        { header: 'Item Code', key: 'itemCode', width: 12 },
        { header: 'Item Name', key: 'itemName', width: 25 },
        { header: 'Category', key: 'categoryName', width: 15 },
        { header: 'Location', key: 'locationName', width: 20 },
        { header: 'Received', key: 'totalReceived', width: 12 },
        { header: 'Consumed', key: 'consumed', width: 12 },
        { header: 'Balance', key: 'balanceQty', width: 12 },
      ];
      await exportToExcel(data.map((r, i) => ({ ...r, sNo: i + 1 })), cols, `Dharamshala_Distribution_${deptName}`);
      toast.success(`Exported ${data.length} items`);
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = data.map((r, i) => `<tr><td>${i + 1}</td><td>${r.itemCode}</td><td>${r.itemName}</td><td>${r.categoryName}</td><td>${r.locationName}</td><td>${r.totalReceived}</td><td>${r.consumed || 0}</td><td>${r.balanceQty}</td></tr>`).join('');
    pw.document.write(`<html><head><title>Dharamshala Distribution</title><style>body{font-family:sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:6px 10px;text-align:left;font-size:11px}th{background:#1A365D;color:#fff;font-weight:600}.h{text-align:center;margin-bottom:12px}.h h2{margin:0;font-size:16px;color:#1A365D}.h p{margin:4px 0 0;font-size:12px;color:#64748B}@media print{body{margin:10px}}</style></head><body><div class="h"><h2>${BRAND_Hindi}</h2><p>Dharamshala Distribution — ${deptName} — FY ${fyLabel}</p></div><table><thead><tr><th>#</th><th>Code</th><th>Item</th><th>Category</th><th>Location</th><th>Received</th><th>Consumed</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#64748B"><span>Prepared By: ________</span><span>Verified By: ________</span><span>Date: ${formatDateDDMMYYYY(new Date())}</span></div></body></html>`);
    pw.document.close();
    pw.print();
  };

  return (
    <Box>
      <ReportHeader title="Dharamshala Level Stock & Distribution" subtitle={`${deptName} — FY ${fyLabel}`} />
      <Stack direction="row" spacing={2} mb={2}>
        <KpiCard title="Total Received" value={totalReceived} icon={<TrendingUp />} color="#2563EB" />
        <KpiCard title="Total Consumed" value={totalConsumed} icon={<Inventory />} color="#F97316" />
        <KpiCard title="Current Balance" value={totalBalance} icon={<Assessment />} color="#D97706" />
      </Stack>
      <ExportPrintButtons onExport={handleExport} onPrint={handlePrint} label={`${data.length} items`} />
      <PaginatedTable
        headers={['#', 'Code', 'Item Name', 'Category', 'Location', 'Received', 'Consumed', 'Balance']}
        rows={data}
        renderRow={(r, i) => (
          <>
            <TableCell align="center">{i + 1}</TableCell>
            <TableCell>{r.itemCode}</TableCell>
            <TableCell>{r.itemName}</TableCell>
            <TableCell>{r.categoryName}</TableCell>
            <TableCell>{r.locationName}</TableCell>
            <TableCell align="center">{r.totalReceived}</TableCell>
            <TableCell align="center" sx={{ color: r.consumed > 0 ? 'warning.main' : 'text.secondary' }}>{r.consumed || 0}</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, color: r.balanceQty > 0 ? 'warning.main' : 'text.secondary' }}>{r.balanceQty}</TableCell>
          </>
        )}
      />
      <PrintFooter />
    </Box>
  );
}

// ==================== REPORT 3: ROOM FACILITIES CHECKLIST ====================

export function RoomFacilitiesReport({ data, dharamshalaName }: { data: any[]; dharamshalaName: string }) {
  const handleExport = async () => {
    try {
      const cols: ExportColumn[] = [
        { header: 'S.No.', key: 'sNo', width: 6 },
        { header: 'Room No', key: 'roomNo', width: 12 },
        { header: 'Category', key: 'roomCategory', width: 18 },
        { header: 'Floor', key: 'floor', width: 10 },
        { header: 'Item Name', key: 'itemName', width: 25 },
        { header: 'Qty', key: 'quantity', width: 8 },
        { header: 'Unit', key: 'unitName', width: 8 },
        { header: 'Installed Date', key: 'installedDate', width: 14 },
        { header: 'Issue Challan', key: 'issueChallanNo', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
      ];
      await exportToExcel(data.map((r, i) => ({ ...r, sNo: i + 1, installedDate: formatDateDDMMYYYY(new Date(r.installedDate)) })), cols, `Room_Facilities_${dharamshalaName}`);
      toast.success(`Exported ${data.length} items`);
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = data.map((r, i) => `<tr><td>${i + 1}</td><td>${r.roomNo}</td><td>${r.roomCategory}</td><td>${r.floor}</td><td>${r.itemName}</td><td>${r.quantity}</td><td>${r.unitName}</td><td>${formatDateDDMMYYYY(new Date(r.installedDate))}</td><td>${r.issueChallanNo}</td><td>${r.status}</td></tr>`).join('');
    pw.document.write(`<html><head><title>Room Facilities</title><style>body{font-family:sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:6px 10px;text-align:left;font-size:11px}th{background:#1A365D;color:#fff;font-weight:600}.h{text-align:center;margin-bottom:12px}.h h2{margin:0;font-size:16px;color:#1A365D}.h p{margin:4px 0 0;font-size:12px;color:#64748B}@media print{body{margin:10px}}</style></head><body><div class="h"><h2>${BRAND_Hindi}</h2><p>Room Facilities & Installed Assets — ${dharamshalaName}</p></div><table><thead><tr><th>#</th><th>Room</th><th>Category</th><th>Floor</th><th>Item</th><th>Qty</th><th>Unit</th><th>Installed</th><th>Challan</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#64748B"><span>Prepared By: ________</span><span>Verified By: ________</span><span>Date: ${formatDateDDMMYYYY(new Date())}</span></div></body></html>`);
    pw.document.close();
    pw.print();
  };

  // Group by room for display
  const roomGroups: Record<string, any[]> = {};
  data.forEach(r => {
    const key = `${r.roomNo}|${r.roomCategory}|${r.floor}`;
    if (!roomGroups[key]) roomGroups[key] = [];
    roomGroups[key].push(r);
  });

  return (
    <Box>
      <ReportHeader title="Room Facilities & Installed Assets Checklist" subtitle={dharamshalaName} />
      <Stack direction="row" spacing={2} mb={2}>
        <KpiCard title="Total Rooms" value={Object.keys(roomGroups).length} icon={<Inventory />} color="#2563EB" />
        <KpiCard title="Total Assets" value={data.length} icon={<CheckCircle />} color="#16A34A" />
        <KpiCard title="Active" value={data.filter(r => r.status === 'Active').length} icon={<CheckCircle />} color="#16A34A" />
        <KpiCard title="Damaged" value={data.filter(r => r.status === 'Damaged').length} icon={<Error />} color="#DC2626" />
      </Stack>
      <ExportPrintButtons onExport={handleExport} onPrint={handlePrint} label={`${data.length} installations`} />
      <PaginatedTable
        headers={['#', 'Room No', 'Category', 'Floor', 'Item', 'Qty', 'Unit', 'Installed', 'Challan', 'Status']}
        rows={data}
        renderRow={(r, i) => (
          <>
            <TableCell align="center">{i + 1}</TableCell>
            <TableCell>{r.roomNo}</TableCell>
            <TableCell>{r.roomCategory}</TableCell>
            <TableCell>{r.floor}</TableCell>
            <TableCell>{r.itemName}</TableCell>
            <TableCell align="center">{r.quantity}</TableCell>
            <TableCell>{r.unitName}</TableCell>
            <TableCell>{formatDateDDMMYYYY(new Date(r.installedDate))}</TableCell>
            <TableCell>{r.issueChallanNo}</TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
          </>
        )}
      />
      <PrintFooter />
    </Box>
  );
}

// ==================== REPORT 4: ITEM AUDIT LEDGER ====================

export function ItemAuditLedgerReport({ data, itemName, fyLabel }: { data: any[]; itemName: string; fyLabel: string }) {
  const totalIn = data.reduce((s: number, r: any) => s + (r.quantityIn || 0), 0);
  const totalOut = data.reduce((s: number, r: any) => s + (r.quantityOut || 0), 0);
  const finalBalance = data.length > 0 ? data[data.length - 1].balanceQty : 0;

  const handleExport = async () => {
    try {
      const cols: ExportColumn[] = [
        { header: 'S.No.', key: 'sNo', width: 6 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Reference No', key: 'referenceNo', width: 16 },
        { header: 'Activity Type', key: 'transactionType', width: 16 },
        { header: 'Source', key: 'source', width: 22 },
        { header: 'Destination', key: 'destination', width: 22 },
        { header: 'Qty In', key: 'quantityIn', width: 10 },
        { header: 'Qty Out', key: 'quantityOut', width: 10 },
        { header: 'Balance', key: 'balanceQty', width: 10 },
        { header: 'By', key: 'createdBy', width: 14 },
      ];
      await exportToExcel(data.map((r, i) => ({ ...r, sNo: i + 1, date: formatDateDDMMYYYY(new Date(r.date)) })), cols, `Item_Audit_Ledger_${itemName}`);
      toast.success(`Exported ${data.length} transactions`);
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = data.map((r, i) => `<tr><td>${i + 1}</td><td>${formatDateDDMMYYYY(new Date(r.date))}</td><td>${r.referenceNo}</td><td>${r.transactionType}</td><td>${r.source}</td><td>${r.destination}</td><td>${r.quantityIn || ''}</td><td>${r.quantityOut || ''}</td><td>${r.balanceQty}</td><td>${r.createdBy}</td></tr>`).join('');
    pw.document.write(`<html><head><title>Item Audit Ledger</title><style>body{font-family:sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:6px 10px;text-align:left;font-size:11px}th{background:#1A365D;color:#fff;font-weight:600}.h{text-align:center;margin-bottom:12px}.h h2{margin:0;font-size:16px;color:#1A365D}.h p{margin:4px 0 0;font-size:12px;color:#64748B}@media print{body{margin:10px}}</style></head><body><div class="h"><h2>${BRAND_Hindi}</h2><p>Item Audit Ledger — ${itemName} — FY ${fyLabel}</p></div><table><thead><tr><th>#</th><th>Date</th><th>Ref No</th><th>Type</th><th>Source</th><th>Destination</th><th>In</th><th>Out</th><th>Balance</th><th>By</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#64748B"><span>Prepared By: ________</span><span>Verified By: ________</span><span>Date: ${formatDateDDMMYYYY(new Date())}</span></div></body></html>`);
    pw.document.close();
    pw.print();
  };

  return (
    <Box>
      <ReportHeader title="Comprehensive Item History & Movement Audit Ledger" subtitle={`${itemName} — FY ${fyLabel}`} />
      <Stack direction="row" spacing={2} mb={2}>
        <KpiCard title="Total In" value={totalIn} icon={<TrendingUp />} color="#16A34A" />
        <KpiCard title="Total Out" value={totalOut} icon={<TrendingDown />} color="#D97706" />
        <KpiCard title="Final Balance" value={finalBalance} icon={<Inventory />} color="#2563EB" />
        <KpiCard title="Transactions" value={data.length} icon={<Assessment />} color="#7C3AED" />
      </Stack>
      <ExportPrintButtons onExport={handleExport} onPrint={handlePrint} label={`${data.length} transactions`} />
      <PaginatedTable
        headers={['#', 'Date', 'Ref No', 'Type', 'Source', 'Destination', 'In', 'Out', 'Balance', 'By']}
        rows={data}
        renderRow={(r, i) => (
          <>
            <TableCell align="center">{i + 1}</TableCell>
            <TableCell>{formatDateDDMMYYYY(new Date(r.date))}</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.referenceNo}</TableCell>
            <TableCell>
              <Chip label={r.transactionType} size="small" sx={{ fontWeight: 600, fontSize: '0.65rem',
                bgcolor: r.transactionType.includes('In') || r.transactionType === 'Purchase' || r.transactionType === 'Opening Stock' ? alpha('#16A34A', 0.1)
                  : r.transactionType.includes('Out') || r.transactionType === 'Issue' ? alpha('#D97706', 0.1)
                  : alpha('#7C3AED', 0.1),
                color: r.transactionType.includes('In') || r.transactionType === 'Purchase' || r.transactionType === 'Opening Stock' ? '#16A34A'
                  : r.transactionType.includes('Out') || r.transactionType === 'Issue' ? '#D97706' : '#7C3AED',
              }} />
            </TableCell>
            <TableCell sx={{ fontSize: '0.75rem', maxWidth: 180 }}>{r.source}</TableCell>
            <TableCell sx={{ fontSize: '0.75rem', maxWidth: 180 }}>{r.destination}</TableCell>
            <TableCell align="center" sx={{ color: r.quantityIn > 0 ? 'success.main' : 'text.secondary' }}>{r.quantityIn || '-'}</TableCell>
            <TableCell align="center" sx={{ color: r.quantityOut > 0 ? 'error.main' : 'text.secondary' }}>{r.quantityOut || '-'}</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>{r.balanceQty}</TableCell>
            <TableCell sx={{ fontSize: '0.75rem' }}>{r.createdBy}</TableCell>
          </>
        )}
      />
      <PrintFooter />
    </Box>
  );
}

// ==================== REPORT 5: DAMAGE / SCRAP / RETURNS ====================

export function DamageScrapReturnsReport({ data, fyLabel }: { data: any[]; fyLabel: string }) {
  const damageCount = data.filter(r => r.entryType === 'DAMAGE').length;
  const returnCount = data.filter(r => r.entryType === 'VENDOR_RETURN').length;
  const totalQty = data.reduce((s: number, r: any) => s + (r.quantity || 0), 0);

  const handleExport = async () => {
    try {
      const cols: ExportColumn[] = [
        { header: 'S.No.', key: 'sNo', width: 6 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Entry Type', key: 'entryType', width: 14 },
        { header: 'Reference No', key: 'referenceNo', width: 16 },
        { header: 'Item Code', key: 'itemCode', width: 12 },
        { header: 'Item Name', key: 'itemName', width: 25 },
        { header: 'Qty', key: 'quantity', width: 8 },
        { header: 'Unit', key: 'unitName', width: 8 },
        { header: 'Source Location', key: 'sourceLocation', width: 18 },
        { header: 'Reason', key: 'reason', width: 25 },
        { header: 'Action Taken', key: 'actionTaken', width: 20 },
      ];
      await exportToExcel(data.map((r, i) => ({ ...r, sNo: i + 1, date: formatDateDDMMYYYY(new Date(r.date)) })), cols, `Damage_Scrap_Returns_${fyLabel}`);
      toast.success(`Exported ${data.length} entries`);
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const handlePrint = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = data.map((r, i) => `<tr><td>${i + 1}</td><td>${formatDateDDMMYYYY(new Date(r.date))}</td><td>${r.entryType}</td><td>${r.referenceNo}</td><td>${r.itemName}</td><td>${r.quantity}</td><td>${r.unitName}</td><td>${r.sourceLocation}</td><td>${r.reason}</td><td>${r.actionTaken}</td></tr>`).join('');
    pw.document.write(`<html><head><title>Damage/Scrap/Returns</title><style>body{font-family:sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:6px 10px;text-align:left;font-size:11px}th{background:#1A365D;color:#fff;font-weight:600}.h{text-align:center;margin-bottom:12px}.h h2{margin:0;font-size:16px;color:#1A365D}.h p{margin:4px 0 0;font-size:12px;color:#64748B}@media print{body{margin:10px}}</style></head><body><div class="h"><h2>${BRAND_Hindi}</h2><p>Damage, Scrap & Vendor Return Report — FY ${fyLabel}</p></div><table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Ref No</th><th>Item</th><th>Qty</th><th>Unit</th><th>Source</th><th>Reason</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#64748B"><span>Prepared By: ________</span><span>Verified By: ________</span><span>Date: ${formatDateDDMMYYYY(new Date())}</span></div></body></html>`);
    pw.document.close();
    pw.print();
  };

  return (
    <Box>
      <ReportHeader title="Damage, Scrap & Vendor Return Report" subtitle={`FY ${fyLabel}`} />
      <Stack direction="row" spacing={2} mb={2}>
        <KpiCard title="Damage Entries" value={damageCount} icon={<Error />} color="#DC2626" />
        <KpiCard title="Vendor Returns" value={returnCount} icon={<TrendingDown />} color="#D97706" />
        <KpiCard title="Total Qty Affected" value={totalQty} icon={<Inventory />} color="#7C3AED" />
      </Stack>
      <ExportPrintButtons onExport={handleExport} onPrint={handlePrint} label={`${data.length} entries`} />
      <PaginatedTable
        headers={['#', 'Date', 'Type', 'Ref No', 'Item', 'Qty', 'Unit', 'Source', 'Reason', 'Action']}
        rows={data}
        renderRow={(r, i) => (
          <>
            <TableCell align="center">{i + 1}</TableCell>
            <TableCell>{formatDateDDMMYYYY(new Date(r.date))}</TableCell>
            <TableCell>
              <Chip label={ENTRY_TYPE_LABELS[r.entryType] || r.entryType} size="small" sx={{
                fontWeight: 600, fontSize: '0.65rem',
                bgcolor: r.entryType === 'DAMAGE' ? alpha('#DC2626', 0.1) : alpha('#D97706', 0.1),
                color: r.entryType === 'DAMAGE' ? '#DC2626' : '#D97706',
              }} />
            </TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.referenceNo}</TableCell>
            <TableCell>{r.itemName}</TableCell>
            <TableCell align="center">{r.quantity}</TableCell>
            <TableCell>{r.unitName}</TableCell>
            <TableCell>{r.sourceLocation}</TableCell>
            <TableCell sx={{ fontSize: '0.75rem', maxWidth: 200 }}>{r.reason}</TableCell>
            <TableCell sx={{ fontSize: '0.75rem' }}>{r.actionTaken}</TableCell>
          </>
        )}
      />
      <PrintFooter />
    </Box>
  );
}

// ==================== ITEM LIFECYCLE ====================

export function ItemLifecycleRenderer({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <Typography>No data</Typography>;

  return (
    <Box>
      <ReportHeader title="Item Movement Lifecycle" />
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#1A365D' }}>
              {['#', 'Date', 'Type', 'Item', 'Department', 'Location', 'In', 'Out', 'Balance', 'Ref', 'Condition'].map(h => (
                <TableCell key={h} sx={{ color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell align="center">{i + 1}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{formatDateDDMMYYYY(new Date(r.date))}</TableCell>
                <TableCell>
                  <Chip label={TRANSACTION_TYPE_LABELS[r.transactionType] || r.transactionType} size="small" sx={{
                    fontWeight: 600, fontSize: '0.6rem',
                    bgcolor: r.transactionType.includes('IN') || r.transactionType === 'PURCHASE' || r.transactionType === 'OPENING_BALANCE'
                      ? alpha('#16A34A', 0.1) : r.transactionType.includes('OUT') || r.transactionType === 'ISSUE'
                      ? alpha('#DC2626', 0.1) : alpha('#D97706', 0.1),
                    color: r.transactionType.includes('IN') || r.transactionType === 'PURCHASE' || r.transactionType === 'OPENING_BALANCE'
                      ? '#16A34A' : r.transactionType.includes('OUT') || r.transactionType === 'ISSUE'
                      ? '#DC2626' : '#D97706',
                  }} />
                </TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{r.itemName}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{r.departmentName}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{r.locationName}</TableCell>
                <TableCell align="right" sx={{ color: '#16A34A', fontWeight: 600 }}>{r.quantityIn || '-'}</TableCell>
                <TableCell align="right" sx={{ color: '#DC2626', fontWeight: 600 }}>{r.quantityOut || '-'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{r.balanceQty}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{r.referenceNo}</TableCell>
                <TableCell>
                  <Chip label={CONDITION_LABELS[r.condition] || r.condition} size="small" sx={{ fontSize: '0.6rem' }}
                    color={r.condition === 'GOOD' ? 'success' : r.condition === 'DAMAGED' ? 'error' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <PrintFooter />
    </Box>
  );
}

// ==================== VISUAL ANALYTICS ====================

export function VisualAnalyticsRenderer({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <Typography>No data available</Typography>;

  const analytics = data[0] as any;
  const COLORS = ['#1A365D', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#2563EB', '#EA580C', '#0891B2'];

  return (
    <Box>
      <ReportHeader title="Visual Analytics Dashboard" />
      <Grid container spacing={3}>
        {analytics.departmentConsumption?.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Department Consumption</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.departmentConsumption.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="received" fill="#16A34A" name="Received" />
                  <Bar dataKey="issued" fill="#DC2626" name="Issued" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {analytics.locationDistribution?.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Stock Distribution by Location</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={analytics.locationDistribution} dataKey="qty" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {analytics.locationDistribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {analytics.monthlyTrend?.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Monthly Receipt vs Issue Trend</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="received" stroke="#16A34A" strokeWidth={2} name="Received" />
                  <Line type="monotone" dataKey="issued" stroke="#DC2626" strokeWidth={2} name="Issued" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
      <PrintFooter />
    </Box>
  );
}
