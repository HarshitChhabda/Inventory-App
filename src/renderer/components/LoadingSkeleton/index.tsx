import React from 'react';
import { Box, Skeleton, Stack, Paper, CircularProgress, Typography, alpha, useTheme } from '@mui/material';

const pulseAnimation = {
  '@keyframes pulse': {
    '0%': { opacity: 0.6 },
    '50%': { opacity: 1 },
    '100%': { opacity: 0.6 },
  },
  animation: 'pulse 1.5s ease-in-out infinite',
};

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper sx={{ p: 0, overflow: 'hidden' }}>
      <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
        <Stack direction="row" spacing={2}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} variant="text" width={`${100 / columns}%`} height={20} sx={{ ...pulseAnimation, animationDelay: `${i * 0.1}s` }} />
          ))}
        </Stack>
      </Box>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <Box key={rowIdx} sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', animation: `fadeIn 300ms ease-out ${rowIdx * 50}ms forwards`, opacity: 0 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton key={colIdx} variant="text" width={`${100 / columns}%`} height={16} sx={{ ...pulseAnimation, animationDelay: `${(rowIdx * columns + colIdx) * 0.05}s` }} />
            ))}
          </Stack>
        </Box>
      ))}
    </Paper>
  );
}

export function CardSkeleton() {
  return (
    <Paper sx={{ p: 2.5, borderRadius: '16px', animation: 'fadeInUp 300ms ease-out forwards', opacity: 0 }}>
      <Stack spacing={1.5}>
        <Skeleton variant="circular" width={40} height={40} sx={pulseAnimation} />
        <Skeleton variant="text" width="60%" height={28} sx={pulseAnimation} />
        <Skeleton variant="text" width="40%" height={16} sx={{ ...pulseAnimation, animationDelay: '0.2s' }} />
      </Stack>
    </Paper>
  );
}

export function PageSkeleton() {
  return (
    <Box sx={{ p: 3, animation: 'fadeIn 300ms ease-out forwards', opacity: 0 }}>
      <Skeleton variant="text" width={250} height={36} sx={{ mb: 1, ...pulseAnimation }} />
      <Skeleton variant="text" width={400} height={16} sx={{ mb: 3, ...pulseAnimation, animationDelay: '0.1s' }} />
      <Stack spacing={2}>
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: '10px', ...pulseAnimation, animationDelay: '0.2s' }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: '16px', ...pulseAnimation, animationDelay: '0.3s' }} />
      </Stack>
    </Box>
  );
}

export function PageLoader({ message, icon }: { message?: string; icon?: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      minHeight: 300, gap: 2, animation: 'fadeIn 300ms ease-out forwards', opacity: 0,
    }}>
      {icon ? (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          ...pulseAnimation,
        }}>
          <CircularProgress size={24} />
          <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        </Box>
      ) : (
        <CircularProgress size={36} sx={pulseAnimation} />
      )}
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{
          animation: 'fadeIn 300ms ease-out 0.2s forwards', opacity: 0,
          fontSize: '0.8125rem', fontWeight: 500,
        }}>
          {message}
        </Typography>
      )}
    </Box>
  );
}
