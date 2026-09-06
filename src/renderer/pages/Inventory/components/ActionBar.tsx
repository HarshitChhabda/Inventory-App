import React from 'react';
import { Button, Paper, Stack, Typography, alpha, useTheme, CircularProgress, Box } from '@mui/material';
import { Save, Send, Cancel } from '@mui/icons-material';

interface ActionBarProps {
  onCancel: () => void;
  onSaveDraft: () => void;
  onPost?: () => void;
  saving?: boolean;
  canSave: boolean;
  postLabel?: string;
  showPostButton?: boolean;
  totalAmount?: number;
}

export default function ActionBar({
  onCancel,
  onSaveDraft,
  onPost,
  saving,
  canSave,
  postLabel = 'Post Challan',
  showPostButton = true,
  totalAmount,
}: ActionBarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      sx={{
        p: 2,
        mt: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1.5,
        position: 'sticky',
        bottom: 16,
        border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
        borderRadius: '16px',
        boxShadow: isDark
          ? '0 -4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 -4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: (theme) => theme.zIndex.appBar - 1,
      }}
    >
      {/* Left: Total Amount */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {totalAmount !== undefined && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.04)',
              border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'}`,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', lineHeight: 1 }}>
              Total
            </Typography>
            <Typography variant="body1" fontWeight={800} sx={{ color: '#22C55E', fontSize: '1.125rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Right: Action Buttons */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={saving}
          startIcon={<Cancel />}
          sx={{
            fontWeight: 500,
            fontSize: '0.8125rem',
            borderRadius: '10px',
            textTransform: 'none',
            borderColor: isDark ? '#334155' : '#E2E8F0',
            color: 'text.secondary',
            '&:hover': {
              borderColor: isDark ? '#475569' : '#CBD5E1',
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={onSaveDraft}
          disabled={!canSave || saving}
          sx={{
            fontWeight: 600,
            fontSize: '0.8125rem',
            borderRadius: '10px',
            textTransform: 'none',
            px: 2.5,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
            '&:hover': {
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
            },
          }}
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </Button>
        {showPostButton && onPost && (
          <Button
            variant="contained"
            color="success"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Send />}
            onClick={onPost}
            disabled={!canSave || saving}
            sx={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              borderRadius: '10px',
              textTransform: 'none',
              px: 2.5,
              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.25)',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.35)',
              },
            }}
          >
            {saving ? 'Posting...' : postLabel}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
