import { ipcMain } from 'electron';
import { ServiceRequestService } from '../../src/main/services/serviceRequest.service';
import { WorkOrderService } from '../../src/main/services/workOrder.service';
import { AMCService } from '../../src/main/services/amc.service';
import { SparePartsService } from '../../src/main/services/spareParts.service';
import { requireAuth, auditLog, serialize } from './helpers';

export function registerMaintenanceIPC() {
  // ===== SERVICE REQUESTS =====
  ipcMain.handle('maintenance:createServiceRequest', async (_e, input) => {
    requireAuth();
    const result = await ServiceRequestService.create(input);
    await auditLog('CREATE', 'ServiceRequest', result.id, `Created service request: ${result.requestNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:updateServiceRequest', async (_e, id, input) => {
    requireAuth();
    const result = await ServiceRequestService.update(id, input);
    await auditLog('UPDATE', 'ServiceRequest', result.id, `Updated service request: ${result.requestNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:submitServiceRequest', async (_e, id) => {
    requireAuth();
    const result = await ServiceRequestService.submit(id);
    await auditLog('UPDATE', 'ServiceRequest', result.id, `Submitted service request: ${result.requestNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:assignServiceRequest', async (_e, id, assignedToId, assignedToName) => {
    requireAuth();
    const result = await ServiceRequestService.assign(id, assignedToId, assignedToName);
    await auditLog('UPDATE', 'ServiceRequest', result.id, `Assigned service request: ${result.requestNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getServiceRequest', async (_e, id) => {
    requireAuth();
    return serialize(await ServiceRequestService.getById(id));
  });

  ipcMain.handle('maintenance:listServiceRequests', async (_e, filter) => {
    requireAuth();
    return serialize(await ServiceRequestService.list(filter));
  });

  ipcMain.handle('maintenance:serviceRequestDashboard', async (_e, companyId) => {
    requireAuth();
    return serialize(await ServiceRequestService.getDashboard(companyId));
  });

  ipcMain.handle('maintenance:addChecklist', async (_e, serviceRequestId, items) => {
    requireAuth();
    const result = await ServiceRequestService.addChecklist(serviceRequestId, items);
    await auditLog('CREATE', 'ServiceChecklist', serviceRequestId, `Added checklist with ${items.length} items to service request ${serviceRequestId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:toggleChecklistItem', async (_e, id, isChecked, remarks) => {
    requireAuth();
    const result = await ServiceRequestService.toggleChecklistItem(id, isChecked, remarks);
    await auditLog('UPDATE', 'ServiceChecklist', id, `Toggled checklist item ${id}: ${isChecked ? 'checked' : 'unchecked'}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getChecklists', async (_e, serviceRequestId) => {
    requireAuth();
    return serialize(await ServiceRequestService.getChecklists(serviceRequestId));
  });

  // ===== WORK ORDERS =====
  ipcMain.handle('maintenance:createWorkOrder', async (_e, input) => {
    requireAuth();
    const result = await WorkOrderService.create(input);
    await auditLog('CREATE', 'WorkOrder', result.id, `Created work order: ${result.workOrderNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:updateWorkOrderStatus', async (_e, id, status) => {
    requireAuth();
    const result = await WorkOrderService.updateStatus(id, status);
    await auditLog('UPDATE', 'WorkOrder', result.id, `Updated work order ${result.workOrderNumber || result.id} status to ${status}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getWorkOrder', async (_e, id) => {
    requireAuth();
    return serialize(await WorkOrderService.getById(id));
  });

  ipcMain.handle('maintenance:listWorkOrders', async (_e, filter) => {
    requireAuth();
    return serialize(await WorkOrderService.list(filter));
  });

  ipcMain.handle('maintenance:workOrderDashboard', async (_e, companyId) => {
    requireAuth();
    return serialize(await WorkOrderService.getDashboard(companyId));
  });

  ipcMain.handle('maintenance:addSparePart', async (_e, workOrderId, data) => {
    requireAuth();
    const result = await WorkOrderService.addSparePart(workOrderId, data);
    await auditLog('CREATE', 'WorkOrderSparePart', result.id, `Added spare part ${data.itemName || data.itemId} to work order ${workOrderId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:removeSparePart', async (_e, id) => {
    requireAuth();
    const result = await WorkOrderService.removeSparePart(id);
    await auditLog('DELETE', 'WorkOrderSparePart', id, `Removed spare part ${id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getSpareParts', async (_e, workOrderId) => {
    requireAuth();
    return serialize(await WorkOrderService.getSpareParts(workOrderId));
  });

  ipcMain.handle('maintenance:addCost', async (_e, workOrderId, data) => {
    requireAuth();
    const result = await WorkOrderService.addCost(workOrderId, data);
    await auditLog('CREATE', 'WorkOrderCost', result.id, `Added ${data.costType} cost of ${data.amount} to work order ${workOrderId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getCosts', async (_e, workOrderId) => {
    requireAuth();
    return serialize(await WorkOrderService.getCosts(workOrderId));
  });

  ipcMain.handle('maintenance:addPhoto', async (_e, workOrderId, data) => {
    requireAuth();
    const result = await WorkOrderService.addPhoto(workOrderId, data);
    await auditLog('CREATE', 'WorkOrderPhoto', result.id, `Added photo ${data.fileName} to work order ${workOrderId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getPhotos', async (_e, workOrderId) => {
    requireAuth();
    return serialize(await WorkOrderService.getPhotos(workOrderId));
  });

  ipcMain.handle('maintenance:addDocument', async (_e, workOrderId, data) => {
    requireAuth();
    const result = await WorkOrderService.addDocument(workOrderId, data);
    await auditLog('CREATE', 'WorkOrderDocument', result.id, `Added document ${data.fileName} to work order ${workOrderId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getDocuments', async (_e, workOrderId) => {
    requireAuth();
    return serialize(await WorkOrderService.getDocuments(workOrderId));
  });

  ipcMain.handle('maintenance:recordMaintenanceHistory', async (_e, data) => {
    requireAuth();
    const result = await WorkOrderService.recordMaintenanceHistory(data);
    await auditLog('CREATE', 'MaintenanceHistory', result.id, `Recorded maintenance history: ${data.serviceType} for asset ${data.assetId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getMaintenanceHistory', async (_e, companyId, assetId) => {
    requireAuth();
    return serialize(await WorkOrderService.getMaintenanceHistory(companyId, assetId));
  });

  ipcMain.handle('maintenance:recordBreakdown', async (_e, data) => {
    requireAuth();
    const result = await WorkOrderService.recordBreakdown(data);
    await auditLog('CREATE', 'BreakdownHistory', result.id, `Recorded breakdown for asset ${data.assetId}: ${data.cause}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getBreakdownHistory', async (_e, companyId, assetId) => {
    requireAuth();
    return serialize(await WorkOrderService.getBreakdownHistory(companyId, assetId));
  });

  ipcMain.handle('maintenance:updateAssetHealth', async (_e, assetId) => {
    requireAuth();
    const result = await WorkOrderService.updateAssetHealth(assetId);
    await auditLog('UPDATE', 'Asset', assetId, `Updated asset health: score ${result.healthScore}`);
    return serialize(result);
  });

  // ===== AMC =====
  ipcMain.handle('maintenance:createAMC', async (_e, input) => {
    requireAuth();
    const result = await AMCService.createAMC(input);
    await auditLog('CREATE', 'AMC', result.id, `Created AMC agreement for asset ${input.assetId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:updateAMC', async (_e, id, data) => {
    requireAuth();
    const result = await AMCService.updateAMC(id, data);
    await auditLog('UPDATE', 'AMC', result.id, `Updated AMC agreement ${id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getAMC', async (_e, id) => {
    requireAuth();
    return serialize(await AMCService.getAMCById(id));
  });

  ipcMain.handle('maintenance:listAMCs', async (_e, filter) => {
    requireAuth();
    return serialize(await AMCService.listAMCs(filter));
  });

  ipcMain.handle('maintenance:addAMCDocument', async (_e, amcId, data) => {
    requireAuth();
    const result = await AMCService.addAMCDocument(amcId, data);
    await auditLog('CREATE', 'AMCDocument', result.id, `Added document ${data.fileName} to AMC ${amcId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getAMCDocuments', async (_e, amcId) => {
    requireAuth();
    return serialize(await AMCService.getAMCDocuments(amcId));
  });

  ipcMain.handle('maintenance:cancelAMC', async (_e, id) => {
    requireAuth();
    const result = await AMCService.cancelAMC(id);
    await auditLog('UPDATE', 'AMC', id, `Cancelled AMC agreement ${id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getExpiringAMCs', async (_e, companyId, days) => {
    requireAuth();
    return serialize(await AMCService.getExpiringAMCs(companyId, days));
  });

  // ===== WARRANTY =====
  ipcMain.handle('maintenance:createWarrantyClaim', async (_e, input) => {
    requireAuth();
    const result = await AMCService.createWarrantyClaim(input);
    await auditLog('CREATE', 'WarrantyClaim', result.id, `Created warranty claim: ${result.claimNumber || result.id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:updateWarrantyClaimStatus', async (_e, id, status, resolution) => {
    requireAuth();
    const result = await AMCService.updateWarrantyClaimStatus(id, status, resolution);
    await auditLog('UPDATE', 'WarrantyClaim', result.id, `Updated warranty claim ${result.claimNumber || result.id} status to ${status}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getWarrantyClaims', async (_e, companyId, assetId) => {
    requireAuth();
    return serialize(await AMCService.getWarrantyClaims(companyId, assetId));
  });

  ipcMain.handle('maintenance:getExpiringWarranties', async (_e, companyId, days) => {
    requireAuth();
    return serialize(await AMCService.getExpiringWarranties(companyId, days));
  });

  // ===== SERVICE SCHEDULES =====
  ipcMain.handle('maintenance:createServiceSchedule', async (_e, data) => {
    requireAuth();
    const result = await AMCService.createServiceSchedule(data);
    await auditLog('CREATE', 'ServiceSchedule', result.id, `Created service schedule for asset ${data.assetId}: ${data.serviceType}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:updateServiceSchedule', async (_e, id, data) => {
    requireAuth();
    const result = await AMCService.updateServiceSchedule(id, data);
    await auditLog('UPDATE', 'ServiceSchedule', result.id, `Updated service schedule ${id}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:listServiceSchedules', async (_e, companyId, assetId) => {
    requireAuth();
    return serialize(await AMCService.listServiceSchedules(companyId, assetId));
  });

  ipcMain.handle('maintenance:getUpcomingReminders', async (_e, companyId, days) => {
    requireAuth();
    return serialize(await AMCService.getUpcomingReminders(companyId, days));
  });

  // ===== SPARE PARTS =====
  ipcMain.handle('maintenance:issueSparePart', async (_e, input) => {
    requireAuth();
    const result = await SparePartsService.issueSparePart(input);
    await auditLog('CREATE', 'SparePartIssue', result.sparePart.id, `Issued ${input.quantity}x ${input.itemName} for work order ${input.workOrderId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:returnSparePart', async (_e, workOrderId, sparePartId, quantity) => {
    requireAuth();
    const result = await SparePartsService.returnSparePart(workOrderId, sparePartId, quantity);
    await auditLog('UPDATE', 'SparePartIssue', result.id, `Returned ${quantity} of spare part ${sparePartId} from work order ${workOrderId}`);
    return serialize(result);
  });

  ipcMain.handle('maintenance:getWorkOrderSpareParts', async (_e, workOrderId) => {
    requireAuth();
    return serialize(await SparePartsService.getSpareParts(workOrderId));
  });

  ipcMain.handle('maintenance:getWorkOrderCostSummary', async (_e, workOrderId) => {
    requireAuth();
    return serialize(await SparePartsService.getWorkOrderCostSummary(workOrderId));
  });
}
