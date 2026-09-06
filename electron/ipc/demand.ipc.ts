import { ipcMain } from 'electron';
import { MaterialDemandService } from '../../src/main/services/materialDemand.service';
import { WorkCompletionService } from '../../src/main/services/workCompletion.service';
import { requireAuth, auditLog, serialize } from './helpers';
import { getPrismaClient } from '../../src/main/database/prisma.client';

export function registerDemandIPC() {
  const prisma = getPrismaClient();

  ipcMain.handle('demand:create', async (_e, serviceRequestId: number, items: any[], headerData?: any) => {
    requireAuth();
    const result = await MaterialDemandService.createDemand(serviceRequestId, items, headerData);
    await auditLog('CREATE', 'MaterialDemand', serviceRequestId, `Created material demand with ${items.length} items for service request ${serviceRequestId}`);
    return serialize(result);
  });

  ipcMain.handle('demand:getItems', async (_e, serviceRequestId: number) => {
    requireAuth();
    return serialize(await MaterialDemandService.getDemandItems(serviceRequestId));
  });

  ipcMain.handle('demand:issue', async (_e, serviceRequestId: number, issueSlipNumber: string, items: any[]) => {
    requireAuth();
    const result = await MaterialDemandService.issueMaterial(serviceRequestId, issueSlipNumber, items);
    await auditLog('UPDATE', 'MaterialDemand', serviceRequestId, `Issued material for demand ${serviceRequestId}, slip: ${issueSlipNumber}`);
    return serialize(result);
  });

  ipcMain.handle('demand:return', async (_e, serviceRequestId: number, items: any[]) => {
    requireAuth();
    const result = await MaterialDemandService.returnMaterial(serviceRequestId, items);
    await auditLog('UPDATE', 'MaterialDemand', serviceRequestId, `Returned material for demand ${serviceRequestId}`);
    return serialize(result);
  });

  ipcMain.handle('demand:list', async (_e, companyId: number, filter?: any) => {
    requireAuth();
    return serialize(await MaterialDemandService.listDemands(companyId, filter));
  });

  ipcMain.handle('demand:getDetail', async (_e, serviceRequestId: number) => {
    requireAuth();
    return serialize(await MaterialDemandService.getDemandDetail(serviceRequestId));
  });

  ipcMain.handle('demand:getOpenDemands', async (_e, companyId: number, financialYearId?: number, demandType?: string) => {
    requireAuth();
    return serialize(await MaterialDemandService.getOpenDemandsForCompany(companyId, financialYearId, demandType));
  });

  ipcMain.handle('demand:searchDemands', async (_e, companyId: number, query: string) => {
    requireAuth();
    return serialize(await MaterialDemandService.searchDemands(companyId, query));
  });

  ipcMain.handle('demand:getByPhysicalNo', async (_e, companyId: number, physicalDemandNo: string) => {
    requireAuth();
    return serialize(await MaterialDemandService.getDemandByPhysicalNo(companyId, physicalDemandNo));
  });

  ipcMain.handle('demand:createDirect', async (_e, data: any) => {
    const user = requireAuth();
    data.requestedById = user.id;
    console.log('[demand:createDirect] RAW data received:', JSON.stringify({
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      requestedById: data.requestedById,
      physicalDemandNo: data.physicalDemandNo,
      demandDate: data.demandDate,
      requestingPerson: data.requestingPerson,
      mobileNo: data.mobileNo,
      responsiblePerson: data.responsiblePerson,
      workType: data.workType,
      remarks: data.remarks,
      locationName: data.locationName,
      departmentId: data.departmentId,
      departmentName: data.departmentName,
      dharmshalaName: data.dharmshalaName,
      storeId: data.storeId,
      storeName: data.storeName,
      itemsCount: data.items?.length,
      itemIds: data.items?.map((i: any) => i.itemId),
    }, null, 2));
    const result = await MaterialDemandService.createDirectDemand(data);
    await auditLog('CREATE', 'MaterialDemand', result.serviceRequest.id, `Created direct demand ${data.physicalDemandNo} with ${data.items.length} items`);
    return serialize(result);
  });

  ipcMain.handle('demand:getAllocations', async (_e, serviceRequestId: number) => {
    requireAuth();
    return serialize(await MaterialDemandService.getDemandAllocations(serviceRequestId));
  });

  ipcMain.handle('demand:getAllocationsByTransaction', async (_e, transactionHeaderId: number) => {
    requireAuth();
    const allocs = await prisma.demandAllocation.findMany({
      where: { transactionHeaderId },
      include: { materialDemandItem: true },
    });
    return serialize(allocs);
  });

  ipcMain.handle('demand:updateDirect', async (_e, serviceRequestId: number, data: any) => {
    requireAuth();
    const result = await MaterialDemandService.updateDirectDemand(serviceRequestId, data);
    await auditLog('UPDATE', 'MaterialDemand', serviceRequestId, `Updated direct demand ${data.physicalDemandNo || serviceRequestId}`);
    return serialize(result);
  });

  ipcMain.handle('demand:deleteDirect', async (_e, serviceRequestId: number) => {
    requireAuth();
    const result = await MaterialDemandService.deleteDirectDemand(serviceRequestId);
    await auditLog('DELETE', 'MaterialDemand', serviceRequestId, `Deleted direct demand ${serviceRequestId}`);
    return serialize(result);
  });

  // Work Completion Verification
  ipcMain.handle('workCompletion:create', async (_e, data: any) => {
    requireAuth();
    const result = await WorkCompletionService.createVerification(data);
    await auditLog('CREATE', 'WorkCompletionVerification', result.id, `Created work completion verification ${result.verificationNumber} for work order ${data.workOrderId}`);
    return serialize(result);
  });

  ipcMain.handle('workCompletion:addSignature', async (_e, verificationId: number, data: any) => {
    requireAuth();
    const result = await WorkCompletionService.addSignature(verificationId, data);
    await auditLog('CREATE', 'VerificationSignature', result.id, `Added ${data.signerRole} signature to verification ${verificationId}`);
    return serialize(result);
  });

  ipcMain.handle('workCompletion:get', async (_e, id: number) => {
    requireAuth();
    return serialize(await WorkCompletionService.getVerification(id));
  });

  ipcMain.handle('workCompletion:list', async (_e, companyId: number, filter?: any) => {
    requireAuth();
    return serialize(await WorkCompletionService.listVerifications(companyId, filter));
  });

  ipcMain.handle('workCompletion:recordDelayedEntry', async (_e, verificationId: number, data: any) => {
    requireAuth();
    const result = await WorkCompletionService.recordDelayedEntry(verificationId, data);
    await auditLog('UPDATE', 'WorkCompletionVerification', verificationId, `Recorded delayed entry for verification ${verificationId}`);
    return serialize(result);
  });

  // Document attachment
  ipcMain.handle('doc:attach', async (_e, data: { sourceType: string; sourceId: number; documentType: string; fileName: string; filePath: string; fileSize?: number; mimeType?: string; description?: string; uploadedBy?: string; isPhysicalCopy?: boolean }) => {
    requireAuth();
    const result = await prisma.documentAttachment.create({ data });
    await auditLog('CREATE', 'DocumentAttachment', result.id, `Attached document ${data.fileName} to ${data.sourceType} ${data.sourceId}`);
    return serialize(result);
  });

  ipcMain.handle('doc:list', async (_e, sourceType: string, sourceId: number) => {
    requireAuth();
    return serialize(await prisma.documentAttachment.findMany({
      where: { sourceType, sourceId },
      orderBy: { uploadedAt: 'desc' },
    }));
  });

  ipcMain.handle('doc:delete', async (_e, id: number) => {
    requireAuth();
    await prisma.documentAttachment.delete({ where: { id } });
    return { success: true };
  });
}
