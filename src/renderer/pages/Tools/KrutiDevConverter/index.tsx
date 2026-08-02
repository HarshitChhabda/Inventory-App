import React, { useState, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Stack, TextField, FormControl,
  InputLabel, Select, MenuItem, Alert, CircularProgress, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  ContentPaste, Transform, GetApp, Upload, TableChart,
  ContentCopy, CheckCircle, Delete, Description,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

interface ConvertedRow {
  columns: string[];
}

interface ConversionResult {
  hindi: string;
  english: string;
  detectedFont: string;
  conversionCount: number;
  rows: ConvertedRow[];
  header: string;
  subHeader: string;
  tableHeaders: string[];
}

export default function KrutiDevConverterPage() {
  const [inputText, setInputText] = useState('');
  const [fontType, setFontType] = useState<string>('auto');
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse converted text into structured format
  const parseConvertedText = (text: string): Omit<ConversionResult, 'hindi' | 'english' | 'detectedFont' | 'conversionCount'> => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 3) {
      return { rows: [], header: '', subHeader: '', tableHeaders: [] };
    }

    // First line = header (organization name)
    const header = lines[0].trim();
    // Second line = sub-header (report title)
    const subHeader = lines[1].trim();

    // Find table header row
    let tableHeaderIdx = -1;
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('क्र.') || line.includes('क्रम') || line.includes('आइटम') || line.includes('नाम')) {
        tableHeaderIdx = i;
        break;
      }
    }
    if (tableHeaderIdx === -1) tableHeaderIdx = 2;

    // Parse table headers
    const tableHeaders = lines[tableHeaderIdx].trim().split(/\s{2,}|\t/).filter(c => c.trim());

    // Parse data rows
    const rows: ConvertedRow[] = [];
    for (let i = tableHeaderIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(c => c);
      if (columns.length >= 2) {
        rows.push({ columns });
      }
    }

    return { rows, header, subHeader, tableHeaders };
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'xps') {
      // XPS file - use existing converter
      setIsConverting(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const conversionResult = await (window as any).electronAPI.convertXps(arrayBuffer);

        if (conversionResult.success && conversionResult.hindiDoc) {
          const hindiText = conversionResult.hindiDoc.pages
            ?.flatMap((p: any) => p.textRuns?.map((r: any) => r.text) || [])
            .join('\n') || '';

          const englishText = conversionResult.englishDoc?.pages
            ?.flatMap((p: any) => p.textRuns?.map((r: any) => r.text) || [])
            .join('\n') || '';

          const parsed = parseConvertedText(hindiText);
          setResult({
            hindi: hindiText,
            english: englishText,
            detectedFont: conversionResult.fontDetections?.[0]?.detectedType || 'krutidev',
            conversionCount: conversionResult.conversionCount || 0,
            ...parsed,
          });
          toast.success('XPS file converted!');
        } else {
          setError(conversionResult.error || 'Failed to convert XPS file');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to read XPS file');
      } finally {
        setIsConverting(false);
      }
    } else if (ext === 'pdf') {
      // PDF file - extract text and convert
      setIsConverting(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfResult = await (window as any).electronAPI.extractTextFromPdf(arrayBuffer);

        if (pdfResult.text) {
          setInputText(pdfResult.text);

          // Convert extracted text
          const converted = await (window as any).electronAPI.convertXpsText(pdfResult.text, fontType);
          const parsed = parseConvertedText(converted.hindi);
          setResult({ ...converted, ...parsed });
          toast.success(`PDF converted! (${pdfResult.numPages} pages)`);
        } else {
          setError('No text found in PDF. The PDF may contain only images.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to read PDF file');
      } finally {
        setIsConverting(false);
      }
    } else if (ext === 'txt' || ext === 'text') {
      // Text file - read and convert
      setIsConverting(true);
      setError(null);
      try {
        const text = await file.text();
        setInputText(text);

        const converted = await (window as any).electronAPI.convertXpsText(text, fontType);
        const parsed = parseConvertedText(converted.hindi);
        setResult({ ...converted, ...parsed });
        toast.success('Text file converted!');
      } catch (err: any) {
        setError(err?.message || 'Failed to read text file');
      } finally {
        setIsConverting(false);
      }
    } else {
      toast.error('Unsupported file type. Please use .xps, .pdf, or .txt files');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleTextConvert = async () => {
    if (!inputText.trim()) {
      toast.error('Please paste some text first');
      return;
    }

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

  // Export to Excel
  const handleExportExcel = async () => {
    if (!result) return;

    try {
      // Build Excel data
      const excelData = {
        header: result.header,
        subHeader: result.subHeader,
        tableHeaders: result.tableHeaders,
        rows: result.rows.map(r => r.columns),
        hindiText: result.hindi,
        englishText: result.english,
      };

      const buffer = await (window as any).electronAPI.exportKrutiDevToExcel(excelData);
      const saved = await (window as any).electronAPI.saveXpsFile(buffer, 'converted_stock_report.xlsx');

      if (saved) {
        toast.success(`Excel saved: ${saved}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Kruti Dev → Unicode Hindi Converter
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Convert Kruti Dev 010 / DevLys 010 encoded text to Unicode Hindi. Upload XPS/TXT files or paste text directly.
      </Typography>

      {/* File Upload Zone */}
      <Paper
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        sx={{
          p: 4, mb: 3, textAlign: 'center', cursor: 'pointer',
          border: '2px dashed', borderColor: isDragOver ? 'primary.main' : 'grey.400',
          bgcolor: isDragOver ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xps,.pdf,.txt,.text"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
        {isConverting ? (
          <CircularProgress size={48} sx={{ mb: 2 }} />
        ) : (
          <Upload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        )}
        <Typography variant="h6" gutterBottom>
          {isConverting ? 'Converting...' : 'Drop XPS/PDF/TXT file here or click to upload'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supports .xps, .pdf, and .txt files with Kruti Dev / DevLys encoding
        </Typography>
      </Paper>

      <Divider sx={{ my: 3 }}>
        <Chip label="OR" />
      </Divider>

      {/* Text Paste Zone */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <ContentPaste color="primary" />
          <Typography variant="h6">Paste Kruti Dev / DevLys Text</Typography>
        </Stack>

        <TextField
          fullWidth
          multiline
          rows={12}
          placeholder={`Paste your Kruti Dev / DevLys encoded text here...\n\nExpected format:\nदिगम्बर जैन अतिशय क्षेत्र श्रीमहावीरजी, जिला करौली (राज.)\nसमस्त आइटमों की चालू स्टॉक रिपोर्ट\n\nक्र.    आइटम नाम    दर    चालू मात्रा    इकाई    राशि\n1    एक्वागार्ड    0    1    नग    0`}
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

          <Button
            variant="contained"
            startIcon={isConverting ? <CircularProgress size={20} /> : <Transform />}
            onClick={handleTextConvert}
            disabled={isConverting || !inputText.trim()}
          >
            {isConverting ? 'Converting...' : 'Convert Text'}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Results */}
      {result && (
        <Paper sx={{ p: 3 }}>
          <Alert severity="success" sx={{ mb: 3 }}>
            Detected: <strong>{result.detectedFont.toUpperCase()}</strong> |
            Converted: {result.conversionCount > 0 ? 'Yes' : 'Already Unicode'} |
            Rows: {result.rows.length}
          </Alert>

          {/* Header */}
          {result.header && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Mangal, Nirmala UI, sans-serif', fontWeight: 'bold', color: 'primary.main' }}>
                {result.header}
              </Typography>
              {result.subHeader && (
                <Typography variant="subtitle1" sx={{ fontFamily: 'Mangal, Nirmala UI, sans-serif', color: 'text.secondary' }}>
                  {result.subHeader}
                </Typography>
              )}
            </Box>
          )}

          {/* Table */}
          {result.tableHeaders.length > 0 && result.rows.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    {result.tableHeaders.map((col, idx) => (
                      <TableCell key={idx} sx={{
                        color: 'white', fontWeight: 'bold',
                        fontFamily: 'Mangal, Nirmala UI, sans-serif',
                        borderBottom: '2px solid white',
                      }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.rows.map((row, rowIdx) => (
                    <TableRow key={rowIdx} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                      {row.columns.map((cell, cellIdx) => (
                        <TableCell key={cellIdx} sx={{
                          fontFamily: 'Mangal, Nirmala UI, sans-serif',
                          textAlign: (cellIdx === 2 || cellIdx === 3 || cellIdx === 5) ? 'right' : 'left',
                        }}>
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Side by Side Text */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                Hindi (Unicode)
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, minHeight: 200, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                <Box sx={{ fontFamily: 'Mangal, Nirmala UI, sans-serif', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '14px' }}>
                  {result.hindi}
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.main', fontWeight: 'bold' }}>
                English Translation
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, minHeight: 200, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                <Box sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '14px' }}>
                  {result.english}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="success"
              startIcon={<TableChart />}
              onClick={handleExportExcel}
              size="large"
            >
              Export to Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => {
                navigator.clipboard.writeText(result.hindi);
                toast.success('Hindi text copied!');
              }}
            >
              Copy Hindi
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => {
                navigator.clipboard.writeText(result.english);
                toast.success('English text copied!');
              }}
            >
              Copy English
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
