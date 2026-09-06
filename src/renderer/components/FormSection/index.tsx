import React from 'react';
import { Box, Typography, Divider, useTheme } from '@mui/material';

export interface FormSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  divider?: boolean;
  sx?: object;
}

export default function FormSection({
  title,
  subtitle,
  icon,
  children,
  divider = true,
  sx,
}: FormSectionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ mb: divider ? 2.5 : 2, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {icon && (
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF',
              flexShrink: 0,
              '& .MuiSvgIcon-root': {
                fontSize: 16,
                color: isDark ? '#60A5FA' : '#2563EB',
              },
            }}
          >
            {icon}
          </Box>
        )}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: '0.8125rem',
              color: 'text.primary',
              lineHeight: 1.3,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.6875rem',
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ pl: icon ? 0 : 0 }}>{children}</Box>
      {divider && (
        <Divider
          sx={{
            mt: 2,
            borderColor: isDark ? '#1E293B' : '#F1F5F9',
          }}
        />
      )}
    </Box>
  );
}
