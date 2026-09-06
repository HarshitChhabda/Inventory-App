import React, { useRef } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Divider, Button, Stack } from '@mui/material';
import { Print, PictureAsPdf } from '@mui/icons-material';
import QRCode from 'qrcode';

const ORG_NAME = JSON.parse(localStorage.getItem('settings') || '{}').companyName || 'Digambar Jain Atishay Kshetra';
const HEADER_TEXT = JSON.parse(localStorage.getItem('settings') || '{}').headerText || 'SHRI MAHAVEERJI';

export interface SignatureBlock {
  label: string;
  name?: string;
  role?: string;
  date?: string;
}

export interface FormSection {
  title: string;
  content: React.ReactNode;
}

export interface PrintableFormLayoutProps {
  documentNumber: string;
  documentTitle: string;
  date: string;
  sections: FormSection[];
  itemTable?: {
    columns: string[];
    rows: (string | number | React.ReactNode)[][];
  };
  signatures: SignatureBlock[];
  remarks?: string;
  qrData?: string;
  subtitle?: string;
  showActions?: boolean;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
}

export default function PrintableFormLayout({
  documentNumber,
  documentTitle,
  date,
  sections,
  itemTable,
  signatures,
  remarks,
  qrData,
  subtitle,
  showActions = true,
  onPrint,
  onDownloadPdf,
}: PrintableFormLayoutProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [qrUrl, setQrUrl] = React.useState<string>('');

  React.useEffect(() => {
    if (qrData) {
      QRCode.toDataURL(qrData, { width: 80, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } })
        .then(setQrUrl)
        .catch(() => {});
    }
  }, [qrData]);

  const handlePrint = () => {
    onPrint?.();
    window.print();
  };

  return (
    <Box className="printable-form" sx={{ maxWidth: 800, mx: 'auto', p: 3, '@media print': { p: 0 } }}>
      {showActions && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, '@media print': { display: 'none' } }}>
          <Button variant="contained" startIcon={<Print />} onClick={handlePrint} size="small">Print</Button>
          {onDownloadPdf && (
            <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={onDownloadPdf} size="small">Download PDF</Button>
          )}
        </Stack>
      )}

      <Box ref={printRef} sx={{
        border: '2px solid #000',
        p: 3,
        backgroundColor: '#fff',
        color: '#000',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        '@media print': { border: 'none', boxShadow: 'none', p: '15mm' },
      }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 2, position: 'relative' }}>
          {qrUrl && (
            <Box component="img" src={qrUrl} alt="QR" sx={{ position: 'absolute', right: 0, top: 0, width: 64, height: 64 }} />
          )}
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {ORG_NAME}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#444' }}>
            {HEADER_TEXT}
          </Typography>
          <Divider sx={{ my: 1.5, borderColor: '#000' }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {documentTitle}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: '0.75rem', color: '#555', mt: 0.5 }}>{subtitle}</Typography>
          )}
        </Box>

        {/* Document info row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, fontSize: '0.8rem', borderBottom: '1px solid #ccc', pb: 1 }}>
          <Box>
            <strong>Document No:</strong> {documentNumber}
          </Box>
          <Box>
            <strong>Date:</strong> {date}
          </Box>
        </Box>

        {/* Sections */}
        {sections.map((section, idx) => (
          <Box key={idx} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, mb: 1, backgroundColor: '#f0f0f0', p: 0.5, border: '1px solid #ccc' }}>
              {section.title}
            </Typography>
            <Box sx={{ fontSize: '0.8rem', lineHeight: 1.8 }}>
              {section.content}
            </Box>
          </Box>
        ))}

        {/* Item Table */}
        {itemTable && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, mb: 1, backgroundColor: '#f0f0f0', p: 0.5, border: '1px solid #ccc' }}>
              Item Details
            </Typography>
            <TableContainer>
              <Table size="small" sx={{ border: '1px solid #000', '& td, & th': { border: '1px solid #000', p: 1, fontSize: '0.75rem' } }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                    <TableCell sx={{ fontWeight: 700, width: 30 }}>#</TableCell>
                    {itemTable.columns.map((col, i) => (
                      <TableCell key={i} sx={{ fontWeight: 700 }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itemTable.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell>{ri + 1}</TableCell>
                      {row.map((cell, ci) => (
                        <TableCell key={ci}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {itemTable.rows.length < 5 && Array.from({ length: 5 - itemTable.rows.length }).map((_, i) => (
                    <TableRow key={`empty-${i}`}>
                      <TableCell>{itemTable.rows.length + i + 1}</TableCell>
                      {itemTable.columns.map((_, ci) => (
                        <TableCell key={ci}>&nbsp;</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Remarks */}
        {remarks !== undefined && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, mb: 0.5, backgroundColor: '#f0f0f0', p: 0.5, border: '1px solid #ccc' }}>
              Remarks
            </Typography>
            <Box sx={{ border: '1px solid #ccc', p: 1, minHeight: 60, fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {remarks || ''}
            </Box>
          </Box>
        )}

        {/* Signatures */}
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(signatures.length, 4)}, 1fr)`, gap: 2, mt: 4 }}>
          {signatures.map((sig, idx) => (
            <Box key={idx} sx={{ textAlign: 'center' }}>
              <Box sx={{ borderBottom: '1px solid #000', mb: 0.5, height: 40 }} />
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{sig.label}</Typography>
              {sig.name && (
                <Typography sx={{ fontSize: '0.65rem', color: '#555' }}>{sig.name}</Typography>
              )}
              {sig.role && (
                <Typography sx={{ fontSize: '0.6rem', color: '#777' }}>{sig.role}</Typography>
              )}
              {sig.date && (
                <Typography sx={{ fontSize: '0.6rem', color: '#777' }}>Date: {sig.date}</Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Footer */}
        <Box sx={{ mt: 3, pt: 1, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#777' }}>
          <Typography sx={{ fontSize: '0.65rem' }}>This is a computer-generated document.</Typography>
          <Typography sx={{ fontSize: '0.65rem' }}>{ORG_NAME}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
