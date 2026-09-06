import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Stack, alpha, useTheme, Chip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

function useAnimatedCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef<number>();

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(ease(progress) * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); startRef.current = undefined; };
  }, [target, duration]);

  return value;
}

interface MetricCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendUp?: boolean;
  onClick?: () => void;
  delay?: number;
  format?: 'number' | 'currency' | 'compact';
}

export default function MetricCard({
  title, value, prefix = '', suffix = '', icon, color, trend, trendUp, onClick, delay = 0, format = 'number',
}: MetricCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const animated = useAnimatedCounter(value);

  const formatValue = (v: number) => {
    if (format === 'currency') {
      if (v >= 100000) return `${prefix}${(v / 100000).toFixed(1)}L`;
      if (v >= 1000) return `${prefix}${(v / 1000).toFixed(1)}K`;
      return `${prefix}${v.toLocaleString('en-IN')}`;
    }
    if (format === 'compact') {
      if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
      if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
      return v.toLocaleString('en-IN');
    }
    return `${prefix}${v.toLocaleString('en-IN')}${suffix}`;
  };

  return (
    <Card
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={`${title}: ${formatValue(animated)}`}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'visible',
        animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms forwards`,
        opacity: 0,
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          borderRadius: '16px 16px 0 0',
          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.4)})`,
          opacity: 0,
          transition: 'opacity 200ms ease-out',
        },
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px -4px ${alpha(color, 0.15)}`,
          '&::before': { opacity: 1 },
        },
        '&:active': { transform: 'translateY(0)' },
      }}
    >
      <CardContent sx={{ p: '16px !important' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.25}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '11px',
            backgroundColor: alpha(color, isDark ? 0.15 : 0.08),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: color,
          }}>
            {icon}
          </Box>
          {trend && (
            <Chip
              icon={trendUp ? <TrendingUp sx={{ fontSize: '11px !important' }} /> : <TrendingDown sx={{ fontSize: '11px !important' }} />}
              label={trend}
              size="small"
              sx={{
                height: 22, fontWeight: 600, fontSize: '0.625rem',
                backgroundColor: trendUp ? alpha('#16A34A', isDark ? 0.15 : 0.08) : alpha('#DC2626', isDark ? 0.15 : 0.08),
                color: trendUp ? '#16A34A' : '#DC2626',
                border: `1px solid ${trendUp ? alpha('#16A34A', 0.2) : alpha('#DC2626', 0.2)}`,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          )}
        </Stack>
        <Typography variant="caption" sx={{
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.625rem',
        }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{
          fontWeight: 800, color: 'text.primary', lineHeight: 1.1,
          letterSpacing: '-0.025em', fontSize: '1.625rem',
        }}>
          {formatValue(animated)}
        </Typography>
      </CardContent>
    </Card>
  );
}
