import React from 'react';
import {
  Box, Typography, Button, Paper, IconButton, Tooltip, Collapse,
} from '@mui/material';
import {
  Error as ErrorIcon, Refresh, Home, ContentCopy, ExpandMore, ExpandLess,
} from '@mui/icons-material';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
  copied: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  private copiedTimerRef: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false, copied: false };
  }

  componentWillUnmount() {
    if (this.copiedTimerRef) clearTimeout(this.copiedTimerRef);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false, copied: false });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, showDetails: false, copied: false });
    window.location.hash = '#/';
    window.location.reload();
  };

  handleCopyError = () => {
    const errorText = this.state.error
      ? `Error: ${this.state.error.message}\n${this.state.error.stack || ''}`
      : 'Unknown error';
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      if (this.copiedTimerRef) clearTimeout(this.copiedTimerRef);
      this.copiedTimerRef = setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, p: 3 }}>
          <Paper
            sx={{
              p: 4,
              maxWidth: 500,
              textAlign: 'center',
              border: '1px solid',
              borderColor: 'error.light',
              borderRadius: '16px',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '14px',
                backgroundColor: 'rgba(239,68,68,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <ErrorIcon sx={{ fontSize: 28, color: 'error.main' }} />
            </Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
              This section could not be loaded. Your data is safe.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<Home />}
                onClick={this.handleGoHome}
                sx={{ fontWeight: 600, fontSize: '0.8125rem' }}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={this.handleReset}
                sx={{ fontWeight: 500, fontSize: '0.8125rem' }}
              >
                Retry
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Button
                size="small"
                onClick={this.toggleDetails}
                endIcon={this.state.showDetails ? <ExpandLess /> : <ExpandMore />}
                sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'none' }}
              >
                Technical Details
              </Button>
              <Tooltip title={this.state.copied ? 'Copied!' : 'Copy error details'}>
                <IconButton
                  size="small"
                  onClick={this.handleCopyError}
                  sx={{ color: 'text.secondary' }}
                >
                  <ContentCopy sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Collapse in={this.state.showDetails}>
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'grey.100', borderRadius: 1, textAlign: 'left' }}>
                <Typography
                  variant="caption"
                  sx={{ fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all', color: 'text.secondary' }}
                >
                  {this.state.error?.message || 'Unknown error'}
                </Typography>
              </Box>
            </Collapse>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
