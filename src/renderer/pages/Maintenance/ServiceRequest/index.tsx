import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, TextField, MenuItem, Grid,
  Card, CardContent, Alert, Snackbar, Tab, Tabs, LinearProgress, Tooltip,
  Select, FormControl, InputLabel, List, ListItem, ListItemText, ListItemSecondaryAction, Stack,
} from '@mui/material';
import { Add, Visibility, Edit, Send, Assignment, Cancel, CheckCircle, Search, Build, Person, Print, Inventory, Delete } from '@mui/icons-material';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import MaterialDemandSlip from '../../../components/PrintForms/MaterialDemandSlip';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import { useCompany } from '../../../context/CompanyContext';
import { useAuth } from '../../../context/AuthContext';

const serviceRequestSchema = z.object({
  assetId: z.number().min(1, 'Asset is required'),
  storeId: z.number().min(1, 'Store is required'),
  departmentId: z.number().min(1, 'Department is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  priority: z.string().min(1, 'Priority is required'),
  issueDescription: z.string().min(1, 'Description is required'),
});
type ServiceRequestFormData = z.infer<typeof serviceRequestSchema>;

declare global { interface Window { electronAPI: any } }

const SERVICE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'BREAKDOWN', 'AMC', 'INTERNAL', 'INSPECTION', 'CALIBRATION', 'CLEANING'];
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES = ['DRAFT', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'WAITING_VENDOR', 'COMPLETED', 'CANCELLED', 'CLOSED'];

const PRIORITY_COLORS: Record<string, string> = { CRITICAL: 'error', HIGH: 'warning', MEDIUM: 'info', LOW: 'success' };
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'info', ASSIGNED: 'primary', IN_PROGRESS: 'warning',
  WAITING_PARTS: 'secondary', WAITING_VENDOR: 'secondary', COMPLETED: 'success', CANCELLED: 'error', CLOSED: 'default',
};
const WORK_TYPES = ['Mason', 'Plumber', 'Electrician', 'Carpenter', 'Welder', 'AC Technician', 'Painter', 'Other'];

export default function ServiceRequestListPage() {
  const { company } = useCompany();
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>({});
  const [assets, setAssets] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignData, setAssignData] = useState({ assignedToId: 0, assignedToName: '' });
  const [filter, setFilter] = useState({ status: '', priority: '', search: '' });
  const { register, handleSubmit: handleSubmitForm, reset, formState: { errors, isValid } } = useForm<ServiceRequestFormData>({
    resolver: zodResolver(serviceRequestSchema),
    mode: 'onChange',
    defaultValues: { assetId: 0, storeId: 0, departmentId: 0, serviceType: '', priority: 'MEDIUM', issueDescription: '' },
  });
  const [snackbar, setSnackbar] = useState({ open: false, msg: '', sev: 'success' as any });
  const [demandItemsMap, setDemandItemsMap] = useState<Record<number, any[]>>({});
  const [demandDialogOpen, setDemandDialogOpen] = useState(false);
  const [demandForm, setDemandForm] = useState({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  const [currentDemandItems, setCurrentDemandItems] = useState<any[]>([]);
  const [demandHeader, setDemandHeader] = useState({ responsiblePerson: '', workType: '', physicalDemandNo: '', demandDate: '', requestingPerson: '', mobileNo: '' });
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [dharmshalas, setDharmshalas] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [directDemandOpen, setDirectDemandOpen] = useState(false);
  const [directDemandForm, setDirectDemandForm] = useState({
    physicalDemandNo: '', demandDate: new Date().toISOString().split('T')[0],
    requestingPerson: '', mobileNo: '', responsiblePerson: '', workType: '', remarks: '',
    locationName: '', departmentId: 0, departmentName: '', dharmshalaName: '', storeId: 0, storeName: '',
  });
  const [directDemandItems, setDirectDemandItems] = useState<any[]>([]);
  const [directDemandItemForm, setDirectDemandItemForm] = useState({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  const [createStoreOpen, setCreateStoreOpen] = useState(false);
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [createDharmshalaOpen, setCreateDharmshalaOpen] = useState(false);
  const [createDeptOpen, setCreateDeptOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [newDharmshalaName, setNewDharmshalaName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [editDemandOpen, setEditDemandOpen] = useState(false);
  const [editDemandTarget, setEditDemandTarget] = useState<any>(null);
  const [editDemandForm, setEditDemandForm] = useState({
    physicalDemandNo: '', demandDate: '', requestingPerson: '', mobileNo: '',
    responsiblePerson: '', workType: '', remarks: '',
    locationName: '', departmentId: 0, departmentName: '', dharmshalaName: '', storeId: 0, storeName: '',
  });
  const [editDemandItems, setEditDemandItems] = useState<any[]>([]);
  const [editDemandItemForm, setEditDemandItemForm] = useState({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  const [deleteDemandTarget, setDeleteDemandTarget] = useState<any>(null);

  const filteredLocationsByDept = useMemo(() => {
    let deptId = directDemandForm.departmentId;
    if (!deptId && directDemandForm.dharmshalaName) {
      const dharmDept = departments.find((d: any) => d.name === directDemandForm.dharmshalaName);
      if (!dharmDept) {
        const dharmAll = allDepartments.find((d: any) => d.name === directDemandForm.dharmshalaName);
        deptId = dharmAll?.id || 0;
      }
    }
    if (!deptId) return locations.filter((l: any) => l.locationType === 'Dharamshala' || l.locationType === 'Store');
    const deptStoreIds = stores.filter((s: any) => s.departmentId === deptId).map((s: any) => s.id);
    return locations.filter((l: any) => deptStoreIds.includes(l.storeId));
  }, [directDemandForm.departmentId, directDemandForm.dharmshalaName, stores, locations, departments, allDepartments]);

  const filteredLocationsByDeptEdit = useMemo(() => {
    let deptId = editDemandForm.departmentId;
    if (!deptId && editDemandForm.dharmshalaName) {
      const dharmDept = departments.find((d: any) => d.name === editDemandForm.dharmshalaName);
      if (!dharmDept) {
        const dharmAll = allDepartments.find((d: any) => d.name === editDemandForm.dharmshalaName);
        deptId = dharmAll?.id || 0;
      }
    }
    if (!deptId) return locations.filter((l: any) => l.locationType === 'Dharamshala' || l.locationType === 'Store');
    const deptStoreIds = stores.filter((s: any) => s.departmentId === deptId).map((s: any) => s.id);
    return locations.filter((l: any) => deptStoreIds.includes(l.storeId));
  }, [editDemandForm.departmentId, editDemandForm.dharmshalaName, stores, locations, departments, allDepartments]);

  const load = async () => {
    setLoading(true);
    const companyId = company?.id || 1;
    try {
      const fy = await window.electronAPI.getCurrentFinancialYear(companyId);
      const [reqs, dash, asts, strs, itms, depts, locs, dhs, allDepts] = await Promise.all([
        window.electronAPI.listServiceRequests({ companyId, ...filter }).catch(() => []),
        window.electronAPI.serviceRequestDashboard(companyId).catch(() => ({})),
        window.electronAPI.searchAssets({ companyId }).catch(() => []),
        window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }).catch(() => []),
        window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }).catch(() => []),
        window.electronAPI.dbQuery('department', 'findMany', { where: { isActive: true, departmentType: 'Department' }, orderBy: { name: 'asc' } }).catch(() => []),
        window.electronAPI.dbQuery('location', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }).catch(() => []),
        window.electronAPI.dbQuery('department', 'findMany', { where: { isActive: true, departmentType: 'Dharamshala' }, orderBy: { name: 'asc' } }).catch(() => []),
        window.electronAPI.dbQuery('department', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }).catch(() => []),
      ]);
      setRequests(reqs || []); setDashboard(dash || {}); setAssets(asts?.data || asts || []); setStores(strs || []); setItems(itms?.data || itms || []);
      setDepartments(depts || []); setLocations(locs || []); setDharmshalas(dhs || []); setAllDepartments(allDepts || []);
    } catch (err) {
      console.error('load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    if (selected && detailOpen && !demandItemsMap[selected.id]) {
      window.electronAPI.getDemandItems(selected.id).then((items: any[]) => {
        if (items && items.length > 0) {
          Promise.all(items.map((item: any) =>
            window.electronAPI.getConsumptionForDemand(selected.id).then((consumptionItems: any[]) => ({
              ...item,
              consumptionItems: consumptionItems.filter((ci: any) =>
                ci.itemId === item.itemId
              ),
            }))
          )).then((itemsWithConsumption) => {
            setDemandItemsMap((prev) => ({ ...prev, [selected.id]: itemsWithConsumption }));
          });
        }
      }).catch(() => {});
    }
  }, [selected, detailOpen]);

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return;
    try {
      const result = await window.electronAPI.dbQuery('store', 'create', { data: { name: newStoreName.trim(), companyId: company?.id || 1, storeType: 'MAIN_STORE', isActive: true } });
      setStores([...stores, result]);
      setNewStoreName(''); setCreateStoreOpen(false);
      setSnackbar({ open: true, msg: 'Store created', sev: 'success' });
    } catch (err: any) { setSnackbar({ open: true, msg: err.message || 'Failed', sev: 'error' }); }
  };

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return;
    try {
      await window.electronAPI.createLocation({ name: newLocationName.trim(), storeId: stores[0]?.id || 1, locationType: 'Room', companyId: company?.id || 1 });
      const locs = await window.electronAPI.dbQuery('location', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } });
      setLocations(locs || []);
      setNewLocationName(''); setCreateLocationOpen(false);
      setSnackbar({ open: true, msg: 'Location created', sev: 'success' });
    } catch (err: any) { setSnackbar({ open: true, msg: err.message || 'Failed', sev: 'error' }); }
  };

  const handleCreateDharmshala = async () => {
    if (!newDharmshalaName.trim()) return;
    try {
      await window.electronAPI.createDharmshala({ name: newDharmshalaName.trim(), companyId: company?.id || 1 });
      setNewDharmshalaName(''); setCreateDharmshalaOpen(false);
      setSnackbar({ open: true, msg: 'Dharmshala created', sev: 'success' });
    } catch (err: any) { setSnackbar({ open: true, msg: err.message || 'Failed', sev: 'error' }); }
  };

  const handleCreateDept = async () => {
    if (!newDeptName.trim()) return;
    try {
      await window.electronAPI.createDepartment({ name: newDeptName.trim(), companyId: company?.id || 1, departmentType: 'Department' });
      const depts = await window.electronAPI.dbQuery('department', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } });
      setDepartments(depts || []);
      setNewDeptName(''); setCreateDeptOpen(false);
      setSnackbar({ open: true, msg: 'Department created', sev: 'success' });
    } catch (err: any) { setSnackbar({ open: true, msg: err.message || 'Failed', sev: 'error' }); }
  };

  const handleCreate = async (data: ServiceRequestFormData) => {
    try {
      const companyId = company?.id || 1;
      const fy = await window.electronAPI.getCurrentFinancialYear(companyId);
      if (!fy) {
        setSnackbar({ open: true, msg: 'No active financial year found', sev: 'error' });
        return;
      }
      await window.electronAPI.createServiceRequest({
        companyId, financialYearId: fy.id, ...data,
        requestedById: 1, requestedByName: 'Admin',
      });
      setSnackbar({ open: true, msg: 'Service request created', sev: 'success' });
      setCreateOpen(false);
      reset({ assetId: 0, storeId: 0, departmentId: 0, serviceType: '', priority: 'MEDIUM', issueDescription: '' });
      load();
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleSubmit = async (id: number) => {
    try { await window.electronAPI.submitServiceRequest(id); setSnackbar({ open: true, msg: 'Submitted', sev: 'success' }); load(); } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleAssign = async () => {
    if (!selected) return;
    try {
      await window.electronAPI.assignServiceRequest(selected.id, assignData.assignedToId, assignData.assignedToName);
      setSnackbar({ open: true, msg: 'Assigned', sev: 'success' });
      setAssignOpen(false); load();
    } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleCancel = async (id: number) => {
    try { await window.electronAPI.updateServiceRequest(id, { status: 'CANCELLED' }); setSnackbar({ open: true, msg: 'Cancelled', sev: 'success' }); load(); } catch (e: any) { setSnackbar({ open: true, msg: e.message, sev: 'error' }); }
  };

  const handleAddDemandItem = () => {
    if (!demandForm.itemId || !demandForm.itemName) return;
    const newItem = {
      itemId: demandForm.itemId,
      itemName: demandForm.itemName,
      quantityRequested: demandForm.quantityRequested,
      unitName: demandForm.unitName,
      serialNumber: demandForm.serialNumber || undefined,
      responsiblePerson: demandHeader.responsiblePerson || undefined,
      workType: demandHeader.workType || undefined,
    };
    setCurrentDemandItems([...currentDemandItems, newItem]);
    setDemandForm({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  };

  const handleRemoveDemandItem = (index: number) => {
    setCurrentDemandItems(currentDemandItems.filter((_, i) => i !== index));
  };

  const handleSaveDemand = async () => {
    if (!selected || currentDemandItems.length === 0) return;
    try {
      await window.electronAPI.createDemand(selected.id, currentDemandItems, demandHeader);
      setDemandItemsMap({ ...demandItemsMap, [selected.id]: currentDemandItems });
      setSnackbar({ open: true, msg: 'Demand items saved', sev: 'success' });
      setDemandDialogOpen(false);
      setCurrentDemandItems([]);
      setDemandHeader({ responsiblePerson: '', workType: '', physicalDemandNo: '', demandDate: '', requestingPerson: '', mobileNo: '' });
    } catch (e: any) {
      setSnackbar({ open: true, msg: e.message || 'Failed to save demand', sev: 'error' });
    }
  };

  const handleOpenDemandDialog = (sr: any) => {
    setSelected(sr);
    setCurrentDemandItems(demandItemsMap[sr.id] || []);
    setDemandHeader({
      responsiblePerson: sr.responsiblePerson || '',
      workType: sr.workType || '',
      physicalDemandNo: sr.physicalDemandNo || '',
      demandDate: sr.demandDate ? sr.demandDate.split('T')[0] : new Date().toISOString().split('T')[0],
      requestingPerson: sr.requestingPerson || sr.requestedByName || '',
      mobileNo: sr.mobileNo || '',
    });
    setDemandDialogOpen(true);
  };

  const handleAddDirectDemandItem = () => {
    if (!directDemandItemForm.itemId || !directDemandItemForm.itemName) return;
    setDirectDemandItems([...directDemandItems, { ...directDemandItemForm }]);
    setDirectDemandItemForm({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  };

  const handleRemoveDirectDemandItem = (index: number) => {
    setDirectDemandItems(directDemandItems.filter((_, i) => i !== index));
  };

  const handleSaveDirectDemand = async () => {
    if (!directDemandForm.physicalDemandNo || directDemandItems.length === 0) {
      setSnackbar({ open: true, msg: 'Physical Demand No. and at least one item required', sev: 'error' });
      return;
    }
    try {
      const companyId = company?.id || 1;
      const fy = await window.electronAPI.getCurrentFinancialYear(companyId);
      if (!fy) {
        setSnackbar({ open: true, msg: 'No active financial year found', sev: 'error' });
        return;
      }
      await window.electronAPI.createDirectDemand({
        companyId, financialYearId: fy.id,
        ...directDemandForm,
        items: directDemandItems,
      });
      setSnackbar({ open: true, msg: `Demand ${directDemandForm.physicalDemandNo} created`, sev: 'success' });
      setDirectDemandOpen(false);
      setDirectDemandForm({ physicalDemandNo: '', demandDate: new Date().toISOString().split('T')[0], requestingPerson: '', mobileNo: '', responsiblePerson: '', workType: '', remarks: '', locationName: '', departmentId: 0, departmentName: '', dharmshalaName: '', storeId: 0, storeName: '' });
      setDirectDemandItems([]);
      load();
    } catch (e: any) {
      setSnackbar({ open: true, msg: e.message || 'Failed to create demand', sev: 'error' });
    }
  };

  const handleOpenEditDemand = async (sr: any) => {
    setEditDemandTarget(sr);
    setEditDemandForm({
      physicalDemandNo: sr.physicalDemandNo || '',
      demandDate: sr.demandDate ? sr.demandDate.split('T')[0] : new Date().toISOString().split('T')[0],
      requestingPerson: sr.requestingPerson || '',
      mobileNo: sr.mobileNo || '',
      responsiblePerson: sr.responsiblePerson || '',
      workType: sr.workType || '',
      remarks: sr.issueDescription || '',
      locationName: sr.locationName || '',
      departmentId: sr.departmentId || 0,
      departmentName: sr.departmentName || '',
      dharmshalaName: sr.dharmshalaName || '',
      storeId: sr.storeId || 0,
      storeName: sr.storeName || '',
    });
    try {
      const items = await window.electronAPI.getDemandItems(sr.id);
      setEditDemandItems(items || []);
    } catch {
      setEditDemandItems([]);
    }
    setEditDemandOpen(true);
  };

  const handleAddEditDemandItem = () => {
    if (!editDemandItemForm.itemId || !editDemandItemForm.itemName) return;
    setEditDemandItems([...editDemandItems, { ...editDemandItemForm }]);
    setEditDemandItemForm({ itemId: 0, itemName: '', quantityRequested: 1, unitName: 'NOS', serialNumber: '' });
  };

  const handleRemoveEditDemandItem = (index: number) => {
    setEditDemandItems(editDemandItems.filter((_, i) => i !== index));
  };

  const handleSaveEditDemand = async () => {
    if (!editDemandTarget) return;
    try {
      const dept = departments.find((d: any) => d.id === editDemandForm.departmentId);
      await window.electronAPI.updateDirectDemand(editDemandTarget.id, {
        ...editDemandForm,
        departmentName: dept?.name || '',
        items: editDemandItems,
      });
      setSnackbar({ open: true, msg: 'Demand updated', sev: 'success' });
      setEditDemandOpen(false);
      setEditDemandTarget(null);
      load();
    } catch (e: any) {
      setSnackbar({ open: true, msg: e.message || 'Failed to update demand', sev: 'error' });
    }
  };

  const handleDeleteDemand = async () => {
    if (!deleteDemandTarget) return;
    try {
      await window.electronAPI.deleteDirectDemand(deleteDemandTarget.id);
      setSnackbar({ open: true, msg: 'Demand deleted', sev: 'success' });
      setDeleteDemandTarget(null);
      load();
    } catch (e: any) {
      setSnackbar({ open: true, msg: e.message || 'Failed to delete demand', sev: 'error' });
    }
  };

  const handlePrintDemandSlip = (sr: any) => {
    const demandItems = demandItemsMap[sr.id] || [];
    if (demandItems.length === 0) {
      setSnackbar({ open: true, msg: 'No demand items to print', sev: 'warning' });
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const slipData = {
        demandNumber: sr.physicalDemandNo || `DEM-${sr.requestNumber}`,
        date: sr.demandDate ? formatDateDDMMYYYY(new Date(sr.demandDate)) : formatDateDDMMYYYY(new Date()),
        department: sr.department?.name || 'N/A',
        location: sr.asset?.locationName || 'N/A',
        dharmshala: sr.asset?.dharmshalaName || 'N/A',
        store: 'N/A',
        requestedBy: sr.requestingPerson || sr.requestedByName || 'N/A',
        mobileNo: sr.mobileNo || demandHeader.mobileNo || 'N/A',
        technicianName: sr.assignedToName || 'N/A',
        responsiblePerson: sr.responsiblePerson || demandHeader.responsiblePerson || 'N/A',
        workType: sr.workType || demandHeader.workType || 'N/A',
        purpose: sr.issueDescription || 'N/A',
        items: demandItems,
      };
      printWindow.document.write(`
        <html>
        <head>
          <title>Material Demand Slip - ${slipData.demandNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
            .info-item { display: flex; gap: 8px; }
            .info-label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; }
            .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 40px; }
            .signature-box { border-top: 1px solid #000; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>MATERIAL DEMAND SLIP</h2>
            <p>मांग क्रमांक: ${slipData.demandNumber} | Date: ${slipData.date}</p>
          </div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Department:</span> ${slipData.department}</div>
            <div class="info-item"><span class="info-label">Location:</span> ${slipData.location}</div>
            <div class="info-item"><span class="info-label">Dharmshala:</span> ${slipData.dharmshala}</div>
            <div class="info-item"><span class="info-label">Store:</span> ${slipData.store}</div>
            <div class="info-item"><span class="info-label">Requested By:</span> ${slipData.requestedBy}</div>
            <div class="info-item"><span class="info-label">Mobile No:</span> ${slipData.mobileNo}</div>
            <div class="info-item"><span class="info-label">Technician:</span> ${slipData.technicianName}</div>
            <div class="info-item"><span class="info-label">Responsible Person:</span> ${slipData.responsiblePerson}</div>
            <div class="info-item"><span class="info-label">Work Type:</span> ${slipData.workType}</div>
            <div class="info-item"><span class="info-label">Purpose:</span> ${slipData.purpose}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Unit</th>
                <th>Qty Requested</th>
                <th>Qty Issued</th>
                <th>Qty Consumed</th>
                <th>Serial No</th>
              </tr>
            </thead>
            <tbody>
              ${demandItems.map(item => `
                <tr>
                  <td>${item.itemName}</td>
                  <td>${item.unitName}</td>
                  <td>${item.quantityRequested}</td>
                  <td>${item.quantityIssued || 0}</td>
                  <td>${item.quantityConsumed || 0}</td>
                  <td>${item.serialNumber || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="signature-section">
            <div class="signature-box">Requested By: ${slipData.requestedBy}</div>
            <div class="signature-box">Store Incharge</div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const statCards = [
    { label: 'Pending', value: dashboard.pending || 0, color: 'info.main' },
    { label: 'In Progress', value: dashboard.inProgress || 0, color: 'warning.main' },
    { label: 'Waiting Parts', value: dashboard.waitingParts || 0, color: 'secondary.main' },
    { label: 'Waiting Vendor', value: dashboard.waitingVendor || 0, color: 'error.main' },
    { label: 'Completed Today', value: dashboard.completedToday || 0, color: 'success.main' },
    { label: 'Overdue', value: dashboard.overdue || 0, color: 'error.dark' },
  ];

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Service Requests</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map(s => (
          <Grid item xs={2} key={s.label}>
            <Card><CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color={s.color}>{s.value}</Typography>
              <Typography variant="body2" color="text.secondary">{s.label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Box display="flex" gap={2} mb={2}>
        <TextField size="small" placeholder="Search..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })}
          InputProps={{ startAdornment: <Search fontSize="small" /> }} sx={{ minWidth: 200 }} />
        <TextField size="small" select label="Status" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Priority" value={filter.priority} onChange={e => setFilter({ ...filter, priority: e.target.value })} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          {PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </TextField>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>New Request</Button>
        <Button variant="contained" color="secondary" startIcon={<Inventory />} onClick={() => setDirectDemandOpen(true)}>New Demand</Button>
      </Box>

      {loading ? <LinearProgress /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Demand No</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Issue</TableCell>
                <TableCell>Requested By</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Demand Status</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <strong>{r.physicalDemandNo || r.requestNumber}</strong>
                    {r.physicalDemandNo && <Typography variant="caption" display="block" color="text.secondary">{r.requestNumber}</Typography>}
                  </TableCell>
                  <TableCell>{r.asset?.assetName || '-'}</TableCell>
                  <TableCell><Chip size="small" label={r.serviceType} /></TableCell>
                  <TableCell><Chip size="small" label={r.priority} color={PRIORITY_COLORS[r.priority] as any} /></TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>{r.issueDescription?.substring(0, 50)}...</TableCell>
                  <TableCell>{r.requestedByName}</TableCell>
                  <TableCell>{formatDateDDMMYYYY(new Date(r.requestDate))}</TableCell>
                  <TableCell>
                    {r.materialDemandStatus && r.materialDemandStatus !== 'NONE' ? (
                      (() => {
                        const items = r.demandItems || [];
                        const totalReq = items.reduce((s: number, i: any) => s + Number(i.quantityRequested), 0);
                        const totalIssued = items.reduce((s: number, i: any) => s + Number(i.quantityIssued), 0);
                        const remaining = totalReq - totalIssued;
                        return (
                          <Stack spacing={0.5}>
                            <Chip size="small" label={r.materialDemandStatus} color={r.materialDemandStatus === 'COMPLETED' ? 'success' : r.materialDemandStatus === 'PARTIALLY_ISSUED' ? 'warning' : 'info'} sx={{ fontSize: '0.65rem', height: 20 }} />
                            <Typography variant="caption" color="text.secondary">{totalIssued}/{totalReq} issued</Typography>
                          </Stack>
                        );
                      })()
                    ) : (
                      <Typography variant="caption" color="text.secondary">No Demand</Typography>
                    )}
                  </TableCell>
                  <TableCell><Chip size="small" label={r.status} color={STATUS_COLORS[r.status] as any} /></TableCell>
                  <TableCell>
                    <Tooltip title="View"><IconButton size="small" onClick={() => { setSelected(r); setDetailOpen(true); }}><Visibility fontSize="small" /></IconButton></Tooltip>
                    {r.status === 'DRAFT' && <Tooltip title="Submit"><IconButton size="small" color="primary" onClick={() => handleSubmit(r.id)}><Send fontSize="small" /></IconButton></Tooltip>}
                    {r.status === 'SUBMITTED' && <Tooltip title="Assign"><IconButton size="small" color="secondary" onClick={() => { setSelected(r); setAssignOpen(true); }}><Assignment fontSize="small" /></IconButton></Tooltip>}
                    {['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'WAITING_VENDOR'].includes(r.status) && (
                      <>
                        <Tooltip title="Create Demand"><IconButton size="small" color="primary" onClick={() => handleOpenDemandDialog(r)}><Inventory fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Print Demand Slip"><IconButton size="small" onClick={() => handlePrintDemandSlip(r)}><Print fontSize="small" /></IconButton></Tooltip>
                      </>
                    )}
                    {['DRAFT', 'SUBMITTED', 'ASSIGNED'].includes(r.status) && <Tooltip title="Cancel"><IconButton size="small" color="error" onClick={() => setCancelTarget(r)}><Cancel fontSize="small" /></IconButton></Tooltip>}
                    {r.serviceType === 'INTERNAL' && currentUser?.role === 'ADMIN' && (
                      <>
                        <Tooltip title="Edit Demand"><IconButton size="small" color="primary" onClick={() => handleOpenEditDemand(r)}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete Demand"><IconButton size="small" color="error" onClick={() => setDeleteDemandTarget(r)}><Delete fontSize="small" /></IconButton></Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && <TableRow><TableCell colSpan={9} align="center">No service requests found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EnterpriseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Service Request"
        icon={<Build />}
        actions={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmitForm(handleCreate)} disabled={!isValid}>Create</Button>
          </>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField fullWidth select label="Asset" {...register('assetId', { valueAsNumber: true })} error={!!errors.assetId} helperText={errors.assetId?.message}>
              <MenuItem value={0}>Select Asset</MenuItem>
              {assets.map((a: any) => <MenuItem key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth select label="Service Type" {...register('serviceType')} error={!!errors.serviceType} helperText={errors.serviceType?.message}>
              <MenuItem value="">Select Type</MenuItem>
              {SERVICE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth select label="Priority" {...register('priority')} error={!!errors.priority} helperText={errors.priority?.message}>
              {PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth select label="Store" {...register('storeId', { valueAsNumber: true })} error={!!errors.storeId} helperText={errors.storeId?.message}>
              <MenuItem value={0}>Select Store</MenuItem>
              {stores.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline rows={3} label="Issue Description" {...register('issueDescription')} error={!!errors.issueDescription} helperText={errors.issueDescription?.message} />
          </Grid>
        </Grid>
      </EnterpriseDialog>

      <EnterpriseDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Service Request Details"
        subtitle={selected?.physicalDemandNo ? `मांग क्रमांक: ${selected.physicalDemandNo}` : selected?.requestNumber}
        actions={<Button onClick={() => setDetailOpen(false)}>Close</Button>}
      >
        {selected && (
          <Grid container spacing={2}>
            <Grid item xs={6}><Typography><strong>Asset:</strong> {selected.asset?.assetName}</Typography></Grid>
            <Grid item xs={6}><Typography><strong>Type:</strong> {selected.serviceType}</Typography></Grid>
            {selected.physicalDemandNo && <Grid item xs={6}><Typography><strong>Physical Demand No:</strong> {selected.physicalDemandNo}</Typography></Grid>}
            {selected.demandDate && <Grid item xs={6}><Typography><strong>Demand Date:</strong> {formatDateDDMMYYYY(new Date(selected.demandDate))}</Typography></Grid>}
            {selected.requestingPerson && <Grid item xs={6}><Typography><strong>Requesting Person:</strong> {selected.requestingPerson}</Typography></Grid>}
            {selected.mobileNo && <Grid item xs={6}><Typography><strong>Mobile No:</strong> {selected.mobileNo}</Typography></Grid>}
            {selected.storeName && <Grid item xs={6}><Typography><strong>Store:</strong> {selected.storeName}</Typography></Grid>}
            {selected.locationName && <Grid item xs={6}><Typography><strong>Location:</strong> {selected.locationName}</Typography></Grid>}
            {selected.dharmshalaName && <Grid item xs={6}><Typography><strong>Dharmshala:</strong> {selected.dharmshalaName}</Typography></Grid>}
            <Grid item xs={6}><Typography><strong>Priority:</strong> {selected.priority}</Typography></Grid>
            <Grid item xs={6}><Typography><strong>Status:</strong> {selected.status}</Typography></Grid>
            <Grid item xs={6}><Typography><strong>Requested By:</strong> {selected.requestedByName}</Typography></Grid>
            <Grid item xs={6}><Typography><strong>Date:</strong> {formatDateDDMMYYYY(new Date(selected.requestDate))}</Typography></Grid>
            <Grid item xs={12}><Typography><strong>Issue:</strong> {selected.issueDescription}</Typography></Grid>
            {selected.assignedToName && <Grid item xs={6}><Typography><strong>Assigned To:</strong> {selected.assignedToName}</Typography></Grid>}
            {selected.responsiblePerson && <Grid item xs={6}><Typography><strong>Responsible Person:</strong> {selected.responsiblePerson}</Typography></Grid>}
            {selected.workType && <Grid item xs={6}><Typography><strong>Work Type:</strong> {selected.workType}</Typography></Grid>}
            {selected.workOrder && <Grid item xs={6}><Typography><strong>Work Order:</strong> {selected.workOrder.workOrderNumber}</Typography></Grid>}
            {demandItemsMap[selected.id] && demandItemsMap[selected.id].length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}><strong>Material Fulfillment:</strong></Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">Requested</TableCell>
                        <TableCell align="right">Issued</TableCell>
                        <TableCell align="right">Consumed</TableCell>
                        <TableCell align="right">Installed</TableCell>
                        <TableCell align="right">Location Balance</TableCell>
                        <TableCell>Serial No</TableCell>
                        <TableCell>Responsible Person</TableCell>
                        <TableCell>Work Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {demandItemsMap[selected.id].map((item: any, idx: number) => {
                        const consumed = Number(item.quantityConsumed || 0);
                        const installed = Number(item.quantityInstalled || 0);
                        const issued = Number(item.quantityIssued || 0);
                        const locationBalance = Math.max(0, issued - consumed - installed);
                        return (
                          <TableRow key={idx}>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.unitName}</TableCell>
                            <TableCell align="right">{Number(item.quantityRequested)}</TableCell>
                            <TableCell align="right">{issued}</TableCell>
                            <TableCell align="right">
                              {consumed > 0 ? <Typography color="warning.main" fontWeight={600}>{consumed}</Typography> : '0'}
                            </TableCell>
                            <TableCell align="right">
                              {installed > 0 ? <Typography color="info.main" fontWeight={600}>{installed}</Typography> : '0'}
                            </TableCell>
                            <TableCell align="right">
                              <Chip size="small" label={locationBalance}
                                color={locationBalance === 0 && issued > 0 ? 'success' : locationBalance > 0 ? 'warning' : 'default'}
                                sx={{ fontSize: '0.65rem', height: 20 }} />
                            </TableCell>
                            <TableCell>{item.serialNumber || '-'}</TableCell>
                            <TableCell>{item.responsiblePerson || '-'}</TableCell>
                            <TableCell>{item.workType || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                {demandItemsMap[selected.id].some((item: any) => item.allocations && item.allocations.length > 0) && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}><strong>Store Issue History:</strong></Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Issue No</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Item</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {demandItemsMap[selected.id].flatMap((item: any) =>
                            (item.allocations || []).map((alloc: any) => (
                              <TableRow key={alloc.id}>
                                <TableCell>{alloc.transaction?.voucherNo || '-'}</TableCell>
                                <TableCell>{alloc.transaction?.transactionDate ? formatDateDDMMYYYY(new Date(alloc.transaction.transactionDate)) : '-'}</TableCell>
                                <TableCell>{item.itemName}</TableCell>
                                <TableCell align="right">{Number(alloc.quantityAllocated)}</TableCell>
                                <TableCell><Chip size="small" label={alloc.transaction?.approvalStatus || '-'} color={alloc.transaction?.approvalStatus === 'POSTED' ? 'success' : 'default'} sx={{ fontSize: '0.65rem', height: 20 }} /></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
                {demandItemsMap[selected.id].some((item: any) => Number(item.quantityConsumed || 0) > 0) && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}><strong>Consumption History:</strong></Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Consumption No</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Item</TableCell>
                            <TableCell align="right">Qty Used</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell>Used By</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {demandItemsMap[selected.id].flatMap((item: any) =>
                            (item.consumptionItems || []).map((ci: any) => (
                              <TableRow key={ci.id}>
                                <TableCell>{ci.consumptionNumber || '-'}</TableCell>
                                <TableCell>{ci.date ? formatDateDDMMYYYY(new Date(ci.date)) : '-'}</TableCell>
                                <TableCell>{ci.itemName || item.itemName}</TableCell>
                                <TableCell align="right">{Number(ci.quantityUsed)}</TableCell>
                                <TableCell>{ci.locationName || '-'}</TableCell>
                                <TableCell>{ci.usedBy || '-'}</TableCell>
                                <TableCell><Chip size="small" label={ci.status || 'POSTED'} color={ci.status === 'POSTED' ? 'success' : 'default'} sx={{ fontSize: '0.65rem', height: 20 }} /></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
                {demandItemsMap[selected.id].some((item: any) => Number(item.quantityInstalled || 0) > 0) && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}><strong>Installation History:</strong></Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Installation No</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Item</TableCell>
                            <TableCell align="right">Qty Installed</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell>Installed By</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {demandItemsMap[selected.id].flatMap((item: any) =>
                            (item.installationItems || []).map((ii: any) => (
                              <TableRow key={ii.id}>
                                <TableCell>{ii.installationNumber || ii.materialInstallation?.installationNumber || '-'}</TableCell>
                                <TableCell>{ii.date ? formatDateDDMMYYYY(new Date(ii.date)) : ii.materialInstallation?.date ? formatDateDDMMYYYY(new Date(ii.materialInstallation.date)) : '-'}</TableCell>
                                <TableCell>{ii.itemName || item.itemName}</TableCell>
                                <TableCell align="right">{Number(ii.quantityInstalled)}</TableCell>
                                <TableCell>{ii.locationName || ii.materialInstallation?.locationName || '-'}</TableCell>
                                <TableCell>{ii.installedBy || ii.materialInstallation?.installedBy || '-'}</TableCell>
                                <TableCell><Chip size="small" label={ii.status || ii.materialInstallation?.status || 'POSTED'} color={(ii.status || ii.materialInstallation?.status) === 'POSTED' ? 'success' : 'default'} sx={{ fontSize: '0.65rem', height: 20 }} /></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
                {demandItemsMap[selected.id] && demandItemsMap[selected.id].length > 0 && (() => {
                  const items = demandItemsMap[selected.id];
                  const totalRequested = items.reduce((s: number, i: any) => s + Number(i.quantityRequested || 0), 0);
                  const totalIssued = items.reduce((s: number, i: any) => s + Number(i.quantityIssued || 0), 0);
                  const totalConsumed = items.reduce((s: number, i: any) => s + Number(i.quantityConsumed || 0), 0);
                  const totalInstalled = items.reduce((s: number, i: any) => s + Number(i.quantityInstalled || 0), 0);
                  const totalRemaining = Math.max(0, totalIssued - totalConsumed - totalInstalled);
                  const hasAnyActivity = totalIssued > 0 || totalConsumed > 0 || totalInstalled > 0;
                  if (!hasAnyActivity) return null;
                  return (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                        <strong>Demand Timeline:</strong>
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          <Chip size="small" label={`Requested: ${totalRequested}`} color="default" />
                          <Typography variant="body2" color="text.secondary">→</Typography>
                          <Chip size="small" label={`Issued: ${totalIssued}`} color={totalIssued > 0 ? 'info' : 'default'} />
                          <Typography variant="body2" color="text.secondary">→</Typography>
                          {totalConsumed > 0 && <Chip size="small" label={`Consumed: ${totalConsumed}`} color="warning" />}
                          {totalInstalled > 0 && <Chip size="small" label={`Installed: ${totalInstalled}`} color="success" />}
                          <Typography variant="body2" color="text.secondary">→</Typography>
                          <Chip size="small" label={`Available: ${totalRemaining}`} color={totalRemaining === 0 && totalIssued > 0 ? 'success' : 'warning'} variant="outlined" />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {totalConsumed > 0 && totalInstalled > 0
                            ? 'This demand has both consumption and installation activity.'
                            : totalConsumed > 0
                              ? 'Consumed materials are used up and no longer available.'
                              : totalInstalled > 0
                                ? 'Installed materials remain physically placed at locations.'
                                : ''}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })()}
              </Grid>
            )}
          </Grid>
        )}
      </EnterpriseDialog>

      <EnterpriseDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Engineer"
        icon={<Person />}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAssign}>Assign</Button>
          </>
        }
      >
        <TextField fullWidth label="Engineer ID" type="number" value={assignData.assignedToId}
          onChange={e => setAssignData({ ...assignData, assignedToId: +e.target.value })} sx={{ mb: 2 }} />
        <TextField fullWidth label="Engineer Name" value={assignData.assignedToName}
          onChange={e => setAssignData({ ...assignData, assignedToName: e.target.value })} />
      </EnterpriseDialog>

      <EnterpriseDialog
        open={demandDialogOpen}
        onClose={() => setDemandDialogOpen(false)}
        title="Create Material Demand"
        icon={<Inventory />}
        maxWidth="lg"
        actions={
          <>
            <Button onClick={() => setDemandDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveDemand} disabled={currentDemandItems.length === 0}>Save Demand</Button>
          </>
        }
      >
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={3}>
            <TextField
              fullWidth
              required
              label="मांग क्रमांक (Physical Demand No.)"
              value={demandHeader.physicalDemandNo}
              onChange={e => setDemandHeader({ ...demandHeader, physicalDemandNo: e.target.value })}
              placeholder="e.g. 71509"
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              fullWidth
              label="Demand Date"
              type="date"
              value={demandHeader.demandDate}
              onChange={e => setDemandHeader({ ...demandHeader, demandDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              fullWidth
              label="Requesting Person"
              value={demandHeader.requestingPerson}
              onChange={e => setDemandHeader({ ...demandHeader, requestingPerson: e.target.value })}
              placeholder="e.g. Rajesh Kumar"
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              fullWidth
              label="Mobile No."
              value={demandHeader.mobileNo}
              onChange={e => setDemandHeader({ ...demandHeader, mobileNo: e.target.value })}
              placeholder="e.g. 9876543210"
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              fullWidth
              label="Responsible Person"
              value={demandHeader.responsiblePerson}
              onChange={e => setDemandHeader({ ...demandHeader, responsiblePerson: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              fullWidth
              select
              label="Work Type"
              value={demandHeader.workType}
              onChange={e => setDemandHeader({ ...demandHeader, workType: e.target.value })}
            >
              <MenuItem value="">Select Work Type</MenuItem>
              {WORK_TYPES.map(wt => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={4}>
            <TextField
              fullWidth
              select
              label="Item"
              value={demandForm.itemId}
              onChange={e => {
                const selectedItemId = +e.target.value;
                const selectedItem = items.find((i: any) => i.id === selectedItemId);
                setDemandForm({
                  ...demandForm,
                  itemId: selectedItemId,
                  itemName: selectedItem?.itemName || '',
                  unitName: selectedItem?.unit?.unitName || 'NOS',
                });
              }}
            >
              <MenuItem value={0}>Select Item</MenuItem>
              {items.map((item: any) => (
                <MenuItem key={item.id} value={item.id}>{item.itemName}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={2}>
            <TextField
              fullWidth
              type="number"
              label="Quantity"
              value={demandForm.quantityRequested}
              onChange={e => setDemandForm({ ...demandForm, quantityRequested: +e.target.value })}
            />
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth label="Unit" value={demandForm.unitName} disabled />
          </Grid>
          <Grid item xs={3}>
            <TextField
              fullWidth
              label="Serial No (Optional)"
              value={demandForm.serialNumber}
              onChange={e => setDemandForm({ ...demandForm, serialNumber: e.target.value })}
            />
          </Grid>
          <Grid item xs={3}>
            <Button variant="outlined" startIcon={<Add />} onClick={handleAddDemandItem} fullWidth sx={{ height: '56px' }}>
              Add
            </Button>
          </Grid>
        </Grid>

        {currentDemandItems.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Serial No</TableCell>
                  <TableCell>Responsible Person</TableCell>
                  <TableCell>Work Type</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentDemandItems.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>{item.quantityRequested}</TableCell>
                    <TableCell>{item.serialNumber || '-'}</TableCell>
                    <TableCell>{item.responsiblePerson || '-'}</TableCell>
                    <TableCell>{item.workType || '-'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove demand item">
                        <IconButton size="small" color="error" onClick={() => handleRemoveDemandItem(idx)} aria-label="Remove demand item">
                          <Cancel fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </EnterpriseDialog>

      <EnterpriseDialog
        open={directDemandOpen}
        onClose={() => setDirectDemandOpen(false)}
        title="New Direct Demand"
        icon={<Inventory />}
        maxWidth="lg"
        actions={
          <>
            <Button onClick={() => setDirectDemandOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveDirectDemand} disabled={!directDemandForm.physicalDemandNo || directDemandItems.length === 0}>Save Demand</Button>
          </>
        }
      >
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={3}>
            <TextField fullWidth required label="मांग क्रमांक (Physical Demand No.)"
              value={directDemandForm.physicalDemandNo}
              onChange={e => setDirectDemandForm({ ...directDemandForm, physicalDemandNo: e.target.value.replace(/[`]/g, '').trim() })}
              placeholder="e.g. 71509" />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Demand Date" type="date"
              value={directDemandForm.demandDate}
              onChange={e => setDirectDemandForm({ ...directDemandForm, demandDate: e.target.value })}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Requesting Person"
              value={directDemandForm.requestingPerson}
              onChange={e => setDirectDemandForm({ ...directDemandForm, requestingPerson: e.target.value })}
              placeholder="e.g. Rajesh Kumar" />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Mobile No."
              value={directDemandForm.mobileNo}
              onChange={e => setDirectDemandForm({ ...directDemandForm, mobileNo: e.target.value })}
              placeholder="e.g. 9876543210" />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Responsible Person"
              value={directDemandForm.responsiblePerson}
              onChange={e => setDirectDemandForm({ ...directDemandForm, responsiblePerson: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Work Type"
              value={directDemandForm.workType}
              onChange={e => setDirectDemandForm({ ...directDemandForm, workType: e.target.value })}>
              <MenuItem value="">Select Work Type</MenuItem>
              {WORK_TYPES.map(wt => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Store (Issue From)"
              value={directDemandForm.storeId}
              onChange={e => {
                const sid = +e.target.value;
                const store = stores.find((s: any) => s.id === sid);
                setDirectDemandForm({ ...directDemandForm, storeId: sid, storeName: store?.name || '' });
              }}>
              <MenuItem value={0}>Select Store</MenuItem>
              {stores.filter((s: any) => s.storeType === 'MAIN_STORE').map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Dharmshala"
              value={directDemandForm.dharmshalaName}
              onChange={e => setDirectDemandForm({ ...directDemandForm, dharmshalaName: e.target.value, locationName: '' })}>
              <MenuItem value="">Select Dharmshala</MenuItem>
              {dharmshalas.map((d: any) => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Department"
              value={directDemandForm.departmentId}
              onChange={e => {
                const did = +e.target.value;
                const dept = departments.find((d: any) => d.id === did);
                setDirectDemandForm({ ...directDemandForm, departmentId: did, departmentName: dept?.name || '', locationName: '' });
              }}>
              <MenuItem value={0}>Select Department</MenuItem>
              {departments.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Location"
              value={directDemandForm.locationName}
              onChange={e => setDirectDemandForm({ ...directDemandForm, locationName: e.target.value })}
              disabled={!directDemandForm.departmentId && !directDemandForm.dharmshalaName}>
              <MenuItem value="">Select Location</MenuItem>
              {filteredLocationsByDept.map((l: any) => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth label="Remarks"
              value={directDemandForm.remarks}
              onChange={e => setDirectDemandForm({ ...directDemandForm, remarks: e.target.value })} />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Add Items</Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <TextField fullWidth select label="Item"
              value={directDemandItemForm.itemId}
              onChange={e => {
                const id = +e.target.value;
                const item = items.find((i: any) => i.id === id);
                setDirectDemandItemForm({ ...directDemandItemForm, itemId: id, itemName: item?.itemName || '', unitName: item?.unit?.unitName || 'NOS' });
              }}>
              <MenuItem value={0}>Select Item</MenuItem>
              {items.map((item: any) => <MenuItem key={item.id} value={item.id}>{item.itemName}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth type="number" label="Quantity"
              value={directDemandItemForm.quantityRequested}
              onChange={e => setDirectDemandItemForm({ ...directDemandItemForm, quantityRequested: +e.target.value })} />
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth label="Unit" value={directDemandItemForm.unitName} disabled />
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth label="Serial No"
              value={directDemandItemForm.serialNumber}
              onChange={e => setDirectDemandItemForm({ ...directDemandItemForm, serialNumber: e.target.value })} />
          </Grid>
          <Grid item xs={2}>
            <Button variant="outlined" startIcon={<Add />} onClick={handleAddDirectDemandItem} fullWidth sx={{ height: '56px' }}>Add</Button>
          </Grid>
        </Grid>

        {directDemandItems.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Serial No</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {directDemandItems.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>{item.quantityRequested}</TableCell>
                    <TableCell>{item.serialNumber || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => handleRemoveDirectDemandItem(idx)}>
                        <Cancel fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </EnterpriseDialog>

      {/* Create Store Dialog */}
      <EnterpriseDialog open={createStoreOpen} onClose={() => setCreateStoreOpen(false)} title="Create Store" icon={<Add />} maxWidth="xs"
        actions={<><Button onClick={() => setCreateStoreOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreateStore}>Create</Button></>}>
        <TextField fullWidth label="Store Name" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} autoFocus />
      </EnterpriseDialog>

      {/* Create Location Dialog */}
      <EnterpriseDialog open={createLocationOpen} onClose={() => setCreateLocationOpen(false)} title="Create Location" icon={<Add />} maxWidth="xs"
        actions={<><Button onClick={() => setCreateLocationOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreateLocation}>Create</Button></>}>
        <TextField fullWidth label="Location Name" value={newLocationName} onChange={e => setNewLocationName(e.target.value)} autoFocus />
      </EnterpriseDialog>

      {/* Create Dharmshala Dialog */}
      <EnterpriseDialog open={createDharmshalaOpen} onClose={() => setCreateDharmshalaOpen(false)} title="Create Dharmshala" icon={<Add />} maxWidth="xs"
        actions={<><Button onClick={() => setCreateDharmshalaOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreateDharmshala}>Create</Button></>}>
        <TextField fullWidth label="Dharmshala Name" value={newDharmshalaName} onChange={e => setNewDharmshalaName(e.target.value)} autoFocus />
      </EnterpriseDialog>

      {/* Create Department Dialog */}
      <EnterpriseDialog open={createDeptOpen} onClose={() => setCreateDeptOpen(false)} title="Create Department" icon={<Add />} maxWidth="xs"
        actions={<><Button onClick={() => setCreateDeptOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreateDept}>Create</Button></>}>
        <TextField fullWidth label="Department Name" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} autoFocus />
      </EnterpriseDialog>

      {/* Edit Direct Demand Dialog */}
      <EnterpriseDialog
        open={editDemandOpen}
        onClose={() => setEditDemandOpen(false)}
        title="Edit Direct Demand"
        icon={<Edit />}
        maxWidth="lg"
        actions={
          <>
            <Button onClick={() => setEditDemandOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEditDemand} disabled={!editDemandForm.physicalDemandNo}>Update Demand</Button>
          </>
        }
      >
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={3}>
            <TextField fullWidth required label="मांग क्रमांक (Physical Demand No.)"
              value={editDemandForm.physicalDemandNo}
              onChange={e => setEditDemandForm({ ...editDemandForm, physicalDemandNo: e.target.value.replace(/[`]/g, '').trim() })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Demand Date" type="date"
              value={editDemandForm.demandDate}
              onChange={e => setEditDemandForm({ ...editDemandForm, demandDate: e.target.value })}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Requesting Person"
              value={editDemandForm.requestingPerson}
              onChange={e => setEditDemandForm({ ...editDemandForm, requestingPerson: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Mobile No."
              value={editDemandForm.mobileNo}
              onChange={e => setEditDemandForm({ ...editDemandForm, mobileNo: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Responsible Person"
              value={editDemandForm.responsiblePerson}
              onChange={e => setEditDemandForm({ ...editDemandForm, responsiblePerson: e.target.value })} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Work Type"
              value={editDemandForm.workType}
              onChange={e => setEditDemandForm({ ...editDemandForm, workType: e.target.value })}>
              <MenuItem value="">Select Work Type</MenuItem>
              {WORK_TYPES.map(wt => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Store (Issue From)"
              value={editDemandForm.storeId}
              onChange={e => {
                const sid = +e.target.value;
                const store = stores.find((s: any) => s.id === sid);
                setEditDemandForm({ ...editDemandForm, storeId: sid, storeName: store?.name || '' });
              }}>
              <MenuItem value={0}>Select Store</MenuItem>
              {stores.filter((s: any) => s.storeType === 'MAIN_STORE').map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Dharmshala"
              value={editDemandForm.dharmshalaName}
              onChange={e => setEditDemandForm({ ...editDemandForm, dharmshalaName: e.target.value, locationName: '' })}>
              <MenuItem value="">Select Dharmshala</MenuItem>
              {dharmshalas.map((d: any) => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Department"
              value={editDemandForm.departmentId}
              onChange={e => {
                const did = +e.target.value;
                const dept = departments.find((d: any) => d.id === did);
                setEditDemandForm({ ...editDemandForm, departmentId: did, departmentName: dept?.name || '', locationName: '' });
              }}>
              <MenuItem value={0}>Select Department</MenuItem>
              {departments.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth select label="Location"
              value={editDemandForm.locationName}
              onChange={e => setEditDemandForm({ ...editDemandForm, locationName: e.target.value })}
              disabled={!editDemandForm.departmentId && !editDemandForm.dharmshalaName}>
              <MenuItem value="">Select Location</MenuItem>
              {filteredLocationsByDeptEdit.map((l: any) => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth label="Remarks"
              value={editDemandForm.remarks}
              onChange={e => setEditDemandForm({ ...editDemandForm, remarks: e.target.value })} />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Demand Items</Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <TextField fullWidth select label="Item"
              value={editDemandItemForm.itemId}
              onChange={e => {
                const id = +e.target.value;
                const item = items.find((i: any) => i.id === id);
                setEditDemandItemForm({ ...editDemandItemForm, itemId: id, itemName: item?.itemName || '', unitName: item?.unit?.unitName || 'NOS' });
              }}>
              <MenuItem value={0}>Select Item</MenuItem>
              {items.map((item: any) => <MenuItem key={item.id} value={item.id}>{item.itemName}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth type="number" label="Quantity"
              value={editDemandItemForm.quantityRequested}
              onChange={e => setEditDemandItemForm({ ...editDemandItemForm, quantityRequested: +e.target.value })} />
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth label="Unit" value={editDemandItemForm.unitName} disabled />
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth label="Serial No"
              value={editDemandItemForm.serialNumber}
              onChange={e => setEditDemandItemForm({ ...editDemandItemForm, serialNumber: e.target.value })} />
          </Grid>
          <Grid item xs={2}>
            <Button variant="outlined" startIcon={<Add />} onClick={handleAddEditDemandItem} fullWidth sx={{ height: '56px' }}>Add</Button>
          </Grid>
        </Grid>

        {editDemandItems.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Serial No</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editDemandItems.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>{item.quantityRequested}</TableCell>
                    <TableCell>{item.serialNumber || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => handleRemoveEditDemandItem(idx)}>
                        <Cancel fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </EnterpriseDialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.sev}>{snackbar.msg}</Alert>
      </Snackbar>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Service Request"
        message={`Cancel service request ${cancelTarget?.requestNumber || ''}? This cannot be reversed.`}
        confirmText="Cancel Request"
        confirmColor="error"
        onConfirm={() => {
          if (cancelTarget) {
            handleCancel(cancelTarget.id);
            setCancelTarget(null);
          }
        }}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteDemandTarget}
        title="Delete Demand"
        message={`Delete demand ${deleteDemandTarget?.physicalDemandNo || ''}? This will permanently remove the demand and all its items.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={handleDeleteDemand}
        onCancel={() => setDeleteDemandTarget(null)}
      />
    </Box>
  );
}
