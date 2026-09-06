import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Stack, TextField, Button, Switch, FormControlLabel,
  Divider, Alert, alpha, useTheme, Card, CardContent, CircularProgress, Chip, LinearProgress,
} from '@mui/material';
import { Save, Palette, TextFields, Storage, SystemUpdateAlt, Update, FolderOpen, Place } from '@mui/icons-material';
import { useThemeMode } from '../../context/ThemeContext';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';

const settingsSchema = z.object({
  companyName: z.string().min(1, 'Organization name is required'),
  headerText: z.string().min(1, 'Header text is required'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useThemeMode();
  const theme = useTheme();
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup saved timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    mode: 'onChange',
    defaultValues: { companyName: 'Digamber Jain Atishay Kshetra', headerText: 'SHRI MAHAVEERJI' },
  });

  // Update system state
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<string>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseDate: string } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Database/Backup state
  const [dbPath, setDbPath] = useState('');
  const [backupLocation, setBackupLocation] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    window.electronAPI.getVersion().then(setAppVersion).catch(() => {});
    window.electronAPI.getUpdateInfo().then(setUpdateInfo).catch(() => {});
    window.electronAPI.getDbPath().then(setDbPath).catch(() => {});
    window.electronAPI.getBackupLocation().then(setBackupLocation).catch(() => {});
    window.electronAPI.getCurrentUser().then((user: { role: string } | null) => {
      if (user) setUserRole(user.role);
    }).catch(() => {});

    const handleUpdateStatus = (_event: any, data: any) => {
      setUpdateStatus(data.status);
      if (data.status === 'available' && data.version) {
        toast(`New version ${data.version} available!`);
      }
      if (data.status === 'up-to-date') {
        toast.success('App is up to date!');
      }
      if (data.status === 'downloaded') {
        toast.success(`Update ${data.version} ready to install!`);
      }
      if (data.status === 'error') {
        toast.error(`Update check failed: ${data.message}`);
      }
    };

    const handleUpdateProgress = (_event: any, data: any) => {
      setUpdateProgress(data.percent);
    };

    window.electronAPI.on?.('update:status', handleUpdateStatus);
    window.electronAPI.on?.('update:progress', handleUpdateProgress);

    return () => {
      window.electronAPI.removeListener?.('update:status', handleUpdateStatus);
      window.electronAPI.removeListener?.('update:progress', handleUpdateProgress);
    };
  }, []);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus('checking');
    try {
      await window.electronAPI.checkForUpdates();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to check for updates'));
    }
    setCheckingUpdate(false);
  };

  const onSave = (data: SettingsFormData) => {
    localStorage.setItem('settings', JSON.stringify(data));
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
  };

  useEffect(() => {
    const settings = localStorage.getItem('settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      reset({
        companyName: parsed.companyName || '',
        headerText: parsed.headerText || '',
      });
    }
  }, []);

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Configure application preferences" />

      {saved && (
        <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>Settings saved successfully!</Alert>
      )}

      <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(340px, 1fr))" gap={2.5}>
        <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Palette sx={{ fontSize: 18, color: 'primary.main' }} />
              </Box>
              <Typography variant="h6" fontWeight={700}>Appearance</Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <FormControlLabel
              control={
                <Switch
                  checked={darkMode}
                  onChange={toggleDarkMode}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main' },
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Dark Mode</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {darkMode ? 'Currently using dark theme' : 'Currently using light theme'}
                  </Typography>
                </Box>
              }
            />
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5,
                bgcolor: alpha(theme.palette.success.main, 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <SystemUpdateAlt sx={{ fontSize: 18, color: 'success.main' }} />
              </Box>
              <Typography variant="h6" fontWeight={700}>App Updates</Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Current Version</Typography>
                <Chip label={`v${appVersion}`} size="small" color="primary" variant="outlined" />
              </Box>
              {updateInfo && (
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Latest Available</Typography>
                  <Chip label={`v${updateInfo.version}`} size="small" color="success" variant="outlined" />
                </Box>
              )}
              {updateStatus === 'checking' && (
                <Box>
                  <LinearProgress sx={{ borderRadius: 1 }} />
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>Checking for updates...</Typography>
                </Box>
              )}
              {updateStatus === 'available' && (
                <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                  New version available! Download will start automatically.
                </Alert>
              )}
              {updateStatus === 'downloaded' && (
                <Alert severity="success" sx={{ borderRadius: 1.5 }} action={
                  <Button color="inherit" size="small" onClick={() => window.electronAPI.installUpdate()}>
                    Restart
                  </Button>
                }>
                  Update downloaded! Restart to apply.
                </Alert>
              )}
              {updateStatus === 'up-to-date' && (
                <Alert severity="success" sx={{ borderRadius: 1.5 }}>
                  You are running the latest version.
                </Alert>
              )}
              {updateStatus === 'error' && (
                <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
                  Could not check for updates. Check your internet connection.
                </Alert>
              )}
              <Button
                variant="outlined"
                fullWidth
                startIcon={checkingUpdate ? <CircularProgress size={16} /> : <Update />}
                onClick={handleCheckUpdate}
                disabled={checkingUpdate || updateStatus === 'checking'}
              >
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5,
                bgcolor: alpha(theme.palette.secondary.main, 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TextFields sx={{ fontSize: 18, color: 'secondary.main' }} />
              </Box>
              <Typography variant="h6" fontWeight={700}>Print Header Settings</Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2.5}>
              <TextField
                label="Trust/Organization Name"
                {...register('companyName')}
                fullWidth
                size="small"
                error={!!errors.companyName}
                helperText={errors.companyName?.message}
              />
              <TextField
                label="Header Text (e.g. SHRI MAHAVEERJI)"
                {...register('headerText')}
                fullWidth
                size="small"
                error={!!errors.headerText}
                helperText={errors.headerText?.message}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5,
                bgcolor: alpha(theme.palette.info.main, 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Storage sx={{ fontSize: 18, color: 'info.main' }} />
              </Box>
              <Typography variant="h6" fontWeight={700}>Database & Backup</Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Database Folder</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dbPath}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FolderOpen />}
                    onClick={() => window.electronAPI.openFolder(dbPath)}
                  >
                    Open
                  </Button>
                </Stack>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Backup Location</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {backupLocation}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FolderOpen />}
                    onClick={() => window.electronAPI.openFolder(backupLocation)}
                  >
                    Open
                  </Button>
                  {userRole === 'ADMIN' && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<Place />}
                      onClick={async () => {
                        const result = await window.electronAPI.openFile({
                          title: 'Select Backup Location',
                          properties: ['openDirectory', 'createDirectory'],
                        });
                        if (!result.canceled && result.filePaths?.[0]) {
                          const newPath = result.filePaths[0];
                          try {
                            await window.electronAPI.changeBackupLocation(newPath);
                            setBackupLocation(newPath);
                            toast.success('Backup location updated!');
                          } catch (err) {
                            toast.error(getErrorMessage(err, 'Failed to change backup location'));
                          }
                        }
                      }}
                    >
                      Change
                    </Button>
                  )}
                </Stack>
                {userRole !== 'ADMIN' && (
                  <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                    Only admin can change backup location
                  </Typography>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Button variant="contained" startIcon={<Save />} onClick={handleSubmit(onSave)} size="large">
          Save Settings
        </Button>
      </Box>
    </Box>
  );
}
