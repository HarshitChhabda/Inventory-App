import React from 'react';
import { Box, Typography, Grid, Card, CardContent, CardActionArea } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BuildIcon from '@mui/icons-material/Build';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningIcon from '@mui/icons-material/Warning';

const reports = [
  { key: 'asset_register', name: 'Asset Register', description: 'Complete list of all assets', icon: <AssessmentIcon />, path: '/reports', color: '#2563EB' },
  { key: 'installed_assets', name: 'Installed Assets', description: 'Currently installed assets by location', icon: <BuildIcon />, path: '/reports', color: '#16A34A' },
  { key: 'asset_health', name: 'Asset Health', description: 'Asset condition and maintenance status', icon: <InventoryIcon />, path: '/reports', color: '#D97706' },
  { key: 'warranty_expiry', name: 'Warranty Expiry', description: 'Assets with expiring warranties', icon: <WarningIcon />, path: '/reports', color: '#DC2626' },
];

export default function AssetReportsPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Asset Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Quick access to asset-related reports
      </Typography>
      <Grid container spacing={2}>
        {reports.map((report) => (
          <Grid item xs={12} sm={6} md={3} key={report.key}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea
                onClick={() => navigate(report.path)}
                sx={{ height: '100%', p: 2 }}
              >
                <CardContent>
                  <Box sx={{ color: report.color, mb: 1 }}>{report.icon}</Box>
                  <Typography variant="subtitle1" fontWeight={600}>{report.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{report.description}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
