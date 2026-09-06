import React from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

export default function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  startIcon,
  sx,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      sx={{
        fontWeight: 600,
        fontSize: '0.8125rem',
        borderRadius: '10px',
        textTransform: 'none',
        px: 2.5,
        minHeight: 36,
        transition: 'all 150ms ease-out',
        ...sx,
      }}
    >
      {loading ? (loadingText || 'Saving...') : children}
    </Button>
  );
}
