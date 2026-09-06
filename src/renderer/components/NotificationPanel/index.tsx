import React, { useState } from 'react';
import {
  Box, Typography, Popover, IconButton, Stack, Avatar, Badge, Button, Divider,
  alpha, useTheme, Chip, Tooltip,
} from '@mui/material';
import {
  Notifications, NotificationImportant, CheckCircle, Warning, Info,
  Inventory, LocalShipping, Assignment, Schedule, PersonAdd, Settings,
  ClearAll, DoneAll, Delete, Archive,
} from '@mui/icons-material';

interface Notification {
  id: number;
  type: 'info' | 'warning' | 'success' | 'error';
  icon: React.ReactNode;
  title: string;
  message: string;
  time: string;
  read: boolean;
  action?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: 'warning',
    icon: <Warning sx={{ fontSize: 18 }} />,
    title: 'Low Stock Alert',
    message: 'LED Bulb 9W stock is below minimum level (5 remaining)',
    time: '2 min ago',
    read: false,
  },
  {
    id: 2,
    type: 'success',
    icon: <CheckCircle sx={{ fontSize: 18 }} />,
    title: 'Receipt Challan Approved',
    message: 'RC-2026-0042 from vendor "Shree Electricals" approved',
    time: '15 min ago',
    read: false,
  },
  {
    id: 3,
    type: 'info',
    icon: <Assignment sx={{ fontSize: 18 }} />,
    title: 'New Requisition',
    message: 'Imarat Store requested 20x Ceiling Fan for Room 12',
    time: '1 hour ago',
    read: false,
  },
  {
    id: 4,
    type: 'info',
    icon: <LocalShipping sx={{ fontSize: 18 }} />,
    title: 'Transfer Completed',
    message: '50x Tube Light transferred from Bijli Store to Dharamshala-3',
    time: '2 hours ago',
    read: true,
  },
  {
    id: 5,
    type: 'warning',
    icon: <Schedule sx={{ fontSize: 18 }} />,
    title: 'FY Closing Due',
    message: 'Financial Year 2025-26 closes in 15 days. Review pending challans.',
    time: '5 hours ago',
    read: true,
  },
  {
    id: 6,
    type: 'success',
    icon: <PersonAdd sx={{ fontSize: 18 }} />,
    title: 'New User Added',
    message: 'Ramesh Kumar (Store Keeper) added to Imarat Store',
    time: '1 day ago',
    read: true,
  },
  {
    id: 7,
    type: 'info',
    icon: <Inventory sx={{ fontSize: 18 }} />,
    title: 'Stock Adjustment',
    message: '3 items adjusted in Bijli Store by admin',
    time: '1 day ago',
    read: true,
  },
];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  info: { bg: '#2563EB', color: '#2563EB' },
  warning: { bg: '#F59E0B', color: '#F59E0B' },
  success: { bg: '#22C55E', color: '#22C55E' },
  error: { bg: '#EF4444', color: '#EF4444' },
};

interface NotificationPanelProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function NotificationPanel({ anchorEl, open, onClose, onUnreadCountChange }: NotificationPanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  React.useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const markAsRead = (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{
        sx: {
          width: 380,
          maxHeight: 520,
          mt: 1,
          borderRadius: '16px',
          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          boxShadow: isDark
            ? '0 20px 60px rgba(0, 0, 0, 0.5)'
            : '0 20px 60px rgba(0, 0, 0, 0.12)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${isDark ? '#334155' : '#F1F5F9'}`,
          background: isDark
            ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(30, 41, 59, 0) 100%)'
            : 'linear-gradient(180deg, rgba(248, 250, 252, 0.8) 0%, rgba(248, 250, 252, 0) 100%)',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: alpha('#EF4444', 0.1),
                  color: '#EF4444',
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Mark all read" arrow>
              <IconButton size="small" onClick={markAllRead} aria-label="Mark all notifications as read" sx={{ width: 28, height: 28 }}>
                <DoneAll sx={{ fontSize: 16, color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear all" arrow>
              <IconButton size="small" onClick={clearAll} aria-label="Clear all notifications" sx={{ width: 28, height: 28 }}>
                <Delete sx={{ fontSize: 16, color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Filter Tabs */}
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }}>
          {(['all', 'unread'] as const).map((f) => (
            <Button
              key={f}
              size="small"
              onClick={() => setFilter(f)}
              sx={{
                minWidth: 'auto',
                py: 0.25,
                px: 1.5,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                borderRadius: '8px',
                color: filter === f ? '#FFFFFF' : 'text.secondary',
                backgroundColor: filter === f
                  ? (isDark ? '#334155' : '#0F172A')
                  : 'transparent',
                '&:hover': {
                  backgroundColor: filter === f
                    ? (isDark ? '#475569' : '#1E293B')
                    : (isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9'),
                },
              }}
            >
              {f === 'all' ? 'All' : `Unread (${unreadCount})`}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* Notification List */}
      <Box
        sx={{
          overflow: 'auto',
          maxHeight: 380,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: isDark ? '#334155' : '#CBD5E1',
            borderRadius: 2,
          },
        }}
      >
        {filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Notifications sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              No notifications
            </Typography>
            <Typography variant="caption" color="text.disabled">
              You're all caught up!
            </Typography>
          </Box>
        ) : (
          filtered.map((notification, index) => (
            <Box
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              sx={{
                px: 2.5,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : '#F8FAFC'}`,
                backgroundColor: !notification.read
                  ? alpha(TYPE_COLORS[notification.type].color, isDark ? 0.08 : 0.04)
                  : 'transparent',
                transition: 'all 150ms ease-out',
                '&:hover': {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                },
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: alpha(TYPE_COLORS[notification.type].color, 0.1),
                    color: TYPE_COLORS[notification.type].color,
                    flexShrink: 0,
                  }}
                >
                  {notification.icon}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} mb={0.25}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: !notification.read ? 700 : 500,
                        fontSize: '0.8125rem',
                        color: 'text.primary',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {notification.title}
                    </Typography>
                    {!notification.read && (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: TYPE_COLORS[notification.type].color,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.4,
                    }}
                  >
                    {notification.message}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.6875rem',
                      color: 'text.disabled',
                      mt: 0.5,
                      display: 'block',
                    }}
                  >
                    {notification.time}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))
        )}
      </Box>

      {/* Footer */}
      {filtered.length > 0 && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${isDark ? '#334155' : '#F1F5F9'}`,
            textAlign: 'center',
          }}
        >
          <Button
            size="small"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { backgroundColor: 'transparent', color: 'text.primary' },
            }}
          >
            View all notifications
          </Button>
        </Box>
      )}
    </Popover>
  );
}
