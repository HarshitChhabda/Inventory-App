import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Alert, Chip, alpha, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tab, Tabs, Divider,
  IconButton, Tooltip, LinearProgress, Card, CardContent, Grid,
} from '@mui/material';
import {
  CloudUpload, FileDownload, FileUpload, TableChart, Description,
  Inventory, Info, Warning, CheckCircle, Error, Undo, Refresh,
  Assessment, History, Preview, Download,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { formatDateDDMMYYYY, todayISO } from '../../utils/dateUtils';
import { downloadBuffer } from '../../utils/importExport';
import { useCompany } from '../../context/CompanyContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';

interface ImportConfig {
  model: string;
  tableName: string;
  matchField: string;
  template: {
    name: string;
    description: string;
    columns: Array<{
      key: string;
      header: string;
      required: boolean;
      type: string;
      sample?: string;
    }>;
  };
}

interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: Array<{
    row: number;
    column: string;
    value: any;
    error: string;
    severity: string;
  }>;
  warnings: Array<{
    row: number;
    column: string;
    value: any;
    warning: string;
  }>;
  preview: any[];
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  failedRows: number;
  errors: Array<{
    row: number;
    column: string;
    value: any;
    error: string;
    severity: string;
  }>;
  errorExcelPath?: string;
  importHistoryId?: number;
}

export default function ImportCenterPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { company, financialYear } = useCompany();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedModel, setSelectedModel] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [resultDialog, setResultDialog] = useState(false);

  // Fetch import configs
  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ['importConfigs'],
    queryFn: () => window.electronAPI.getImportConfigs(),
  });

  // Fetch import history
  const { data: importHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['importHistory', company?.id],
    queryFn: () => window.electronAPI.listImportHistory(company!.id),
    enabled: !!company?.id,
  });

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setProcessing(true);
    setValidationResult(null);
    setImportResult(null);

    try {
      const buffer = await window.electronAPI.readFileBuffer((file as any).path);
      const parsed = await window.electronAPI.parseImportFile(buffer, file.name);
      
      if (parsed.rows.length === 0) {
        toast.error('No data found in file');
        return;
      }

      setImportHeaders(parsed.headers);
      setImportRows(parsed.rows);
      toast.success(`Loaded ${parsed.rows.length} rows from ${file.name}`);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to read file'));
    } finally {
      setProcessing(false);
    }
  }, []);

  // Validate import data
  const handleValidate = useCallback(async () => {
    if (!selectedModel || !company?.id || importRows.length === 0) {
      toast.error('Select a model and load data first');
      return;
    }

    setProcessing(true);
    try {
      const result = await window.electronAPI.validateImportV2(selectedModel, importRows, company.id);
      setValidationResult(result);

      if (result.valid) {
        toast.success(`Validation passed: ${result.validRows} rows ready to import`);
      } else {
        toast.error(`Validation failed: ${result.errorRows} rows have errors`);
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Validation failed'));
    } finally {
      setProcessing(false);
    }
  }, [selectedModel, company?.id, importRows]);

  // Execute import
  const handleImport = useCallback(async () => {
    if (!selectedModel || !company?.id || !financialYear?.id || importRows.length === 0) {
      toast.error('Select a model, load data, and ensure company/FY are selected');
      return;
    }

    setProcessing(true);
    try {
      // Create pre-import backup
      await window.electronAPI.createPreImportBackup(selectedModel, importRows.length);

      const result = await window.electronAPI.executeImportV2(
        selectedModel,
        importRows,
        company.id,
        financialYear.id
      );

      setImportResult(result);
      setResultDialog(true);

      if (result.success) {
        toast.success(`Import completed: ${result.importedRows} rows imported`);
        queryClient.invalidateQueries({ queryKey: ['importHistory'] });
      } else {
        toast.error(`Import failed: ${result.failedRows} rows failed`);
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Import failed'));
    } finally {
      setProcessing(false);
    }
  }, [selectedModel, company?.id, financialYear?.id, importRows]);

  // Download template
  const handleDownloadTemplate = useCallback(async (model: string) => {
    try {
      const buffer = await window.electronAPI.generateImportTemplateV2(model);
      downloadBuffer(buffer, `import-template-${model}.xlsx`);
      toast.success('Template downloaded');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to download template'));
    }
  }, []);

  // Rollback import
  const handleRollback = useCallback(async (importHistoryId: number) => {
    if (!company?.id || !financialYear?.id) return;

    if (!confirm('Are you sure you want to rollback this import? This will create reversal entries to undo all changes.')) {
      return;
    }

    try {
      const result = await window.electronAPI.rollbackImportV2(importHistoryId, company.id, financialYear.id);
      toast.success(`Rollback completed: ${result.reversed} transactions reversed`);
      queryClient.invalidateQueries({ queryKey: ['importHistory'] });
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Rollback failed'));
    }
  }, [company?.id, financialYear?.id]);

  // Download error Excel
  const handleDownloadErrors = useCallback(async (filePath: string) => {
    try {
      const buffer = await window.electronAPI.downloadErrorExcel(filePath);
      downloadBuffer(buffer, `import-errors-${Date.now()}.xlsx`);
      toast.success('Error report downloaded');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to download errors'));
    }
  }, []);

  // Reset state
  const handleReset = useCallback(() => {
    setSelectedModel('');
    setImportFile(null);
    setImportRows([]);
    setImportHeaders([]);
    setValidationResult(null);
    setImportResult(null);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Box>
      <PageHeader
        title="Import Center"
        subtitle="Import data from Excel/CSV files with validation and rollback support"
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleReset}
            >
              Reset
            </Button>
          </Stack>
        }
      />

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Import Data" icon={<CloudUpload />} iconPosition="start" />
        <Tab label="Import Templates" icon={<Description />} iconPosition="start" />
        <Tab label="Import History" icon={<History />} iconPosition="start" />
      </Tabs>

      {/* Import Data Tab */}
      {activeTab === 0 && (
        <Box>
          <Grid container spacing={2}>
            {/* Step 1: Select Model */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Step 1: Select Import Type
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Import Type</InputLabel>
                    <Select
                      value={selectedModel}
                      label="Import Type"
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        handleReset();
                      }}
                    >
                      {configs?.map((config: ImportConfig) => (
                        <MenuItem key={config.model} value={config.model}>
                          {config.template.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedModel && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Match by: {configs?.find((c: ImportConfig) => c.model === selectedModel)?.matchField}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Step 2: Upload File */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Step 2: Upload File
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<FileUpload />}
                    fullWidth
                    disabled={!selectedModel}
                  >
                    Choose Excel/CSV
                    <input
                      type="file"
                      hidden
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                    />
                  </Button>
                  {importFile && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      {importFile.name} ({formatSize(importFile.size)})
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Step 3: Validate & Import */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Step 3: Validate & Import
                  </Typography>
                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<Assessment />}
                      onClick={handleValidate}
                      disabled={!selectedModel || importRows.length === 0 || processing}
                      fullWidth
                    >
                      Validate Data
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={processing ? <CircularProgress size={16} /> : <CloudUpload />}
                      onClick={handleImport}
                      disabled={!selectedModel || importRows.length === 0 || processing}
                      fullWidth
                    >
                      {processing ? 'Processing...' : 'Import Data'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Validation Results */}
          {validationResult && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Validation Results
              </Typography>
              <Stack direction="row" spacing={2} mb={2}>
                <Chip
                  label={`Total: ${validationResult.totalRows}`}
                  color="default"
                  variant="outlined"
                />
                <Chip
                  label={`Valid: ${validationResult.validRows}`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  label={`Errors: ${validationResult.errorRows}`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  label={`Duplicates: ${validationResult.duplicateRows}`}
                  color="warning"
                  variant="outlined"
                />
              </Stack>

              <LinearProgress
                variant="determinate"
                value={(validationResult.validRows / validationResult.totalRows) * 100}
                color={validationResult.valid ? 'success' : 'error'}
                sx={{ mb: 2 }}
              />

              {validationResult.errors.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {validationResult.errors.slice(0, 5).map((err, idx) => (
                    <div key={idx}>Row {err.row}, {err.column}: {err.error}</div>
                  ))}
                  {validationResult.errors.length > 5 && (
                    <div>... and {validationResult.errors.length - 5} more errors</div>
                  )}
                </Alert>
              )}

              {validationResult.warnings.length > 0 && (
                <Alert severity="warning">
                  {validationResult.warnings.slice(0, 3).map((warn, idx) => (
                    <div key={idx}>Row {warn.row}, {warn.column}: {warn.warning}</div>
                  ))}
                </Alert>
              )}
            </Paper>
          )}

          {/* Data Preview */}
          {importRows.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Data Preview: {importRows.length} rows
                </Typography>
                <Button
                  size="small"
                  startIcon={<Preview />}
                  onClick={() => setPreviewDialog(true)}
                >
                  Full Preview
                </Button>
              </Stack>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {importHeaders.map((header) => (
                        <TableCell key={header} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                          {header}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importRows.slice(0, 10).map((row, idx) => (
                      <TableRow key={idx}>
                        {importHeaders.map((header) => (
                          <TableCell key={header} sx={{ fontSize: '0.75rem' }}>
                            {String(row[header] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {importRows.length > 10 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Showing first 10 rows of {importRows.length} total
                </Typography>
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* Import Templates Tab */}
      {activeTab === 1 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Download import templates to see the correct Excel format for each data type.
            Templates include column names, sample data, and instructions.
          </Alert>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Columns</TableCell>
                  <TableCell>Match By</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {configsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <TableSkeleton rows={5} columns={5} />
                    </TableCell>
                  </TableRow>
                ) : (
                  configs?.map((config: ImportConfig) => (
                    <TableRow key={config.model} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Box sx={{
                            width: 32, height: 32, borderRadius: 1.5,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Inventory sx={{ fontSize: 16, color: 'primary.main' }} />
                          </Box>
                          <Typography fontWeight={500}>{config.template.name}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {config.template.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${config.template.columns.length} columns`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {config.matchField}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<FileDownload />}
                          onClick={() => handleDownloadTemplate(config.model)}
                        >
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Import History Tab */}
      {activeTab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            View past imports and rollback if needed. Rollback will undo all changes made by that import.
          </Alert>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>File / Type</TableCell>
                  <TableCell>Import Type</TableCell>
                  <TableCell align="right">Total Rows</TableCell>
                  <TableCell align="right">Imported</TableCell>
                  <TableCell align="right">Errors</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <TableSkeleton rows={5} columns={8} />
                    </TableCell>
                  </TableRow>
                ) : importHistory?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        icon={<History />}
                        title="No import history"
                        description="No imports have been recorded yet"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  importHistory?.map((record: any) => (
                    <TableRow key={record.id} hover>
                      <TableCell>
                        <Typography fontWeight={500} fontSize="0.8125rem">
                          {record.fileName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={record.importType} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {record.rowCount}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', color: 'success.main' }}>
                        {record.importedCount}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', color: 'error.main' }}>
                        {record.errorCount || 0}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={record.status}
                          size="small"
                          color={record.status === 'completed' ? 'success' : record.status === 'partial' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{formatDateDDMMYYYY(record.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Rollback this import">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleRollback(record.id)}
                          >
                            <Undo fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Preview />
            <Typography variant="h6">Data Preview</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {importHeaders.map((header) => (
                    <TableCell key={header} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {importRows.map((row, idx) => (
                  <TableRow key={idx}>
                    {importHeaders.map((header) => (
                      <TableCell key={header} sx={{ fontSize: '0.75rem' }}>
                        {String(row[header] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={resultDialog} onClose={() => setResultDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            {importResult?.success ? (
              <CheckCircle color="success" />
            ) : (
              <Error color="error" />
            )}
            <Typography variant="h6">
              Import {importResult?.success ? 'Completed' : 'Failed'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {importResult && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <Chip label={`Total: ${importResult.totalRows}`} />
                <Chip label={`Imported: ${importResult.importedRows}`} color="success" />
                <Chip label={`Failed: ${importResult.failedRows}`} color="error" />
                <Chip label={`Skipped: ${importResult.skippedRows}`} />
              </Stack>

              {importResult.errors.length > 0 && (
                <Alert severity="error">
                  {importResult.errors.slice(0, 5).map((err, idx) => (
                    <div key={idx}>Row {err.row}: {err.error}</div>
                  ))}
                </Alert>
              )}

              {importResult.errorExcelPath && (
                <Button
                  variant="outlined"
                  startIcon={<FileDownload />}
                  onClick={() => handleDownloadErrors(importResult.errorExcelPath!)}
                >
                  Download Error Report
                </Button>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
