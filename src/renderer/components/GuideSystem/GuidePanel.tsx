import React from 'react';
import {
  Drawer, Box, Typography, IconButton, Stack, Divider, Chip, alpha, useTheme,
  List, ListItem, ListItemIcon, ListItemText, Link,
} from '@mui/material';
import {
  Close, CheckCircle, Cancel, Info, Warning, ArrowForward,
  Lightbulb, Rule, FormatListNumbered,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGuide } from './GuideProvider';
import GuideSteps from './GuideSteps';

export default function GuidePanel() {
  const { currentGuide, isGuideOpen, closeGuide } = useGuide();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  if (!currentGuide) return null;

  const handleNavigate = (route: string) => {
    closeGuide();
    setTimeout(() => navigate(route), 300);
  };

  return (
    <Drawer
      anchor="right"
      open={isGuideOpen}
      onClose={closeGuide}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          backgroundColor: isDark ? '#0F172A' : '#FAFBFC',
          borderLeft: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2.5,
            background: `linear-gradient(135deg, ${isDark ? '#1E3A5F' : '#EFF6FF'} 0%, ${isDark ? '#0F172A' : '#F8FAFC'} 100%)`,
            borderBottom: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Chip
                label="PAGE GUIDE"
                size="small"
                sx={{
                  mb: 1,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  backgroundColor: isDark ? '#2563EB33' : '#DBEAFE',
                  color: isDark ? '#60A5FA' : '#2563EB',
                }}
              />
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.125rem', color: 'text.primary' }}>
                {currentGuide.pageTitle}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, fontSize: '0.8125rem' }}>
                {currentGuide.pageDescription}
              </Typography>
            </Box>
            <IconButton onClick={closeGuide} size="small" sx={{ mt: -0.5 }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
          {/* What is this */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Info sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.875rem' }}>
                What is this page?
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem', lineHeight: 1.6, pl: 3.5 }}>
              {currentGuide.whatIsThis}
            </Typography>
          </Box>

          {/* When to use */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Lightbulb sx={{ fontSize: 18, color: '#F59E0B' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.875rem' }}>
                When to use?
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem', lineHeight: 1.6, pl: 3.5 }}>
              {currentGuide.whenToUse}
            </Typography>
          </Box>

          {/* Prerequisites */}
          {currentGuide.prerequisites.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.875rem', mb: 1 }}>
                Prerequisites
              </Typography>
              <List dense disablePadding>
                {currentGuide.prerequisites.map((req, idx) => (
                  <ListItem key={idx} disablePadding sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          backgroundColor: 'warning.main',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={req}
                      primaryTypographyProps={{ variant: 'body2', fontSize: '0.8125rem', color: 'text.secondary' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Steps */}
          {currentGuide.steps.length > 0 && (
            <GuideSteps steps={currentGuide.steps} />
          )}

          <Divider sx={{ my: 2 }} />

          {/* Do's and Don'ts */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
            {/* Do's */}
            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                <CheckCircle sx={{ fontSize: 16, color: '#10B981' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#10B981', fontSize: '0.8125rem' }}>
                  Do's
                </Typography>
              </Stack>
              <List dense disablePadding>
                {currentGuide.dos.map((item, idx) => (
                  <ListItem key={idx} disablePadding sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={item}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        sx: { pl: 2.5 },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* Don'ts */}
            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                <Cancel sx={{ fontSize: 16, color: '#EF4444' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#EF4444', fontSize: '0.8125rem' }}>
                  Don'ts
                </Typography>
              </Stack>
              <List dense disablePadding>
                {currentGuide.donts.map((item, idx) => (
                  <ListItem key={idx} disablePadding sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={item}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        sx: { pl: 2.5 },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Validation Rules */}
          {currentGuide.validationRules.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Rule sx={{ fontSize: 18, color: '#8B5CF6' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.875rem' }}>
                  Validation Rules
                </Typography>
              </Stack>
              <Box
                sx={{
                  backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                  borderRadius: 1.5,
                  p: 1.5,
                  border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                }}
              >
                {currentGuide.validationRules.map((rule, idx) => (
                  <Box key={idx} sx={{ py: 0.75, borderBottom: idx < currentGuide.validationRules.length - 1 ? `1px solid ${isDark ? '#334155' : '#E2E8F0'}` : 'none' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: 'text.primary' }}>
                      {rule.field}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {rule.rule}
                    </Typography>
                    {rule.example && (
                      <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic', mt: 0.25 }}>
                        Example: {rule.example}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Sections */}
          {currentGuide.sections.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.875rem', mb: 1.5 }}>
                Additional Information
              </Typography>
              {currentGuide.sections.map((section, idx) => (
                <Box
                  key={idx}
                  sx={{
                    mb: 1.5,
                    p: 1.5,
                    backgroundColor: isDark ? '#1E293B80' : '#F8FAFC',
                    borderRadius: 1.5,
                    border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: 'text.primary', mb: 0.5 }}>
                    {section.title}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {section.content}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Related Pages */}
          {currentGuide.relatedPages.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.875rem', mb: 1 }}>
                Related Pages
              </Typography>
              <Stack spacing={0.5}>
                {currentGuide.relatedPages.map((page, idx) => (
                  <Box
                    key={idx}
                    onClick={() => handleNavigate(page.route)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                      },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'primary.main', fontWeight: 500 }}>
                      {page.title}
                    </Typography>
                    <ArrowForward sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
