import React, { useState, useRef } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle,
  DialogContent, DialogActions, Typography, Stack, Alert, CircularProgress,
  Chip, Box,
} from '@mui/material';
import {
  FileDownload, FileUpload, ExpandMore, TableChart, Description,
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
}

export default function ImportExportButtons({
  data,
  columns,
  fileName,
  onImport,
  onExportOpen,
  showImport = true,
  showExport = true,
}: ImportExportButtonsProps) {
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [resultDialog, setResultDialog] = useState(false);

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

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importFromFile();
      if (result && result.rows.length > 0) {
        if (onImport) {
          onImport(result.rows);
        }
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
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        )}
      </Stack>

      {importResult && (
        <Dialog open={!!importResult} onClose={() => setImportResult(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Import Result</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Alert severity="success">
                Successfully parsed {importResult.rows.length} rows from {importResult.headers.length} columns.
              </Alert>
              <Box>
                <Typography variant="subtitle2" gutterBottom>Columns found:</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {importResult.headers.map((h: string) => (
                    <Chip key={h} label={h} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Alert severity="info">
                Click "Send to Server" to save these records to the database. Existing records will be updated, new ones created.
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
