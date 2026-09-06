import React, { useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Grid, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, LinearProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import { CheckCircle, ErrorOutline, Warning, Refresh, PlayArrow } from '@mui/icons-material';
import { useCompany } from '../../../context/CompanyContext';
import { formatDateTimeDDMMYYYY } from '../../../utils/dateUtils';

interface IntegrityCheck {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  count?: number;
}

interface AuditSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  checks: IntegrityCheck[];
}

const STATUS_CONFIG: Record<string, { color: 'success' | 'error' | 'warning'; icon: React.ReactNode }> = {
  PASS: { color: 'success', icon: <CheckCircle /> },
  FAIL: { color: 'error', icon: <ErrorOutline /> },
  WARNING: { color: 'warning', icon: <Warning /> },
};

export default function IntegrityPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getIntegritySummary(companyId);
      setSummary(result);
      setLastRun(formatDateTimeDDMMYYYY(new Date()));
    } catch (err) {
      console.error('Integrity audit failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Data Integrity Auditor</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {lastRun && <Typography variant="body2" color="textSecondary">Last run: {lastRun}</Typography>}
          <Button variant="contained" startIcon={loading ? <Refresh /> : <PlayArrow />} onClick={runAudit} disabled={loading}>
            {loading ? 'Running...' : 'Run Full Audit'}
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Alert severity="info" sx={{ mb: 3 }}>
        This auditor checks for negative stock, orphan transactions, duplicate vouchers, stock-ledger mismatches,
        referential integrity, and more. Run regularly to ensure data consistency.
      </Alert>

      {summary && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card><CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3">{summary.total}</Typography>
                <Typography color="textSecondary">Total Checks</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: 'success.light' }}><CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="success.dark">{summary.passed}</Typography>
                <Typography color="success.dark">Passed</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: summary.failed > 0 ? 'error.light' : 'grey.100' }}><CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color={summary.failed > 0 ? 'error.dark' : 'textSecondary'}>{summary.failed}</Typography>
                <Typography color={summary.failed > 0 ? 'error.dark' : 'textSecondary'}>Failed</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: summary.warnings > 0 ? 'warning.light' : 'grey.100' }}><CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color={summary.warnings > 0 ? 'warning.dark' : 'textSecondary'}>{summary.warnings}</Typography>
                <Typography color={summary.warnings > 0 ? 'warning.dark' : 'textSecondary'}>Warnings</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          {summary.failed > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {summary.failed} integrity check(s) failed. Review and resolve issues below.
            </Alert>
          )}
          {summary.failed === 0 && summary.warnings === 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              All integrity checks passed. System data is consistent.
            </Alert>
          )}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Check</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell align="right">Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.checks.map((check) => (
                  <TableRow key={check.check} hover sx={{ bgcolor: check.status === 'FAIL' ? 'error.light' : check.status === 'WARNING' ? 'warning.light' : undefined }}>
                    <TableCell><strong>{check.check}</strong></TableCell>
                    <TableCell>
                      <Chip icon={STATUS_CONFIG[check.status].icon as React.ReactElement} label={check.status}
                        color={STATUS_CONFIG[check.status].color} size="small" />
                    </TableCell>
                    <TableCell>{check.details}</TableCell>
                    <TableCell align="right">{check.count ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {!summary && !loading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>Run your first data integrity audit</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Click the button above to check for data consistency issues across the system.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
