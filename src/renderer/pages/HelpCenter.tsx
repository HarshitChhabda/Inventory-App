import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, CardActionArea, Stack, TextField,
  InputAdornment, Chip, alpha, useTheme, Grid, Paper, Badge, Divider,
} from '@mui/material';
import {
  Search, Dashboard, Warehouse, Storage, Business, Settings,
  HelpOutline, ArrowForward, BarChart, AdminPanelSettings, BookOnline,
  AutoAwesome, TrendingUp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useGuide } from '../components/GuideSystem';
import { guideCategories, guideRegistry } from '../components/GuideSystem/guides';

const categoryIcons: Record<string, React.ReactNode> = {
  Dashboard: <Dashboard sx={{ fontSize: 22 }} />,
  Warehouse: <Warehouse sx={{ fontSize: 22 }} />,
  Storage: <Storage sx={{ fontSize: 22 }} />,
  Business: <Business sx={{ fontSize: 22 }} />,
  Settings: <Settings sx={{ fontSize: 22 }} />,
  BarChart: <BarChart sx={{ fontSize: 22 }} />,
  AdminPanelSettings: <AdminPanelSettings sx={{ fontSize: 22 }} />,
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Dashboard: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  Warehouse: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  Storage: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  Business: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  Settings: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  BarChart: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  AdminPanelSettings: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

const categoryColorsDark: Record<string, { bg: string; text: string; border: string }> = {
  Dashboard: { bg: '#1E3A5F', text: '#60A5FA', border: '#1E40AF' },
  Warehouse: { bg: '#14532D', text: '#4ADE80', border: '#166534' },
  Storage: { bg: '#7C2D12', text: '#FB923C', border: '#9A3412' },
  Business: { bg: '#3B0764', text: '#A78BFA', border: '#581C87' },
  Settings: { bg: '#1E293B', text: '#94A3B8', border: '#334155' },
  BarChart: { bg: '#064E3B', text: '#34D399', border: '#065F46' },
  AdminPanelSettings: { bg: '#7F1D1D', text: '#FCA5A5', border: '#991B1B' },
};

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { openGuide } = useGuide();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const allGuides = Object.values(guideRegistry);

  const filteredGuides = useMemo(() => {
    if (!search) return allGuides;
    const q = search.toLowerCase();
    return allGuides.filter(g =>
      g.pageTitle.toLowerCase().includes(q) ||
      g.pageDescription.toLowerCase().includes(q) ||
      g.whatIsThis.toLowerCase().includes(q)
    );
  }, [search, allGuides]);

  const totalGuides = allGuides.length;
  const totalCategories = guideCategories.length;

  const handleGuideClick = (pageId: string) => {
    openGuide(pageId);
  };

  const handleNavigate = (route: string) => {
    navigate(route);
  };

  return (
    <Box>
      <PageHeader
        title="Help Center"
        subtitle={`${totalGuides} guides across ${totalCategories} categories`}
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Help Center' },
        ]}
      />

      {/* Hero Stats */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: isDark
            ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'
            : 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)',
          border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          borderRadius: 3,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              <AutoAwesome sx={{ fontSize: 20, mr: 0.5, color: isDark ? '#60A5FA' : '#2563EB' }} />
              Inventory Management Guides
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Step-by-step guides, tips, and best practices for every page
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: isDark ? '#60A5FA' : '#2563EB' }}>{totalGuides}</Typography>
              <Typography variant="caption" color="text.secondary">Guides</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: isDark ? '#4ADE80' : '#16A34A' }}>{totalCategories}</Typography>
              <Typography variant="caption" color="text.secondary">Categories</Typography>
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}` }}>
        <TextField
          fullWidth
          placeholder="Search guides... (e.g., Receipt, Stock, Report, Security)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            },
          }}
        />
      </Paper>

      {/* Search Results Count */}
      {search && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <TrendingUp sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {filteredGuides.length} guide(s) found for "<strong>{search}</strong>"
          </Typography>
        </Stack>
      )}

      {/* Categories */}
      {guideCategories.map((category) => {
        const categoryGuides = category.guides
          .map(id => guideRegistry[id])
          .filter(g => !search || filteredGuides.some(fg => fg.pageId === g.pageId));

        if (categoryGuides.length === 0) return null;

        const colors = isDark
          ? (categoryColorsDark[category.icon] || categoryColorsDark.Settings)
          : (categoryColors[category.icon] || categoryColors.Settings);

        return (
          <Box key={category.title} sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  backgroundColor: colors.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.text,
                }}
              >
                {categoryIcons[category.icon] || <HelpOutline />}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                {category.title}
              </Typography>
              <Badge
                badgeContent={categoryGuides.length}
                color="primary"
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.65rem',
                    height: 18,
                    minWidth: 18,
                  },
                }}
              />
            </Stack>

            <Grid container spacing={2}>
              {categoryGuides.map((guide) => (
                <Grid item xs={12} sm={6} md={4} key={guide.pageId}>
                  <Card
                    sx={{
                      borderRadius: 2,
                      border: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
                      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                      '&:hover': {
                        borderColor: colors.text,
                        boxShadow: `0 4px 16px ${alpha(colors.text, 0.15)}`,
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleGuideClick(guide.pageId)}
                      sx={{ p: 2.5 }}
                    >
                      <CardContent sx={{ p: 0 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                              <BookOnline sx={{ fontSize: 16, color: colors.text }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                                {guide.pageTitle}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8125rem', mb: 1.5, lineHeight: 1.5 }}>
                              {guide.pageDescription}
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                              {guide.prerequisites.slice(0, 2).map((req, idx) => (
                                <Chip
                                  key={idx}
                                  label={req}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                                    color: 'text.secondary',
                                    fontWeight: 500,
                                  }}
                                />
                              ))}
                              {guide.steps.length > 0 && (
                                <Chip
                                  label={`${guide.steps.length} steps`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    backgroundColor: alpha(colors.text, 0.1),
                                    color: colors.text,
                                    fontWeight: 600,
                                  }}
                                />
                              )}
                            </Stack>
                          </Box>
                          <ArrowForward sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5, opacity: 0.5 }} />
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}

      {/* No Results */}
      {search && filteredGuides.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <HelpOutline sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            No guide found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            No guide available for "<strong>{search}</strong>". Try different keywords or browse categories.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
