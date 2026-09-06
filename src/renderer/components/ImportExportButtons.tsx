import React, { useState } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle,
  DialogContent, DialogActions, Typography, Stack, Alert, CircularProgress,
  Chip, Box,
} from '@mui/material';
import {
  FileDownload, FileUpload, ExpandMore, TableChart, Description, Info,
} from '@mui/icons-material';
import { ExportColumn, exportToExcel, exportToCSV, importFromFile } from '../utils/importExport';
import toast from 'react-hot-toast';

interface ImportExportButtonsProps {
  data: any[];
  columns: ExportColumn[];
  fileName: string;
  onImport?: (rows: any[]) => void;
  onExportOpen?: () => void;
  showImport?: boolean;
  showExport?: boolean;
  importColumns?: string[];
}

export default function ImportExportButtons({
  data,
  columns,
  fileName,
  onImport,
  onExportOpen,
  showImport = true,
  showExport = true,
  importColumns,
}: ImportExportButtonsProps) {
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);

  const handleExportExcel = async () => {
    setExportAnchor(null);
    try {
      await exportToExcel(data, columns, fileName);
      toast.success(`Exported ${data.length} rows to Excel`);
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const handleExportCSV = async () => {
    setExportAnchor(null);
    try {
      await exportToCSV(data, columns, fileName);
      toast.success(`Exported ${data.length} rows to CSV`);
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const handleImportFile = async () => {
    setShowImportInfo(false);
    setImporting(true);
    try {
      const result = await importFromFile();
      if (result && result.rows.length > 0) {
        setImportResult({ ...result, fileName: 'file' });
      }
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        {showExport && data.length > 0 && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownload />}
              endIcon={<ExpandMore />}
              onClick={(e) => { if (onExportOpen) onExportOpen(); setExportAnchor(e.currentTarget); }}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportAnchor}
              open={Boolean(exportAnchor)}
              onClose={() => setExportAnchor(null)}
            >
              <MenuItem onClick={handleExportExcel}>
                <ListItemIcon><TableChart fontSize="small" /></ListItemIcon>
                <ListItemText>Export as Excel (.xlsx)</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleExportCSV}>
                <ListItemIcon><Description fontSize="small" /></ListItemIcon>
                <ListItemText>Export as CSV (.csv)</ListItemText>
              </MenuItem>
            </Menu>
          </>
        )}
        {showImport && (
          <Button
            variant="outlined"
            size="small"
            startIcon={importing ? <CircularProgress size={16} /> : <FileUpload />}
            onClick={() => importColumns ? setShowImportInfo(true) : handleImportFile()}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        )}
      </Stack>

      {/* Pre-import info dialog — shows expected columns */}
      {showImportInfo && (
        <Dialog open={showImportInfo} onClose={() => setShowImportInfo(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Info sx={{ color: 'info.main' }} />
            Import Columns
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Your Excel file must contain these columns. Required columns (*) are mandatory.
              </Alert>
              <Box>
                <Typography variant="subtitle2" gutterBottom>Expected columns:</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {importColumns?.map((col) => (
                    <Chip
                      key={col}
                      label={col}
                      size="small"
                      variant="filled"
                      color="primary"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ))}
                </Stack>
              </Box>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Column names are case-sensitive. Download the template first using the Export button.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowImportInfo(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleImportFile}>
              Choose File
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Post-import result dialog */}
      {importResult && (
        <Dialog open={!!importResult} onClose={() => setImportResult(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Import Result</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Alert severity="success">
                Successfully parsed {importResult.rows.length} rows from {importResult.headers.length} columns.
              </Alert>
              <Box>
                <Typography variant="subtitle2" gutterBottom>Columns found in your file:</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {importResult.headers.map((h: string) => (
                    <Chip key={h} label={h} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Alert severity="info">
                Click "Send to Server" to save records. Existing records will be updated, new ones will be created.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportResult(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                if (onImport) onImport(importResult.rows);
                setImportResult(null);
              }}
            >
              Send to Server
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
