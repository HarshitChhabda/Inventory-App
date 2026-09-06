import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, useTheme, alpha,
} from '@mui/material';
import { Warning, Info, CheckCircle } from '@mui/icons-material';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'error' | 'warning' | 'primary' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md';
}

export default function ConfirmDialog({
  open,
  title,
  message,
  subtitle,
  icon,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  confirmColor = 'error',
  onConfirm,
  onCancel,
  loading = false,
  maxWidth = 'xs',
}: ConfirmDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const defaultIcon = confirmColor === 'error'
    ? <Warning />
    : confirmColor === 'success'
      ? <CheckCircle />
      : <Info />;

  const iconBg = confirmColor === 'error'
    ? (isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2')
    : confirmColor === 'success'
      ? (isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4')
      : confirmColor === 'warning'
        ? (isDark ? 'rgba(251,191,36,0.1)' : '#FFFBEB')
        : (isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF');

  const iconColor = confirmColor === 'error'
    ? (isDark ? '#F87171' : '#DC2626')
    : confirmColor === 'success'
      ? (isDark ? '#4ADE80' : '#16A34A')
      : confirmColor === 'warning'
        ? (isDark ? '#FBBF24' : '#D97706')
        : (isDark ? '#60A5FA' : '#2563EB');

  const dialogTitleId = `confirm-dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth={maxWidth}
      fullWidth
      role="alertdialog"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogTitleId}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          overflow: 'hidden',
        },
      }}
    >
      <DialogContent sx={{ px: 3, pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: iconBg,
              flexShrink: 0,
              '& .MuiSvgIcon-root': {
                fontSize: 22,
                color: iconColor,
              },
            }}
          >
            {icon || defaultIcon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              id={dialogTitleId}
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '0.9375rem',
                color: 'text.primary',
                lineHeight: 1.3,
                mb: subtitle ? 0.5 : 0,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 500 }}
              >
                {subtitle}
              </Typography>
            )}
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 1, lineHeight: 1.6, fontSize: '0.8125rem' }}
            >
              {message}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={loading}
          sx={{ fontWeight: 500, fontSize: '0.8125rem' }}
        >
          {cancelText}
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ fontWeight: 600, fontSize: '0.8125rem', minWidth: 100 }}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
