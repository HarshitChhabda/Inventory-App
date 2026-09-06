import React from 'react';
import { Box, Typography, Button, Stack, Paper, alpha, useTheme } from '@mui/material';
import { CheckCircle, Visibility, Add, ArrowBack } from '@mui/icons-material';

interface SuccessScreenProps {
  title: string;
  subtitle?: string;
  entityName?: string;
  entityCode?: string;
  onViewDetails?: () => void;
  onCreateNew?: () => void;
  onBackToList?: () => void;
  viewDetailsLabel?: string;
  createNewLabel?: string;
  backToListLabel?: string;
  showViewDetails?: boolean;
  showCreateNew?: boolean;
}

export default function SuccessScreen({
  title,
  subtitle,
  entityName,
  entityCode,
  onViewDetails,
  onCreateNew,
  onBackToList,
  viewDetailsLabel = 'View Details',
  createNewLabel = 'Create New',
  backToListLabel = 'Back to List',
  showViewDetails = true,
  showCreateNew = true,
}: SuccessScreenProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 5,
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          borderRadius: '20px',
          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.06)',
            border: `2px solid ${isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'}`,
          }}
        >
          <CheckCircle sx={{ fontSize: 36, color: '#22C55E' }} />
        </Box>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            fontSize: '1.25rem',
            color: 'text.primary',
            mb: 0.5,
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.875rem',
              mb: 1,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </Typography>
        )}

        {(entityName || entityCode) && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.75,
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.04)',
              border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'}`,
              mb: 3,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#22C55E', fontSize: '0.875rem' }}>
              {entityCode && `${entityCode}`}
              {entityCode && entityName && ' — '}
              {entityName}
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 2 }}>
          {showViewDetails && onViewDetails && (
            <Button
              variant="outlined"
              startIcon={<Visibility />}
              onClick={onViewDetails}
              sx={{
                fontWeight: 600,
                fontSize: '0.8125rem',
                borderRadius: '10px',
                textTransform: 'none',
                px: 2.5,
                borderColor: isDark ? '#334155' : '#E2E8F0',
                color: 'text.primary',
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#CBD5E1',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                },
              }}
            >
              {viewDetailsLabel}
            </Button>
          )}
          {showCreateNew && onCreateNew && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={onCreateNew}
              sx={{
                fontWeight: 600,
                fontSize: '0.8125rem',
                borderRadius: '10px',
                textTransform: 'none',
                px: 2.5,
              }}
            >
              {createNewLabel}
            </Button>
          )}
          {onBackToList && (
            <Button
              variant="text"
              startIcon={<ArrowBack />}
              onClick={onBackToList}
              sx={{
                fontWeight: 500,
                fontSize: '0.8125rem',
                borderRadius: '10px',
                textTransform: 'none',
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                },
              }}
            >
              {backToListLabel}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
