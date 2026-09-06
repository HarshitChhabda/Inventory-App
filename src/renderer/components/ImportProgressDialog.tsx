import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Box, Chip, LinearProgress, CircularProgress,
} from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';

export interface ImportProgress {
  active: boolean;
  current: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface ImportProgressDialogProps {
  progress: ImportProgress;
  onClose: () => void;
  entityLabel?: string;
}

export function getInitialProgress(): ImportProgress {
  return { active: false, current: 0, total: 0, created: 0, updated: 0, skipped: 0, errors: [] };
}

export default function ImportProgressDialog({ progress, onClose, entityLabel = 'items' }: ImportProgressDialogProps) {
  const isOpen = progress.active || progress.errors.length > 0 || progress.current > 0;

  return (
    <Dialog open={isOpen} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          {progress.active ? <CircularProgress size={20} /> : progress.skipped > 0 ? <Warning color="warning" /> : <CheckCircle color="success" />}
          <span>{progress.active ? `Importing ${entityLabel}...` : 'Import Complete'}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {progress.total > 0 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" fontWeight={500}>
                  Processing {progress.current} of {progress.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round((progress.current / progress.total) * 100)}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(progress.current / progress.total) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
            {progress.created > 0 && <Chip icon={<CheckCircle />} label={`${progress.created} created`} color="success" size="small" variant="outlined" />}
            {progress.updated > 0 && <Chip label={`${progress.updated} updated`} color="info" size="small" variant="outlined" />}
            {progress.skipped > 0 && <Chip icon={<Error />} label={`${progress.skipped} skipped`} color="warning" size="small" variant="outlined" />}
          </Stack>
          {progress.errors.length > 0 && (
            <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
              <Typography variant="caption" fontWeight={600} color="error" gutterBottom>
                Errors ({progress.errors.length}):
              </Typography>
              {progress.errors.map((err, idx) => (
                <Typography key={idx} variant="caption" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
                  {err}
                </Typography>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose} disabled={progress.active}>
          {progress.active ? 'Processing...' : 'Done'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
