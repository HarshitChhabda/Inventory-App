import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, TextField, MenuItem, Grid,
  Card, CardContent, Alert, Snackbar, Tabs, Tab, Tooltip, LinearProgress, Divider,
  List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import { Add, Visibility, PlayArrow, CheckCircle, Cancel, Build, Search, Print, AttachFile, EditNote, Description } from '@mui/icons-material';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import WorkCompletionForm from '../../../components/PrintForms/WorkCompletionForm';
import DocumentUploader from '../../../components/DocumentUploader';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';

declare global { interface Window { electronAPI: any } }

const STATUSES = ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const STATUS_COLORS: Record<string, string> = { DRAFT: 'default', APPROVED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'error' };
const COST_TYPES = ['MATERIAL', 'LABOUR', 'VENDOR', 'TRAVEL', 'MISC'];

const workOrderSchema = z.object({
  assetId: z.number().min(1, 'Asset is required'),
  engineerName: z.string().min(1, 'Engineer name is required'),
  vendorName: z.string(),
  expectedCompletion: z.string(),
  remarks: z.string(),
});
type WorkOrderFormData = z.infer<typeof workOrderSchema>;

export default function WorkOrderPage() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>({});
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [spareParts, setSpareParts] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [addSpareOpen, setAddSpareOpen] = useState(false);
  const [addCostOpen, setAddCostOpen] = useState(false);
  const [costSummary, setCostSummary] = useState<any>({});
  const [filter, setFilter] = useState({ status: '', search: '' });
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    mode: 'onChange',
    defaultValues: { assetId: 0, engineerName: '', vendorName: '', expectedCompletion: '', remarks: '' },
  });
  const [spareForm, setSpareForm] = useState({ itemId: 0, itemName: '', quantity: 1, rate: 0 });
  const [costForm, setCostForm] = useState({ costType: 'MATERIAL', amount: 0, description: '', invoiceNumber: '' });
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', sev: 'success' as any });
  const [completionData, setCompletionData] = useState<any>(null);
  const [docUploaderOpen, setDocUploaderOpen] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<any[]>([]);
  const [delayedEntryOpen, setDelayedEntryOpen] = useState(false);
  const [delayedEntry, setDelayedEntry] = useState({
    completedDate: '',
    workDescription: '',
    locationDetails: '',
    departmentVerifiedBy: '',
    managerVerifiedBy: '',
    items: [] as any[],
    overallRemarks: '',
  });
  const [cancelTarget, setCancelTarget] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const companyId = 1;
    const [wos, dash, asts] = await Promise.all([
      window.electronAPI.listWorkOrders({ companyId, ...filter }),
      window.electronAPI.workOrderDashboard(companyId),
      window.electronAPI.searchAssets({ companyId }),
    ]);
    setWorkOrders(wos); setDashboard(dash); setAssets(asts?.data || asts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const loadDetail = async (wo: any) => {
    setSelected(wo);
    const [sp, co, ph, cs] = await Promise.all([
      window.electronAPI.getWOSpareParts(wo.id),
      window.electronAPI.getWOCosts(wo.id),
      window.electronAPI.getWOPhotos(wo.id),
      window.electronAPI.getWorkOrderCostSummary(wo.id),
    ]);
    setSpareParts(sp || []); setCosts(co || []); setPhotos(ph || []); setCostSummary(cs || {});
    setTab(0); setDetailOpen(true);
  };

  const handleCreate = async (data: WorkOrderFormData) => {
    try {
      const companyId = 1;
      const fy = await window.electronAPI.getCurrentFinancialYear(companyId);
      await window.electronAPI.createWorkOrder({
        companyId, financialYearId: fy.id, ...data,
        expectedCompletion: data.expectedCompletion ? new Date(data.expectedCompletion) : undefined,
      });
      setSnackbar({ open: true, msg: 'Work order created', sev: 'success' });
      setCreateOpen(false); load();
      reset({ assetId: 0, engineerName: '', vendorName: '', expectedCompletion: '', remarks: '' });
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try { await window.electronAPI.updateWorkOrderStatus(id, status); setSnackbar({ open: true, msg: `Status updated to ${status}`, sev: 'success' }); load(); } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleAddSparePart = async () => {
    if (!selected) return;
    try {
      await window.electronAPI.addSparePartToWO(selected.id, { lineNumber: spareParts.length + 1, ...spareForm });
      setSnackbar({ open: true, msg: 'Spare part added', sev: 'success' });
      setAddSpareOpen(false); loadDetail(selected);
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleAddCost = async () => {
    if (!selected) return;
    try {
      await window.electronAPI.addWOCost(selected.id, costForm);
      setSnackbar({ open: true, msg: 'Cost added', sev: 'success' });
      setAddCostOpen(false); loadDetail(selected);
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handlePrintCompletion = () => {
    if (!selected) return;
    const completionNum = `WC-${selected.workOrderNumber?.replace('WO-', '') || Date.now()}`;
    const data = {
      completionNumber: completionNum,
      date: formatDateDDMMYYYY(new Date()),
      workOrderNumber: selected.workOrderNumber,
      department: selected.department || 'Maintenance',
      technicianName: selected.engineerName || '',
      workDescription: selected.remarks || '',
      items: spareParts.map((sp: any) => ({
        itemName: sp.itemName,
        itemCode: sp.itemCode || '',
        unitName: sp.unitName || 'Nos',
        quantityIssued: sp.quantity,
        quantityInstalled: sp.quantity,
        quantityReturned: 0,
        quantityDamaged: 0,
        quantityScrap: 0,
        installationLocation: '',
        remarks: '',
      })),
      overallRemarks: '',
    };
    setCompletionData(data);

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Work Completion Form - ${completionNum}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; color: #000; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header h2 { margin: 5px 0 0; font-size: 14px; color: #333; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 15px; }
  .info-grid div { padding: 3px 0; }
  .info-grid strong { display: inline-block; min-width: 120px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 10px; }
  th { background-color: #f0f0f0; font-weight: bold; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px; margin-top: 30px; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; font-size: 10px; }
  .remarks { margin-top: 15px; border: 1px solid #000; padding: 8px; min-height: 40px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <h1>WORK COMPLETION FORM</h1>
  <h2>Completion No: ${completionNum}</h2>
</div>
<div class="info-grid">
  <div><strong>Work Order Ref:</strong> ${selected.workOrderNumber || '-'}</div>
  <div><strong>Date:</strong> ${formatDateDDMMYYYY(new Date())}</div>
  <div><strong>Department:</strong> ${selected.department || 'Maintenance'}</div>
  <div><strong>Engineer:</strong> ${selected.engineerName || '-'}</div>
  <div><strong>Asset:</strong> ${selected.asset?.assetName || '-'}</div>
  <div><strong>Status:</strong> ${selected.status}</div>
</div>
<h3 style="margin:10px 0 5px;font-size:12px;">Items</h3>
<table>
  <thead><tr><th>#</th><th>Item</th><th>Qty Issued</th><th>Qty Installed</th><th>Returned</th><th>Damaged</th><th>Scrap</th><th>Location</th><th>Remarks</th></tr></thead>
  <tbody>
    ${data.items.map((item: any, i: number) => `<tr><td>${i + 1}</td><td>${item.itemName}</td><td>${item.quantityIssued}</td><td>${item.quantityInstalled}</td><td>${item.quantityReturned}</td><td>${item.quantityDamaged}</td><td>${item.quantityScrap}</td><td>${item.installationLocation || '-'}</td><td>${item.remarks || '-'}</td></tr>`).join('')}
    ${data.items.length === 0 ? '<tr><td colspan="9" style="text-align:center">No items</td></tr>' : ''}
  </tbody>
</table>
<div class="remarks"><strong>Remarks:</strong> ${data.overallRemarks || ''}</div>
<div class="signatures">
  <div class="sig-box"><div class="sig-line">Technician Signature</div></div>
  <div class="sig-box"><div class="sig-line">Store Incharge</div></div>
  <div class="sig-box"><div class="sig-line">Site Verification Officer</div></div>
  <div class="sig-box"><div class="sig-line">Maintenance Supervisor</div></div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleDocumentUploaded = (doc: any) => {
    setAttachedDocs(prev => [...prev, doc]);
    setSnackbar({ open: true, msg: 'Document attached successfully', sev: 'success' });
  };

  const handleDelayedEntrySubmit = async () => {
    if (!selected) return;
    try {
      await window.electronAPI.recordDelayedEntry({
        workOrderId: selected.id,
        ...delayedEntry,
      });
      setSnackbar({ open: true, msg: 'Delayed entry recorded', sev: 'success' });
      setDelayedEntryOpen(false);
      setDelayedEntry({
        completedDate: '', workDescription: '', locationDetails: '',
        departmentVerifiedBy: '', managerVerifiedBy: '', items: [], overallRemarks: '',
      });
      loadDetail(selected);
    } catch (e: any) {
      setSnackbar({ open: true, msg: e.message, sev: 'error' });
    }
  };

  const addDelayedItem = () => {
    setDelayedEntry(prev => ({
      ...prev,
      items: [...prev.items, {
        itemName: '', installedQty: 0, returnedQty: 0, damagedQty: 0,
        scrapQty: 0, location: '', remarks: '',
      }],
    }));
  };

  const updateDelayedItem = (index: number, field: string, value: any) => {
    setDelayedEntry(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const removeDelayedItem = (index: number) => {
    setDelayedEntry(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const statCards = [
    { label: 'Pending Approval', value: dashboard.pendingApproval || 0, color: 'info.main' },
    { label: 'In Progress', value: dashboard.inProgress || 0, color: 'warning.main' },
    { label: 'Completed Today', value: dashboard.completedToday || 0, color: 'success.main' },
    { label: 'Overdue', value: dashboard.overdue || 0, color: 'error.main' },
    { label: 'Total Cost', value: `₹${(dashboard.totalCost || 0).toLocaleString()}`, color: 'primary.main' },
  ];

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Work Orders</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map(s => (
          <Grid item xs={2.4} key={s.label}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color={s.color}>{s.value}</Typography>
              <Typography variant="body2" color="text.secondary">{s.label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Box display="flex" gap={2} mb={2}>
        <TextField size="small" placeholder="Search..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })}
          InputProps={{ startAdornment: <Search fontSize="small" /> }} sx={{ minWidth: 200 }} />
        <TextField size="small" select label="Status" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>New Work Order</Button>
      </Box>

      {loading ? <LinearProgress /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Work Order #</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell>Engineer</TableCell>
                <TableCell>Expected</TableCell>
                <TableCell>Completion</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workOrders.map(wo => (
                <TableRow key={wo.id} hover>
                  <TableCell><strong>{wo.workOrderNumber}</strong></TableCell>
                  <TableCell>{wo.asset?.assetName || '-'}</TableCell>
                  <TableCell>{wo.engineerName || '-'}</TableCell>
<TableCell>{wo.expectedCompletion ? formatDateDDMMYYYY(new Date(wo.expectedCompletion)) : '-'}</TableCell>
                   <TableCell>{wo.completionDate ? formatDateDDMMYYYY(new Date(wo.completionDate)) : '-'}</TableCell>
                  <TableCell><Chip size="small" label={wo.status} color={STATUS_COLORS[wo.status] as any} /></TableCell>
                  <TableCell>
                    <Tooltip title="View"><IconButton size="small" onClick={() => loadDetail(wo)}><Visibility fontSize="small" /></IconButton></Tooltip>
                    {wo.status === 'DRAFT' && <Tooltip title="Approve"><IconButton size="small" color="primary" onClick={() => handleStatusChange(wo.id, 'APPROVED')}><CheckCircle fontSize="small" /></IconButton></Tooltip>}
                    {wo.status === 'APPROVED' && <Tooltip title="Start"><IconButton size="small" color="warning" onClick={() => handleStatusChange(wo.id, 'IN_PROGRESS')}><PlayArrow fontSize="small" /></IconButton></Tooltip>}
                    {wo.status === 'IN_PROGRESS' && <Tooltip title="Complete"><IconButton size="small" color="success" onClick={() => handleStatusChange(wo.id, 'COMPLETED')}><CheckCircle fontSize="small" /></IconButton></Tooltip>}
                    {['DRAFT', 'APPROVED'].includes(wo.status) && <Tooltip title="Cancel"><IconButton size="small" color="error" onClick={() => setCancelTarget(wo)}><Cancel fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}
              {workOrders.length === 0 && <TableRow><TableCell colSpan={7} align="center">No work orders found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EnterpriseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Work Order"
        icon={<Build />}
        actions={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit(handleCreate)}>Create</Button>
          </>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField fullWidth select label="Asset" {...register('assetId', { valueAsNumber: true })} error={!!errors.assetId} helperText={errors.assetId?.message}>
              <MenuItem value={0}>Select Asset</MenuItem>
              {assets.map((a: any) => <MenuItem key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}><TextField fullWidth label="Engineer Name" {...register('engineerName')} error={!!errors.engineerName} helperText={errors.engineerName?.message} /></Grid>
          <Grid item xs={6}><TextField fullWidth label="Vendor Name" {...register('vendorName')} /></Grid>
          <Grid item xs={6}>
            <Controller name="expectedCompletion" control={control} render={({ field }) => (
              <DatePickerField fullWidth label="Expected Completion" value={field.value} onChange={field.onChange} />
            )} />
          </Grid>
          <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Remarks" {...register('remarks')} /></Grid>
        </Grid>
      </EnterpriseDialog>

      <EnterpriseDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Work Order Details"
        subtitle={selected?.workOrderNumber}
        maxWidth="lg"
        actions={
          <>
            {selected && ['IN_PROGRESS', 'COMPLETED'].includes(selected.status) && (
              <>
                <Button variant="outlined" startIcon={<Print />} onClick={handlePrintCompletion}>
                  Print Work Completion Form
                </Button>
                <Button variant="outlined" startIcon={<AttachFile />} onClick={() => setDocUploaderOpen(true)}>
                  Attach Document
                </Button>
                <Button variant="outlined" startIcon={<EditNote />} onClick={() => setDelayedEntryOpen(true)}>
                  Record Delayed Entry
                </Button>
              </>
            )}
            <Button onClick={() => setDetailOpen(false)}>Close</Button>
          </>
        }
      >
        {selected && (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={3}><Typography><strong>Asset:</strong> {selected.asset?.assetName}</Typography></Grid>
              <Grid item xs={3}><Typography><strong>Engineer:</strong> {selected.engineerName || '-'}</Typography></Grid>
              <Grid item xs={3}><Typography><strong>Vendor:</strong> {selected.vendorName || '-'}</Typography></Grid>
              <Grid item xs={3}><Typography><strong>Status:</strong> <Chip size="small" label={selected.status} color={STATUS_COLORS[selected.status] as any} /></Typography></Grid>
            </Grid>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label={`Spare Parts (${spareParts.length})`} />
              <Tab label={`Costs (${costs.length})`} />
              <Tab label={`Photos (${photos.length})`} />
              <Tab label="Cost Summary" />
            </Tabs>

            {tab === 0 && (
              <>
                <Button size="small" startIcon={<Add />} onClick={() => setAddSpareOpen(true)} sx={{ mb: 1 }}>Add Spare Part</Button>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>#</TableCell><TableCell>Item</TableCell><TableCell>Qty</TableCell><TableCell>Rate</TableCell><TableCell>Amount</TableCell></TableRow></TableHead>
                    <TableBody>
                      {spareParts.map((sp: any) => (
                        <TableRow key={sp.id}>
                          <TableCell>{sp.lineNumber}</TableCell>
                          <TableCell>{sp.itemName}</TableCell>
                          <TableCell>{sp.quantity}</TableCell>
                          <TableCell>₹{sp.rate}</TableCell>
                          <TableCell>₹{sp.amount}</TableCell>
                        </TableRow>
                      ))}
                      {spareParts.length === 0 && <TableRow><TableCell colSpan={5} align="center">No spare parts</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {tab === 1 && (
              <>
                <Button size="small" startIcon={<Add />} onClick={() => setAddCostOpen(true)} sx={{ mb: 1 }}>Add Cost</Button>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Amount</TableCell><TableCell>Description</TableCell><TableCell>Invoice #</TableCell></TableRow></TableHead>
                    <TableBody>
                      {costs.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell><Chip size="small" label={c.costType} /></TableCell>
                          <TableCell>₹{c.amount}</TableCell>
                          <TableCell>{c.description || '-'}</TableCell>
                          <TableCell>{c.invoiceNumber || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {costs.length === 0 && <TableRow><TableCell colSpan={4} align="center">No costs recorded</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {tab === 2 && (
              <Grid container spacing={1}>
                {photos.map((p: any) => (
                  <Grid item xs={3} key={p.id}>
                    <Card><CardContent>
                      <Typography variant="body2"><strong>{p.photoType}</strong></Typography>
                      <Typography variant="caption">{p.fileName}</Typography>
                    </CardContent></Card>
                  </Grid>
                ))}
                {photos.length === 0 && <Typography color="text.secondary">No photos</Typography>}
              </Grid>
            )}

            {tab === 3 && (
              <Card><CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={4}><Typography><strong>Parts:</strong> ₹{(costSummary.partsTotal || 0).toLocaleString()}</Typography></Grid>
                  <Grid item xs={4}><Typography><strong>Material:</strong> ₹{(costSummary.materialCost || 0).toLocaleString()}</Typography></Grid>
                  <Grid item xs={4}><Typography><strong>Labour:</strong> ₹{(costSummary.labourCost || 0).toLocaleString()}</Typography></Grid>
                  <Grid item xs={4}><Typography><strong>Vendor:</strong> ₹{(costSummary.vendorCost || 0).toLocaleString()}</Typography></Grid>
                  <Grid item xs={4}><Typography><strong>Travel:</strong> ₹{(costSummary.travelCost || 0).toLocaleString()}</Typography></Grid>
                  <Grid item xs={4}><Typography><strong>Misc:</strong> ₹{(costSummary.miscCost || 0).toLocaleString()}</Typography></Grid>
                  <Grid item xs={12}><Divider /><Typography variant="h6"><strong>Total: ₹{(costSummary.totalCost || 0).toLocaleString()}</strong></Typography></Grid>
                </Grid>
              </CardContent></Card>
            )}
          </>
        )}
      </EnterpriseDialog>

      <EnterpriseDialog
        open={addSpareOpen}
        onClose={() => setAddSpareOpen(false)}
        title="Add Spare Part"
        icon={<Add />}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={() => setAddSpareOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddSparePart} disabled={!spareForm.itemName}>Add</Button>
          </>
        }
      >
        <TextField fullWidth label="Item Name" value={spareForm.itemName} onChange={e => setSpareForm({ ...spareForm, itemName: e.target.value })} sx={{ mb: 2 }} />
        <TextField fullWidth label="Quantity" type="number" value={spareForm.quantity} onChange={e => setSpareForm({ ...spareForm, quantity: +e.target.value })} sx={{ mb: 2 }} />
        <TextField fullWidth label="Rate" type="number" value={spareForm.rate} onChange={e => setSpareForm({ ...spareForm, rate: +e.target.value })} />
      </EnterpriseDialog>

      <EnterpriseDialog
        open={addCostOpen}
        onClose={() => setAddCostOpen(false)}
        title="Add Cost"
        icon={<Add />}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={() => setAddCostOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddCost}>Add</Button>
          </>
        }
      >
        <TextField fullWidth select label="Cost Type" value={costForm.costType} onChange={e => setCostForm({ ...costForm, costType: e.target.value })} sx={{ mb: 2 }}>
          {COST_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="Amount" type="number" value={costForm.amount} onChange={e => setCostForm({ ...costForm, amount: +e.target.value })} sx={{ mb: 2 }} />
        <TextField fullWidth label="Description" value={costForm.description} onChange={e => setCostForm({ ...costForm, description: e.target.value })} sx={{ mb: 2 }} />
        <TextField fullWidth label="Invoice #" value={costForm.invoiceNumber} onChange={e => setCostForm({ ...costForm, invoiceNumber: e.target.value })} />
      </EnterpriseDialog>

      <EnterpriseDialog
        open={docUploaderOpen}
        onClose={() => setDocUploaderOpen(false)}
        title="Attach Document"
        icon={<AttachFile />}
        maxWidth="sm"
        actions={<Button onClick={() => setDocUploaderOpen(false)}>Close</Button>}
      >
        {selected && (
          <>
            <DocumentUploader
              sourceType="WorkOrder"
              sourceId={selected.id}
              onUploaded={handleDocumentUploaded}
            />
            {attachedDocs.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Attached Documents:</Typography>
                <List dense>
                  {attachedDocs.map((doc: any, i: number) => (
                    <ListItem key={i}>
                      <ListItemIcon><Description fontSize="small" /></ListItemIcon>
                      <ListItemText primary={doc.fileName} secondary={doc.fileType} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </>
        )}
      </EnterpriseDialog>

      <EnterpriseDialog
        open={delayedEntryOpen}
        onClose={() => setDelayedEntryOpen(false)}
        title="Record Delayed Entry"
        icon={<EditNote />}
        maxWidth="lg"
        actions={
          <>
            <Button onClick={() => setDelayedEntryOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleDelayedEntrySubmit}>Submit</Button>
          </>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <DatePickerField
              fullWidth size="small" label="Completed Date"
              value={delayedEntry.completedDate}
              onChange={v => setDelayedEntry({ ...delayedEntry, completedDate: v })}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              fullWidth size="small" label="Department Verified By"
              value={delayedEntry.departmentVerifiedBy}
              onChange={e => setDelayedEntry({ ...delayedEntry, departmentVerifiedBy: e.target.value })}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              fullWidth size="small" label="Manager Verified By"
              value={delayedEntry.managerVerifiedBy}
              onChange={e => setDelayedEntry({ ...delayedEntry, managerVerifiedBy: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline rows={2} label="Work Description"
              value={delayedEntry.workDescription}
              onChange={e => setDelayedEntry({ ...delayedEntry, workDescription: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Location Details"
              value={delayedEntry.locationDetails}
              onChange={e => setDelayedEntry({ ...delayedEntry, locationDetails: e.target.value })}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, mb: 1 }}>
          <Button size="small" startIcon={<Add />} onClick={addDelayedItem}>Add Item</Button>
        </Box>
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Installed Qty</TableCell>
                <TableCell>Returned Qty</TableCell>
                <TableCell>Damaged Qty</TableCell>
                <TableCell>Scrap Qty</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {delayedEntry.items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <TextField size="small" value={item.itemName} onChange={e => updateDelayedItem(i, 'itemName', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={item.installedQty} onChange={e => updateDelayedItem(i, 'installedQty', +e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={item.returnedQty} onChange={e => updateDelayedItem(i, 'returnedQty', +e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={item.damagedQty} onChange={e => updateDelayedItem(i, 'damagedQty', +e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={item.scrapQty} onChange={e => updateDelayedItem(i, 'scrapQty', +e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={item.location} onChange={e => updateDelayedItem(i, 'location', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={item.remarks} onChange={e => updateDelayedItem(i, 'remarks', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeDelayedItem(i)}><Cancel fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {delayedEntry.items.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center">No items added</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TextField
          fullWidth size="small" multiline rows={2} label="Overall Remarks"
          value={delayedEntry.overallRemarks}
          onChange={e => setDelayedEntry({ ...delayedEntry, overallRemarks: e.target.value })}
        />
      </EnterpriseDialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.sev}>{snackbar.msg}</Alert>
      </Snackbar>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Work Order"
        message={`Cancel work order ${cancelTarget?.workOrderNumber || ''}? This cannot be reversed.`}
        confirmText="Cancel Work Order"
        confirmColor="error"
        onConfirm={() => {
          if (cancelTarget) {
            handleStatusChange(cancelTarget.id, 'CANCELLED');
            setCancelTarget(null);
          }
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </Box>
  );
}
