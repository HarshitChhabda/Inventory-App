import React from 'react';
import { Box, Card, CardContent, Stack, Typography, alpha, useTheme, Chip, Divider } from '@mui/material';
import { SvgIconTypeMap } from '@mui/material';
import { OverridableComponent } from '@mui/material/OverridableComponent';

interface ChallanFormSectionProps {
  icon: OverridableComponent<SvgIconTypeMap> & { muiName: string };
  title: string;
  count?: number;
  chips?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}

export default function ChallanFormSection({
  icon: Icon,
  title,
  count,
  chips,
  children,
  accent,
}: ChallanFormSectionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const accentColor = accent || theme.palette.primary.main;

  return (
    <Card
      role="region"
      aria-label={title}
      sx={{
        mb: 2.5,
        border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
        borderRadius: '16px',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 4px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
        transition: 'box-shadow 200ms ease-out',
        '&:hover': {
          boxShadow: isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
        },
      }}
    >
      {/* Section Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)'}`,
          background: isDark
            ? `linear-gradient(135deg, ${alpha(accentColor, 0.08)} 0%, transparent 100%)`
            : `linear-gradient(135deg, ${alpha(accentColor, 0.04)} 0%, transparent 100%)`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${alpha(accentColor, 0.15)} 0%, ${alpha(accentColor, 0.05)} 100%)`,
            border: `1px solid ${alpha(accentColor, 0.12)}`,
          }}
        >
          <Icon sx={{ fontSize: 17, color: accentColor }} />
        </Box>
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{
            fontSize: '0.875rem',
            letterSpacing: '-0.01em',
            color: 'text.primary',
          }}
        >
          {title}
        </Typography>
        {count !== undefined && count > 0 && (
          <Chip
            label={`${count}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.6875rem',
              fontWeight: 700,
              backgroundColor: alpha(accentColor, 0.1),
              color: accentColor,
              border: `1px solid ${alpha(accentColor, 0.2)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
        {chips}
      </Box>

      {/* Section Content */}
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {children}
      </CardContent>
    </Card>
  );
}
