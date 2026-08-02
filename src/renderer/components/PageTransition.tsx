import React from 'react';
import { Box } from '@mui/material';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <Box
      sx={{
        animation: 'pageEnter 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        '@keyframes pageEnter': {
          '0%': {
            opacity: 0,
            transform: 'translateY(8px) scale(0.995)',
          },
          '100%': {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          },
        },
      }}
    >
      {children}
    </Box>
  );
}
