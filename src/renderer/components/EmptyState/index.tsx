import React from 'react';
import { Box, Typography, Button, alpha, useTheme } from '@mui/material';
import { Inbox as InboxIcon } from '@mui/icons-material';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
  compact?: boolean;
  size?: 'compact' | 'normal' | 'large';
}

export default function EmptyState({ icon, title, description, action, compact, size }: EmptyStateProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const effectiveSize = size || (compact ? 'compact' : 'normal');
  const iconSize = effectiveSize === 'large' ? 96 : effectiveSize === 'compact' ? 64 : 80;
  const iconFontSize = effectiveSize === 'large' ? 44 : effectiveSize === 'compact' ? 28 : 36;
  const py = effectiveSize === 'large' ? 10 : effectiveSize === 'compact' ? 5 : 8;
  const titleSize = effectiveSize === 'large' ? '1.125rem' : effectiveSize === 'compact' ? '0.9375rem' : '1.0625rem';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py,
        px: 3,
        textAlign: 'center',
        animation: 'fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        opacity: 0,
      }}
    >
      <Box
        sx={{
          width: iconSize,
          height: iconSize,
          borderRadius: effectiveSize === 'large' ? '24px' : '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDark
            ? 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(124,58,237,0.1) 100%)'
            : 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)',
          mb: 2.5,
          border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.1)'}`,
          '& .MuiSvgIcon-root': {
            fontSize: iconFontSize,
            color: isDark ? '#60A5FA' : '#2563EB',
          },
        }}
      >
        {icon || <InboxIcon />}
      </Box>
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: 'text.primary',
          fontWeight: 700,
          fontSize: titleSize,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 360, mb: action ? 3 : 0, lineHeight: 1.6 }}
        >
          {description}
        </Typography>
      )}
      {action && (
        <Button
          variant="contained"
          startIcon={action.icon}
          onClick={action.onClick}
          sx={{
            mt: 2,
            borderRadius: '10px',
            px: 2.5,
            py: 1,
            fontSize: '0.8125rem',
            fontWeight: 600,
            boxShadow: `0 2px 8px ${alpha('#2563EB', 0.25)}`,
            '&:hover': {
              boxShadow: `0 4px 12px ${alpha('#2563EB', 0.35)}`,
              transform: 'translateY(-1px)',
            },
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
