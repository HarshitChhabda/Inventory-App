import React from 'react';
import { Chip, ChipProps, useTheme } from '@mui/material';
import {
  CheckCircle, Error, Warning, Info, Schedule, Cancel,
  Inventory, LocalShipping, Build, Assignment, Security,
} from '@mui/icons-material';

type StatusType =
  | 'DRAFT' | 'POSTED' | 'CANCELLED' | 'APPROVED' | 'REJECTED'
  | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ASSIGNED'
  | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'CLOSED' | 'SCRAPPED'
  | 'ACTIVE' | 'INACTIVE' | 'OPEN' | 'SUBMITTED'
  | 'PARTIAL' | 'RETURNED' | 'FORWARDED' | 'ON_HOLD'
  | string;

interface StatusConfig {
  color: ChipProps['color'];
  icon: React.ReactElement;
  label: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  DRAFT: { color: 'default', icon: <Schedule sx={{ fontSize: 14 }} />, label: 'Draft' },
  POSTED: { color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} />, label: 'Posted' },
  CANCELLED: { color: 'error', icon: <Cancel sx={{ fontSize: 14 }} />, label: 'Cancelled' },
  APPROVED: { color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} />, label: 'Approved' },
  REJECTED: { color: 'error', icon: <Error sx={{ fontSize: 14 }} />, label: 'Rejected' },
  PENDING: { color: 'warning', icon: <Schedule sx={{ fontSize: 14 }} />, label: 'Pending' },
  IN_PROGRESS: { color: 'info', icon: <Build sx={{ fontSize: 14 }} />, label: 'In Progress' },
  COMPLETED: { color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} />, label: 'Completed' },
  ASSIGNED: { color: 'primary', icon: <Assignment sx={{ fontSize: 14 }} />, label: 'Assigned' },
  ORDERED: { color: 'primary', icon: <LocalShipping sx={{ fontSize: 14 }} />, label: 'Ordered' },
  PARTIALLY_RECEIVED: { color: 'warning', icon: <Inventory sx={{ fontSize: 14 }} />, label: 'Partial' },
  CLOSED: { color: 'default', icon: <CheckCircle sx={{ fontSize: 14 }} />, label: 'Closed' },
  SCRAPPED: { color: 'error', icon: <Warning sx={{ fontSize: 14 }} />, label: 'Scrapped' },
  ACTIVE: { color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} />, label: 'Active' },
  INACTIVE: { color: 'default', icon: <Cancel sx={{ fontSize: 14 }} />, label: 'Inactive' },
  OPEN: { color: 'info', icon: <Info sx={{ fontSize: 14 }} />, label: 'Open' },
  SUBMITTED: { color: 'primary', icon: <Assignment sx={{ fontSize: 14 }} />, label: 'Submitted' },
  PARTIAL: { color: 'warning', icon: <Inventory sx={{ fontSize: 14 }} />, label: 'Partial' },
  RETURNED: { color: 'warning', icon: <Warning sx={{ fontSize: 14 }} />, label: 'Returned' },
  FORWARDED: { color: 'info', icon: <Info sx={{ fontSize: 14 }} />, label: 'Forwarded' },
  ON_HOLD: { color: 'warning', icon: <Schedule sx={{ fontSize: 14 }} />, label: 'On Hold' },
};

const FALLBACK_COLORS: Record<string, ChipProps['color']> = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  primary: 'primary',
};

function getStatusConfig(status: string): StatusConfig {
  if (!status) {
    return {
      color: 'default',
      icon: <Info sx={{ fontSize: 14 }} />,
      label: 'Unknown',
    };
  }
  if (STATUS_MAP[status]) return STATUS_MAP[status];
  const upper = status.toUpperCase().replace(/[\s-]/g, '_');
  if (STATUS_MAP[upper]) return STATUS_MAP[upper];
  const lower = status.toLowerCase();
  for (const [key, config] of Object.entries(STATUS_MAP)) {
    if (config.label.toLowerCase() === lower) return config;
  }
  return {
    color: 'default',
    icon: <Info sx={{ fontSize: 14 }} />,
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
  };
}

export interface StatusBadgeProps {
  status: StatusType;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  sx?: object;
}

export default function StatusBadge({
  status,
  size = 'small',
  variant = 'filled',
  sx,
}: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size={size}
      variant={variant}
      role="status"
      aria-label={`Status: ${config.label}`}
      sx={{
        fontWeight: 600,
        fontSize: '0.6875rem',
        height: size === 'small' ? 24 : 28,
        borderRadius: '6px',
        '& .MuiChip-icon': {
          fontSize: 14,
        },
        ...sx,
      }}
    />
  );
}
