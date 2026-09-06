import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Switch, FormControlLabel,
  Grid, Alert, Snackbar, Divider, CircularProgress, Select, MenuItem, FormControl,
  InputLabel, SelectChangeEvent, Tabs, Tab, Chip, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions
} from '@mui/material';
import { Settings, Save, Refresh, Business, Inventory, SwapHoriz, Approval, QrCode, Assessment } from '@mui/icons-material';
import { GuideButton } from '../../components/GuideSystem';
import { useCompany } from '../../context/CompanyContext';
import { getErrorMessage } from '../../utils/errorUtils';

interface ConfigEntry {
  key: string;
  value: string;
  category: string;
  description?: string;
  dataType: string;
}

const CATEGORIES = [
  { value: 'GENERAL', label: 'General', icon: <Settings /> },
  { value: 'STOCK', label: 'Stock Rules', icon: <Inventory /> },
  { value: 'TRANSFER', label: 'Transfer Rules', icon: <SwapHoriz /> },
  { value: 'APPROVAL', label: 'Approval Workflow', icon: <Approval /> },
  { value: 'SERIAL', label: 'Serial Numbers', icon: <QrCode /> },
  { value: 'REPORT', label: 'Reports', icon: <Assessment /> },
];

export default function ConfigurationPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('GENERAL');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [confirmDefaults, setConfirmDefaults] = useState(false);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getAllConfigs(companyId);
      setConfigs(data);
    } catch (err: any) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to load configuration'), severity: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => { loadConfigs(); }, [companyId]);

  const handleValueChange = (key: string, value: string) => {
    setConfigs(configs.map((c) => c.key === key ? { ...c, value } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const config of configs) {
        await window.electronAPI.setConfig(companyId, config.key, config.value, config.category, config.description);
      }
      setSnackbar({ open: true, message: 'Configuration saved successfully', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to save configuration'), severity: 'error' });
    }
    setSaving(false);
  };

  const handleInitializeDefaults = async () => {
    try {
      await window.electronAPI.initializeDefaultConfigs(companyId);
      loadConfigs();
      setSnackbar({ open: true, message: 'Default configurations initialized', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: getErrorMessage(err, 'Failed to initialize defaults'), severity: 'error' });
    }
  };

  const filteredConfigs = configs.filter((c) => c.category === activeCategory);

  const renderConfigInput = (config: ConfigEntry) => {
    if (config.dataType === 'boolean') {
      return (
        <FormControlLabel
          key={config.key}
          control={
            <Switch
              checked={config.value.toLowerCase() === 'true'}
              onChange={(e) => handleValueChange(config.key, e.target.checked ? 'true' : 'false')}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={500}>{config.key.split('.').pop()}</Typography>
              <Typography variant="caption" color="textSecondary">{config.description}</Typography>
            </Box>
          }
        />
      );
    }

    if (config.dataType === 'number') {
      return (
        <TextField
          key={config.key}
          fullWidth
          label={config.key.split('.').pop()}
          helperText={config.description}
          value={config.value}
          onChange={(e) => handleValueChange(config.key, e.target.value)}
          type="number"
          size="small"
          sx={{ mb: 2 }}
          inputProps={{ min: 0 }}
        />
      );
    }

    return (
      <TextField
        key={config.key}
        fullWidth
        label={config.key.split('.').pop()}
        helperText={config.description}
        value={config.value}
        onChange={(e) => handleValueChange(config.key, e.target.value)}
        size="small"
        sx={{ mb: 2 }}
      />
    );
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={600}>System Configuration</Typography>
        <Box display="flex" gap={1}>
          <GuideButton pageId="configuration" />
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => setConfirmDefaults(true)}>Initialize Defaults</Button>
          <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        All business rules are configurable. Changes take effect immediately. No code changes needed for new rules.
      </Alert>

      <Card>
        <CardContent>
          <Tabs value={activeCategory} onChange={(_, v) => setActiveCategory(v)} variant="scrollable" scrollButtons="auto">
            {CATEGORIES.map((cat) => (
              <Tab key={cat.value} label={cat.label} value={cat.value} icon={cat.icon} iconPosition="start" />
            ))}
          </Tabs>

          <Divider sx={{ my: 2 }} />

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : (
            <Grid container spacing={2}>
              {filteredConfigs.map((config) => (
                <Grid item xs={12} md={6} key={config.key}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    {renderConfigInput(config)}
                  </Card>
                </Grid>
              ))}
              {filteredConfigs.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="textSecondary" align="center">No configurations found for this category.</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>

      <Dialog open={confirmDefaults} onClose={() => setConfirmDefaults(false)}>
        <DialogTitle>Initialize Defaults</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will reset all configurations to defaults. Existing custom settings will be lost. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDefaults(false)}>Cancel</Button>
          <Button onClick={() => { setConfirmDefaults(false); handleInitializeDefaults(); }} variant="contained" color="warning">Continue</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
