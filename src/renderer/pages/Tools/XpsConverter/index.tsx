import React, { useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Stepper, Step, StepLabel,
  LinearProgress, Alert, Chip, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab, FormControl,
  InputLabel, Select, MenuItem, FormControlLabel, Checkbox,
  CircularProgress, Divider, TextField, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  CloudUpload, Transform, Translate, GetApp,
  Description, TableChart, Visibility, CheckCircle, Error as ErrorIcon,
  ContentPaste, Article,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

interface ConversionResult {
  success: boolean;
  originalDoc: { pages: any[]; tables: any[]; fonts: string[]; pageCount: number };
  hindiDoc: { pages: any[]; tables: any[]; fonts: string[]; pageCount: number };
  englishDoc: { pages: any[]; tables: any[]; fonts: string[]; pageCount: number };
  fontDetections: Array<{ fontName: string; detectedType: string; confidence: number }>;
  conversionCount: number;
  translationCount: number;
  error?: string;
}

interface TextConversionResult {
  hindi: string;
  english: string;
  detectedFont: string;
  conversionCount: number;
}

interface Progress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

const STEPS = ['Upload XPS', 'Parse & Detect', 'Convert to Hindi', 'Translate to English', 'Export'];

type InputMode = 'xps' | 'text';

export default function XpsConverterPage() {
  const [inputMode, setInputMode] = useState<InputMode>('xps');
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<string>('xlsx');
  const [bilingualMode, setBilingualMode] = useState(true);
  const [previewTab, setPreviewTab] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text paste state
  const [inputText, setInputText] = useState('');
  const [fontType, setFontType] = useState<string>('auto');
  const [textResult, setTextResult] = useState<TextConversionResult | null>(null);
  const [isConvertingText, setIsConvertingText] = useState(false);

  const handleModeChange = (_: any, newMode: InputMode | null) => {
    if (newMode !== null) {
      setInputMode(newMode);
      setResult(null);
      setTextResult(null);
      setError(null);
      setActiveStep(0);
    }
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.xps')) {
      toast.error('Please select an XPS file');
      return;
    }
    setFile(f);
    setActiveStep(1);
    startConversion(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const startConversion = async (f: File) => {
    setIsConverting(true);
    setError(null);
    setResult(null);

    try {
      const arrayBuffer = await f.arrayBuffer();

      setProgress({ stage: 'parsing', current: 0, total: 4, message: 'Parsing XPS document...' });

      const conversionResult = await (window as any).electronAPI.convertXps(arrayBuffer);

      setResult(conversionResult);
      setActiveStep(4);

      if (conversionResult.success) {
        toast.success('Conversion complete!');
      } else {
        toast.error(conversionResult.error || 'Conversion failed');
        setError(conversionResult.error || 'Conversion failed');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  const handleTextConvert = async () => {
    if (!inputText.trim()) {
      toast.error('Please paste some text first');
      return;
    }

    setIsConvertingText(true);
    setTextResult(null);
    setError(null);

    try {
      const converted = await (window as any).electronAPI.convertXpsText(inputText, fontType);
      setTextResult(converted);
      toast.success('Text converted!');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsConvertingText(false);
    }
  };

  const handleExport = async () => {
    if (!result) return;

    try {
      setProgress({ stage: 'exporting', current: 1, total: 1, message: `Exporting as ${exportFormat.toUpperCase()}...` });

      const buffer = await (window as any).electronAPI.exportXps(result, exportFormat, {
        includeHindi: true,
        includeEnglish: true,
        bilingualMode,
        preserveLayout: true,
      }, file?.name || 'converted');

      const defaultName = file?.name?.replace(/\.xps$/i, '') || 'converted';
      const saved = await (window as any).electronAPI.saveXpsFile(buffer, `${defaultName}.${exportFormat}`);

      if (saved) {
        toast.success(`File saved: ${saved}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setProgress(null);
    }
  };

  const renderUploadZone = () => (
    <Paper
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      sx={{
        p: 6, textAlign: 'center', cursor: 'pointer',
        border: '2px dashed', borderColor: isConverting ? 'primary.main' : 'grey.400',
        bgcolor: isConverting ? 'action.hover' : 'background.paper',
        transition: 'all 0.2s',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xps"
        hidden
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      {isConverting ? (
        <CircularProgress size={48} sx={{ mb: 2 }} />
      ) : (
        <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
      )}
      <Typography variant="h5" gutterBottom>
        {isConverting ? 'Converting...' : 'Drop XPS file here or click to browse'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Supports .xps files with DevLys 010, Kruti Dev, or Unicode Hindi text
      </Typography>
      {file && (
        <Chip label={file.name} color="primary" sx={{ mt: 2 }} />
      )}
    </Paper>
  );

  const renderTextPasteZone = () => {
    // Parse converted text into structured format
    const parseStockReport = (text: string) => {
      if (!text) return null;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 3) return null;

      // First line = header (organization name)
      const header = lines[0].trim();
      // Second line = sub-header (report title)
      const subHeader = lines[1].trim();

      // Find table header row (contains क्र. or क्रमांक or आइटम)
      let tableHeaderIdx = -1;
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('क्र.') || line.includes('क्रमांक') || line.includes('आइटम') || line.includes('नाम')) {
          tableHeaderIdx = i;
          break;
        }
      }

      if (tableHeaderIdx === -1) {
        // No table header found, treat line 3 as table header
        tableHeaderIdx = 2;
      }

      // Parse table header columns
      const tableHeaderLine = lines[tableHeaderIdx].trim();
      const columns = tableHeaderLine.split(/\s{2,}|\t/).filter(c => c.trim());

      // Parse data rows (lines after table header)
      const dataRows: string[][] = [];
      for (let i = tableHeaderIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Split by multiple spaces or tabs
        const cells = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(c => c);
        if (cells.length >= 2) {
          dataRows.push(cells);
        }
      }

      return { header, subHeader, columns, dataRows };
    };

    const hindiData = parseStockReport(textResult?.hindi || '');
    const englishData = parseStockReport(textResult?.english || '');

    const HindiTable = ({ data, title }: { data: ReturnType<typeof parseStockReport>; title: string }) => {
      if (!data) return null;
      return (
        <Box sx={{ mb: 3 }}>
          {/* Header */}
          <Typography variant="h6" sx={{ fontFamily: 'Mangal, Nirmala UI, sans-serif', fontWeight: 'bold', color: 'primary.main', mb: 0.5 }}>
            {data.header}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontFamily: 'Mangal, Nirmala UI, sans-serif', color: 'text.secondary', mb: 2 }}>
            {data.subHeader}
          </Typography>

          {/* Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  {data.columns.map((col, idx) => (
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
                {data.dataRows.map((row, rowIdx) => (
                  <TableRow key={rowIdx} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx} sx={{
                        fontFamily: 'Mangal, Nirmala UI, sans-serif',
                        // Right align numbers (columns 2,3,5)
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
        </Box>
      );
    };

    const EnglishTable = ({ data }: { data: ReturnType<typeof parseStockReport> }) => {
      if (!data) return null;
      return (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.main', mb: 0.5 }}>
            {data.header}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: 'text.secondary', mb: 2 }}>
            {data.subHeader}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'success.main' }}>
                  {data.columns.map((col, idx) => (
                    <TableCell key={idx} sx={{ color: 'white', fontWeight: 'bold', borderBottom: '2px solid white' }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.dataRows.map((row, rowIdx) => (
                  <TableRow key={rowIdx} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx} sx={{ textAlign: (cellIdx === 2 || cellIdx === 3 || cellIdx === 5) ? 'right' : 'left' }}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    };

    return (
      <Box>
        <Paper sx={{ p: 3, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <ContentPaste color="primary" />
            <Typography variant="h6">Paste Kruti Dev / DevLys Text</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste text copied from XPS file. Converter will detect Kruti Dev/DevLys encoding
            and convert to Unicode Hindi with proper table formatting.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={12}
            placeholder={`Paste your Kruti Dev / DevLys text here...\n\nThe converter will auto-detect:\n- Header (organization name)\n- Sub-header (report title)\n- Table columns (क्र., आइटम नाम, दर, etc.)\n- Data rows`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            sx={{ mb: 2, '& .MuiInputBase-input': { fontFamily: 'Consolas, monospace', fontSize: '14px' } }}
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
              startIcon={isConvertingText ? <CircularProgress size={20} /> : <Transform />}
              onClick={handleTextConvert}
              disabled={isConvertingText || !inputText.trim()}
            >
              {isConvertingText ? 'Converting...' : 'Convert Text'}
            </Button>
          </Stack>
        </Paper>

        {textResult && (
          <Paper sx={{ p: 3 }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Detected font: <strong>{textResult.detectedFont.toUpperCase()}</strong> |
              Conversion: {textResult.conversionCount > 0 ? 'Applied' : 'Already Unicode'}
            </Alert>

            {/* Hindi Table */}
            {hindiData && <HindiTable data={hindiData} title="Hindi" />}

            {/* English Table */}
            {englishData && <EnglishTable data={englishData} />}

            {/* Fallback: Plain text view if no structure detected */}
            {!hindiData && !englishData && textResult.hindi && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  Hindi (Unicode)
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, minHeight: 200, bgcolor: 'grey.50', mb: 2 }}>
                  <Box sx={{ fontFamily: 'Mangal, Nirmala UI, sans-serif', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                    {textResult.hindi}
                  </Box>
                </Paper>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  English Translation
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, minHeight: 200, bgcolor: 'grey.50' }}>
                  <Box sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                    {textResult.english}
                  </Box>
                </Paper>
              </Box>
            )}

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  navigator.clipboard.writeText(textResult.hindi);
                  toast.success('Hindi text copied!');
                }}
              >
                Copy Hindi
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  navigator.clipboard.writeText(textResult.english);
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
  };

  const renderProgress = () => progress && (
    <Box sx={{ mt: 3 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {progress.message}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
      />
    </Box>
  );

  const renderFontDetections = () => result?.fontDetections && result.fontDetections.length > 0 && (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Font Detection Results
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Font Name</TableCell>
              <TableCell>Detected Type</TableCell>
              <TableCell>Confidence</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {result.fontDetections.map((f, idx) => (
              <TableRow key={idx}>
                <TableCell>{f.fontName}</TableCell>
                <TableCell>
                  <Chip
                    label={f.detectedType.toUpperCase()}
                    size="small"
                    color={f.detectedType === 'unicode' ? 'success' :
                      f.detectedType === 'devlys' || f.detectedType === 'krutidev' ? 'warning' : 'default'}
                  />
                </TableCell>
                <TableCell>{(f.confidence * 100).toFixed(0)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  const renderPreview = () => {
    if (!result) return null;

    const docs = [
      { label: 'Hindi (Unicode)', doc: result.hindiDoc },
      { label: 'English Translation', doc: result.englishDoc },
    ];

    return (
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Preview
        </Typography>

        <Tabs value={previewTab} onChange={(_, v) => setPreviewTab(v)} sx={{ mb: 2 }}>
          {docs.map((d, idx) => (
            <Tab key={idx} label={d.label} />
          ))}
          {result.originalDoc.pages.length > 0 && (
            <Tab label="Original" />
          )}
        </Tabs>

        {previewTab < 2 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Pages: {docs[previewTab].doc.pageCount} | Tables Detected: {docs[previewTab].doc.tables.length}
            </Typography>

            {docs[previewTab].doc.pages.map((page: any) => (
              <Paper key={page.pageNumber} variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Page {page.pageNumber} ({page.textRuns.length} text blocks)
                </Typography>
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {[...page.textRuns]
                    .sort((a: any, b: any) => a.y - b.y || a.x - b.x)
                    .reduce((rows: any[][], run: any) => {
                      const lastRow = rows[rows.length - 1];
                      if (lastRow && Math.abs(lastRow[0].y - run.y) < 5) {
                        lastRow.push(run);
                      } else {
                        rows.push([run]);
                      }
                      return rows;
                    }, [])
                    .map((row: any[], rowIdx: number) => (
                      <Typography key={rowIdx} sx={{ fontFamily: previewTab === 0 ? 'Mangal, Nirmala UI, sans-serif' : 'inherit' }}>
                        {row.map((r: any) => r.text).join(' ')}
                      </Typography>
                    ))
                  }
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        {previewTab === 2 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Original extracted text (before conversion)
            </Typography>
            {result.originalDoc.pages.map((page: any) => (
              <Paper key={page.pageNumber} variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Page {page.pageNumber}
                </Typography>
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {[...page.textRuns]
                    .sort((a: any, b: any) => a.y - b.y || a.x - b.x)
                    .reduce((rows: any[][], run: any) => {
                      const lastRow = rows[rows.length - 1];
                      if (lastRow && Math.abs(lastRow[0].y - run.y) < 5) {
                        lastRow.push(run);
                      } else {
                        rows.push([run]);
                      }
                      return rows;
                    }, [])
                    .map((row: any[], rowIdx: number) => (
                      <Typography key={rowIdx} sx={{ fontFamily: result.originalDoc.fonts[0] || 'monospace' }}>
                        {row.map((r: any) => `${r.text} [${r.fontName}]`).join(' ')}
                      </Typography>
                    ))
                  }
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    );
  };

  const renderBilingualTable = () => {
    if (!result) return null;

    const hindiTexts = result.hindiDoc.pages.flatMap((p: any) =>
      [...p.textRuns].sort((a: any, b: any) => a.y - b.y || a.x - b.x)
        .reduce((rows: any[][], run: any) => {
          const lastRow = rows[rows.length - 1];
          if (lastRow && Math.abs(lastRow[0].y - run.y) < 5) {
            lastRow.push(run);
          } else {
            rows.push([run]);
          }
          return rows;
        }, [])
        .map((row: any[]) => row.map((r: any) => r.text).join(' '))
    );

    const englishTexts = result.englishDoc.pages.flatMap((p: any) =>
      [...p.textRuns].sort((a: any, b: any) => a.y - b.y || a.x - b.x)
        .reduce((rows: any[][], run: any) => {
          const lastRow = rows[rows.length - 1];
          if (lastRow && Math.abs(lastRow[0].y - run.y) < 5) {
            lastRow.push(run);
          } else {
            rows.push([run]);
          }
          return rows;
        }, [])
        .map((row: any[]) => row.map((r: any) => r.text).join(' '))
    );

    const maxRows = Math.max(hindiTexts.length, englishTexts.length);
    if (maxRows === 0) return null;

    return (
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Bilingual View (Side by Side)
        </Typography>
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                  Hindi (Unicode)
                </TableCell>
                <TableCell sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 'bold' }}>
                  English Translation
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: maxRows }, (_, i) => (
                <TableRow key={i} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                  <TableCell sx={{ fontFamily: 'Mangal, Nirmala UI, sans-serif' }}>
                    {hindiTexts[i] || ''}
                  </TableCell>
                  <TableCell>
                    {englishTexts[i] || ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  const renderExportOptions = () => result && (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Options
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Export Format</InputLabel>
            <Select value={exportFormat} label="Export Format" onChange={(e) => setExportFormat(e.target.value)}>
              <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
              <MenuItem value="pdf">PDF (.pdf)</MenuItem>
              <MenuItem value="docx">DOCX (.html for Word)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControlLabel
            control={<Checkbox checked={bilingualMode} onChange={(e) => setBilingualMode(e.target.checked)} />}
            label="Bilingual Side-by-Side"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Button
            variant="contained"
            startIcon={<GetApp />}
            onClick={handleExport}
            fullWidth
            size="large"
          >
            Export {exportFormat.toUpperCase()}
          </Button>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <Alert severity="info">
          <Typography variant="body2">
            Export will include: {result.conversionCount} font conversions, {result.translationCount} translations.
            Document has {result.hindiDoc.pageCount} pages.
          </Typography>
        </Alert>
      </Box>
    </Paper>
  );

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        XPS Document Converter
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Convert XPS files or pasted text with legacy Hindi fonts (DevLys 010, Kruti Dev) to Unicode Hindi and English translation
      </Typography>

      {/* Input Mode Toggle */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle2" color="text.secondary">Input Mode:</Typography>
          <ToggleButtonGroup
            value={inputMode}
            exclusive
            onChange={handleModeChange}
            size="small"
          >
            <ToggleButton value="xps">
              <CloudUpload sx={{ mr: 1, fontSize: 18 }} />
              Upload XPS File
            </ToggleButton>
            <ToggleButton value="text">
              <ContentPaste sx={{ mr: 1, fontSize: 18 }} />
              Paste Text
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* XPS File Mode */}
      {inputMode === 'xps' && (
        <>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && renderUploadZone()}
          {renderProgress()}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

          {result && result.success && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Conversion complete! {result.conversionCount} characters converted from legacy font to Unicode Hindi.
                {result.translationCount} characters translated to English.
              </Alert>

              {renderFontDetections()}
              {renderPreview()}
              {renderBilingualTable()}
              {renderExportOptions()}

              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button variant="outlined" onClick={() => { setActiveStep(0); setResult(null); setFile(null); setError(null); }}>
                  Convert Another File
                </Button>
              </Stack>
            </Box>
          )}

          {result && !result.success && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {result.error || 'Conversion failed. Please check the file format.'}
            </Alert>
          )}
        </>
      )}

      {/* Text Paste Mode */}
      {inputMode === 'text' && (
        <>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {renderTextPasteZone()}
        </>
      )}
    </Box>
  );
}
