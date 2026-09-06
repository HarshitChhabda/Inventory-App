import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress,
  Grid, Chip, List, ListItem, ListItemIcon, ListItemText, Divider
} from '@mui/material';
import { Sync, CheckCircle, Error, Warning, ArrowForward } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useCompany } from '../../context/CompanyContext';
import { getErrorMessage } from '../../utils/errorUtils';

interface MigrationStatus {
  needed: boolean;
  reasons: string[];
}

interface MigrationResult {
  success: boolean;
  storesCreated: number;
  locationsUpdated: number;
  itemsUpdated: number;
  stockMigrated: number;
  installationsMigrated: number;
  errors: string[];
}

export default function DataMigrationPage() {
  const { company } = useCompany();
  const companyId = company?.id;
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  const checkMigration = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await window.electronAPI.isMigrationNeeded(companyId);
      setStatus(data);
    } catch (err: any) {
      console.error(err);
      toast.error(getErrorMessage(err, 'Failed to check migration status'));
    }
    setLoading(false);
  };

  useEffect(() => { checkMigration(); }, [companyId]);

  const handleMigrate = async () => {
    if (!companyId) return;
    if (!confirm('This will migrate your existing data to the new enterprise architecture. Continue?')) return;
    setMigrating(true);
    try {
      const data = await window.electronAPI.migrateData(companyId);
      setResult(data);
      checkMigration();
    } catch (err: any) {
      console.error(err);
      toast.error(getErrorMessage(err, 'Migration failed'));
    }
    setMigrating(false);
  };

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight={600} mb={3}>Data Migration</Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Migrate existing data to the new enterprise architecture. This creates Stores from Departments, links Locations to Stores, and initializes configuration.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Migration Status</Typography>
          {loading ? (
            <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
          ) : status ? (
            <Box>
              <Alert severity={status.needed ? 'warning' : 'success'} sx={{ mb: 2 }}>
                {status.needed ? 'Migration is needed' : 'System is up to date'}
              </Alert>
              {status.reasons.length > 0 && (
                <List>
                  {status.reasons.map((reason, i) => (
                    <ListItem key={i}>
                      <ListItemIcon><Warning color="warning" /></ListItemIcon>
                      <ListItemText primary={reason} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          ) : null}
        </CardContent>
      </Card>

      {result && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" mb={2}>Migration Result</Typography>
            <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }}>
              {result.success ? 'Migration completed successfully' : 'Migration failed'}
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={4}><Chip label={`Stores Created: ${result.storesCreated}`} color="primary" /></Grid>
              <Grid item xs={4}><Chip label={`Locations Updated: ${result.locationsUpdated}`} color="secondary" /></Grid>
              <Grid item xs={4}><Chip label={`Stock Migrated: ${result.stockMigrated}`} color="success" /></Grid>
              <Grid item xs={4}><Chip label={`Installations: ${result.installationsMigrated}`} color="info" /></Grid>
            </Grid>
            {result.errors.length > 0 && (
              <Box mt={2}>
                <Typography color="error" fontWeight={500}>Errors:</Typography>
                {result.errors.map((err, i) => (
                  <Typography key={i} color="error" variant="body2">{err}</Typography>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>What This Migration Does</Typography>
          <List>
            <ListItem><ListItemIcon><ArrowForward /></ListItemIcon><ListItemText primary="Creates Stores from existing Departments (MainStore → MAIN_STORE, DepartmentStore → DEPARTMENT_STORE, etc.)" /></ListItem>
            <Divider />
            <ListItem><ListItemIcon><ArrowForward /></ListItemIcon><ListItemText primary="Links Locations to their associated Stores" /></ListItem>
            <Divider />
            <ListItem><ListItemIcon><ArrowForward /></ListItemIcon><ListItemText primary="Adds storeId to all existing Stock Transactions" /></ListItem>
            <Divider />
            <ListItem><ListItemIcon><ArrowForward /></ListItemIcon><ListItemText primary="Adds storeId to all existing Asset Installations" /></ListItem>
            <Divider />
            <ListItem><ListItemIcon><ArrowForward /></ListItemIcon><ListItemText primary="Initializes default System Configurations (25+ business rules)" /></ListItem>
            <Divider />
            <ListItem><ListItemIcon><ArrowForward /></ListItemIcon><ListItemText primary="Initializes Transfer Matrix (store-to-store transfer rules)" /></ListItem>
          </List>

          <Box mt={3} display="flex" gap={2}>
            <Button variant="contained" onClick={handleMigrate} disabled={migrating || !status?.needed}>
              {migrating ? 'Migrating...' : 'Run Migration'}
            </Button>
            <Button variant="outlined" onClick={checkMigration}>
              Refresh Status
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
