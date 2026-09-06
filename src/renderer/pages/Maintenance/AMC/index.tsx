import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Grid, Card, CardContent,
  Alert, Snackbar, Tabs, Tab, Tooltip, LinearProgress, FormHelperText
} from '@mui/material';
import { Add, Visibility, Cancel, Search } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import DatePickerField from '../../../components/DatePickerField';
import StatusBadge from '../../../components/StatusBadge';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';

declare global { interface Window { electronAPI: any } }

const COVERAGES = ['FULL', 'PARTIAL', 'COMPREHENSIVE'];
const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'];

const amcSchema = z.object({
  assetId: z.number().min(1, 'Asset is required'),
  vendorId: z.number().min(1, 'Vendor is required'),
  vendorName: z.string(),
  agreementNumber: z.string().min(1, 'Agreement number is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  coverage: z.string(),
  totalVisits: z.number().min(1),
  totalCost: z.number().min(0),
  remarks: z.string(),
});
type AMCFormData = z.infer<typeof amcSchema>;

export default function AMCPage() {
  const [amcs, setAmcs] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState({ status: '', search: '' });
  const { register, handleSubmit, reset, watch, control, formState: { errors, isValid } } = useForm<AMCFormData>({
    resolver: zodResolver(amcSchema),
    mode: 'onChange',
    defaultValues: { assetId: 0, vendorId: 0, vendorName: '', agreementNumber: '', startDate: '', endDate: '', coverage: 'FULL', totalVisits: 0, totalCost: 0, remarks: '' },
  });
  const [scheduleForm, setScheduleForm] = useState({ assetId: 0, serviceType: 'PREVENTIVE', frequency: 'MONTHLY', customDays: 30, remarks: '' });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [createScheduleOpen, setCreateScheduleOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', sev: 'success' as any });

  const load = async () => {
    setLoading(true);
    const companyId = 1;
    const [amcList, asts] = await Promise.all([
      window.electronAPI.listAMCs({ companyId, ...filter }),
      window.electronAPI.searchAssets({ companyId }),
    ]);
    setAmcs(amcList || []); setAssets(asts?.data || asts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const loadDetail = async (amc: any) => {
    setSelected(amc); setTab(0); setDetailOpen(true);
  };

  const handleCreate = async (data: AMCFormData) => {
    try {
      const companyId = 1;
      await window.electronAPI.createAMC({
        companyId, ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      });
      setSnackbar({ open: true, msg: 'AMC created', sev: 'success' });
      setCreateOpen(false); reset({ assetId: 0, vendorId: 0, vendorName: '', agreementNumber: '', startDate: '', endDate: '', coverage: 'FULL', totalVisits: 0, totalCost: 0, remarks: '' }); load();
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleCancel = async (id: number) => {
    try { await window.electronAPI.cancelAMC(id); setSnackbar({ open: true, msg: 'AMC cancelled', sev: 'success' }); load(); } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleCreateSchedule = async () => {
    try {
      const companyId = 1;
      await window.electronAPI.createServiceSchedule({ companyId, ...scheduleForm });
      setSnackbar({ open: true, msg: 'Schedule created', sev: 'success' });
      setCreateScheduleOpen(false);
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">AMC & Service Schedules</Typography>
        <Box display="flex" gap={1}>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>New AMC</Button>
          <Button variant="outlined" startIcon={<Add />} onClick={() => setCreateScheduleOpen(true)}>New Schedule</Button>
        </Box>
      </Box>

      <Box display="flex" gap={2} mb={2}>
        <TextField size="small" select label="Status" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="EXPIRED">Expired</MenuItem>
          <MenuItem value="CANCELLED">Cancelled</MenuItem>
        </TextField>
      </Box>

      {loading ? <LinearProgress /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Agreement #</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Coverage</TableCell>
                <TableCell>Cost</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {amcs.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell><strong>{a.agreementNumber || '-'}</strong></TableCell>
                  <TableCell>{a.asset?.assetName || '-'}</TableCell>
                  <TableCell>{a.vendorName || '-'}</TableCell>
                  <TableCell>{formatDateDDMMYYYY(new Date(a.startDate))}</TableCell>
                  <TableCell>{formatDateDDMMYYYY(new Date(a.endDate))}</TableCell>
                  <TableCell><Chip size="small" label={a.coverage || '-'} /></TableCell>
                  <TableCell>₹{(a.totalCost || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={a.status || 'UNKNOWN'} /></TableCell>
                  <TableCell>
                    <Tooltip title="View"><IconButton size="small" onClick={() => loadDetail(a)}><Visibility fontSize="small" /></IconButton></Tooltip>
                    {a.status === 'ACTIVE' && <Tooltip title="Cancel"><IconButton size="small" color="error" onClick={() => handleCancel(a.id)}><Cancel fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}
              {amcs.length === 0 && <TableRow><TableCell colSpan={9} align="center">No AMC agreements</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create AMC Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New AMC Agreement</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField fullWidth select label="Asset" {...register('assetId', { valueAsNumber: true })} value={watch('assetId') || ''} error={!!errors.assetId} helperText={errors.assetId?.message}>
                <MenuItem value={0}>Select</MenuItem>
                {assets.map((a: any) => <MenuItem key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}><TextField fullWidth label="Vendor Name" {...register('vendorName')} error={!!errors.vendorName} helperText={errors.vendorName?.message} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Agreement Number" {...register('agreementNumber')} error={!!errors.agreementNumber} helperText={errors.agreementNumber?.message} /></Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Coverage" {...register('coverage')}>
                {COVERAGES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <Controller name="startDate" control={control} render={({ field }) => (
                <DatePickerField fullWidth label="Start Date" value={field.value} onChange={field.onChange} error={!!errors.startDate} helperText={errors.startDate?.message} />
              )} />
            </Grid>
            <Grid item xs={6}>
              <Controller name="endDate" control={control} render={({ field }) => (
                <DatePickerField fullWidth label="End Date" value={field.value} onChange={field.onChange} error={!!errors.endDate} helperText={errors.endDate?.message} />
              )} />
            </Grid>
            <Grid item xs={6}><TextField fullWidth label="Total Visits" type="number" {...register('totalVisits', { valueAsNumber: true })} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Total Cost" type="number" {...register('totalCost', { valueAsNumber: true })} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Remarks" {...register('remarks')} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit(handleCreate)} disabled={!isValid}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>AMC Details</DialogTitle>
        <DialogContent>
          {selected && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}><Typography><strong>Agreement #:</strong> {selected.agreementNumber || '-'}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>Asset:</strong> {selected.asset?.assetName}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>Vendor:</strong> {selected.vendorName || '-'}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>Coverage:</strong> {selected.coverage}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>Start:</strong> {formatDateDDMMYYYY(new Date(selected.startDate))}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>End:</strong> {formatDateDDMMYYYY(new Date(selected.endDate))}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>Visits:</strong> {selected.visitsUsed || 0} / {selected.totalVisits || '-'}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>Cost:</strong> ₹{(selected.totalCost || 0).toLocaleString()}</Typography></Grid>
              <Grid item xs={6}><Typography><strong>Status:</strong> <Chip size="small" label={selected.status} color={selected.status === 'ACTIVE' ? 'success' : 'default'} /></Typography></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Schedule Dialog */}
      <Dialog open={createScheduleOpen} onClose={() => setCreateScheduleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Service Schedule</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField fullWidth select label="Asset" value={scheduleForm.assetId} onChange={e => setScheduleForm({ ...scheduleForm, assetId: +e.target.value })}>
                {assets.map((a: any) => <MenuItem key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}><TextField fullWidth label="Service Type" value={scheduleForm.serviceType} onChange={e => setScheduleForm({ ...scheduleForm, serviceType: e.target.value })} /></Grid>
            <Grid item xs={6}>
              <TextField fullWidth select label="Frequency" value={scheduleForm.frequency} onChange={e => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}>
                {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
            </Grid>
            {scheduleForm.frequency === 'CUSTOM' && (
              <Grid item xs={6}><TextField fullWidth label="Custom Days" type="number" value={scheduleForm.customDays} onChange={e => setScheduleForm({ ...scheduleForm, customDays: +e.target.value })} /></Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateScheduleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSchedule} disabled={!scheduleForm.assetId}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.sev}>{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
