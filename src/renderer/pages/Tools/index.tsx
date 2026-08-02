import React, { useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Tabs, Tab, TextField, FormControl,
  InputLabel, Select, MenuItem, Alert, CircularProgress, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Divider, IconButton,
  Tooltip, Checkbox, LinearProgress, Stepper, Step, StepLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  CloudUpload, Transform, GetApp, Upload, ContentPaste, ContentCopy,
  TableChart, Delete, CheckCircle, Error as ErrorIcon, Search, FilterList,
  Code, Article, Inventory2, Tune,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import toast from 'react-hot-toast';

// ========== Tab 1: Text Converter ==========
function TextConverterTab() {
  const [inputText, setInputText] = useState('');
  const [fontType, setFontType] = useState<string>('auto');
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const parseConvertedText = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 3) return { rows: [], header: '', subHeader: '', tableHeaders: [] };
    const header = lines[0].trim();
    const subHeader = lines[1].trim();
    let tableHeaderIdx = -1;
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('क्र.') || line.includes('क्रम') || line.includes('आइटम') || line.includes('नाम')) {
        tableHeaderIdx = i;
        break;
      }
    }
    if (tableHeaderIdx === -1) tableHeaderIdx = 2;
    const tableHeaders = lines[tableHeaderIdx].trim().split(/\s{2,}|\t/).filter(c => c.trim());
    const rows: { columns: string[] }[] = [];
    for (let i = tableHeaderIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(c => c);
      if (columns.length >= 2) rows.push({ columns });
    }
    return { rows, header, subHeader, tableHeaders };
  };

  const handleConvert = async () => {
    if (!inputText.trim()) { toast.error('Please paste some text first'); return; }
    setIsConverting(true);
    setError(null);
    try {
      const converted = await (window as any).electronAPI.convertXpsText(inputText, fontType);
      const parsed = parseConvertedText(converted.hindi);
      setResult({ ...converted, ...parsed });
      toast.success('Text converted!');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsConverting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!result) return;
    try {
      const buffer = await (window as any).electronAPI.exportKrutiDevToExcel({
        header: result.header, subHeader: result.subHeader,
        tableHeaders: result.tableHeaders, rows: result.rows.map((r: any) => r.columns),
        hindiText: result.hindi, englishText: result.english,
      });
      const saved = await (window as any).electronAPI.saveXpsFile(buffer, 'converted_stock_report.xlsx');
      if (saved) toast.success(`Excel saved: ${saved}`);
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
  };

  const handleExportKrutiDevToExcel = async () => {
    if (!result) return;
    try {
      const buffer = await (window as any).electronAPI.exportKrutiDevToExcel({
        header: result.header, subHeader: result.subHeader,
        tableHeaders: result.tableHeaders, rows: result.rows.map((r: any) => r.columns),
        hindiText: result.hindi, englishText: result.english,
      });
      const saved = await (window as any).electronAPI.saveXpsFile(buffer, 'converted_report.xlsx');
      if (saved) toast.success(`Excel saved: ${saved}`);
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <ContentPaste color="primary" />
          <Typography variant="h6">Kruti Dev / DevLys Text Convert karo</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kruti Dev 010 ya DevLys 010 encoded text paste karo. Auto-detect karke Unicode Hindi mein convert karega.
        </Typography>
        <TextField
          fullWidth multiline rows={12}
          placeholder="Yahan Kruti Dev / DevLys text paste karo..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          sx={{ mb: 2, '& .MuiInputBase-input': { fontFamily: 'Consolas, monospace', fontSize: '13px' } }}
        />
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Font Type</InputLabel>
            <Select value={fontType} label="Font Type" onChange={(e) => setFontType(e.target.value)}>
              <MenuItem value="auto">Auto Detect</MenuItem>
              <MenuItem value="krutidev">Kruti Dev 010</MenuItem>
              <MenuItem value="devlys">DevLys 010</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={isConverting ? <CircularProgress size={20} /> : <Transform />}
            onClick={handleConvert} disabled={isConverting || !inputText.trim()}>
            {isConverting ? 'Converting...' : 'Convert'}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <Paper sx={{ p: 3 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Detected: <strong>{result.detectedFont?.toUpperCase()}</strong> |
            Rows: {result.rows?.length || 0}
          </Alert>

          {result.header && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{result.header}</Typography>
              {result.subHeader && <Typography variant="subtitle1" color="text.secondary">{result.subHeader}</Typography>}
            </Box>
          )}

          {result.tableHeaders?.length > 0 && result.rows?.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    {result.tableHeaders.map((col: string, idx: number) => (
                      <TableCell key={idx} sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white' }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.rows.map((row: any, rowIdx: number) => (
                    <TableRow key={rowIdx} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                      {row.columns.map((cell: string, cellIdx: number) => (
                        <TableCell key={cellIdx} sx={{ textAlign: (cellIdx === 2 || cellIdx === 3 || cellIdx === 5) ? 'right' : 'left' }}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>Hindi (Unicode)</Typography>
              <Paper variant="outlined" sx={{ p: 2, minHeight: 200, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                <Box sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '14px' }}>{result.hindi}</Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.main', fontWeight: 'bold' }}>English Translation</Typography>
              <Paper variant="outlined" sx={{ p: 2, minHeight: 200, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                <Box sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '14px' }}>{result.english}</Box>
              </Paper>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2}>
            <Button variant="contained" color="success" startIcon={<TableChart />} onClick={handleExportExcel} size="large">Export Excel</Button>
            <Button variant="outlined" startIcon={<ContentCopy />} onClick={() => { navigator.clipboard.writeText(result.hindi); toast.success('Hindi copied!'); }}>Copy Hindi</Button>
            <Button variant="outlined" startIcon={<ContentCopy />} onClick={() => { navigator.clipboard.writeText(result.english); toast.success('English copied!'); }}>Copy English</Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

// ========== Tab 2: XPS File Converter ==========
function XpsFileConverterTab() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'xps' && ext !== 'pdf' && ext !== 'txt') {
      toast.error('Please select .xps, .pdf, or .txt file');
      return;
    }
    setFile(f);
    setIsConverting(true);
    setError(null);
    try {
      if (ext === 'xps') {
        const arrayBuffer = await f.arrayBuffer();
        const conversionResult = await (window as any).electronAPI.convertXps(arrayBuffer);
        setResult(conversionResult);
        if (conversionResult.success) toast.success('XPS converted!');
        else { setError(conversionResult.error); toast.error(conversionResult.error); }
      } else if (ext === 'pdf') {
        const arrayBuffer = await f.arrayBuffer();
        const pdfResult = await (window as any).electronAPI.extractTextFromPdf(arrayBuffer);
        if (pdfResult.text) {
          const converted = await (window as any).electronAPI.convertXpsText(pdfResult.text, 'auto');
          setResult({ success: true, ...converted, originalDoc: { pages: [], tables: [], fonts: [], pageCount: pdfResult.numPages } });
          toast.success(`PDF converted! (${pdfResult.numPages} pages)`);
        } else { setError('No text found in PDF'); }
      } else {
        const text = await f.text();
        const converted = await (window as any).electronAPI.convertXpsText(text, 'auto');
        setResult({ success: true, ...converted, originalDoc: { pages: [], tables: [], fonts: [], pageCount: 1 } });
        toast.success('Text file converted!');
      }
    } catch (err: any) { setError(err?.message); toast.error(err?.message); }
    finally { setIsConverting(false); }
  }, []);

  const handleExport = async () => {
    if (!result) return;
    try {
      const buffer = await (window as any).electronAPI.exportXps(result, 'xlsx', {
        includeHindi: true, includeEnglish: true, bilingualMode: true, preserveLayout: true,
      }, file?.name || 'converted');
      const saved = await (window as any).electronAPI.saveXpsFile(buffer, `${file?.name?.replace(/\.[^.]+$/, '') || 'converted'}.xlsx`);
      if (saved) toast.success(`File saved: ${saved}`);
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  return (
    <Box>
      <Paper
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        sx={{
          p: 6, textAlign: 'center', cursor: 'pointer',
          border: '2px dashed', borderColor: isConverting ? 'primary.main' : 'grey.400',
          bgcolor: isConverting ? 'action.hover' : 'background.paper',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".xps,.pdf,.txt,.text" hidden onChange={(e) => handleFileSelect(e.target.files)} />
        {isConverting ? <CircularProgress size={48} sx={{ mb: 2 }} /> : <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
        <Typography variant="h5" gutterBottom>{isConverting ? 'Converting...' : 'XPS/PDF/TXT file drop karo ya click karo'}</Typography>
        <Typography variant="body2" color="text.secondary">.xps, .pdf, .txt files support hoti hain</Typography>
        {file && <Chip label={file.name} color="primary" sx={{ mt: 2 }} />}
      </Paper>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {result?.success && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Conversion complete! {result.conversionCount || 0} characters converted.
          </Alert>

          {result.fontDetections?.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>Font Detection</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Font</TableCell><TableCell>Type</TableCell><TableCell>Confidence</TableCell></TableRow></TableHead>
                  <TableBody>
                    {result.fontDetections.map((f: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{f.fontName}</TableCell>
                        <TableCell><Chip label={f.detectedType.toUpperCase()} size="small" color={f.detectedType === 'unicode' ? 'success' : 'warning'} /></TableCell>
                        <TableCell>{(f.confidence * 100).toFixed(0)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button variant="contained" color="success" startIcon={<GetApp />} onClick={handleExport} size="large">Export Excel</Button>
            <Button variant="outlined" onClick={() => { setResult(null); setFile(null); setError(null); }}>Convert Another</Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

// ========== Tab 3: Item Import ==========
interface ImportedItem {
  itemCode: string; itemName: string; unitName: string;
  departmentName: string; categoryName: string; minimumStockLevel: number;
  rawText: string; rowNumber: number; confidence: 'high' | 'medium' | 'low'; selected?: boolean;
}

function ItemImportTab() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImportedItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [importMode, setImportMode] = useState<'xps' | 'csv'>('xps');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => window.electronAPI.dbQuery('itemCategory', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: () => window.electronAPI.dbQuery('unit', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const handleXpsUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    setIsExtracting(true);
    try {
      const buffer = await f.arrayBuffer();
      const result = await (window as any).electronAPI.extractItemsFromXps(buffer);
      if (result.success) {
        setItems(result.items.map((item: ImportedItem) => ({ ...item, selected: true })));
        toast.success(`Extracted ${result.items.length} items`);
      } else { toast.error(result.errors?.[0] || 'Failed'); }
    } catch (err: any) { toast.error(err?.message); }
    finally { setIsExtracting(false); }
  }, []);

  const handleCsvUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.endsWith('.csv')) { toast.error('Please select CSV file'); return; }
    setIsExtracting(true);
    try {
      const text = await f.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV is empty'); return; }
      const headers = lines[0].split(',').map(h => h.trim());
      const nameIdx = headers.findIndex(h => h.toLowerCase().includes('item name'));
      const catIdx = headers.findIndex(h => h.toLowerCase().includes('category'));
      const unitIdx = headers.findIndex(h => h.toLowerCase().includes('unit'));
      const codeIdx = headers.findIndex(h => h.toLowerCase().includes('item code'));
      const qtyIdx = headers.findIndex(h => h.toLowerCase().includes('opening qty'));
      const rateIdx = headers.findIndex(h => h.toLowerCase().includes('opening rate'));

      const parsed: ImportedItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 2 || !cols[nameIdx]) continue;
        parsed.push({
          itemCode: cols[codeIdx] || `CSV-${i}`,
          itemName: cols[nameIdx] || '',
          unitName: cols[unitIdx] || 'नग',
          departmentName: '',
          categoryName: cols[catIdx] || '',
          minimumStockLevel: 0,
          rawText: lines[i],
          rowNumber: i,
          confidence: 'high',
          selected: true,
        });
      }
      setItems(parsed);
      toast.success(`Parsed ${parsed.length} items from CSV`);
    } catch (err: any) { toast.error(err?.message); }
    finally { setIsExtracting(false); }
  }, []);

  const handleImport = async () => {
    const selectedItems = items.filter(i => i.selected);
    if (selectedItems.length === 0) { toast.error('No items selected'); return; }
    if (!company?.id) { toast.error('No company selected'); return; }
    setIsImporting(true);
    try {
      const defaultUnitId = units?.[0]?.id || 1;
      const defaultCategoryId = categories?.[0]?.id || 1;
      const result = await (window as any).electronAPI.bulkImportItems(
        selectedItems.map(({ selected, ...rest }) => rest),
        company.id, defaultCategoryId, defaultUnitId
      );
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      if (result.imported > 0) toast.success(`Imported ${result.imported} items!`);
      if (result.skipped > 0) toast(`${result.skipped} skipped (already exist)`, { icon: 'ℹ️' });
    } catch (err: any) { toast.error(err?.message); }
    finally { setIsImporting(false); }
  };

  const toggleItem = (idx: number) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  const toggleAll = () => { const all = items.every(i => i.selected); setItems(prev => prev.map(i => ({ ...i, selected: !all }))); };
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ImportedItem, value: any) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const filtered = items.filter(i => !searchText || i.itemName.toLowerCase().includes(searchText.toLowerCase()) || i.itemCode.toLowerCase().includes(searchText.toLowerCase()));
  const selectedCount = items.filter(i => i.selected).length;

  if (importResult) {
    return (
      <Box>
        <Alert severity={importResult.imported > 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
          <Typography variant="h6">{importResult.imported > 0 ? `Imported ${importResult.imported} items!` : 'No items imported'}</Typography>
          {importResult.skipped > 0 && <Typography variant="body2">{importResult.skipped} skipped</Typography>}
        </Alert>
        <Button variant="outlined" onClick={() => { setItems([]); setImportResult(null); }}>Import Another</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle2">Import Mode:</Typography>
          <ToggleButtonGroup value={importMode} exclusive onChange={(_, v) => { if (v) setImportMode(v); setItems([]); }} size="small">
            <ToggleButton value="xps"><CloudUpload sx={{ mr: 1, fontSize: 16 }} />XPS File</ToggleButton>
            <ToggleButton value="csv"><Article sx={{ mr: 1, fontSize: 16 }} />CSV File</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {items.length === 0 && (
        <Paper
          onDrop={(e) => { e.preventDefault(); importMode === 'xps' ? handleXpsUpload(e.dataTransfer.files) : handleCsvUpload(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            p: 6, textAlign: 'center', cursor: 'pointer',
            border: '2px dashed', borderColor: isExtracting ? 'primary.main' : 'grey.400',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept={importMode === 'xps' ? '.xps' : '.csv'} hidden
            onChange={(e) => importMode === 'xps' ? handleXpsUpload(e.target.files) : handleCsvUpload(e.target.files)} />
          {isExtracting ? <CircularProgress size={48} sx={{ mb: 2 }} /> : <Upload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />}
          <Typography variant="h5" gutterBottom>{isExtracting ? 'Extracting...' : `${importMode.toUpperCase()} file drop karo`}</Typography>
          <Typography variant="body2" color="text.secondary">
            {importMode === 'xps' ? 'DevLys 010 / Kruti Dev font wali XPS file' : 'Item Name, Category, Unit, Item Code columns wali CSV'}
          </Typography>
        </Paper>
      )}

      {items.length > 0 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField size="small" fullWidth placeholder="Search items..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={toggleAll}>{items.every(i => i.selected) ? 'Deselect All' : 'Select All'}</Button>
                  <Chip label={`${selectedCount} selected`} color="primary" size="small" />
                </Stack>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="contained" fullWidth onClick={handleImport} disabled={selectedCount === 0 || isImporting}>
                  {isImporting ? <CircularProgress size={20} /> : <Upload />} Import {selectedCount}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <TableContainer component={Paper} sx={{ maxHeight: 500, border: '1px solid', borderColor: 'divider' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox checked={items.length > 0 && items.every(i => i.selected)} onChange={toggleAll} /></TableCell>
                  <TableCell>#</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((item) => {
                  const idx = items.indexOf(item);
                  return (
                    <TableRow key={idx} hover selected={item.selected}>
                      <TableCell padding="checkbox"><Checkbox checked={item.selected} onChange={() => toggleItem(idx)} /></TableCell>
                      <TableCell>{item.rowNumber}</TableCell>
                      <TableCell><TextField size="small" value={item.itemCode} onChange={(e) => updateItem(idx, 'itemCode', e.target.value)} sx={{ width: 100 }} /></TableCell>
                      <TableCell><TextField size="small" value={item.itemName} fullWidth onChange={(e) => updateItem(idx, 'itemName', e.target.value)} /></TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                          <Select value={item.unitName} onChange={(e) => updateItem(idx, 'unitName', e.target.value)}>
                            {units?.map((u: any) => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}
                            <MenuItem value={item.unitName}>{item.unitName}</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select value={item.categoryName} onChange={(e) => updateItem(idx, 'categoryName', e.target.value)}>
                            {categories?.map((c: any) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
                            <MenuItem value={item.categoryName}>{item.categoryName}</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Remove"><IconButton size="small" color="error" onClick={() => removeItem(idx)}><Delete fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Button sx={{ mt: 2 }} onClick={() => { setItems([]); }}>Clear All</Button>
        </Box>
      )}
    </Box>
  );
}

// ========== Main Unified Tools Page ==========
export default function ToolsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700 }}>Tools</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, letterSpacing: '0.02em' }}>
        Text convert, XPS/PDF parse, aur items import - sab ek jagah
      </Typography>

      <Paper sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab icon={<Transform />} iconPosition="start" label="Text Converter" />
          <Tab icon={<CloudUpload />} iconPosition="start" label="XPS/PDF/TXT Convert" />
          <Tab icon={<Inventory2 />} iconPosition="start" label="Item Import" />
        </Tabs>
      </Paper>

      {tab === 0 && <TextConverterTab />}
      {tab === 1 && <XpsFileConverterTab />}
      {tab === 2 && <ItemImportTab />}
    </Box>
  );
}
