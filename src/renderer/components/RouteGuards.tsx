import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const PERMISSION_MAP: Record<string, string> = {
  '/masters/items': 'manage_masters',
  '/masters/categories': 'manage_masters',
  '/masters/units': 'manage_masters',
  '/masters/vendors': 'manage_masters',
  '/masters/departments': 'manage_masters',
  '/masters/locations': 'manage_masters',
  '/financial-year': 'manage_financial_year',
  '/backup': 'manage_backup',
  '/companies': 'manage_company',
};

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
          backgroundColor: '#F8FAFC',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={32} sx={{ color: '#2563EB' }} />
        </Box>
        <Typography
          variant="body2"
          sx={{ color: '#64748B', fontWeight: 500, letterSpacing: '0.02em' }}
        >
          Loading Mahaveerji Inventory...
        </Typography>
      </Box>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function RequirePermission({
  permissionKey,
  children,
}: {
  permissionKey: string;
  children: React.ReactNode;
}) {
  const { currentUser, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  const denied = !isLoading && currentUser && !hasPermission(permissionKey);

  useEffect(() => {
    if (denied) {
      toast.error("You don't have permission to access this page");
    }
  }, [denied]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
          backgroundColor: '#F8FAFC',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={32} sx={{ color: '#2563EB' }} />
        </Box>
        <Typography
          variant="body2"
          sx={{ color: '#64748B', fontWeight: 500, letterSpacing: '0.02em' }}
        >
          Loading Mahaveerji Inventory...
        </Typography>
      </Box>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (denied) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function getPermissionForPath(path: string): string | null {
  for (const [prefix, key] of Object.entries(PERMISSION_MAP)) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      return key;
    }
  }
  return null;
}
