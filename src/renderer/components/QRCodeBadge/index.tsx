import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import QRCode from 'qrcode';

interface QRCodeBadgeProps {
  data: string;
  size?: number;
  label?: string;
  showLabel?: boolean;
}

export default function QRCodeBadge({ data, size = 64, label, showLabel = true }: QRCodeBadgeProps) {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (data) {
      QRCode.toDataURL(data, {
        width: size,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      }).then(setQrUrl).catch(() => {});
    }
  }, [data, size]);

  if (!qrUrl) return null;

  return (
    <Box sx={{ textAlign: 'center', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box component="img" src={qrUrl} alt={`QR: ${data}`} sx={{ width: size, height: size }} />
      {showLabel && (
        <Typography sx={{ fontSize: '0.6rem', color: '#666', mt: 0.25, fontFamily: 'monospace' }}>
          {label || data}
        </Typography>
      )}
    </Box>
  );
}
