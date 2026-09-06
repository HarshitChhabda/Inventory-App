import React from 'react';
import { Grid, useTheme } from '@mui/material';

export interface FormRowProps {
  columns?: 1 | 2 | 3 | 4;
  spacing?: number;
  children: React.ReactNode;
  sx?: object;
}

export default function FormRow({
  columns = 2,
  spacing = 2,
  children,
  sx,
}: FormRowProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const getSpan = () => {
    switch (columns) {
      case 1: return { xs: 12 };
      case 2: return { xs: 12, sm: 6 };
      case 3: return { xs: 12, sm: 6, md: 4 };
      case 4: return { xs: 12, sm: 6, md: 3 };
      default: return { xs: 12, sm: 6 };
    }
  };

  const span = getSpan();

  return (
    <Grid container spacing={spacing} sx={sx}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return null;
        return (
          <Grid item {...span} key={index}>
            {child}
          </Grid>
        );
      })}
    </Grid>
  );
}
