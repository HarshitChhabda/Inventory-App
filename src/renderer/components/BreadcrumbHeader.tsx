import React from 'react';
import { Box, Typography, Stack, Breadcrumbs, Link, Chip, useTheme } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
  status?: { label: string; color?: 'default' | 'primary' | 'success' | 'warning' | 'error' };
  children?: React.ReactNode;
}

export default function BreadcrumbHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  status,
  children,
}: BreadcrumbHeaderProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<ChevronRight sx={{ fontSize: 14, color: isDark ? '#475569' : '#CBD5E1' }} />}
          sx={{ mb: 1.5 }}
        >
          {breadcrumbs.map((crumb, idx) => (
            crumb.path ? (
              <Link
                key={idx}
                component="button"
                variant="body2"
                onClick={() => navigate(crumb.path!)}
                sx={{
                  color: isDark ? '#94A3B8' : '#64748B',
                  textDecoration: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  '&:hover': { color: isDark ? '#60A5FA' : '#2563EB' },
                  cursor: 'pointer',
                }}
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography key={idx} variant="body2" sx={{
                color: 'text.primary', fontWeight: 600, fontSize: '0.75rem',
              }}>
                {crumb.label}
              </Typography>
            )
          ))}
        </Breadcrumbs>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h4" sx={{
                color: 'text.primary',
                fontWeight: 800,
                fontSize: '1.375rem',
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
              }}>
                {title}
              </Typography>
              {status && (
                <Chip
                  label={status.label}
                  size="small"
                  color={status.color || 'default'}
                  sx={{
                    height: 22,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                  }}
                />
              )}
            </Stack>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{
                mt: 0.25,
                fontSize: '0.8125rem',
                lineHeight: 1.4,
              }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {actions && <Stack direction="row" spacing={1} alignItems="center">{actions}</Stack>}
      </Stack>
      {children}
    </Box>
  );
}
