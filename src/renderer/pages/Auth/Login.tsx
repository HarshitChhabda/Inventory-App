import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, CircularProgress, alpha, useTheme,
  InputAdornment, IconButton, Grid
} from '@mui/material';
import { LockOutlined, Visibility, VisibilityOff, Inventory2Outlined, VerifiedUserOutlined, SecurityOutlined } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';

export default function Login() {
  const { login } = useAuth();
  const { company } = useCompany();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid container sx={{ minHeight: '100vh', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
      {/* Left Side - Branding / Trust Signals */}
      <Grid 
        item 
        xs={12} 
        md={5} 
        lg={6} 
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          bgcolor: isDark ? '#020617' : '#0F172A',
          color: 'white',
          p: { md: 6, lg: 10 },
          position: 'relative',
          overflow: 'hidden',
          borderRight: isDark ? '1px solid #1E293B' : 'none'
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 1.5 }}>
            <Box
              sx={{
                width: 72, height: 72, borderRadius: '24px',
                bgcolor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                p: 0, overflow: 'hidden',
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
              }}
            >
              <img src="/icon.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '0', fontFamily: '"Kokila", "Plus Jakarta Sans", sans-serif', fontSize: '2.2rem' }}>
              दिगम्बर जैन अतिशय क्षेत्र श्री महावीरजी
            </Typography>
          </Box>
          <Typography variant="h2" sx={{ fontWeight: 700, mb: 3, letterSpacing: '-0.02em', fontSize: { md: '2.5rem', lg: '3.5rem' }, lineHeight: 1.2, fontFamily: '"Kokila", "Plus Jakarta Sans", sans-serif' }}>
            Enterprise <br />
            <Box component="span" sx={{ color: '#38BDF8' }}>Inventory Management</Box>
          </Typography>
          <Typography variant="h6" sx={{ color: '#94A3B8', mb: 6, fontWeight: 400, maxWidth: 480, lineHeight: 1.6 }}>
            A comprehensive solution for tracking, managing, and optimizing your inventory operations securely and efficiently.
          </Typography>

          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ 
              display: 'flex', alignItems: 'center', gap: 1.5,
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '10px 16px',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              '&:hover': { background: 'rgba(255, 255, 255, 0.08)', transform: 'translateY(-2px)' }
            }}>
              <VerifiedUserOutlined sx={{ color: '#38BDF8', fontSize: 24 }} />
              <Box>
                <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 600, lineHeight: 1.2 }}>Verified Data</Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>End-to-end encrypted</Typography>
              </Box>
            </Box>
            <Box sx={{ 
              display: 'flex', alignItems: 'center', gap: 1.5,
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '10px 16px',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              '&:hover': { background: 'rgba(255, 255, 255, 0.08)', transform: 'translateY(-2px)' }
            }}>
              <SecurityOutlined sx={{ color: '#38BDF8', fontSize: 24 }} />
              <Box>
                <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 600, lineHeight: 1.2 }}>Secure Access</Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>Enterprise-grade security</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
        
        {/* Background Decorative Elements */}
        <Box 
          sx={{
            position: 'absolute',
            top: '-20%', right: '-10%',
            width: '70%', height: '70%',
            background: 'radial-gradient(circle, rgba(3,105,161,0.2) 0%, rgba(15,23,42,0) 70%)',
            borderRadius: '50%',
            zIndex: 0
          }}
        />
        <Box 
          sx={{
            position: 'absolute',
            bottom: '-10%', left: '-20%',
            width: '80%', height: '80%',
            background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, rgba(15,23,42,0) 70%)',
            borderRadius: '50%',
            zIndex: 0
          }}
        />
      </Grid>

      {/* Right Side - Form */}
      <Grid 
        item 
        xs={12} 
        md={7} 
        lg={6} 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 3
        }}
      >
        <Paper
          elevation={isDark ? 0 : 4}
          sx={{
            width: '100%',
            maxWidth: 440,
            borderRadius: '20px',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            px: { xs: 3, sm: 5 },
            py: { xs: 4, sm: 6 },
            boxShadow: isDark 
              ? '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' 
              : '0 25px 50px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', mb: 5 }}>
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', mb: 3, gap: 1 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '16px', bgcolor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <img src="/icon.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Kokila", "Plus Jakarta Sans", sans-serif', fontSize: '1.5rem', letterSpacing: '0' }}>
                दिगम्बर जैन अतिशय क्षेत्र श्री महावीरजी
              </Typography>
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1.5rem', fontFamily: '"Kokila", "Plus Jakarta Sans", sans-serif', mb: 1 }}>
              Sign in
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
              Enter your credentials to access your account
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1, ml: 0.5 }}>
              Username
            </Typography>
            <TextField
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="Enter your username"
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: isDark ? '#020617' : '#F8FAFC',
                  color: isDark ? '#F1F5F9' : '#0F172A',
                  transition: 'all 0.2s',
                  '& fieldset': { borderColor: isDark ? '#334155' : '#E2E8F0' },
                  '&:hover fieldset': { borderColor: '#0369A1' },
                  '&.Mui-focused fieldset': { borderColor: '#0369A1', borderWidth: '2px' }
                }
              }}
            />

            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1, ml: 0.5 }}>
              Password
            </Typography>
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              sx={{ 
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: isDark ? '#020617' : '#F8FAFC',
                  color: isDark ? '#F1F5F9' : '#0F172A',
                  transition: 'all 0.2s',
                  '& fieldset': { borderColor: isDark ? '#334155' : '#E2E8F0' },
                  '&:hover fieldset': { borderColor: '#0369A1' },
                  '&.Mui-focused fieldset': { borderColor: '#0369A1', borderWidth: '2px' }
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      sx={{ color: 'text.secondary' }}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ minHeight: 24, mb: 3, mt: 1 }}>
              {error && (
                <Typography variant="body2" sx={{ color: '#EF4444', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span style={{ fontWeight: 600 }}>Error:</span> {error}
                </Typography>
              )}
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={!canSubmit}
              disableElevation
              sx={{
                py: 1.75,
                fontWeight: 700,
                fontSize: '0.9375rem',
                textTransform: 'none',
                borderRadius: '12px',
                backgroundColor: '#0EA5E9',
                color: '#FFFFFF',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                boxShadow: '0 4px 14px 0 rgba(14, 165, 233, 0.39)',
                '&:hover': { 
                  backgroundColor: '#0284C7',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(14, 165, 233, 0.23)'
                },
                '&.Mui-disabled': { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', 
                  color: isDark ? '#475569' : '#94A3B8',
                  boxShadow: 'none'
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: '#FFFFFF' }} />
              ) : (
                'Sign In to Dashboard'
              )}
            </Button>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}
