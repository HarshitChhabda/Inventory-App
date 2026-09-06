import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, useTheme,
} from '@mui/material';
import { Warning } from '@mui/icons-material';

interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onSaveDraft?: () => void;
  hasDraftSupport?: boolean;
}

export default function UnsavedChangesDialog({
  open,
  onConfirm,
  onCancel,
  onSaveDraft,
  hasDraftSupport = false,
}: UnsavedChangesDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const dialogTitleId = 'unsaved-changes-dialog-title';

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
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
              backgroundColor: isDark ? 'rgba(251,191,36,0.1)' : '#FFFBEB',
              flexShrink: 0,
              '& .MuiSvgIcon-root': {
                fontSize: 22,
                color: isDark ? '#FBBF24' : '#D97706',
              },
            }}
          >
            <Warning />
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
                mb: 0.5,
              }}
            >
              Unsaved Changes
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.6, fontSize: '0.8125rem' }}
            >
              You have unsaved changes on this page. If you leave now, those changes will be lost.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onCancel}
          sx={{ fontWeight: 500, fontSize: '0.8125rem' }}
        >
          Continue Editing
        </Button>
        {hasDraftSupport && onSaveDraft && (
          <Button
            variant="outlined"
            onClick={onSaveDraft}
            sx={{ fontWeight: 500, fontSize: '0.8125rem' }}
          >
            Save as Draft
          </Button>
        )}
        <Button
          variant="contained"
          color="warning"
          onClick={onConfirm}
          sx={{ fontWeight: 600, fontSize: '0.8125rem', minWidth: 100 }}
        >
          Discard Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
