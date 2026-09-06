import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Chip, IconButton, TextField, MenuItem, Grid, Card, CardContent, Tooltip,
  Button, LinearProgress,
} from '@mui/material';
import { Refresh, Visibility, Search, FactCheck } from '@mui/icons-material';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import DatePickerField from '../../../components/DatePickerField';
import { useCompany } from '../../../context/CompanyContext';
import { formatDateTimeDDMMYYYY } from '../../../utils/dateUtils';

interface AuditLogEntry {
  id: number;
  userId?: number;
  action: string;
  tableName: string;
  recordId?: number;
  oldValues?: string;
  newValues?: string;
  description?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { id: number; username: string; fullName: string; role: string };
}

interface AuditStats {
  totalLogs: number;
  actionCounts: Array<{ action: string; _count: { action: number } }>;
  tableCounts: Array<{ tableName: string; _count: { tableName: number } }>;
  recentLogs: AuditLogEntry[];
}

const ACTION_COLORS: Record<string, 'success' | 'error' | 'warning' | 'info' | 'primary'> = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'error', LOGIN: 'primary', LOGOUT: 'warning',
  IMPORT: 'info', EXPORT: 'info', APPROVE: 'success', REJECT: 'error',
  FY_CLOSING: 'warning', FY_REOPEN: 'warning', BACKUP: 'info', RESTORE: 'info',
  STOCK_MOVEMENT: 'info', ROLE_CHANGE: 'warning', PERMISSION_CHANGE: 'warning', FORCE_LOGOUT: 'error',
};

export default function AuditLogsPage() {
  const { company } = useCompany();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const [filterAction, setFilterAction] = useState('');
  const [filterTable, setFilterTable] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  const companyId = company?.id || 1;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = { companyId, page: page + 1, pageSize };
      if (filterAction) filter.action = filterAction;
      if (filterTable) filter.tableName = filterTable;
      if (filterFrom) filter.fromDate = filterFrom;
      if (filterTo) filter.toDate = filterTo;
      const result = await window.electronAPI.findAuditLogs(filter);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, page, pageSize, filterAction, filterTable, filterFrom, filterTo]);

  const fetchStats = async () => {
    try {
      const s = await window.electronAPI.getAuditStats(companyId);
      setStats(s);
    } catch (err) { console.error('Failed to load audit stats', err); }
  };

  const fetchActionTypes = async () => {
    try {
      const types = await window.electronAPI.getAuditActionTypes();
      setActionTypes(types);
    } catch (err) { console.error('Failed to load action types', err); }
  };

  useEffect(() => { fetchLogs(); fetchStats(); fetchActionTypes(); }, [fetchLogs]);

  const handleViewDetail = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const formatDate = (d: string) => formatDateTimeDDMMYYYY(d);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Audit Logs</Typography>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary">Total Entries</Typography>
              <Typography variant="h4">{stats.totalLogs.toLocaleString()}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary">Actions Tracked</Typography>
              <Typography variant="h4">{stats.actionCounts.length}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary">Tables Tracked</Typography>
              <Typography variant="h4">{stats.tableCounts.length}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary">Recent (24h)</Typography>
              <Typography variant="h4">
                {stats.recentLogs.filter((l) => Date.now() - new Date(l.createdAt).getTime() < 86400000).length}
              </Typography>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Action" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <MenuItem value="">All Actions</MenuItem>
              {actionTypes.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField fullWidth size="small" label="Table" value={filterTable} onChange={(e) => setFilterTable(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={2}>
            <DatePickerField fullWidth size="small" label="From" value={filterFrom} onChange={(v) => setFilterFrom(v)} />
          </Grid>
          <Grid item xs={12} md={2}>
            <DatePickerField fullWidth size="small" label="To" value={filterTo} onChange={(v) => setFilterTo(v)} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button variant="contained" startIcon={<Search />} onClick={fetchLogs} fullWidth>Search</Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => { setFilterAction(''); setFilterTable(''); setFilterFrom(''); setFilterTo(''); }} fullWidth>Clear</Button>
          </Grid>
        </Grid>
      </Paper>

      {loading && <LinearProgress />}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Table</TableCell>
              <TableCell>Record ID</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>IP</TableCell>
              <TableCell align="right">Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>{formatDate(log.createdAt)}</TableCell>
                <TableCell>{log.user?.fullName || log.user?.username || '-'}</TableCell>
                <TableCell>
                  <Chip label={log.action} size="small" color={ACTION_COLORS[log.action] || 'default'} />
                </TableCell>
                <TableCell>{log.tableName}</TableCell>
                <TableCell>{log.recordId || '-'}</TableCell>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.description || '-'}
                </TableCell>
                <TableCell>{log.ipAddress || '-'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => handleViewDetail(log)}>
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center">No audit logs found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
        rowsPerPage={pageSize} onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50, 100]} />

      <EnterpriseDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Audit Log Details"
        icon={<FactCheck />}
        maxWidth="md"
        actions={
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        }
      >
        {selectedLog && (
          <Box sx={{ pt: 1 }}>
            <Typography><strong>Action:</strong> <Chip label={selectedLog.action} size="small" color={ACTION_COLORS[selectedLog.action] || 'default'} /></Typography>
            <Typography sx={{ mt: 1 }}><strong>Table:</strong> {selectedLog.tableName}</Typography>
            <Typography><strong>Record ID:</strong> {selectedLog.recordId || 'N/A'}</Typography>
            <Typography><strong>User:</strong> {selectedLog.user?.fullName || selectedLog.user?.username || 'System'}</Typography>
            <Typography><strong>Time:</strong> {formatDate(selectedLog.createdAt)}</Typography>
            <Typography><strong>Description:</strong> {selectedLog.description || 'N/A'}</Typography>
            {selectedLog.oldValues && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Old Values:</Typography>
                <Paper sx={{ p: 1, bgcolor: 'grey.100', maxHeight: 200, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 12 }}>{(() => { try { return JSON.stringify(JSON.parse(selectedLog.oldValues), null, 2); } catch { return selectedLog.oldValues || '{}'; } })()}</pre>
                </Paper>
              </Box>
            )}
            {selectedLog.newValues && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">New Values:</Typography>
                <Paper sx={{ p: 1, bgcolor: 'grey.100', maxHeight: 200, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 12 }}>{(() => { try { return JSON.stringify(JSON.parse(selectedLog.newValues), null, 2); } catch { return selectedLog.newValues || '{}'; } })()}</pre>
                </Paper>
              </Box>
            )}
          </Box>
        )}
      </EnterpriseDialog>
    </Box>
  );
}
