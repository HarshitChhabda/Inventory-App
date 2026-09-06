import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Stack, CircularProgress, useTheme, alpha,
} from '@mui/material';
import { Send, Warning } from '@mui/icons-material';

interface SummaryItem {
  label: string;
  value: string | number;
}

interface PostConfirmationDialogProps {
  open: boolean;
  title: string;
  summary: SummaryItem[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmLabel?: string;
  disableConfirm?: boolean;
}

export default function PostConfirmationDialog({
  open,
  title,
  summary,
  onConfirm,
  onCancel,
  loading = false,
  confirmLabel = 'Post Now',
  disableConfirm = false,
}: PostConfirmationDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const dialogId = `post-confirm-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="sm"
      fullWidth
      role="alertdialog"
      aria-labelledby={dialogId}
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
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
              flexShrink: 0,
            }}
          >
            <Send sx={{ fontSize: 20, color: isDark ? '#60A5FA' : '#2563EB' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              id={dialogId}
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '0.9375rem',
                color: 'text.primary',
                lineHeight: 1.3,
                mb: 0.25,
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                mb: 2,
              }}
            >
              This will post the challan and update stock balances. This action cannot be undone.
            </Typography>

            <Box
              sx={{
                p: 1.5,
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#F8FAFC',
                border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
              }}
            >
              <Stack spacing={0.75}>
                {summary.map((item, idx) => (
                  <Stack key={idx} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 500 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: 'text.primary' }}>
                      {item.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={loading}
          sx={{ fontWeight: 500, fontSize: '0.8125rem', borderRadius: '10px', textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={onConfirm}
          disabled={loading || disableConfirm}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send />}
          sx={{ fontWeight: 600, fontSize: '0.8125rem', minWidth: 100, borderRadius: '10px', textTransform: 'none' }}
        >
          {loading ? 'Posting...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
