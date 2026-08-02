import { createTheme } from '@mui/material/styles';

const sharedTypography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  h1: { fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: '1.875rem', lineHeight: 1.3, letterSpacing: '-0.025em' },
  h2: { fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.35, letterSpacing: '-0.02em' },
  h3: { fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.4, letterSpacing: '-0.015em' },
  h4: { fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.4, letterSpacing: '-0.01em' },
  h5: { fontFamily: '"Inter", sans-serif', fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
  h6: { fontFamily: '"Inter", sans-serif', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.5 },
  subtitle1: { fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.5 },
  subtitle2: { fontWeight: 500, fontSize: '0.8125rem', lineHeight: 1.5 },
  body1: { fontSize: '0.875rem', lineHeight: 1.6 },
  body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
  caption: { fontSize: '0.75rem', lineHeight: 1.4, letterSpacing: '0.01em' },
  button: { fontWeight: 600, letterSpacing: '0.01em', fontFamily: '"Inter", sans-serif', textTransform: 'none' as const },
  overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const },
};

const sharedShadows = [
  'none',
  '0 1px 2px rgba(15, 23, 42, 0.04)',
  '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
  '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
  '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
  '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
  '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
  '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
  '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
  ...Array(16).fill('0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)'),
] as any;

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB',
      light: '#3B82F6',
      dark: '#1D4ED8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#7C3AED',
      light: '#A78BFA',
      dark: '#6D28D9',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    success: { main: '#16A34A', light: '#22C55E', dark: '#15803D' },
    warning: { main: '#D97706', light: '#F59E0B', dark: '#B45309' },
    error: { main: '#DC2626', light: '#EF4444', dark: '#B91C1C' },
    info: { main: '#0EA5E9', light: '#38BDF8', dark: '#0284C7' },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
    },
    divider: '#E2E8F0',
    action: {
      hover: '#F1F5F9',
      selected: '#EFF6FF',
      disabledBackground: '#F8FAFC',
      focus: 'rgba(37, 99, 235, 0.08)',
    },
  },
  typography: sharedTypography,
  shape: { borderRadius: 16 },
  shadows: sharedShadows,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': { boxSizing: 'border-box' },
        '::-webkit-scrollbar': { width: 5, height: 5 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: 3, '&:hover': { background: '#94A3B8' } },
        body: { transition: 'background-color 0.3s ease', backgroundColor: '#F8FAFC' },
        'input, textarea, select': { fontFamily: '"Inter", sans-serif' },
        '*:focus-visible': { outline: '2px solid #2563EB', outlineOffset: '2px' },
        '*:focus:not(:focus-visible)': { outline: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '9px 18px',
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' },
        },
        contained: {
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
          '&:hover': { backgroundColor: '#1D4ED8', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)' },
          '&:disabled': { backgroundColor: '#E2E8F0', color: '#94A3B8' },
        },
        outlined: {
          borderColor: '#E2E8F0',
          color: '#475569',
          backgroundColor: '#FFFFFF',
          '&:hover': { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', color: '#0F172A' },
          '&:disabled': { borderColor: '#E2E8F0', color: '#CBD5E1' },
        },
        text: {
          color: '#475569',
          '&:hover': { backgroundColor: '#F1F5F9', color: '#0F172A' },
          '&:disabled': { color: '#CBD5E1' },
        },
        sizeSmall: { padding: '5px 12px', fontSize: '0.75rem', borderRadius: 8 },
        sizeLarge: { padding: '11px 24px', fontSize: '0.875rem' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none', borderRadius: 16, border: '1px solid #E2E8F0' },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          transition: 'all 250ms cubic-bezier(0.4,0,0.2,1)',
          backgroundImage: 'none',
          '&:hover': {
            borderColor: 'transparent',
            boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
            transform: 'translateY(-3px)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            fontSize: '0.8125rem',
            transition: 'all 200ms ease-out',
            '& fieldset': { borderColor: '#E2E8F0', transition: 'border-color 200ms ease-out' },
            '&:hover fieldset': { borderColor: '#94A3B8' },
            '&.Mui-focused fieldset': { borderColor: '#2563EB', borderWidth: 1.5 },
            '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.08)' },
            '& input': { padding: '10px 14px', fontSize: '0.8125rem' },
            '& input::placeholder': { color: '#94A3B8', opacity: 1 },
          },
          '& .MuiInputLabel-root': { fontSize: '0.8125rem', color: '#64748B', '&.Mui-focused': { color: '#2563EB' } },
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 10, fontSize: '0.8125rem' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          padding: '12px 16px',
          borderBottom: '1px solid #F1F5F9',
          color: '#334155',
          verticalAlign: 'middle',
        },
        head: {
          fontFamily: '"Inter", sans-serif',
          fontWeight: 600,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#64748B',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          whiteSpace: 'nowrap',
        },
        sizeSmall: { padding: '8px 12px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'all 150ms ease-out',
          '&:hover': { backgroundColor: '#F8FAFC' },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid #E2E8F0' },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { borderTop: '1px solid #F1F5F9', minHeight: 48 },
        selectLabel: { fontSize: '0.8125rem', color: '#64748B' },
        displayedRows: { fontSize: '0.8125rem', color: '#64748B' },
        selectRoot: { fontSize: '0.8125rem' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1rem', padding: '20px 24px 8px', color: '#0F172A' },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '8px 24px 20px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '8px 24px 20px', gap: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8, fontSize: '0.6875rem', height: 24, '& .MuiChip-label': { padding: '0 10px' } },
        filled: { backgroundColor: '#F1F5F9', color: '#475569' },
        colorSuccess: { backgroundColor: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' },
        colorError: { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' },
        colorWarning: { backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' },
        colorInfo: { backgroundColor: '#E0F2FE', color: '#0EA5E9', border: '1px solid #BAE6FD' },
        colorPrimary: { backgroundColor: '#DBEAFE', color: '#2563EB', border: '1px solid #BFDBFE' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
          minHeight: 42,
          color: '#64748B',
          borderRadius: 8,
          '&.Mui-selected': { color: '#2563EB' },
          transition: 'all 200ms ease-out',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, borderRadius: '2px 2px 0 0', backgroundColor: '#2563EB' },
        root: { borderBottom: '1px solid #E2E8F0' },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            '& input': { fontSize: '0.8125rem' },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontSize: '0.8125rem', border: '1px solid transparent' },
        standardSuccess: { backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' },
        standardError: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' },
        standardWarning: { backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' },
        standardInfo: { backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', color: '#075985' },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-switchBase.Mui-checked': { color: '#2563EB' },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#2563EB' },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0F172A',
          fontSize: '0.75rem',
          borderRadius: 8,
          padding: '6px 12px',
          fontWeight: 500,
        },
        arrow: { color: '#0F172A' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { border: 'none' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6, backgroundColor: '#E2E8F0' },
        colorPrimary: { backgroundColor: '#2563EB' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#E2E8F0' },
      },
    },
    MuiBadge: {
      styleOverrides: {
        colorError: { backgroundColor: '#DC2626' },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        colorPrimary: { color: '#2563EB' },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: '#E2E8F0', borderRadius: 8 },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#A78BFA',
      light: '#C4B5FD',
      dark: '#7C3AED',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#0F172A',
      paper: '#1E293B',
    },
    success: { main: '#22C55E', light: '#4ADE80', dark: '#16A34A' },
    warning: { main: '#FBBF24', light: '#FDE68A', dark: '#F59E0B' },
    error: { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
    info: { main: '#38BDF8', light: '#7DD3FC', dark: '#0EA5E9' },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: '#334155',
    action: {
      hover: 'rgba(255, 255, 255, 0.04)',
      selected: 'rgba(59, 130, 246, 0.12)',
      disabledBackground: 'rgba(255, 255, 255, 0.06)',
      focus: 'rgba(59, 130, 246, 0.12)',
    },
  },
  typography: sharedTypography,
  shape: { borderRadius: 16 },
  shadows: sharedShadows,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': { boxSizing: 'border-box' },
        '::-webkit-scrollbar': { width: 5, height: 5 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': { background: '#475569', borderRadius: 3, '&:hover': { background: '#64748B' } },
        body: { transition: 'background-color 0.3s ease', backgroundColor: '#0F172A' },
        'input, textarea, select': { fontFamily: '"Inter", sans-serif' },
        '*:focus-visible': { outline: '2px solid #60A5FA', outlineOffset: '2px' },
        '*:focus:not(:focus-visible)': { outline: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '9px 18px',
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' },
        },
        contained: {
          backgroundColor: '#3B82F6',
          color: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(59, 130, 246, 0.3)',
          '&:hover': { backgroundColor: '#60A5FA', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)' },
          '&:disabled': { backgroundColor: '#334155', color: '#64748B' },
        },
        outlined: {
          borderColor: '#334155',
          color: '#94A3B8',
          backgroundColor: 'transparent',
          '&:hover': { borderColor: '#475569', backgroundColor: 'rgba(255,255,255,0.04)', color: '#F1F5F9' },
          '&:disabled': { borderColor: '#1E293B', color: '#334155' },
        },
        text: {
          color: '#94A3B8',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)', color: '#F1F5F9' },
          '&:disabled': { color: '#334155' },
        },
        sizeSmall: { padding: '5px 12px', fontSize: '0.75rem', borderRadius: 8 },
        sizeLarge: { padding: '11px 24px', fontSize: '0.875rem' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none', borderRadius: 16, border: '1px solid #334155', backgroundColor: '#1E293B' },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #334155',
          backgroundColor: '#1E293B',
          transition: 'all 250ms cubic-bezier(0.4,0,0.2,1)',
          backgroundImage: 'none',
          '&:hover': {
            borderColor: 'transparent',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            transform: 'translateY(-3px)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.04)',
            fontSize: '0.8125rem',
            transition: 'all 200ms ease-out',
            '& fieldset': { borderColor: '#334155', transition: 'border-color 200ms ease-out' },
            '&:hover fieldset': { borderColor: '#475569' },
            '&.Mui-focused fieldset': { borderColor: '#3B82F6', borderWidth: 1.5 },
            '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.12)' },
            '& input': { padding: '10px 14px', fontSize: '0.8125rem', color: '#F1F5F9' },
            '& input::placeholder': { color: '#64748B', opacity: 1 },
          },
          '& .MuiInputLabel-root': { fontSize: '0.8125rem', color: '#94A3B8', '&.Mui-focused': { color: '#60A5FA' } },
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 10, fontSize: '0.8125rem' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          padding: '12px 16px',
          borderBottom: '1px solid #1E293B',
          color: '#CBD5E1',
          verticalAlign: 'middle',
        },
        head: {
          fontFamily: '"Inter", sans-serif',
          fontWeight: 600,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#94A3B8',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #334155',
          whiteSpace: 'nowrap',
        },
        sizeSmall: { padding: '8px 12px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'all 150ms ease-out',
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid #334155' },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { borderTop: '1px solid #334155', minHeight: 48 },
        selectLabel: { fontSize: '0.8125rem', color: '#94A3B8' },
        displayedRows: { fontSize: '0.8125rem', color: '#94A3B8' },
        selectRoot: { fontSize: '0.8125rem' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid #334155',
          backgroundColor: '#1E293B',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1rem', padding: '20px 24px 8px', color: '#F1F5F9' },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '8px 24px 20px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '8px 24px 20px', gap: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8, fontSize: '0.6875rem', height: 24, '& .MuiChip-label': { padding: '0 10px' } },
        filled: { backgroundColor: '#334155', color: '#CBD5E1' },
        colorSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#4ADE80', border: '1px solid rgba(34, 197, 94, 0.2)' },
        colorError: { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.2)' },
        colorWarning: { backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#FBBF24', border: '1px solid rgba(251, 191, 36, 0.2)' },
        colorInfo: { backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.2)' },
        colorPrimary: { backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.2)' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
          minHeight: 42,
          color: '#94A3B8',
          borderRadius: 8,
          '&.Mui-selected': { color: '#60A5FA' },
          transition: 'all 200ms ease-out',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, borderRadius: '2px 2px 0 0', backgroundColor: '#3B82F6' },
        root: { borderBottom: '1px solid #334155' },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.04)',
            '& input': { fontSize: '0.8125rem', color: '#F1F5F9' },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontSize: '0.8125rem', border: '1px solid transparent' },
        standardSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#4ADE80' },
        standardError: { backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#F87171' },
        standardWarning: { backgroundColor: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)', color: '#FBBF24' },
        standardInfo: { backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38BDF8' },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-switchBase.Mui-checked': { color: '#60A5FA' },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3B82F6' },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1E293B',
          fontSize: '0.75rem',
          borderRadius: 8,
          padding: '6px 12px',
          fontWeight: 500,
          border: '1px solid #334155',
        },
        arrow: { color: '#1E293B' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { border: 'none' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6, backgroundColor: '#334155' },
        colorPrimary: { backgroundColor: '#3B82F6' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#334155' },
      },
    },
    MuiBadge: {
      styleOverrides: {
        colorError: { backgroundColor: '#EF4444' },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        colorPrimary: { color: '#3B82F6' },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: '#334155', borderRadius: 8 },
      },
    },
  },
});
