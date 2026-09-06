import React from 'react';
import { Box, Typography, Button, alpha, useTheme } from '@mui/material';
import { Inventory2, Add } from '@mui/icons-material';

interface EmptyItemsStateProps {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyItemsState({
  message = 'No items added yet',
  actionLabel,
  onAction,
}: EmptyItemsStateProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        py: 5,
        px: 3,
        textAlign: 'center',
        animation: 'fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        opacity: 0,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 2,
          background: isDark
            ? 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(124,58,237,0.1) 100%)'
            : 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)',
          border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.08)'}`,
        }}
      >
        <Inventory2
          sx={{
            fontSize: 28,
            color: isDark ? '#60A5FA' : '#2563EB',
          }}
        />
      </Box>
      <Typography
        variant="body1"
        fontWeight={600}
        sx={{
          color: 'text.primary',
          fontSize: '0.875rem',
          mb: 0.5,
        }}
      >
        {message}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          fontSize: '0.8125rem',
          mb: actionLabel ? 2 : 0,
          maxWidth: 280,
          mx: 'auto',
        }}
      >
        Click the button below to add your first item to this challan.
      </Typography>
      {actionLabel && onAction && (
        <Button
          size="small"
          startIcon={<Add />}
          onClick={onAction}
          sx={{
            fontWeight: 600,
            fontSize: '0.8125rem',
            textTransform: 'none',
            borderRadius: '8px',
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
