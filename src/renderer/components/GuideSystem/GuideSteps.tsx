import React from 'react';
import { Box, Typography, Step, StepLabel, StepContent, Alert, Chip } from '@mui/material';
import { Lightbulb, Warning } from '@mui/icons-material';
import { GuideStep } from './types';

interface GuideStepsProps {
  steps: GuideStep[];
}

export default function GuideSteps({ steps }: GuideStepsProps) {
  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.primary', fontSize: '0.875rem' }}>
        Step-by-Step Guide
      </Typography>
      <Box sx={{ pl: 0.5 }}>
        {steps.map((step) => (
          <Box key={step.stepNumber} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  mt: 0.25,
                }}
              >
                {step.stepNumber}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.25 }}>
                  {step.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  {step.description}
                </Typography>
                {step.tip && (
                  <Alert
                    severity="info"
                    icon={<Lightbulb fontSize="small" />}
                    sx={{
                      mt: 1,
                      py: 0,
                      '& .MuiAlert-message': { py: '4px', fontSize: '0.75rem' },
                      backgroundColor: 'info.50',
                    }}
                  >
                    {step.tip}
                  </Alert>
                )}
                {step.warning && (
                  <Alert
                    severity="warning"
                    icon={<Warning fontSize="small" />}
                    sx={{
                      mt: 1,
                      py: 0,
                      '& .MuiAlert-message': { py: '4px', fontSize: '0.75rem' },
                      backgroundColor: 'warning.50',
                    }}
                  >
                    {step.warning}
                  </Alert>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
