import React, { useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, IconButton, CircularProgress, useTheme, alpha,
} from '@mui/material';
import { Close } from '@mui/icons-material';

export interface EnterpriseDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  loading?: boolean;
  disableBackdropClick?: boolean;
  disableEscape?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  stickyHeader?: boolean;
  stickyFooter?: boolean;
  bodySx?: object;
}

export default function EnterpriseDialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'sm',
  fullWidth = true,
  loading = false,
  disableBackdropClick = false,
  disableEscape = false,
  actions,
  children,
  stickyHeader = true,
  stickyFooter = true,
  bodySx,
}: EnterpriseDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleClose = useCallback((_event: object, reason: string) => {
    if (loading) return;
    if (disableBackdropClick && reason === 'backdropClick') return;
    if (disableEscape && reason === 'escapeKeyDown') return;
    onClose();
  }, [loading, disableBackdropClick, disableEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscape && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, disableEscape, loading, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disableEscapeKeyDown={disableEscape}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          maxHeight: '85vh',
          ...bodySx,
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          pt: 2.5,
          pb: subtitle ? 1 : 2,
          borderBottom: subtitle ? `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}` : 'none',
          ...(stickyHeader && {
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          }),
        }}
      >
        {icon && (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDark
                ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(124,58,237,0.15) 100%)'
                : 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)',
              flexShrink: 0,
              '& .MuiSvgIcon-root': {
                fontSize: 20,
                color: isDark ? '#60A5FA' : '#2563EB',
              },
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1.3,
              color: 'text.primary',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={onClose}
          disabled={loading}
          aria-label="Close dialog"
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
            },
          }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent
        sx={{
          px: 3,
          py: 2.5,
          position: 'relative',
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: isDark ? '#334155' : '#CBD5E1',
            borderRadius: 3,
          },
        }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(isDark ? '#0F172A' : '#FFFFFF', 0.7),
              zIndex: 1,
              borderRadius: '4px',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                Processing...
              </Typography>
            </Box>
          </Box>
        )}
        {children}
      </DialogContent>

      {/* Footer */}
      {actions && (
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}`,
            gap: 1.5,
            ...(stickyFooter && {
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            }),
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}
