import React, { useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Stepper, Step, StepLabel,
  LinearProgress, Alert, Chip, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, IconButton,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Tooltip, Checkbox,
} from '@mui/material';
import {
  CloudUpload, Upload, Edit, Delete, CheckCircle, Error as ErrorIcon,
  Refresh, Search, FilterList, SelectAll,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import toast from 'react-hot-toast';

interface ImportedItem {
  itemCode: string;
  itemName: string;
  unitName: string;
  departmentName: string;
  categoryName: string;
  minimumStockLevel: number;
  rawText: string;
  rowNumber: number;
  confidence: 'high' | 'medium' | 'low';
  selected?: boolean;
}

interface ExtractResult {
  success: boolean;
  items: ImportedItem[];
  totalRows: number;
  skippedRows: number;
  departments: string[];
  categories: string[];
  units: string[];
  errors: string[];
}

const STEPS = ['Upload XPS', 'Review Items', 'Import to Database'];

export default function XpsItemImportPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [items, setItems] = useState<ImportedItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: ImportedItem | null; index: number }>({
    open: false, item: null, index: -1,
  });
  const [importResult, setImportResult] = useState<any>(null);

  // Fetch categories and units for mapping
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => window.electronAPI.dbQuery('itemCategory', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: () => window.electronAPI.dbQuery('unit', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.xps')) {
      toast.error('Please select an XPS file');
      return;
    }
    setFile(f);
    setIsExtracting(true);

    try {
      const buffer = await f.arrayBuffer();
      const result = await (window as any).electronAPI.extractItemsFromXps(buffer);

      if (result.success) {
        const itemsWithSelection = result.items.map((item: ImportedItem) => ({ ...item, selected: true }));
        setExtractResult(result);
        setItems(itemsWithSelection);
        setActiveStep(1);
        toast.success(`Extracted ${result.items.length} items from XPS`);
      } else {
        toast.error(result.errors?.[0] || 'Failed to extract items');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const toggleItemSelection = (index: number) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  const toggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  const updateItem = (index: number, field: keyof ImportedItem, value: any) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      toast.error('No items selected for import');
      return;
    }
    if (!company?.id) {
      toast.error('No company selected');
      return;
    }

    setIsImporting(true);
    try {
      // Map unit names to unit IDs
      const defaultUnitId = units?.[0]?.id || 1;
      const defaultCategoryId = categories?.[0]?.id || 1;

      const result = await (window as any).electronAPI.bulkImportItems(
        selectedItems.map(({ selected, ...rest }) => rest),
        company.id,
        defaultCategoryId,
        defaultUnitId
      );

      setImportResult(result);
      setActiveStep(2);
      queryClient.invalidateQueries({ queryKey: ['items'] });

      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} items!`);
      }
      if (result.skipped > 0) {
        toast(`${result.skipped} items skipped (already exist)`, { icon: 'ℹ️' });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchText ||
      item.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
      item.itemCode.toLowerCase().includes(searchText.toLowerCase());
    const matchesDept = !filterDept || item.departmentName === filterDept;
    return matchesSearch && matchesDept;
  });

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Import Items from XPS
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload XPS files with department-wise item lists (DevLys 010 font) to auto-import items
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 0: Upload */}
      {activeStep === 0 && (
        <Paper
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          sx={{
            p: 6, textAlign: 'center', cursor: 'pointer',
            border: '2px dashed', borderColor: isExtracting ? 'primary.main' : 'grey.400',
            bgcolor: isExtracting ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => !isExtracting && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".xps" hidden onChange={(e) => handleFileSelect(e.target.files)} />
          {isExtracting ? (
            <CircularProgress size={48} sx={{ mb: 2 }} />
          ) : (
            <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          )}
          <Typography variant="h5" gutterBottom>
            {isExtracting ? 'Extracting items...' : 'Drop XPS file here or click to browse'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            XPS file should contain item list with columns like: Sr. No., Item Name, Unit, Department
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Supports DevLys 010, Kruti Dev, and Unicode Hindi fonts
          </Typography>
        </Paper>
      )}

      {/* Step 1: Review Items */}
      {activeStep === 1 && extractResult && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Found <strong>{items.length}</strong> items | Skipped <strong>{extractResult.skippedRows}</strong> rows
            {extractResult.departments.length > 0 && <> | Departments: {extractResult.departments.join(', ')}</>}
          </Alert>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  size="small" fullWidth placeholder="Search items..."
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Filter by Department</InputLabel>
                  <Select value={filterDept} label="Filter by Department" onChange={(e) => setFilterDept(e.target.value)}>
                    <MenuItem value="">All Departments</MenuItem>
                    {extractResult.departments.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={toggleSelectAll}>
                    {items.every((i) => i.selected) ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Chip label={`${selectedCount} selected`} color="primary" size="small" />
                </Stack>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="contained" fullWidth onClick={handleImport} disabled={selectedCount === 0 || isImporting}>
                  {isImporting ? <CircularProgress size={20} /> : <Upload />}
                  Import {selectedCount}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Items Table */}
          <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox checked={items.length > 0 && items.every((i) => i.selected)} onChange={toggleSelectAll} />
                  </TableCell>
                  <TableCell sx={{ width: 50 }}>#</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell sx={{ width: 80 }}>Confidence</TableCell>
                  <TableCell sx={{ width: 80 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((item, idx) => {
                  const originalIdx = items.indexOf(item);
                  return (
                    <TableRow key={originalIdx} hover selected={item.selected}>
                      <TableCell padding="checkbox">
                        <Checkbox checked={item.selected} onChange={() => toggleItemSelection(originalIdx)} />
                      </TableCell>
                      <TableCell>{item.rowNumber}</TableCell>
                      <TableCell>
                        <TextField size="small" value={item.itemCode}
                          onChange={(e) => updateItem(originalIdx, 'itemCode', e.target.value)}
                          sx={{ width: 120 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={item.itemName} fullWidth
                          onChange={(e) => updateItem(originalIdx, 'itemName', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select value={item.unitName} onChange={(e) => updateItem(originalIdx, 'unitName', e.target.value)}>
                            {units?.map((u: any) => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}
                            <MenuItem value={item.unitName}>{item.unitName}</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={item.departmentName}
                          onChange={(e) => updateItem(originalIdx, 'departmentName', e.target.value)}
                          sx={{ width: 120 }} />
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select value={item.categoryName} onChange={(e) => updateItem(originalIdx, 'categoryName', e.target.value)}>
                            {categories?.map((c: any) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
                            <MenuItem value={item.categoryName}>{item.categoryName}</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.confidence}
                          size="small"
                          color={item.confidence === 'high' ? 'success' : item.confidence === 'medium' ? 'warning' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Remove">
                          <IconButton size="small" color="error" onClick={() => removeItem(originalIdx)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button onClick={() => { setActiveStep(0); setItems([]); setExtractResult(null); }}>
              Upload Another File
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 2: Import Complete */}
      {activeStep === 2 && importResult && (
        <Box>
          <Alert severity={importResult.imported > 0 ? 'success' : 'warning'} sx={{ mb: 3 }}>
            <Typography variant="h6">
              {importResult.imported > 0
                ? `Successfully imported ${importResult.imported} items!`
                : 'No new items were imported'}
            </Typography>
            {importResult.skipped > 0 && (
              <Typography variant="body2">{importResult.skipped} items skipped (already exist in database)</Typography>
            )}
          </Alert>

          {importResult.errors?.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Import Errors:</Typography>
              {importResult.errors.map((err: string, i: number) => (
                <Typography key={i} variant="body2">{err}</Typography>
              ))}
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={() => navigate('/masters/items')}>
              View Items
            </Button>
            <Button variant="outlined" onClick={() => {
              setActiveStep(0); setItems([]); setExtractResult(null); setImportResult(null); setFile(null);
            }}>
              Import Another File
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
