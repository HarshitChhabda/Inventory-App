import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Divider, Button, Stack } from '@mui/material';
import { PictureAsPdf, Print } from '@mui/icons-material';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

interface ChallanPrintLayoutProps {
  type: 'Receipt' | 'Issue' | 'Transfer';
  data: any;
  showActions?: boolean;
}

const settings = JSON.parse(localStorage.getItem('settings') || '{}');
const TRUST_NAME = settings.companyName || 'Digamber Jain Atishay Kshetra';
const HEADER_TEXT = settings.headerText || 'SHRI MAHAVEERJI';

export default function ChallanPrintLayout({ type, data, showActions = true }: ChallanPrintLayoutProps) {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      const enrichedData = {
        ...data,
        _trustName: settings.companyName || 'Digamber Jain Atishay Kshetra',
        _headerText: settings.headerText || 'SHRI MAHAVEERJI',
      };
      const result = await window.electronAPI.generatePdfFromPrint({ type, challanData: enrichedData });
      if (result.success) {
        toast.success(`PDF saved to ${result.path}`);
      }
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <Box className="challan-print" sx={{
      p: 3, maxWidth: 800, mx: 'auto',
      '@media print': { p: 0, boxShadow: 'none', '& *': { overflow: 'visible !important', textOverflow: 'clip !important', whiteSpace: 'normal !important' } },
    }}>
      <Paper sx={{ p: 4, border: '2px solid #000', position: 'relative', overflow: 'visible' }}>
        <Typography variant="h5" textAlign="center" fontWeight={700} gutterBottom sx={{ wordBreak: 'break-word' }}>
          {TRUST_NAME}
        </Typography>
        <Typography variant="h6" textAlign="center" gutterBottom sx={{ wordBreak: 'break-word' }}>
          {HEADER_TEXT}
        </Typography>

        {type === 'Receipt' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" textAlign="center" gutterBottom fontWeight={700}>
              RECEIPT CHALLAN (AAMAD)
            </Typography>

            <Box display="flex" justifyContent="space-between" mb={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Challan No:</strong> {data.challanNo}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Received From:</strong> {data.vendor?.name || data.sourceName}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Invoice No:</strong> {data.invoiceNumber || '-'}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Vehicle No:</strong> {data.vehicleNumber || '-'}</Typography>
                {data.department && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Store:</strong> {data.department?.name}</Typography>}
              </Box>
              <Box textAlign="right" sx={{ minWidth: 150 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Date:</strong> {formatDateDDMMYYYY(data.date)}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Received By:</strong> {data.receivedBy}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Status:</strong> {data.status}</Typography>
              </Box>
            </Box>

            <TableContainer sx={{ overflow: 'visible' }}>
              <Table size="small" sx={{ border: '1px solid #000', tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '5%' }}>#</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '35%' }}>Item Name</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '10%' }} align="center">Qty</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '10%' }} align="center">Unit</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '15%' }} align="right">Rate</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '15%' }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items?.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ border: '1px solid #000' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ border: '1px solid #000', whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.item?.itemName}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="center">{item.quantity}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="center">{item.unit?.name}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="right">₹{Number(item.rate).toFixed(2)}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="right">₹{Number(item.amount || item.quantity * item.rate).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell colSpan={5} sx={{ border: '1px solid #000', fontWeight: 700 }} align="right">Total</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700 }} align="right">
                      ₹{data.items?.reduce((sum: number, i: any) => sum + Number(i.amount || i.quantity * i.rate || 0), 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {data.remarks && (
              <Box mt={2}>
                <Typography variant="body2"><strong>Remarks:</strong> {data.remarks}</Typography>
              </Box>
            )}

            <Box display="flex" justifyContent="space-between" mt={4} sx={{ flexWrap: 'wrap', gap: 2 }}>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">Receiver Sign</Typography>
              </Box>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">Store Incharge Sign</Typography>
              </Box>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">Authorized Sign</Typography>
              </Box>
            </Box>
          </>
        )}

        {type === 'Issue' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" textAlign="center" gutterBottom fontWeight={700}>
              ISSUE CHALLAN (KHARCH)
            </Typography>

            <Box display="flex" justifyContent="space-between" mb={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Challan No:</strong> {data.challanNo}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Issue To:</strong> {data.department?.name}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Approved By:</strong> {data.approvedBy || '-'}</Typography>
                {data.purpose && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Purpose:</strong> {data.purpose}</Typography>}
              </Box>
              <Box textAlign="right" sx={{ minWidth: 150 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Date:</strong> {formatDateDDMMYYYY(data.date)}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Issued By:</strong> {data.issuedBy}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Status:</strong> {data.status}</Typography>
              </Box>
            </Box>

            <TableContainer sx={{ overflow: 'visible' }}>
              <Table size="small" sx={{ border: '1px solid #000', tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '5%' }}>#</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '30%' }}>Item Name</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '10%' }} align="center">Qty</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '10%' }} align="center">Unit</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '20%' }}>Location / Room</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '15%' }}>Purpose</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items?.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ border: '1px solid #000' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ border: '1px solid #000', whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.item?.itemName}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="center">{item.quantity}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="center">{item.unit?.name}</TableCell>
                      <TableCell sx={{ border: '1px solid #000', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {item.location ? `${item.location.locationType} - ${item.location.locationName}` : item.usedAt || '-'}
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #000' }}>{item.purpose || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {data.remarks && (
              <Box mt={2}>
                <Typography variant="body2"><strong>Remarks:</strong> {data.remarks}</Typography>
              </Box>
            )}

            <Box display="flex" justifyContent="space-between" mt={4} sx={{ flexWrap: 'wrap', gap: 2 }}>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">Issued By Sign</Typography>
              </Box>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">Dept / Dharamshala Sign</Typography>
              </Box>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">Store Sign</Typography>
              </Box>
            </Box>
          </>
        )}

        {type === 'Transfer' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" textAlign="center" gutterBottom fontWeight={700}>
              TRANSFER CHALLAN
            </Typography>

            <Box display="flex" justifyContent="space-between" mb={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Challan No:</strong> {data.challanNo}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>From:</strong> {data.fromDepartment?.name}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>To:</strong> {data.toDepartment?.name}</Typography>
              </Box>
              <Box textAlign="right" sx={{ minWidth: 150 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Date:</strong> {formatDateDDMMYYYY(data.date)}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Transferred By:</strong> {data.transferredBy}</Typography>
              </Box>
            </Box>

            <TableContainer sx={{ overflow: 'visible' }}>
              <Table size="small" sx={{ border: '1px solid #000', tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '5%' }}>#</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '40%' }}>Item Name</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '15%' }} align="center">Qty</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700, width: '15%' }} align="right">Rate</TableCell>
                    <TableCell sx={{ border: '1px solid #000', fontWeight: 700 }}>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items?.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ border: '1px solid #000' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ border: '1px solid #000', whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.item?.itemName}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="center">{item.quantity}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }} align="right">₹{Number(item.rate).toFixed(2)}</TableCell>
                      <TableCell sx={{ border: '1px solid #000' }}>{item.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {data.remarks && (
              <Box mt={2}>
                <Typography variant="body2"><strong>Remarks:</strong> {data.remarks}</Typography>
              </Box>
            )}

            <Box display="flex" justifyContent="space-between" mt={4} sx={{ flexWrap: 'wrap', gap: 2 }}>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">From Dept Sign</Typography>
              </Box>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">To Dept Sign</Typography>
              </Box>
              <Box textAlign="center" sx={{ flex: 1, minWidth: 120 }}>
                <Typography variant="body2" mb={4}>___________________</Typography>
                <Typography variant="caption">Authorized Sign</Typography>
              </Box>
            </Box>
          </>
        )}
      </Paper>

      {showActions && (
        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 2, print: { display: 'none' } }}>
          <Button
            variant="outlined"
            startIcon={<Print />}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button
            variant="contained"
            startIcon={<PictureAsPdf />}
            onClick={handleDownloadPdf}
            color="error"
          >
            Download PDF
          </Button>
        </Stack>
      )}
    </Box>
  );
}
