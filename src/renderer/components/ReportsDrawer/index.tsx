import React, { Suspense } from 'react';
import { Drawer, Box, IconButton, Typography, useTheme, alpha, Stack, Chip, CircularProgress } from '@mui/material';
import { Close, Assessment, Fullscreen, FullscreenExit } from '@mui/icons-material';

const ReportsPage = React.lazy(() => import('../../pages/Reports'));

interface ReportsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ReportsDrawer({ open, onClose }: ReportsDrawerProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isFullscreen ? '100vw' : '80vw',
          maxWidth: isFullscreen ? 'none' : '1400px',
          transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: isDark ? '#0B1120' : '#FFFFFF',
          borderLeft: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
          boxShadow: isDark
            ? '-8px 0 32px rgba(0, 0, 0, 0.5)'
            : '-8px 0 32px rgba(0, 0, 0, 0.08)',
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: alpha('#000', isDark ? 0.6 : 0.4),
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
          backgroundColor: isDark ? '#0B1120' : '#FFFFFF',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${isDark ? '#334155' : '#CBD5E1'}, transparent)`,
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Assessment sx={{ fontSize: 20, color: '#FFFFFF' }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Poppins", sans-serif',
                fontWeight: 700,
                fontSize: '1rem',
                color: 'text.primary',
                lineHeight: 1.2,
              }}
            >
              Report Center
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.6875rem',
                color: 'text.secondary',
                fontWeight: 500,
              }}
            >
              Analytics, reports & data exports
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Chip
            label="LIVE"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              backgroundColor: alpha('#22C55E', 0.1),
              color: '#22C55E',
              border: `1px solid ${alpha('#22C55E', 0.2)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <IconButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            size="small"
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
            {isFullscreen ? <FullscreenExit sx={{ fontSize: 18 }} /> : <Fullscreen sx={{ fontSize: 18 }} />}
          </IconButton>
          <IconButton
            onClick={onClose}
            aria-label="Close reports panel"
            size="small"
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
                color: '#EF4444',
              },
            }}
          >
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 3,
          py: 2.5,
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: isDark ? '#334155' : '#CBD5E1',
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: isDark ? '#475569' : '#94A3B8',
          },
        }}
      >
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>}>
          <ReportsPage />
        </Suspense>
      </Box>
    </Drawer>
  );
}
