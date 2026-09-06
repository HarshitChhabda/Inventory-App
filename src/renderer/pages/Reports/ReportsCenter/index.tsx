import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, Tabs, Tab, TextField, MenuItem,
  LinearProgress, Alert, Snackbar, IconButton, Tooltip, Stack, alpha, useTheme,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Skeleton
} from '@mui/material';
import {
  Download, PictureAsPdf, TableChart, FileDownload, Search, FilterAlt, AutoGraph,
  Assessment, Tune, Assignment, ReceiptLong, LocalShipping, Warehouse, Build, EventNote, FolderOpen, Refresh
} from '@mui/icons-material';
import DatePickerField from '../../../components/DatePickerField';
import { useCompany } from '../../../context/CompanyContext';
import { formatDateDDMMYYYY, todayISO } from '../../../utils/dateUtils';

declare global { interface Window { electronAPI: any } }

const VOUCHER_LABELS: Record<string, string> = {
  RC: 'Receipt', IC: 'Issue', TC: 'Transfer', VR: 'Vendor Return',
  DM: 'Damage', AD: 'Adjustment', UN: 'Uninstall', RP: 'Repair',
  RM: 'Replacement', RT: 'Return', CN: 'Consumption', MC: 'Material Consumption',
  RECEIPT: 'Receipt', PURCHASE: 'Purchase',
  ISSUE: 'Issue', DAMAGE: 'Damage', STOCK_ADJUSTMENT: 'Adjustment',
};

const REPORT_SECTIONS = [
  { label: 'Stock', icon: <Warehouse />, reports: ['Overall Stock', 'Store Wise', 'Department Wise', 'Item Wise', 'Category Wise'] },
  { label: 'Movement', icon: <LocalShipping />, reports: ['Receipt', 'Issue', 'Transfer', 'Installation', 'Damage', 'Repair', 'Replacement', 'Return', 'Adjustment'] },
  { label: 'Ledger', icon: <Assignment />, reports: ['Complete Ledger', 'Item Ledger', 'Store Ledger', 'Department Ledger'] },
  { label: 'Asset', icon: <Build />, reports: ['Asset Register', 'Installed Assets', 'Asset Health', 'Warranty Expiry', 'AMC Expiry'] },
  { label: 'Purchase', icon: <ReceiptLong />, reports: ['Purchase Register', 'GRN Register', 'Vendor Performance'] },
  { label: 'Maintenance', icon: <Tune />, reports: ['Service Register', 'Work Order Register', 'Downtime', 'Repair Cost'] },
  { label: 'Financial', icon: <AutoGraph />, reports: ['Inventory Valuation', 'Transaction Summary'] },
  { label: 'Audit', icon: <Assessment />, reports: ['Import History'] },
];

export default function ReportsCenter() {
  const theme = useTheme();
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const [loading, setLoading] = useState(false);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [reportIdx, setReportIdx] = useState(0);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [filter, setFilter] = useState({ dateFrom: '', dateTo: '', storeId: '', itemId: '' });
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', sev: 'success' as any });

  const currentSection = REPORT_SECTIONS[sectionIdx];
  const currentReports = currentSection?.reports || [];
  const currentReport = currentReports[reportIdx];

  const loadReport = async () => {
    setLoading(true);
    const fy = await window.electronAPI.getCurrentFinancialYear(companyId);
    const f: any = { companyId, financialYearId: fy?.id };
    if (filter.dateFrom) f.dateFrom = new Date(filter.dateFrom);
    if (filter.dateTo) f.dateTo = new Date(filter.dateTo);
    if (filter.storeId) f.storeId = +filter.storeId;
    if (filter.itemId) f.itemId = +filter.itemId;

    try {
      let result: any[] = [];
      let cols: any[] = [];
      switch (currentReport) {
        case 'Overall Stock':
          result = await window.electronAPI.getOverallStock(f);
          cols = [{ header: 'Code', key: 'itemCode', width: 15 }, { header: 'Name', key: 'itemName', width: 30 }, { header: 'Category', key: 'category', width: 15 }, { header: 'In', key: 'quantityIn', width: 10, align: 'right' }, { header: 'Out', key: 'quantityOut', width: 10, align: 'right' }, { header: 'Balance', key: 'balance', width: 10, align: 'right' }];
          break;
        case 'Store Wise':
          result = await window.electronAPI.getStoreStockRpt(f);
          cols = [{ header: 'Store', key: 'storeName', width: 20 }, { header: 'Item', key: 'itemName', width: 30 }, { header: 'In', key: 'quantityIn', width: 10, align: 'right' }, { header: 'Out', key: 'quantityOut', width: 10, align: 'right' }, { header: 'Balance', key: 'balance', width: 10, align: 'right' }];
          break;
        case 'Department Wise':
          result = await window.electronAPI.getDeptStock(f);
          cols = [{ header: 'Department', key: 'department', width: 20 }, { header: 'Item', key: 'itemName', width: 30 }, { header: 'Received', key: 'received', width: 10, align: 'right' }, { header: 'Issued', key: 'issued', width: 10, align: 'right' }, { header: 'Balance', key: 'balance', width: 10, align: 'right' }];
          break;
        case 'Item Wise':
          result = await window.electronAPI.getItemStock(f);
          cols = [{ header: 'Code', key: 'itemCode', width: 15 }, { header: 'Item', key: 'itemName', width: 30 }, { header: 'Store', key: 'store', width: 15 }, { header: 'In', key: 'quantityIn', width: 10, align: 'right' }, { header: 'Out', key: 'quantityOut', width: 10, align: 'right' }, { header: 'Balance', key: 'balance', width: 10, align: 'right' }];
          break;
        case 'Category Wise':
          result = await window.electronAPI.getCategoryStock(f);
          cols = [{ header: 'Category', key: 'category', width: 30 }, { header: 'Quantity', key: 'quantity', width: 15, align: 'right' }];
          break;
        case 'Receipt': result = await window.electronAPI.getReceiptReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }, { header: 'Date', key: 'transactionDate', width: 15 }, { header: 'Remarks', key: 'remarks', width: 30 }]; break;
        case 'Issue': result = await window.electronAPI.getIssueReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }, { header: 'Date', key: 'transactionDate', width: 15 }, { header: 'Remarks', key: 'remarks', width: 30 }]; break;
        case 'Transfer': result = await window.electronAPI.getTransferReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }, { header: 'Date', key: 'transactionDate', width: 15 }, { header: 'Remarks', key: 'remarks', width: 30 }]; break;
        case 'Installation': result = await window.electronAPI.getInstallationReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }, { header: 'Date', key: 'transactionDate', width: 15 }]; break;
        case 'Damage': result = await window.electronAPI.getDamageReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }, { header: 'Date', key: 'transactionDate', width: 15 }]; break;
        case 'Repair': result = await window.electronAPI.getRepairReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }, { header: 'Date', key: 'transactionDate', width: 15 }]; break;
        case 'Replacement': result = await window.electronAPI.getReplacementReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }]; break;
        case 'Return': result = await window.electronAPI.getReturnReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }]; break;
        case 'Adjustment': result = await window.electronAPI.getAdjustmentReport(f); cols = [{ header: 'Voucher', key: 'voucherNo', width: 20 }]; break;
        case 'Complete Ledger': result = await window.electronAPI.getCompleteLedger(f); cols = [{ header: 'Date', key: 'transactionDate', width: 15 }, { header: 'Item', key: 'itemName', width: 20 }, { header: 'In', key: 'quantityIn', width: 10, align: 'right' }, { header: 'Out', key: 'quantityOut', width: 10, align: 'right' }]; break;
        case 'Item Ledger': result = await window.electronAPI.getItemLedger(f); cols = [{ header: 'Date', key: 'transactionDate', width: 15 }, { header: 'Item', key: 'itemName', width: 20 }, { header: 'In', key: 'quantityIn', width: 10, align: 'right' }]; break;
        case 'Store Ledger': result = await window.electronAPI.getStoreLedger(f); cols = [{ header: 'Date', key: 'transactionDate', width: 15 }, { header: 'Store', key: 'storeName', width: 20 }]; break;
        case 'Department Ledger': result = await window.electronAPI.getDeptLedger(f); cols = [{ header: 'Date', key: 'transactionDate', width: 15 }, { header: 'Dept', key: 'departmentName', width: 20 }]; break;
        case 'Asset Register': result = await window.electronAPI.getAssetRegister(f); cols = [{ header: 'Code', key: 'assetCode', width: 15 }, { header: 'Name', key: 'assetName', width: 30 }, { header: 'Status', key: 'status', width: 15 }, { header: 'Health', key: 'healthScore', width: 10, align: 'right' }]; break;
        case 'Installed Assets': result = await window.electronAPI.getInstalledAssetsRpt(f); cols = [{ header: 'Code', key: 'assetCode', width: 15 }, { header: 'Name', key: 'assetName', width: 30 }]; break;
        case 'Asset Health': result = await window.electronAPI.getAssetHealthRpt(f); cols = [{ header: 'Code', key: 'assetCode', width: 15 }, { header: 'Name', key: 'assetName', width: 25 }, { header: 'Health', key: 'healthScore', width: 10, align: 'right' }, { header: 'Repairs', key: 'repairCount', width: 10, align: 'right' }]; break;
        case 'Warranty Expiry': result = await window.electronAPI.getWarrantyExpiryReport(f); cols = [{ header: 'Code', key: 'assetCode', width: 15 }, { header: 'Name', key: 'assetName', width: 25 }, { header: 'Warranty End', key: 'warrantyEnd', width: 15 }]; break;
        case 'AMC Expiry': result = await window.electronAPI.getAMCExpiryReport(f); cols = [{ header: 'Asset', key: 'assetName', width: 25 }, { header: 'Vendor', key: 'vendorName', width: 20 }, { header: 'End', key: 'endDate', width: 15 }]; break;
        case 'Purchase Register': result = await window.electronAPI.getPurchaseRegister(f); cols = [{ header: 'PO #', key: 'poNumber', width: 20 }, { header: 'Date', key: 'createdAt', width: 15 }, { header: 'Status', key: 'status', width: 15 }]; break;
        case 'GRN Register': result = await window.electronAPI.getGRNRegister(f); cols = [{ header: 'GRN #', key: 'grnNumber', width: 20 }, { header: 'Date', key: 'createdAt', width: 15 }]; break;
        case 'Vendor Performance': result = await window.electronAPI.getVendorPerformanceReport(f); cols = [{ header: 'Vendor', key: 'vendorName', width: 25 }, { header: 'POs', key: 'totalPO', width: 10, align: 'right' }, { header: 'Rating', key: 'avgRating', width: 10, align: 'right' }]; break;
        case 'Service Register': result = await window.electronAPI.getServiceRegister(f); cols = [{ header: 'Asset', key: 'assetName', width: 25 }, { header: 'Type', key: 'serviceType', width: 15 }, { header: 'Date', key: 'serviceDate', width: 15 }, { header: 'Cost', key: 'totalCost', width: 10, align: 'right' }]; break;
        case 'Work Order Register': result = await window.electronAPI.getWORegister(f); cols = [{ header: 'WO #', key: 'workOrderNumber', width: 20 }, { header: 'Asset', key: 'assetName', width: 25 }, { header: 'Status', key: 'status', width: 15 }]; break;
        case 'Downtime': result = await window.electronAPI.getDowntimeReport(f); cols = [{ header: 'Asset', key: 'assetName', width: 25 }, { header: 'Cause', key: 'cause', width: 30 }, { header: 'Hours', key: 'downtime', width: 10, align: 'right' }]; break;
        case 'Repair Cost': result = await window.electronAPI.getRepairCostReport(f); cols = [{ header: 'Asset', key: 'assetName', width: 25 }, { header: 'Repairs', key: 'repairCount', width: 10, align: 'right' }, { header: 'Total Cost', key: 'totalCost', width: 15, align: 'right' }]; break;
        case 'Inventory Valuation': result = await window.electronAPI.getInventoryValuation(f); cols = [{ header: 'Code', key: 'itemCode', width: 15 }, { header: 'Item', key: 'itemName', width: 30 }, { header: 'Qty', key: 'quantity', width: 10, align: 'right' }, { header: 'Value', key: 'value', width: 15, align: 'right' }]; break;
        case 'Transaction Summary': result = await window.electronAPI.getTransactionSummary(f); cols = [{ header: 'Type', key: 'voucherType', width: 20 }, { header: 'Count', key: 'count', width: 10, align: 'right' }]; break;
        case 'Import History': result = await window.electronAPI.getImportHistoryReport(f); cols = [{ header: 'Type', key: 'importType', width: 20 }, { header: 'Date', key: 'createdAt', width: 15 }, { header: 'Records', key: 'recordCount', width: 10, align: 'right' }]; break;
        default: result = []; cols = [];
      }
      setData(result); setColumns(cols);
    } catch (e: any) {
      setSnackbar({ open: true, msg: e.message, sev: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => { loadReport(); }, [sectionIdx, reportIdx]);

  const handleExport = async (format: string) => {
    if (data.length === 0) { setSnackbar({ open: true, msg: 'No data to export', sev: 'warning' }); return; }
    try {
      const filename = `${currentReport}_${todayISO()}`;
      if (format === 'excel') {
        const path = await window.electronAPI.exportToExcel(data, columns, filename);
        setSnackbar({ open: true, msg: `Exported: ${path}`, sev: 'success' });
      } else if (format === 'csv') {
        const path = await window.electronAPI.exportToCSV(data, columns, filename);
        setSnackbar({ open: true, msg: `Exported: ${path}`, sev: 'success' });
      }
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleResetFilters = () => {
    setFilter({ dateFrom: '', dateTo: '', storeId: '', itemId: '' });
  };

  const renderSkeleton = () => (
    <Box sx={{ mt: 2 }}>
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} animation="wave" height={52} sx={{ mb: 1, borderRadius: 1 }} />
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', bgcolor: 'background.default' }}>
      
      {/* Sidebar Navigation */}
      <Paper elevation={0} sx={{ width: 260, flexShrink: 0, borderRadius: 0, borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto' }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="h6" sx={{ fontFamily: '\"Poppins\", sans-serif', fontWeight: 600 }}>Reports Center</Typography>
          <Typography variant="caption" color="text.secondary">Select a category to view reports</Typography>
        </Box>
        <List sx={{ px: 1 }}>
          {REPORT_SECTIONS.map((s, idx) => (
            <React.Fragment key={s.label}>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton 
                  selected={sectionIdx === idx} 
                  onClick={() => { setSectionIdx(idx); setReportIdx(0); }}
                  sx={{ 
                    borderRadius: 1, 
                    '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) } }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: sectionIdx === idx ? 'primary.main' : 'text.secondary' }}>
                    {React.cloneElement(s.icon, { fontSize: 'small' })}
                  </ListItemIcon>
                  <ListItemText primary={s.label} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: sectionIdx === idx ? 600 : 500 }} />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 3 }}>
        
        {/* Header & Sub-tabs */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontFamily: '\"Poppins\", sans-serif', fontWeight: 600, mb: 2 }}>
            {currentSection?.label} Reports
          </Typography>
          <Tabs 
            value={reportIdx} 
            onChange={(_, v) => setReportIdx(v)} 
            variant="scrollable" 
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 500, fontSize: '0.875rem', px: 3 },
              borderBottom: 1, borderColor: 'divider'
            }}
          >
            {currentReports.map(r => <Tab key={r} label={r} />)}
          </Tabs>
        </Box>

        {/* Filter Bar */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <DatePickerField fullWidth size="small" label="Date From" value={filter.dateFrom} onChange={v => setFilter({ ...filter, dateFrom: v })} sx={{ bgcolor: 'background.paper' }} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <DatePickerField fullWidth size="small" label="Date To" value={filter.dateTo} onChange={v => setFilter({ ...filter, dateTo: v })} sx={{ bgcolor: 'background.paper' }} />
            </Grid>
            <Grid item xs={12} sm={6} display="flex" gap={1.5} justifyContent="flex-end">
              <Button variant="outlined" color="inherit" onClick={handleResetFilters} startIcon={<Refresh />}>Reset</Button>
              <Button variant="contained" onClick={loadReport} startIcon={<Search />} disableElevation>Apply Filters</Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Action Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{currentReport}</Typography>
            <Chip label={`${data.length} records`} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<TableChart />} onClick={() => handleExport('excel')} sx={{ color: '#107c41', borderColor: '#107c41', '&:hover': { bgcolor: alpha('#107c41', 0.05), borderColor: '#107c41' } }}>Excel</Button>
            <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={() => handleExport('csv')}>CSV</Button>
          </Stack>
        </Box>

        {/* Data Table */}
        <Paper elevation={0} sx={{ flexGrow: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <Box sx={{ p: 2 }}>{renderSkeleton()}</Box>
          ) : data.length > 0 ? (
            <TableContainer sx={{ flexGrow: 1, maxHeight: '100%' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {columns.map(c => (
                      <TableCell 
                        key={c.key} 
                        align={c.align || 'left'}
                        sx={{ 
                          bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                          fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', py: 1.5
                        }}
                      >
                        {c.header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((row: any, i: number) => (
                    <TableRow key={i} hover sx={{ '&:nth-of-type(even)': { bgcolor: alpha(theme.palette.action.hover, 0.3) } }}>
                      {columns.map(c => {
                        let value = row[c.key];
                        let isNumeric = c.align === 'right';
                        let formattedValue = value;

                        if (value === null || value === undefined) formattedValue = '-';
                        else if (c.key.toLowerCase().includes('date')) {
                          try { const d = new Date(value); formattedValue = (!isNaN(d.getTime())) ? formatDateDDMMYYYY(d) : String(value); } catch { formattedValue = String(value); }
                        } else if (c.key.toLowerCase().includes('cost') || c.key.toLowerCase().includes('value')) {
                          formattedValue = `${Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`;
                          isNumeric = true;
                        } else if (typeof value === 'number') {
                          formattedValue = value.toLocaleString();
                          isNumeric = true;
                        }

                        return (
                          <TableCell 
                            key={c.key} 
                            align={c.align || 'left'}
                            sx={{ 
                              py: 1, 
                              fontFamily: isNumeric ? '\"JetBrains Mono\", monospace' : 'inherit',
                              fontSize: isNumeric ? '0.8125rem' : '0.875rem'
                            }}
                          >
                            {c.key === 'status' ? (
                              <Chip 
                                label={String(formattedValue)} 
                                size="small" 
                                color={String(formattedValue).toLowerCase().includes('posted') || String(formattedValue).toLowerCase().includes('active') ? 'success' : 'default'}
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 500 }}
                              />
                            ) : c.key === 'transactionType' || c.key === 'voucherType' ? (
                              <Chip 
                                label={VOUCHER_LABELS[String(formattedValue)] || String(formattedValue)} 
                                size="small" 
                                sx={{ 
                                  height: 20, fontSize: '0.7rem', fontWeight: 500,
                                  bgcolor: ['RECEIPT', 'PURCHASE'].includes(String(formattedValue)) ? alpha(theme.palette.success.main, 0.1) : 
                                          ['ISSUE', 'DAMAGE'].includes(String(formattedValue)) ? alpha(theme.palette.error.main, 0.1) : 
                                          alpha(theme.palette.info.main, 0.1),
                                  color: ['RECEIPT', 'PURCHASE'].includes(String(formattedValue)) ? 'success.main' : 
                                          ['ISSUE', 'DAMAGE'].includes(String(formattedValue)) ? 'error.main' : 
                                          'info.main',
                                }}
                              />
                            ) : formattedValue}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 8 }}>
              <FolderOpen sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>No records found</Typography>
              <Typography variant="body2" color="text.disabled">Adjust your filters or try a different report.</Typography>
            </Box>
          )}
        </Paper>

      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.sev}>{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
