import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as MuiThemeProvider, CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { ThemeProvider, useThemeMode } from './context/ThemeContext';
import { TabProvider } from './context/TabContext';
import { lightTheme, darkTheme } from './theme';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import { RequireAuth, RequirePermission } from './components/RouteGuards';

const Login = lazy(() => import('./pages/Auth/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ItemsPage = lazy(() => import('./pages/Masters/Items'));
const VendorsPage = lazy(() => import('./pages/Masters/Vendors'));
const DepartmentsPage = lazy(() => import('./pages/Masters/Departments'));
const UnitsPage = lazy(() => import('./pages/Masters/Units'));
const CategoriesPage = lazy(() => import('./pages/Masters/Categories'));
const LocationsPage = lazy(() => import('./pages/Masters/Locations'));
const UsersPage = lazy(() => import('./pages/Masters/Users'));
const ReceiptChallanList = lazy(() => import('./pages/Inventory/ReceiptChallan/ReceiptChallanList'));
const ReceiptChallanForm = lazy(() => import('./pages/Inventory/ReceiptChallan/ReceiptChallanForm'));
const IssueChallanList = lazy(() => import('./pages/Inventory/IssueChallan/IssueChallanList'));
const IssueChallanForm = lazy(() => import('./pages/Inventory/IssueChallan/IssueChallanForm'));
const StockLedgerPage = lazy(() => import('./pages/Inventory/StockLedger'));
const DamageEntryPage = lazy(() => import('./pages/Inventory/DamageEntry'));
const TransferChallanList = lazy(() => import('./pages/Inventory/Transfers/TransferChallanList'));
const TransferChallanForm = lazy(() => import('./pages/Inventory/Transfers/TransferChallanForm'));
const VendorReturnPage = lazy(() => import('./pages/Inventory/VendorReturn'));
const StockAdjustmentPage = lazy(() => import('./pages/Inventory/StockAdjustment'));
const ItemHistoryTimeline = lazy(() => import('./components/ItemHistoryTimeline'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const RoomDetails = lazy(() => import('./pages/Facilities/RoomDetails'));
const FinancialYearPage = lazy(() => import('./pages/FinancialYear'));
const CompanyManagementPage = lazy(() => import('./pages/CompanyManagement'));
const BackupPage = lazy(() => import('./pages/Backup'));
const SettingsPage = lazy(() => import('./pages/Settings'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

function LoginRoute() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
          backgroundColor: '#F8FAFC',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={32} sx={{ color: '#2563EB' }} />
        </Box>
        <Typography
          variant="body2"
          sx={{ color: '#64748B', fontWeight: 500, letterSpacing: '0.02em' }}
        >
          Loading Mahaveerji Inventory...
        </Typography>
      </Box>
    );
  }

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress size={32} sx={{ color: '#2563EB' }} />
        </Box>
      }
    >
      <Login />
    </Suspense>
  );
}

function ThemedApp() {
  const { darkMode } = useThemeMode();
  const theme = darkMode ? darkTheme : lightTheme;

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: darkMode ? '#1E293B' : '#FFFFFF',
            color: darkMode ? '#F1F5F9' : '#0F172A',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
            fontSize: '0.8125rem',
          },
        }}
      />
      <Router>
        <TabProvider>
          <Routes>
            {/* Login — standalone full-screen, no Layout/Sidebar */}
            <Route path="/login" element={<LoginRoute />} />

            {/* All authenticated routes — inside Layout with Sidebar */}
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <Layout>
                    <Suspense
                      fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                          <Box sx={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CircularProgress size={28} sx={{ color: '#2563EB' }} />
                          </Box>
                        </Box>
                      }
                    >
                      <ErrorBoundary>
                        <Routes>
                          <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />

                          {/* Admin-only: Masters */}
                          <Route path="/masters/items" element={<RequirePermission permissionKey="manage_masters"><PageTransition><ItemsPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/categories" element={<RequirePermission permissionKey="manage_masters"><PageTransition><CategoriesPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/units" element={<RequirePermission permissionKey="manage_masters"><PageTransition><UnitsPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/vendors" element={<RequirePermission permissionKey="manage_masters"><PageTransition><VendorsPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/departments" element={<RequirePermission permissionKey="manage_masters"><PageTransition><DepartmentsPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/locations" element={<RequirePermission permissionKey="manage_masters"><PageTransition><LocationsPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/users" element={<RequirePermission permissionKey="manage_users"><PageTransition><UsersPage /></PageTransition></RequirePermission>} />

                          {/* Authenticated: Inventory */}
                          <Route path="/inventory/receipt-challan" element={<PageTransition><ReceiptChallanList /></PageTransition>} />
                          <Route path="/inventory/receipt-challan/new" element={<PageTransition><ReceiptChallanForm /></PageTransition>} />
                          <Route path="/inventory/receipt-challan/:id" element={<PageTransition><ReceiptChallanForm /></PageTransition>} />
                          <Route path="/inventory/issue-challan" element={<PageTransition><IssueChallanList /></PageTransition>} />
                          <Route path="/inventory/issue-challan/new" element={<PageTransition><IssueChallanForm /></PageTransition>} />
                          <Route path="/inventory/issue-challan/:id" element={<PageTransition><IssueChallanForm /></PageTransition>} />
                          <Route path="/inventory/transfer-challan" element={<PageTransition><TransferChallanList /></PageTransition>} />
                          <Route path="/inventory/transfer-challan/new" element={<PageTransition><TransferChallanForm /></PageTransition>} />
                          <Route path="/inventory/transfer-challan/:id" element={<PageTransition><TransferChallanForm /></PageTransition>} />
                          <Route path="/inventory/vendor-return" element={<PageTransition><VendorReturnPage /></PageTransition>} />
                          <Route path="/inventory/stock-adjustment" element={<PageTransition><StockAdjustmentPage /></PageTransition>} />
                          <Route path="/inventory/stock-ledger" element={<PageTransition><StockLedgerPage /></PageTransition>} />
                          <Route path="/inventory/damage-entry" element={<PageTransition><DamageEntryPage /></PageTransition>} />
                          <Route path="/inventory/item-history" element={<PageTransition><ItemHistoryTimeline /></PageTransition>} />

                          {/* Authenticated: Facilities, Reports */}
                          <Route path="/facilities/room-details" element={<PageTransition><RoomDetails /></PageTransition>} />
                          <Route path="/reports" element={<PageTransition><ReportsPage /></PageTransition>} />

                          {/* Admin-only: Financial Year, Companies, Backup */}
                          <Route path="/financial-year" element={<RequirePermission permissionKey="manage_financial_year"><PageTransition><FinancialYearPage /></PageTransition></RequirePermission>} />
                          <Route path="/companies" element={<RequirePermission permissionKey="manage_company"><PageTransition><CompanyManagementPage /></PageTransition></RequirePermission>} />
                          <Route path="/backup" element={<RequirePermission permissionKey="manage_backup"><PageTransition><BackupPage /></PageTransition></RequirePermission>} />

                          {/* Authenticated: Settings */}
                          <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />

                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </ErrorBoundary>
                    </Suspense>
                  </Layout>
                </RequireAuth>
              }
            />
          </Routes>
        </TabProvider>
      </Router>
    </MuiThemeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <ThemeProvider>
            <ThemedApp />
          </ThemeProvider>
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
