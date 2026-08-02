import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Error as ErrorIcon, Refresh } from '@mui/icons-material';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center', border: '1px solid', borderColor: 'error.light' }}>
            <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              An unexpected error occurred. Your data is safe.
            </Typography>
            {this.state.error && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1, textAlign: 'left' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                  {this.state.error.message}
                </Typography>
              </Box>
            )}
            <Button variant="contained" startIcon={<Refresh />} onClick={this.handleReset}>
              Try Again
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
