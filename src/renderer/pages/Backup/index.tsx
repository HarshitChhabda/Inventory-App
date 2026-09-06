import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Alert, Chip, alpha, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Tab, Tabs, Divider,
  IconButton, Tooltip, Grid,
} from '@mui/material';
import {
  Backup, Restore, FolderOpen, CloudUpload, FileDownload, FileUpload,
  TableChart, Description, Inventory, Info, HomeWork, Delete, Warning,
  Storage, LocationOn, Schedule, ContentCopy,
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
import { GuideButton } from '../../components/GuideSystem';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../components/ImportProgressDialog';

export default function BackupPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { company, financialYear } = useCompany();
  const [importDialog, setImportDialog] = useState(false);
  const [importModel, setImportModel] = useState('');
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [backupInfoDialog, setBackupInfoDialog] = useState(false);
  const [openingStockRows, setOpeningStockRows] = useState<any[]>([]);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);
  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => window.electronAPI.listBackups(),
  });

  const { data: storageInfo } = useQuery({
    queryKey: ['storageInfo'],
    queryFn: () => window.electronAPI.getStorageInfo(),
  });

  const { data: tables } = useQuery({
    queryKey: ['importTables'],
    queryFn: () => window.electronAPI.getImportTables(),
  });

  const { data: backupInfo, isLoading: backupInfoLoading } = useQuery({
    queryKey: ['backupInfo'],
    queryFn: () => window.electronAPI.getBackupInfo(),
  });

  const [locationGuideOpen, setLocationGuideOpen] = useState(false);

  // Load import history
  const loadImportHistory = async (signal?: AbortSignal) => {
    if (!company?.id) return;
    try {
      const history = await window.electronAPI.listImportHistory(company.id);
      if (!signal?.aborted) setImportHistory(history);
    } catch (err) {
      console.error('Failed to load import history:', err);
    }
  };

  // Load history on mount and when company changes
  React.useEffect(() => {
    const controller = new AbortController();
    loadImportHistory(controller.signal);
    return () => controller.abort();
  }, [company?.id]);

  const createBackupMutation = useMutation({
    mutationFn: () => window.electronAPI.createBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup created successfully!');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to create backup'));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (path: string) => window.electronAPI.restoreBackup(path),
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to restore backup'));
    },
  });

  const exportAllMutation = useMutation({
    mutationFn: async () => {
      const buffer = await window.electronAPI.exportAllTablesComplete();
      downloadBuffer(buffer, `inventory-complete-backup-${todayISO()}.xlsx`);
    },
    onSuccess: () => toast.success('Complete backup exported!'),
    onError: (err: any) => toast.error(getErrorMessage(err, 'Export failed')),
  });

  const handleDownloadOpeningStockTemplate = async () => {
    try {
      const buffer = await window.electronAPI.generateOpeningStockTemplate('simple');
      downloadBuffer(buffer, `stock-import-template.xlsx`);
      toast.success('Stock import template downloaded!');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to download template'));
    }
  };

  const handleImportOpeningStockFile = async () => {
    try {
      const result = await window.electronAPI.openFile({
        title: 'Import Opening Stock',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths?.[0]) return;
      const filePath = result.filePaths[0];
      const fileName = filePath.split(/[\\/]/).pop() || '';
      const buffer = await window.electronAPI.readFileBuffer(filePath);
      const parsed = await window.electronAPI.parseImportFile(buffer, fileName);
      if (parsed.rows.length === 0) {
        toast.error('No data found in file');
        return;
      }
      setOpeningStockRows(parsed.rows);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to read file'));
    }
  };

  const handleBulkImportOpeningStock = async () => {
    if (!company?.id || !financialYear?.id) {
      toast.error('Select a company and financial year first');
      return;
    }
    const total = openingStockRows.length;
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      if (total > 0) {
        const sampleRow = openingStockRows[0];
        const keys = Object.keys(sampleRow);
        const hasQty = keys.some(k => k.toLowerCase() === 'qty' || k.toLowerCase() === 'quantity');
        const hasStore = keys.some(k => k.toLowerCase().includes('store') || k.toLowerCase().includes('department'));
        if (!hasQty) {
          toast.error(`Qty column not found! Detected columns: ${keys.join(', ')}. Please use the downloaded template.`);
          setImportProgress(prev => ({ ...prev, active: false }));
          return;
        }
        if (!hasStore) {
          toast.error(`Store column not found! Detected columns: ${keys.join(', ')}. Please use the downloaded template.`);
          setImportProgress(prev => ({ ...prev, active: false }));
          return;
        }
      }

      setImportProgress(prev => ({ ...prev, current: Math.floor(total / 2) }));

      const rows = openingStockRows.map((r: any) => ({
        dharamshalaDept: r['Store Name'] || r['Store/Department'] || r['Dharamshala/Department'] || r['dharamshalaDept'] || r['dharamshala'] || r['department'] || r['store'] || '',
        roomLocation: r['Room/Location'] || r['roomLocation'] || r['room'] || r['location'] || '',
        itemCode: r['Item Code'] || r['itemCode'] || r['code'] || '',
        itemName: r['Item Name'] || r['itemName'] || '',
        unit: r['Unit'] || r['unit'] || '',
        quantity: Number(r['Qty'] || r['Quantity'] || r['quantity'] || r['qty'] || 0),
        rate: Number(r['Rate'] || r['rate'] || 0),
        date: r['Date'] || r['date'] || '',
        status: r['Status'] || r['status'] || 'Available',
        remarks: r['Remarks'] || r['remarks'] || '',
      }));

      setImportProgress(prev => ({ ...prev, current: Math.floor(total * 0.75) }));

      const result = await window.electronAPI.bulkImportOpeningStock({
        companyId: company.id,
        financialYearId: financialYear.id,
        rows,
      });

      const errors = (result.errors || []).map((e: string) => e);
      setImportProgress({
        active: false,
        current: total,
        total,
        created: result.imported,
        updated: 0,
        skipped: result.total - result.imported,
        errors,
      });

      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} of ${result.total} rows`);
        try {
          await window.electronAPI.createImportHistory({
            fileName: `Stock Import (${rows.length} rows)`,
            importType: 'opening_stock',
            rowCount: result.total,
            importedCount: result.imported,
            companyId: company.id,
            financialYearId: financialYear.id,
          });
          loadImportHistory();
        } catch (err) {
          console.error('Failed to save import history:', err);
        }
      }
      if (result.errors?.length > 0) {
        toast.error(`Errors: ${result.errors.slice(0, 3).join(', ')}`);
      }
      setOpeningStockRows([]);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error(getErrorMessage(err, 'Import failed'));
    }
  };

  const handleImportFile = async () => {
    try {
      const result = await window.electronAPI.openFile({
        title: 'Import Data for Restore',
        filters: [
          { name: 'Excel/CSV', extensions: ['xlsx', 'csv'] },
        ],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths?.[0]) return;
      const filePath = result.filePaths[0];
      const fileName = filePath.split(/[\\/]/).pop() || '';
      const buffer = await window.electronAPI.readFileBuffer(filePath);
      const parsed = await window.electronAPI.parseImportFile(buffer, fileName);
      if (parsed.rows.length === 0) {
        toast.error('No data found in file');
        return;
      }
      setImportHeaders(parsed.headers);
      setImportRows(parsed.rows);
      setImportDialog(true);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to read file'));
    }
  };

  const handleImportToTable = async () => {
    if (!importModel) { toast.error('Select a table first'); return; }
    const table = tables?.find((t: any) => t.model === importModel);
    if (!table) return;
    const total = importRows.length;
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      setImportProgress(prev => ({ ...prev, current: Math.floor(total / 2) }));

      const result = await window.electronAPI.bulkUpsert(importModel, importRows, table.matchField);

      const errors = (result.errors || []).map((e: string) => e);
      setImportProgress({
        active: false,
        current: total,
        total,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors,
      });

      toast.success(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);

      if (company?.id && financialYear?.id) {
        try {
          await window.electronAPI.createImportHistory({
            fileName: `Master Data - ${table.name}`,
            importType: 'master_data',
            rowCount: result.total,
            importedCount: result.created + result.updated,
            companyId: company.id,
            financialYearId: financialYear.id,
          });
          loadImportHistory();
        } catch (err) {
          console.error('Failed to save import history:', err);
        }
      }
      setImportDialog(false);
      setImportRows([]);
      setImportModel('');
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error(getErrorMessage(err, 'Import failed'));
    }
  };

  const handleDownloadTemplate = async (model: string) => {
    try {
      const buffer = await window.electronAPI.generateImportTemplate(model);
      downloadBuffer(buffer, `import-template-${model}.xlsx`);
      toast.success(`Template downloaded for ${model}`);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to download template'));
    }
  };

  const handleDeleteImport = async () => {
    if (!deleteTarget || !company?.id || !financialYear?.id) return;
    setDeleting(true);
    try {
      const result = await window.electronAPI.deleteImportHistory({
        id: deleteTarget.id,
        companyId: company.id,
        financialYearId: financialYear.id,
      });
      toast.success(result.message);
      setDeleteDialog(false);
      setDeleteTarget(null);
      loadImportHistory();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Delete failed'));
    } finally {
      setDeleting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Box>
      <PageHeader
        title="Backup & Restore"
        subtitle="Manage database backups, export/import data, download import templates"
        actions={
          <Stack direction="row" spacing={1.5}>
            <GuideButton pageId="backup" />
            <Button
              variant="outlined"
              startIcon={<Info />}
              onClick={() => setBackupInfoDialog(true)}
            >
              Backup Details
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={() => exportAllMutation.mutate()}
              disabled={exportAllMutation.isPending}
            >
              {exportAllMutation.isPending ? 'Exporting...' : 'Complete Excel Backup'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileUpload />}
              onClick={handleImportFile}
            >
              Import Data
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderOpen />}
              onClick={async () => {
                const dir = await window.electronAPI.getExportsDir();
                toast.success(`Exports directory: ${dir}`);
              }}
            >
              Open Folder
            </Button>
            <Button
              variant="contained"
              startIcon={<Backup />}
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
            >
              {createBackupMutation.isPending ? 'Creating...' : 'Create Backup'}
            </Button>
          </Stack>
        }
      />

      <Alert
        severity="info"
        sx={{ mb: 2.5, borderRadius: 2, '& .MuiAlert-icon': { alignItems: 'center' } }}
      >
        Backups are automatic every hour. Daily (7 days), Weekly (4 weeks), Monthly (6 months), Yearly (3 years).
        "Complete Excel Backup" exports ALL tables with ALL data. Use "Import Data" to restore from Excel/CSV.
      </Alert>

      {/* Storage Info Cards */}
      {storageInfo && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2.5 }}>
          <Paper sx={{ p: 1.5, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
            <Storage sx={{ fontSize: 20, color: 'primary.main', mb: 0.5 }} />
            <Typography variant="h6" fontWeight={700} fontSize="1rem">{formatSize(storageInfo.totalSize)}</Typography>
            <Typography variant="caption" color="text.secondary">Total Storage</Typography>
          </Paper>
          <Paper sx={{ p: 1.5, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
            <Backup sx={{ fontSize: 20, color: 'success.main', mb: 0.5 }} />
            <Typography variant="h6" fontWeight={700} fontSize="1rem">{storageInfo.totalCount}</Typography>
            <Typography variant="caption" color="text.secondary">Total Backups</Typography>
          </Paper>
          <Paper sx={{ p: 1.5, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
            <Schedule sx={{ fontSize: 20, color: 'warning.main', mb: 0.5 }} />
            <Typography variant="h6" fontWeight={700} fontSize="1rem">{storageInfo.byType?.hourly?.count || 0}</Typography>
            <Typography variant="caption" color="text.secondary">Hourly Backups</Typography>
          </Paper>
          <Paper
            sx={{ p: 1.5, textAlign: 'center', border: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setLocationGuideOpen(true)}
          >
            <LocationOn sx={{ fontSize: 20, color: 'error.main', mb: 0.5 }} />
            <Typography variant="h6" fontWeight={700} fontSize="0.75rem" noWrap>{storageInfo.backupPath?.split(/[\\/]/).pop()}</Typography>
            <Typography variant="caption" color="text.secondary">Backup Location</Typography>
          </Paper>
        </Box>
      )}

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Database Backups" icon={<Backup />} iconPosition="start" />
        <Tab label="Import Templates" icon={<Description />} iconPosition="start" />
        <Tab label="Room Stock Import" icon={<HomeWork />} iconPosition="start" />
      </Tabs>

      {activeTab === 0 && (
        <>
          {createBackupMutation.isSuccess && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>Backup created successfully!</Alert>
          )}

          {isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Backup Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups?.map((backup: any) => (
                    <TableRow key={backup.path} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Box sx={{
                            width: 32, height: 32, borderRadius: 1.5,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <CloudUpload sx={{ fontSize: 16, color: 'primary.main' }} />
                          </Box>
                          <Typography fontWeight={500}>{backup.name}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={backup.type}
                          size="small"
                          color={backup.type === 'daily' ? 'primary' : backup.type === 'weekly' ? 'secondary' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {formatSize(backup.size)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDateDDMMYYYY(backup.date)}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="warning"
                          startIcon={<Restore />}
                          onClick={() => {
                            if (confirm('Are you sure you want to restore this backup? The app will restart.')) {
                              restoreMutation.mutate(backup.path);
                            }
                          }}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!backups || backups.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <EmptyState
                          icon={<Backup />}
                          title="No backups found"
                          description="Create your first backup to protect your data"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {activeTab === 1 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
            Download import templates to see the correct Excel format for each table. Templates include column names, sample data, and instructions.
          </Alert>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Table</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Columns ( * = required )</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tables?.map((table: any) => (
                  <TableRow key={table.model} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{
                          width: 32, height: 32, borderRadius: 1.5,
                          bgcolor: alpha(theme.palette.info.main, 0.08),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Inventory sx={{ fontSize: 16, color: 'info.main' }} />
                        </Box>
                        <Typography fontWeight={500}>{table.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        Match by: {table.matchField}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {table.fields.map((f: string) => {
                          const isRequired = table.required?.includes(f);
                          return (
                            <Chip
                              key={f}
                              label={isRequired ? `${f} *` : f}
                              size="small"
                              variant={isRequired ? 'filled' : 'outlined'}
                              color={isRequired ? 'primary' : 'default'}
                              sx={{ fontSize: '0.7rem' }}
                            />
                          );
                        })}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownload />}
                        onClick={() => handleDownloadTemplate(table.model)}
                      >
                        Download Template
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
            Stock import with full details. Template includes: Dharamshala/Department, Room/Location, Category, Item Code, Item Name, Unit, Qty, Rate, Date, Status, Remarks. <br />
            <strong>Auto-creates:</strong> New items, categories, and units if they don't exist. After import, you can update Unit and Rate anytime from Item Master.
          </Alert>
          <Stack direction="row" spacing={2} mb={3} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={handleDownloadOpeningStockTemplate}
            >
              Download Template
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileUpload />}
              onClick={handleImportOpeningStockFile}
            >
              Import Excel File
            </Button>
          </Stack>

          {openingStockRows.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Preview: {openingStockRows.length} rows ready to import
                </Typography>
                <Button
                  variant="contained"
                  startIcon={importProgress.active ? <CircularProgress size={16} /> : <FileUpload />}
                  onClick={handleBulkImportOpeningStock}
                  disabled={importProgress.active}
                >
                  {importProgress.active ? 'Importing...' : `Import ${openingStockRows.length} Rows`}
                </Button>
              </Stack>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {Object.keys(openingStockRows[0] || {}).map((key) => (
                        <TableCell key={key} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{key}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {openingStockRows.slice(0, 50).map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        {Object.keys(row).map((key) => (
                          <TableCell key={key} sx={{ fontSize: '0.75rem' }}>{String(row[key] ?? '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {openingStockRows.length > 50 && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Showing first 50 rows of {openingStockRows.length} total
                </Typography>
              )}
            </Paper>
          )}

          {/* Undo Import Section */}
          <Paper sx={{ p: 2, mt: 2, border: '1px dashed', borderColor: 'warning.main' }}>
            <Typography variant="subtitle1" fontWeight={600} color="warning.main" mb={1}>
              Undo / Rollback Import
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Accidentally imported wrong file? Click the button below to delete all imports from the last 10 minutes.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={async () => {
                if (!confirm('All stock entries from the last 10 minutes will be permanently deleted. Are you sure?')) return;
                try {
                  const result = await window.electronAPI.undoOpeningStockImport({
                    companyId: company!.id,
                    financialYearId: financialYear!.id,
                    minutes: 10,
                  });
                  toast.success(result.message);
                  loadImportHistory();
                } catch (err: any) {
                  toast.error(getErrorMessage(err, 'Undo failed'));
                }
              }}
            >
              Undo Last 10 Minutes
            </Button>
          </Paper>

          {/* Import History Section */}
          <Paper sx={{ p: 2, mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                Import History
              </Typography>
              <Button size="small" onClick={() => loadImportHistory()}>Refresh</Button>
            </Stack>
            {importHistory.length === 0 ? (
              <Alert severity="info">No imports recorded yet.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>File / Import</TableCell>
                      <TableCell>Level</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell align="right">Rows</TableCell>
                      <TableCell align="right">Imported</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importHistory.map((h: any) => (
                      <TableRow key={h.id} hover>
                        <TableCell>
                          <Typography fontWeight={500} fontSize="0.8125rem">{h.fileName}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={h.level || h.importType} size="small" variant="outlined" sx={{ fontSize: '0.625rem' }} />
                        </TableCell>
                        <TableCell>{h.departmentName || '-'}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{h.rowCount}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace', color: 'success.main' }}>{h.importedCount}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{formatDateDDMMYYYY(h.createdAt)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete this import and all related stock data">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => { setDeleteTarget(h); setDeleteDialog(true); }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Warning color="error" />
                <Typography variant="h6">Delete Import Data</Typography>
              </Stack>
            </DialogTitle>
            <DialogContent>
              {deleteTarget && (
                <Stack spacing={2}>
                  <Alert severity="error">
                    This action cannot be undone! All stock transactions associated with this import will be permanently deleted.
                  </Alert>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2"><strong>File:</strong> {deleteTarget.fileName}</Typography>
                    <Typography variant="body2"><strong>Level:</strong> {deleteTarget.level || deleteTarget.importType}</Typography>
                    <Typography variant="body2"><strong>Department:</strong> {deleteTarget.departmentName || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Rows:</strong> {deleteTarget.importedCount} imported</Typography>
                    <Typography variant="body2"><strong>Date:</strong> {formatDateDDMMYYYY(deleteTarget.createdAt)}</Typography>
                  </Paper>
                  <Typography variant="body2" color="text.secondary">
                    Are you sure you want to delete this import data?
                  </Typography>
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setDeleteDialog(false); setDeleteTarget(null); }}>Cancel</Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteImport}
                disabled={deleting}
                startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* Import Dialog */}
      <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Data to Database</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Alert severity="info">
              Found {importRows.length} rows with columns: {importHeaders.join(', ')}
            </Alert>
            <FormControl fullWidth>
              <InputLabel>Select Target Table</InputLabel>
              <Select
                value={importModel}
                label="Select Target Table"
                onChange={(e) => setImportModel(e.target.value)}
              >
                {tables?.map((t: any) => (
                  <MenuItem key={t.model} value={t.model}>{t.name} (match by: {t.matchField})</MenuItem>
                ))}
              </Select>
            </FormControl>
            {importModel && (
              <Alert severity="warning">
                Records will be matched by <strong>{tables?.find((t: any) => t.model === importModel)?.matchField}</strong>.
                Existing records will be updated, new ones will be created.
              </Alert>
            )}
            {importRows.length > 0 && (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {importHeaders.map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importRows.slice(0, 20).map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        {importHeaders.map((h) => (
                          <TableCell key={h} sx={{ fontSize: '0.75rem' }}>{String(row[h] ?? '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImportToTable}
            disabled={!importModel || importing}
            startIcon={importing ? <CircularProgress size={16} /> : <TableChart />}
          >
            {importing ? 'Importing...' : `Import ${importRows.length} Rows`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backup Info Dialog */}
      <Dialog open={backupInfoDialog} onClose={() => setBackupInfoDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Info />
            <Typography variant="h6">Backup Data Summary</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {backupInfoLoading ? (
            <CircularProgress />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Table Name</strong></TableCell>
                    <TableCell align="right"><strong>Record Count</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backupInfo?.map((table: any) => (
                    <TableRow key={table.model} hover>
                      <TableCell>{table.name}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                          {table.count.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={table.count > 0 ? 'Has Data' : 'Empty'}
                          size="small"
                          color={table.count > 0 ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            All tables are included in the backup. The "Complete Excel Backup" exports every table with all columns and data.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupInfoDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Location Guide Dialog */}
      <Dialog open={locationGuideOpen} onClose={() => setLocationGuideOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocationOn />
            <Typography variant="h6">Backup Location Guide</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            All backups are stored in the following location. You can copy this path to access backups directly.
          </Alert>

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Backup Storage Path:</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', flex: 1 }}>
                {storageInfo?.backupPath || 'Loading...'}
              </Typography>
              <Tooltip title="Copy path">
                <IconButton size="small" onClick={() => {
                  navigator.clipboard.writeText(storageInfo?.backupPath || '');
                  toast.success('Path copied to clipboard!');
                }}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Paper>

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Backup Folders:</Typography>
          <Box sx={{ pl: 1 }}>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                <Typography variant="body2"><strong>hourly/</strong> — Every hour, keeps last 8 backups (~8 hours)</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
                <Typography variant="body2"><strong>daily/</strong> — Every midnight, keeps last 7 backups (~1 week)</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main' }} />
                <Typography variant="body2"><strong>weekly/</strong> — Every Sunday, keeps last 4 backups (~1 month)</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'info.main' }} />
                <Typography variant="body2"><strong>monthly/</strong> — 1st of each month, keeps last 6 backups (~6 months)</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                <Typography variant="body2"><strong>yearly/</strong> — 1st January, keeps last 3 backups (~3 years)</Typography>
              </Stack>
            </Stack>
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2"><strong>How to change backup location:</strong></Typography>
            <Typography variant="body2">1. Click "Open Folder" to see current backups</Typography>
            <Typography variant="body2">2. Copy the backup path from above</Typography>
            <Typography variant="body2">3. Create a new folder where you want to store backups</Typography>
            <Typography variant="body2">4. Contact administrator to update the backup location</Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationGuideOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="data" />
    </Box>
  );
}
