import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, TextField, Button, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton,
  Alert, LinearProgress, Tooltip, Divider, Stack, InputAdornment,
} from '@mui/material';
import { Save, Lock, People, Shield, Stop, Refresh, Pin, Visibility, VisibilityOff } from '@mui/icons-material';
import { useCompany } from '../../../context/CompanyContext';
import toast from 'react-hot-toast';
import { formatDateTimeDDMMYYYY } from '../../../utils/dateUtils';
import { getErrorMessage } from '../../../utils/errorUtils';

interface PasswordPolicy {
  id: number; companyId: number; minPasswordLength: number; requireUppercase: boolean;
  requireLowercase: boolean; requireNumbers: boolean; requireSpecialChars: boolean;
  maxAgeDays: number | null; maxFailedAttempts: number; lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number; forceLogoutAllDevices: boolean; passwordHistoryCount: number;
}

interface SessionEntry {
  id: number; uuid: string; token: string; ipAddress?: string; device?: string;
  loginAt: string; lastActiveAt: string; logoutAt?: string; isActive: boolean;
  user?: { id: number; username: string; fullName: string };
}

interface SessionStats { totalActive: number; totalUsers: number; recentLogins: any[] }

export default function SecurityPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lockUserId, setLockUserId] = useState('');
  const [unlockUserId, setUnlockUserId] = useState('');
  const [forceLogoutUserId, setForceLogoutUserId] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const fetchPolicy = async () => {
    try {
      const p = await window.electronAPI.getPasswordPolicy(companyId);
      setPolicy(p);
    } catch (err: any) { setError(getErrorMessage(err, 'Failed to load password policy')); }
  };

  const fetchSessions = async () => {
    try {
      const [s, stats] = await Promise.all([
        window.electronAPI.getActiveSessions(),
        window.electronAPI.getSessionStats(companyId),
      ]);
      setSessions(s);
      setSessionStats(stats);
    } catch (err: any) { setError(getErrorMessage(err, 'Failed to load sessions')); }
  };

  const init = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPolicy(), fetchSessions()]);
    setLoading(false);
  }, []);

  useEffect(() => { init(); }, [init]);

  const handleSavePolicy = async () => {
    if (!policy) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await window.electronAPI.updatePasswordPolicy(companyId, {
        minPasswordLength: policy.minPasswordLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireNumbers: policy.requireNumbers,
        requireSpecialChars: policy.requireSpecialChars,
        maxAgeDays: policy.maxAgeDays,
        maxFailedAttempts: policy.maxFailedAttempts,
        lockoutDurationMinutes: policy.lockoutDurationMinutes,
        sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
        forceLogoutAllDevices: policy.forceLogoutAllDevices,
        passwordHistoryCount: policy.passwordHistoryCount,
      });
      setSuccess('Password policy updated successfully');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save policy'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePin = async () => {
    if (!adminPin || adminPin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    if (adminPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    if (!/^\d{4}$/.test(adminPin)) {
      toast.error('PIN must contain only numbers');
      return;
    }
    setSavingPin(true);
    try {
      await window.electronAPI.updatePasswordPolicy(companyId, { adminPin });
      setSuccess('Administrator PIN saved securely');
      setAdminPin('');
      setConfirmPin('');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save PIN'));
    } finally {
      setSavingPin(false);
    }
  };

  const handleForceLogout = async (userId: number) => {
    if (!confirm('Force logout this user from all devices?')) return;
    try {
      await window.electronAPI.forceLogoutAll(userId);
      fetchSessions();
    } catch (err: any) { toast.error(getErrorMessage(err, 'Failed to force logout')); }
  };

  const handleLockAccount = async (userId: number) => {
    if (!confirm('Lock this account? The user will not be able to log in until unlocked.')) return;
    try {
      await window.electronAPI.lockAccount(userId);
      fetchSessions();
    } catch (err: any) { toast.error(getErrorMessage(err, 'Failed to lock account')); }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Security & Access Control</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage password rules, active sessions, and administrator access
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Section 1: Security Overview */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Security Overview</Typography>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="textSecondary" variant="body2">Active Sessions</Typography>
                <Typography variant="h3" fontWeight={700} color="primary">{sessionStats?.totalActive || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="textSecondary" variant="body2">Total Users</Typography>
                <Typography variant="h3" fontWeight={700}>{sessionStats?.totalUsers || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="textSecondary" variant="body2">Recent Logins</Typography>
                <Typography variant="h3" fontWeight={700}>{sessionStats?.recentLogins.length || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 2: Administrator PIN */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Pin color="primary" />
          <Typography variant="h6" fontWeight={600}>Administrator PIN</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Set a 4-digit PIN for quick administrative actions. This PIN is stored securely and never displayed.
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="New 4-Digit PIN"
              type={showPin ? 'text' : 'password'}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputProps={{ maxLength: 4, inputMode: 'numeric', pattern: '[0-9]*' }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPin(!showPin)} size="small">
                      {showPin ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Confirm PIN"
              type={showPin ? 'text' : 'password'}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputProps={{ maxLength: 4, inputMode: 'numeric', pattern: '[0-9]*' }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              onClick={handleSavePin}
              disabled={savingPin || adminPin.length !== 4 || confirmPin.length !== 4}
            >
              {savingPin ? 'Saving...' : 'Save PIN'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Section 3: Password Policy */}
      {policy && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Password Policy</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Complexity</Typography>
              <TextField fullWidth type="number" label="Minimum Password Length" value={policy.minPasswordLength}
                onChange={(e) => setPolicy({ ...policy, minPasswordLength: parseInt(e.target.value) || 8 })} sx={{ mb: 2 }} />
              <Stack spacing={0.5}>
                <FormControlLabel control={<Switch checked={policy.requireUppercase}
                  onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })} />}
                  label="Require Uppercase Letters" />
                <FormControlLabel control={<Switch checked={policy.requireLowercase}
                  onChange={(e) => setPolicy({ ...policy, requireLowercase: e.target.checked })} />}
                  label="Require Lowercase Letters" />
                <FormControlLabel control={<Switch checked={policy.requireNumbers}
                  onChange={(e) => setPolicy({ ...policy, requireNumbers: e.target.checked })} />}
                  label="Require Numbers" />
                <FormControlLabel control={<Switch checked={policy.requireSpecialChars}
                  onChange={(e) => setPolicy({ ...policy, requireSpecialChars: e.target.checked })} />}
                  label="Require Special Characters" />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Expiry & Lockout</Typography>
              <TextField fullWidth type="number" label="Password Expiry (days, 0 = never)" value={policy.maxAgeDays || 0}
                onChange={(e) => setPolicy({ ...policy, maxAgeDays: parseInt(e.target.value) || null })} sx={{ mb: 2 }} />
              <TextField fullWidth type="number" label="Max Failed Login Attempts" value={policy.maxFailedAttempts}
                onChange={(e) => setPolicy({ ...policy, maxFailedAttempts: parseInt(e.target.value) || 5 })} sx={{ mb: 2 }} />
              <TextField fullWidth type="number" label="Lockout Duration (minutes)" value={policy.lockoutDurationMinutes}
                onChange={(e) => setPolicy({ ...policy, lockoutDurationMinutes: parseInt(e.target.value) || 30 })} sx={{ mb: 2 }} />
              <TextField fullWidth type="number" label="Session Timeout (minutes)" value={policy.sessionTimeoutMinutes}
                onChange={(e) => setPolicy({ ...policy, sessionTimeoutMinutes: parseInt(e.target.value) || 480 })} sx={{ mb: 2 }} />
              <FormControlLabel control={<Switch checked={policy.forceLogoutAllDevices}
                onChange={(e) => setPolicy({ ...policy, forceLogoutAllDevices: e.target.checked })} />}
                label="Force Logout All Devices on Password Change" />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" startIcon={<Save />} onClick={handleSavePolicy} disabled={saving}>
              {saving ? 'Saving...' : 'Save Password Policy'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Section 4: Active Sessions */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Active Sessions</Typography>
          <Button startIcon={<Refresh />} onClick={fetchSessions} size="small">Refresh</Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Login At</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.user?.fullName || s.user?.username || '-'}</TableCell>
                  <TableCell>{s.device || '-'}</TableCell>
                  <TableCell>{s.ipAddress || '-'}</TableCell>
                  <TableCell>{formatDateTimeDDMMYYYY(s.loginAt)}</TableCell>
                  <TableCell>{formatDateTimeDDMMYYYY(s.lastActiveAt)}</TableCell>
                  <TableCell>
                    <Chip label={s.isActive ? 'Active' : 'Inactive'} size="small" color={s.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    {s.isActive && (
                      <Tooltip title="Force logout this user from all devices">
                        <IconButton size="small" onClick={() => handleForceLogout(s.user?.id || 0)} aria-label="Force logout">
                          <Stop fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && <TableRow><TableCell colSpan={7} align="center">No active sessions</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Section 5: Account Management */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Account Management</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>Quick actions to manage user access. Enter the User ID from the Users page.</Alert>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600}>Lock Account</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Prevent a user from logging in</Typography>
                <TextField fullWidth label="User ID" size="small" sx={{ mb: 1 }}
                  value={lockUserId} onChange={(e) => setLockUserId(e.target.value)} />
                <Button variant="outlined" color="error" startIcon={<Lock />}
                  disabled={!lockUserId || isNaN(parseInt(lockUserId))}
                  onClick={async () => {
                    await handleLockAccount(parseInt(lockUserId));
                    setLockUserId('');
                  }}>Lock Account</Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600}>Unlock Account</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Re-enable a locked account</Typography>
                <TextField fullWidth label="User ID" size="small" sx={{ mb: 1 }}
                  value={unlockUserId} onChange={(e) => setUnlockUserId(e.target.value)} />
                <Button variant="outlined" color="success"
                  disabled={!unlockUserId || isNaN(parseInt(unlockUserId))}
                  onClick={async () => {
                    try {
                      await window.electronAPI.unlockAccount(parseInt(unlockUserId));
                      toast.success('Account unlocked');
                      setUnlockUserId('');
                      fetchSessions();
                    } catch (err: any) { toast.error(getErrorMessage(err, 'Failed to unlock account')); }
                  }}>Unlock Account</Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600}>Force Logout</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Logout user from all devices</Typography>
                <TextField fullWidth label="User ID" size="small" sx={{ mb: 1 }}
                  value={forceLogoutUserId} onChange={(e) => setForceLogoutUserId(e.target.value)} />
                <Button variant="outlined" color="warning"
                  disabled={!forceLogoutUserId || isNaN(parseInt(forceLogoutUserId))}
                  onClick={async () => {
                    try {
                      await window.electronAPI.forceLogoutAll(parseInt(forceLogoutUserId));
                      toast.success('User logged out from all devices');
                      setForceLogoutUserId('');
                      fetchSessions();
                    } catch (err: any) { toast.error(getErrorMessage(err, 'Failed to force logout')); }
                  }}>Force Logout</Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
