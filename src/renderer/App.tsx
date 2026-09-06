import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as MuiThemeProvider, CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { ThemeProvider, useThemeMode } from './context/ThemeContext';
import { TabProvider } from './context/TabContext';
import { GuideProvider, GuidePanel } from './components/GuideSystem';
import { lightTheme, darkTheme } from './theme';
import Layout from './components/Layout';
import SetupGuard from './components/SetupGuard';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import { RequireAuth, RequirePermission } from './components/RouteGuards';

const Login = lazy(() => import('./pages/Auth/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ItemsPage = lazy(() => import('./pages/Masters/Items'));
const DepartmentsPage = lazy(() => import('./pages/Masters/Departments'));
const UnitsPage = lazy(() => import('./pages/Masters/Units'));
const LocationsPage = lazy(() => import('./pages/Masters/Locations'));
const UsersPage = lazy(() => import('./pages/Masters/Users'));
const MovementHub = lazy(() => import('./pages/Inventory/MovementHub'));
const MaterialIssueForm = lazy(() => import('./pages/Inventory/MaterialIssue'));
const MaterialTransfer = lazy(() => import('./pages/Inventory/MaterialTransfer'));
const DirectDemand = lazy(() => import('./pages/Inventory/DirectDemand'));
const DemandSlips = lazy(() => import('./pages/Inventory/DemandSlips'));
const IssueChallanList = lazy(() => import('./pages/Inventory/IssueChallan/IssueChallanList'));
const IssueChallanForm = lazy(() => import('./pages/Inventory/IssueChallan/IssueChallanForm'));
const ConsumptionList = lazy(() => import('./pages/Inventory/Consumption/ConsumptionList'));
const ConsumptionForm = lazy(() => import('./pages/Inventory/Consumption/ConsumptionForm'));
const InstallationList = lazy(() => import('./pages/Inventory/Installation/InstallationList'));
const InstallationForm = lazy(() => import('./pages/Inventory/Installation/InstallationForm'));
const InstallationDetail = lazy(() => import('./pages/Inventory/Installation/InstallationDetail'));
const StockLedgerPage = lazy(() => import('./pages/Inventory/StockLedger'));
const DamageEntryPage = lazy(() => import('./pages/Inventory/DamageEntry'));
const TransferChallanList = lazy(() => import('./pages/Inventory/Transfers/TransferChallanList'));
const TransferChallanForm = lazy(() => import('./pages/Inventory/Transfers/TransferChallanForm'));
const DharmshalaShiftList = lazy(() => import('./pages/Inventory/DharmshalaShift/List'));
const DharmshalaShiftForm = lazy(() => import('./pages/Inventory/DharmshalaShift/Form'));
const DepartmentShiftList = lazy(() => import('./pages/Inventory/DepartmentShift/List'));
const DepartmentShiftForm = lazy(() => import('./pages/Inventory/DepartmentShift/Form'));
const VendorReturnPage = lazy(() => import('./pages/Inventory/VendorReturn'));
const StockAdjustmentPage = lazy(() => import('./pages/Inventory/StockAdjustment'));
const ItemHistoryTimeline = lazy(() => import('./components/ItemHistoryTimeline'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const RoomDetails = lazy(() => import('./pages/Facilities/RoomDetails'));
const FinancialYearPage = lazy(() => import('./pages/FinancialYear'));
const CompanyManagementPage = lazy(() => import('./pages/CompanyManagement'));
const BackupPage = lazy(() => import('./pages/Backup'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// Enterprise Pages
const StoreMasterPage = lazy(() => import('./pages/Enterprise/StoreMaster'));
const ConfigurationPage = lazy(() => import('./pages/Enterprise/Configuration'));
const StoreStockPage = lazy(() => import('./pages/Enterprise/StoreStock'));
const ItemStoreViewPage = lazy(() => import('./pages/Enterprise/ItemStoreView'));
const LocationItemViewPage = lazy(() => import('./pages/Enterprise/LocationItemView'));
const DataMigrationPage = lazy(() => import('./pages/Enterprise/DataMigration'));

// Asset Pages
const AssetRegistryPage = lazy(() => import('./pages/Assets/Registry'));
const AssetInstallationsPage = lazy(() => import('./pages/Assets/Installations'));
const AssetReportsPage = lazy(() => import('./pages/Assets/AssetReports'));

// Requisition Pages
const RequisitionCreatePage = lazy(() => import('./pages/Requisition/Create'));
const RequisitionListPage = lazy(() => import('./pages/Requisition/List'));
const WorkflowConfigPage = lazy(() => import('./pages/Requisition/Workflow'));

// Procurement Pages
const VendorMasterPage = lazy(() => import('./pages/Procurement/VendorMaster'));
const PurchaseOrderListPage = lazy(() => import('./pages/Procurement/PurchaseOrder/List'));
const PurchaseOrderFormPage = lazy(() => import('./pages/Procurement/PurchaseOrder/Form'));
const GoodsReceiptListPage = lazy(() => import('./pages/Procurement/GoodsReceipt/List'));
const GoodsReceiptFormPage = lazy(() => import('./pages/Procurement/GoodsReceipt/Form'));
const PurchaseDashboardPage = lazy(() => import('./pages/Procurement/Dashboard'));

const MaintenanceDashboardPage = lazy(() => import('./pages/Maintenance/Dashboard'));
const ServiceRequestListPage = lazy(() => import('./pages/Maintenance/ServiceRequest'));
const WorkOrderPage = lazy(() => import('./pages/Maintenance/WorkOrder'));
const AMCPage = lazy(() => import('./pages/Maintenance/AMC'));

const SuperAdminDashboardPage = lazy(() => import('./pages/Dashboard/SuperAdmin'));
const ReportsCenterPage = lazy(() => import('./pages/Reports/ReportsCenter'));
const GlobalSearchPage = lazy(() => import('./pages/Reports/GlobalSearch'));

// Admin Pages
const AuditLogsPage = lazy(() => import('./pages/Admin/AuditLogs'));
const RolesPage = lazy(() => import('./pages/Admin/Roles'));
const SecurityPage = lazy(() => import('./pages/Admin/Security'));
const IntegrityPage = lazy(() => import('./pages/Admin/Integrity'));

// Phase 11 Pages
const ImportCenterPage = lazy(() => import('./pages/ImportCenter'));
const BulkOperationsPage = lazy(() => import('./pages/BulkOperations'));

// Tools Pages
const ToolsHubPage = lazy(() => import('./pages/Tools'));

// Help Center
const HelpCenterPage = lazy(() => import('./pages/HelpCenter'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
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
      <GuideProvider>
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
        <GuidePanel />
        <TabProvider>
          <Routes>
            {/* Login — standalone full-screen, no Layout/Sidebar */}
            <Route path="/login" element={<LoginRoute />} />

            {/* All authenticated routes — inside Layout with Sidebar */}
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <SetupGuard>
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

                           <Route path="/masters/units" element={<RequirePermission permissionKey="manage_masters"><PageTransition><UnitsPage /></PageTransition></RequirePermission>} />
                           <Route path="/masters/departments" element={<RequirePermission permissionKey="manage_masters"><PageTransition><DepartmentsPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/locations" element={<RequirePermission permissionKey="manage_masters"><PageTransition><LocationsPage /></PageTransition></RequirePermission>} />
                          <Route path="/masters/users" element={<RequirePermission permissionKey="manage_users"><PageTransition><UsersPage /></PageTransition></RequirePermission>} />

                           {/* Authenticated: Inventory */}
                           <Route path="/inventory/movement" element={<PageTransition><MovementHub /></PageTransition>} />
                           <Route path="/inventory/material-issue" element={<PageTransition><MaterialIssueForm /></PageTransition>} />
                            <Route path="/inventory/material-transfer" element={<PageTransition><MaterialTransfer /></PageTransition>} />
                            <Route path="/inventory/new-demand" element={<PageTransition><DirectDemand /></PageTransition>} />
                            <Route path="/inventory/demand-slips" element={<PageTransition><DemandSlips /></PageTransition>} />
                           <Route path="/inventory/issue-challan" element={<PageTransition><IssueChallanList /></PageTransition>} />
                          <Route path="/inventory/issue-challan/new" element={<PageTransition><IssueChallanForm /></PageTransition>} />
                           <Route path="/inventory/issue-challan/:id" element={<PageTransition><IssueChallanForm /></PageTransition>} />
                            <Route path="/inventory/consumption" element={<PageTransition><ConsumptionList /></PageTransition>} />
                            <Route path="/inventory/consumption/new" element={<PageTransition><ConsumptionForm /></PageTransition>} />
                            <Route path="/inventory/consumption/:id" element={<PageTransition><ConsumptionForm /></PageTransition>} />
                            <Route path="/inventory/installation" element={<PageTransition><InstallationList /></PageTransition>} />
                            <Route path="/inventory/installation/new" element={<PageTransition><InstallationForm /></PageTransition>} />
                            <Route path="/inventory/installation/:id" element={<PageTransition><InstallationDetail /></PageTransition>} />
                           <Route path="/inventory/transfer-challan" element={<PageTransition><TransferChallanList /></PageTransition>} />
                          <Route path="/inventory/transfer-challan/new" element={<PageTransition><TransferChallanForm /></PageTransition>} />
                          <Route path="/inventory/transfer-challan/:id" element={<PageTransition><TransferChallanForm /></PageTransition>} />
                          <Route path="/inventory/ds" element={<PageTransition><DharmshalaShiftList /></PageTransition>} />
                          <Route path="/inventory/ds/new" element={<PageTransition><DharmshalaShiftForm /></PageTransition>} />
                          <Route path="/inventory/ds/:id" element={<PageTransition><DharmshalaShiftForm /></PageTransition>} />
                          <Route path="/inventory/dp" element={<PageTransition><DepartmentShiftList /></PageTransition>} />
                          <Route path="/inventory/dp/new" element={<PageTransition><DepartmentShiftForm /></PageTransition>} />
                          <Route path="/inventory/dp/:id" element={<PageTransition><DepartmentShiftForm /></PageTransition>} />
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

                          {/* Help Center */}
                          <Route path="/help-center" element={<PageTransition><HelpCenterPage /></PageTransition>} />

                          {/* Admin: Security & Compliance */}
                          <Route path="/admin/audit" element={<RequirePermission permissionKey="audit:view"><PageTransition><AuditLogsPage /></PageTransition></RequirePermission>} />
                          <Route path="/admin/roles" element={<RequirePermission permissionKey="user:create"><PageTransition><RolesPage /></PageTransition></RequirePermission>} />
                          <Route path="/admin/security" element={<RequirePermission permissionKey="settings:edit"><PageTransition><SecurityPage /></PageTransition></RequirePermission>} />
                          <Route path="/admin/integrity" element={<RequirePermission permissionKey="audit:view"><PageTransition><IntegrityPage /></PageTransition></RequirePermission>} />

                          {/* Enterprise: Store Management */}
                          <Route path="/enterprise/stores" element={<RequirePermission permissionKey="manage_masters"><PageTransition><StoreMasterPage /></PageTransition></RequirePermission>} />
                          <Route path="/enterprise/stock" element={<PageTransition><StoreStockPage /></PageTransition>} />
                          <Route path="/enterprise/item-stores" element={<PageTransition><ItemStoreViewPage /></PageTransition>} />
                          <Route path="/enterprise/location-items" element={<PageTransition><LocationItemViewPage /></PageTransition>} />
                          <Route path="/enterprise/configuration" element={<RequirePermission permissionKey="manage_settings"><PageTransition><ConfigurationPage /></PageTransition></RequirePermission>} />
                          <Route path="/enterprise/migration" element={<RequirePermission permissionKey="manage_settings"><PageTransition><DataMigrationPage /></PageTransition></RequirePermission>} />

                          {/* Phase 11: Import & Bulk Operations */}
                          <Route path="/import-center" element={<PageTransition><ImportCenterPage /></PageTransition>} />
                          <Route path="/bulk-operations" element={<PageTransition><BulkOperationsPage /></PageTransition>} />

                          {/* Tools */}
                          <Route path="/tools" element={<PageTransition><ToolsHubPage /></PageTransition>} />

                          {/* Asset Management */}
                          <Route path="/assets/registry" element={<PageTransition><AssetRegistryPage /></PageTransition>} />
                          <Route path="/assets/installations" element={<PageTransition><AssetInstallationsPage /></PageTransition>} />
                          <Route path="/assets/reports" element={<PageTransition><AssetReportsPage /></PageTransition>} />

                          <Route path="/requisition/create" element={<PageTransition><RequisitionCreatePage /></PageTransition>} />
                          <Route path="/requisition/list" element={<PageTransition><RequisitionListPage /></PageTransition>} />
                          <Route path="/requisition/workflow" element={<PageTransition><WorkflowConfigPage /></PageTransition>} />

                          <Route path="/procurement/vendors" element={<PageTransition><VendorMasterPage /></PageTransition>} />
                          <Route path="/procurement/po" element={<PageTransition><PurchaseOrderListPage /></PageTransition>} />
                          <Route path="/procurement/po/new" element={<PageTransition><PurchaseOrderFormPage /></PageTransition>} />
                          <Route path="/procurement/po/:id" element={<PageTransition><PurchaseOrderFormPage /></PageTransition>} />
                          <Route path="/procurement/grn" element={<PageTransition><GoodsReceiptListPage /></PageTransition>} />
                          <Route path="/procurement/grn/new" element={<PageTransition><GoodsReceiptFormPage /></PageTransition>} />
                          <Route path="/procurement/dashboard" element={<PageTransition><PurchaseDashboardPage /></PageTransition>} />

                          <Route path="/maintenance/dashboard" element={<PageTransition><MaintenanceDashboardPage /></PageTransition>} />
                          <Route path="/maintenance/requests" element={<PageTransition><ServiceRequestListPage /></PageTransition>} />
                          <Route path="/maintenance/workorders" element={<PageTransition><WorkOrderPage /></PageTransition>} />
                          <Route path="/maintenance/amc" element={<PageTransition><AMCPage /></PageTransition>} />

                          {/* Executive Dashboard & Reports */}
                          <Route path="/executive/dashboard" element={<PageTransition><SuperAdminDashboardPage /></PageTransition>} />
                          <Route path="/executive/reports" element={<PageTransition><ReportsCenterPage /></PageTransition>} />
                          <Route path="/executive/search" element={<PageTransition><GlobalSearchPage /></PageTransition>} />

                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </ErrorBoundary>
                    </Suspense>
                  </Layout>
                  </SetupGuard>
                </RequireAuth>
              }
            />
          </Routes>
        </TabProvider>
      </Router>
      </GuideProvider>
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
