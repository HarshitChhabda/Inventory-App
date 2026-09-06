import { GuideData } from '../types';
import { dashboardGuide } from './dashboard';
import { storeMasterGuide } from './storeMaster';
import { storeStockGuide } from './storeStock';
import { receiptChallanGuide } from './receiptChallan';
import { issueChallanGuide } from './issueChallan';
import { transferChallanGuide } from './transferChallan';
import { vendorReturnGuide } from './vendorReturn';
import { stockAdjustmentGuide } from './stockAdjustment';
import { stockLedgerGuide } from './stockLedger';
import { damageEntryGuide } from './damageEntry';
import { itemsGuide } from './items';
import { unitsGuide } from './units';
import { vendorsGuide } from './vendors';
import { departmentsGuide } from './departments';
import { locationsGuide } from './locations';
import { usersGuide } from './users';
import { configurationGuide } from './configuration';
import { financialYearGuide } from './financialYear';
import { companyManagementGuide } from './companyManagement';
import { backupGuide } from './backup';
import { rolesGuide } from './roles';
import { reportsCenterGuide } from './reportsCenter';
import { auditLogsGuide } from './auditLogs';
import { securityGuide } from './security';
import { dataIntegrityGuide } from './dataIntegrity';

export const guideRegistry: Record<string, GuideData> = {
  'dashboard': dashboardGuide,
  'store-master': storeMasterGuide,
  'store-stock': storeStockGuide,
  'receipt-challan': receiptChallanGuide,
  'issue-challan': issueChallanGuide,
  'transfer-challan': transferChallanGuide,
  'vendor-return': vendorReturnGuide,
  'stock-adjustment': stockAdjustmentGuide,
  'stock-ledger': stockLedgerGuide,
  'damage-entry': damageEntryGuide,
  'items': itemsGuide,
  'units': unitsGuide,
  'vendors': vendorsGuide,
  'departments': departmentsGuide,
  'locations': locationsGuide,
  'users': usersGuide,
  'configuration': configurationGuide,
  'financial-year': financialYearGuide,
  'company-management': companyManagementGuide,
  'backup': backupGuide,
  'roles': rolesGuide,
  'reports-center': reportsCenterGuide,
  'audit-logs': auditLogsGuide,
  'security': securityGuide,
  'data-integrity': dataIntegrityGuide,
};

export const guideCategories = [
  {
    title: 'Dashboard & Overview',
    icon: 'Dashboard',
    guides: ['dashboard'],
  },
  {
    title: 'Inventory Management',
    icon: 'Warehouse',
    guides: ['receipt-challan', 'issue-challan', 'transfer-challan', 'vendor-return', 'stock-adjustment', 'stock-ledger', 'damage-entry'],
  },
  {
    title: 'Master Data',
    icon: 'Storage',
    guides: ['items', 'units', 'vendors', 'departments', 'locations', 'users'],
  },
  {
    title: 'Reports & Analytics',
    icon: 'BarChart',
    guides: ['reports-center'],
  },
  {
    title: 'Enterprise',
    icon: 'Business',
    guides: ['store-master', 'store-stock', 'configuration'],
  },
  {
    title: 'Administration',
    icon: 'AdminPanelSettings',
    guides: ['roles', 'audit-logs', 'security', 'data-integrity'],
  },
  {
    title: 'System',
    icon: 'Settings',
    guides: ['financial-year', 'company-management', 'backup'],
  },
];
