import React from 'react';
import { Fab, Tooltip, Badge, alpha, useTheme } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { useGuide } from './GuideProvider';

interface GuideButtonProps {
  pageId: string;
  position?: 'fixed' | 'absolute' | 'relative';
}

export default function GuideButton({ pageId, position = 'relative' }: GuideButtonProps) {
  const { openGuide, seenGuides } = useGuide();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hasSeen = seenGuides.includes(pageId);

  return (
    <Tooltip title="Page Guide - Learn about this page" arrow>
      <Badge
        variant="dot"
        invisible={hasSeen}
        sx={{
          '& .MuiBadge-badge': {
            backgroundColor: '#F59E0B',
            color: '#F59E0B',
            boxShadow: `0 0 0 2px ${isDark ? '#1E293B' : '#FFFFFF'}`,
          },
        }}
      >
        <Fab
          size="small"
          onClick={() => openGuide(pageId)}
          sx={{
            position: position === 'fixed' ? 'fixed' : 'relative',
            bottom: position === 'fixed' ? 24 : 'auto',
            right: position === 'fixed' ? 24 : 'auto',
            zIndex: position === 'fixed' ? 1000 : 'auto',
            width: 40,
            height: 40,
            backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF',
            color: isDark ? '#60A5FA' : '#2563EB',
            border: `1px solid ${isDark ? '#2563EB33' : '#BFDBFE'}`,
            boxShadow: position === 'fixed'
              ? '0 4px 12px rgba(37, 99, 235, 0.2)'
              : 'none',
            '&:hover': {
              backgroundColor: isDark ? '#1E40AF' : '#DBEAFE',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <HelpOutline sx={{ fontSize: 20 }} />
        </Fab>
      </Badge>
    </Tooltip>
  );
}
