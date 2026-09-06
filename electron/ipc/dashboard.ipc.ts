import { ipcMain } from 'electron';
import { DashboardService } from '../../src/main/services/dashboard.service';
import { ReportService } from '../../src/main/services/reportService.service';
import { GlobalSearchService } from '../../src/main/services/globalSearch.service';
import { ExportService } from '../../src/main/services/export.service';
import { requireAuth } from './helpers';

const ser = (r: any) => JSON.parse(JSON.stringify(r, (_k, v) => {
  if (typeof v === 'bigint') return v.toString();
  if (v != null && typeof v === 'object') {
    if (typeof v.toJSON === 'function') {
      const json = v.toJSON();
      if (typeof json !== 'object' || json === null) return json;
    }
    if ('s' in v && 'e' in v && 'd' in v) return Number(String(v));
  }
  return v;
}));

export function registerDashboardIPC() {
  // Legacy dashboard:getData handler (used by Dashboard page)
  ipcMain.handle('dashboard:getData', async (_e, companyId: number, financialYearId: number) => {
    requireAuth();
    return ser(await DashboardService.getSuperAdminDashboard({ companyId, financialYearId }));
  });

  // ===== DASHBOARDS =====
  ipcMain.handle('dash:superAdmin', async (_e, filter) => { requireAuth(); return ser(await DashboardService.getSuperAdminDashboard(filter)); });
  ipcMain.handle('dash:storeManager', async (_e, filter) => { requireAuth(); return ser(await DashboardService.getStoreManagerDashboard(filter)); });
  ipcMain.handle('dash:maintenance', async (_e, filter) => { requireAuth(); return ser(await DashboardService.getMaintenanceDashboard(filter)); });
  ipcMain.handle('dash:purchase', async (_e, filter) => { requireAuth(); return ser(await DashboardService.getPurchaseDashboard(filter)); });
  ipcMain.handle('dash:kpis', async (_e, filter) => { requireAuth(); return ser(await DashboardService.getKPIs(filter)); });
  ipcMain.handle('dash:monthlyTrend', async (_e, companyId, months) => { requireAuth(); return ser(await DashboardService.getMonthlyTrend(companyId, months)); });
  ipcMain.handle('dash:lowStock', async (_e, companyId, storeId) => { requireAuth(); return ser(await DashboardService.getLowStockItems(companyId, storeId)); });
  ipcMain.handle('dash:outOfStock', async (_e, companyId) => { requireAuth(); return ser(await DashboardService.getOutOfStockItems(companyId)); });
  ipcMain.handle('dash:topProblematic', async (_e, companyId, limit) => { requireAuth(); return ser(await DashboardService.getTopProblematicAssets(companyId, limit)); });
  ipcMain.handle('dash:engineerWorkload', async (_e, companyId) => { requireAuth(); return ser(await DashboardService.getEngineerWorkload(companyId)); });
  ipcMain.handle('dash:deptConsumption', async (_e, companyId, fyId) => { requireAuth(); return ser(await DashboardService.getDepartmentConsumption(companyId, fyId)); });

  // ===== REPORTS =====
  ipcMain.handle('rpt:overallStock', async (_e, filter) => { requireAuth(); return ser(await ReportService.getOverallStock(filter)); });
  ipcMain.handle('rpt:storeStock', async (_e, filter) => { requireAuth(); return ser(await ReportService.getStoreWiseStock(filter)); });
  ipcMain.handle('rpt:deptStock', async (_e, filter) => { requireAuth(); return ser(await ReportService.getDepartmentWiseStock(filter)); });
  ipcMain.handle('rpt:itemStock', async (_e, filter) => { requireAuth(); return ser(await ReportService.getItemWiseStock(filter)); });
  ipcMain.handle('rpt:categoryStock', async (_e, filter) => { requireAuth(); return ser(await ReportService.getCategoryWiseStock(filter)); });

  ipcMain.handle('rpt:receipt', async (_e, filter) => { requireAuth(); return ser(await ReportService.getReceiptReport(filter)); });
  ipcMain.handle('rpt:issue', async (_e, filter) => { requireAuth(); return ser(await ReportService.getIssueReport(filter)); });
  ipcMain.handle('rpt:transfer', async (_e, filter) => { requireAuth(); return ser(await ReportService.getTransferReport(filter)); });
  ipcMain.handle('rpt:installation', async (_e, filter) => { requireAuth(); return ser(await ReportService.getInstallationReport(filter)); });
  ipcMain.handle('rpt:uninstallation', async (_e, filter) => { requireAuth(); return ser(await ReportService.getUninstallationReport(filter)); });
  ipcMain.handle('rpt:damage', async (_e, filter) => { requireAuth(); return ser(await ReportService.getDamageReport(filter)); });
  ipcMain.handle('rpt:repair', async (_e, filter) => { requireAuth(); return ser(await ReportService.getRepairReport(filter)); });
  ipcMain.handle('rpt:replacement', async (_e, filter) => { requireAuth(); return ser(await ReportService.getReplacementReport(filter)); });
  ipcMain.handle('rpt:return', async (_e, filter) => { requireAuth(); return ser(await ReportService.getReturnReport(filter)); });
  ipcMain.handle('rpt:adjustment', async (_e, filter) => { requireAuth(); return ser(await ReportService.getAdjustmentReport(filter)); });

  ipcMain.handle('rpt:completeLedger', async (_e, filter) => { requireAuth(); return ser(await ReportService.getCompleteLedger(filter)); });
  ipcMain.handle('rpt:itemLedger', async (_e, filter) => { requireAuth(); return ser(await ReportService.getItemLedger(filter)); });
  ipcMain.handle('rpt:storeLedger', async (_e, filter) => { requireAuth(); return ser(await ReportService.getStoreLedger(filter)); });
  ipcMain.handle('rpt:deptLedger', async (_e, filter) => { requireAuth(); return ser(await ReportService.getDepartmentLedger(filter)); });

  ipcMain.handle('rpt:assetRegister', async (_e, filter) => { requireAuth(); return ser(await ReportService.getAssetRegister(filter)); });
  ipcMain.handle('rpt:installedAssets', async (_e, filter) => { requireAuth(); return ser(await ReportService.getInstalledAssets(filter)); });
  ipcMain.handle('rpt:assetHealth', async (_e, filter) => { requireAuth(); return ser(await ReportService.getAssetHealthReport(filter)); });
  ipcMain.handle('rpt:warrantyExpiry', async (_e, filter) => { requireAuth(); return ser(await ReportService.getWarrantyExpiryReport(filter)); });
  ipcMain.handle('rpt:amcExpiry', async (_e, filter) => { requireAuth(); return ser(await ReportService.getAMCExpiryReport(filter)); });

  ipcMain.handle('rpt:purchaseRegister', async (_e, filter) => { requireAuth(); return ser(await ReportService.getPurchaseRegister(filter)); });
  ipcMain.handle('rpt:grnRegister', async (_e, filter) => { requireAuth(); return ser(await ReportService.getGRNRegister(filter)); });
  ipcMain.handle('rpt:vendorPerformance', async (_e, filter) => { requireAuth(); return ser(await ReportService.getVendorPerformance(filter)); });

  ipcMain.handle('rpt:serviceRegister', async (_e, filter) => { requireAuth(); return ser(await ReportService.getServiceRegister(filter)); });
  ipcMain.handle('rpt:woRegister', async (_e, filter) => { requireAuth(); return ser(await ReportService.getWorkOrderRegister(filter)); });
  ipcMain.handle('rpt:downtime', async (_e, filter) => { requireAuth(); return ser(await ReportService.getDowntimeReport(filter)); });
  ipcMain.handle('rpt:repairCost', async (_e, filter) => { requireAuth(); return ser(await ReportService.getRepairCostReport(filter)); });

  ipcMain.handle('rpt:inventoryValuation', async (_e, filter) => { requireAuth(); return ser(await ReportService.getInventoryValuation(filter)); });
  ipcMain.handle('rpt:transactionSummary', async (_e, filter) => { requireAuth(); return ser(await ReportService.getTransactionSummary(filter)); });

  ipcMain.handle('rpt:importHistory', async (_e, filter) => { requireAuth(); return ser(await ReportService.getImportHistory(filter)); });

  // ===== SEARCH =====
  ipcMain.handle('global:search', async (_e, companyId, query, limit) => { requireAuth(); return GlobalSearchService.search(companyId, query, limit); });

  // ===== EXPORT =====
  ipcMain.handle('export:excel', async (_e, data, columns, filename) => { requireAuth(); return ExportService.exportToExcel(data, columns, filename); });
  ipcMain.handle('export:csv', async (_e, data, columns, filename) => { requireAuth(); return ExportService.exportToCSV(data, columns, filename); });
  ipcMain.handle('export:json', async (_e, data, filename) => { requireAuth(); return ExportService.exportToJSON(data, filename); });
  ipcMain.handle('export:list', async () => { requireAuth(); return ExportService.listExports(); });
  ipcMain.handle('export:delete', async (_e, filename) => { requireAuth(); return ExportService.deleteExport(filename); });
}
