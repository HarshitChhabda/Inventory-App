import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Construction } from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';

export default function ToolsPage() {
  return (
    <Box>
      <PageHeader
        title="Tools"
        subtitle="Utilities and converters"
      />

      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <Construction sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Tools Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Text conversion and data import/export utilities will be available here.
        </Typography>
      </Paper>
    </Box>
  );
}
