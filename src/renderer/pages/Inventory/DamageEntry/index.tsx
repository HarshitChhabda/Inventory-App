import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, TextField, TablePagination,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Grid, alpha, useTheme,
  CircularProgress, Tooltip, IconButton,
} from '@mui/material';
import { Add, Search, Warning, ReportProblem, Build, Inventory2, DeleteForever, ArrowBack } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TableSkeleton } from '../../../components/LoadingSkeleton';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import FormSection from '../../../components/FormSection';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import { GuideButton } from '../../../components/GuideSystem';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../../components/ImportProgressDialog';
import DatePickerField from '../../../components/DatePickerField';
import { formatDateDDMMYYYY, normalizeDate, todayISO } from '../../../utils/dateUtils';
import { toNumber } from '../../../utils/numberUtils';
import { useUnsavedChangesWarning, suppressUnsavedWarning } from '../../../hooks/useUnsavedChangesWarning';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';

const DAMAGE_REASONS = ['Damaged', 'Lost', 'Broken', 'Scrap', 'Expired'] as const;
const WORK_TYPES = ['Mason', 'Plumber', 'Electrician', 'Carpenter', 'Welder', 'AC Technician', 'Painter', 'Other'] as const;

const damageSchema = z.object({
  itemId: z.number().min(1, 'Item is required'),
  departmentId: z.number().nullable().optional(),
  locationId: z.number().nullable().optional(),
  storeId: z.number().nullable().optional(),
  date: z.string().min(1, 'Date is required'),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.enum(['Damaged', 'Lost', 'Broken', 'Scrap', 'Expired']),
  reportedBy: z.string().min(1, 'Reported By is required'),
  workType: z.string().optional(),
  responsiblePerson: z.string().optional(),
  remarks: z.string().optional(),
});

type DamageFormData = z.infer<typeof damageSchema>;

// ==================== SEND TO REPAIR DIALOG ====================

function SendToRepairDialog({ open, onClose, items, stores, companyId, financialYearId, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  items: any[];
  stores: any[];
  companyId?: number;
  financialYearId?: number;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const theme = useTheme();
  const [itemId, setItemId] = useState<number>(0);
  const [storeId, setStoreId] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [sentBy, setSentBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [stockInfo, setStockInfo] = useState<any>(null);

  const handleItemStoreChange = async (iid: number, sid: number) => {
    if (iid > 0 && sid > 0 && companyId && financialYearId) {
      try {
        const breakdown = await window.electronAPI.getStockBreakdown(companyId, financialYearId, iid, sid);
        setStockInfo(breakdown);
      } catch { setStockInfo(null); }
    } else {
      setStockInfo(null);
    }
  };

  const handleSubmit = () => {
    if (itemId && storeId && quantity > 0 && sentBy && transactionDate) {
      onSubmit({ itemId, storeId, quantity, sentBy, remarks, transactionDate });
    }
  };

  const isValid = itemId > 0 && storeId > 0 && quantity > 0 && sentBy.trim() && transactionDate;

  return (
    <EnterpriseDialog open={open} onClose={onClose} title="Send to Repair" subtitle="Move damaged items to repair status" icon={<Build />} maxWidth="sm"
      actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isValid || isPending} startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {isPending ? 'Sending...' : 'Send to Repair'}
        </Button>
      </>}
    >
      <Stack spacing={2.5}>
        <Autocomplete options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
          value={items?.find((i: any) => i.id === itemId) || null}
          onChange={(_, v: any) => { const id = v?.id || 0; setItemId(id); handleItemStoreChange(id, storeId); }}
          renderInput={(params) => <TextField {...params} label="Item" />} />
        <Autocomplete options={stores || []} getOptionLabel={(o: any) => o.name}
          value={stores?.find((s: any) => s.id === storeId) || null}
          onChange={(_, v: any) => { const id = v?.id || 0; setStoreId(id); handleItemStoreChange(itemId, id); }}
          renderInput={(params) => <TextField {...params} label="Store" />} />
        {stockInfo && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.04), border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`, borderRadius: 2 }}>
            <Typography variant="caption" color="warning.main" fontWeight={600}>Stock Breakdown:</Typography>
            <Typography variant="caption" display="block" color="text.secondary">Available: {stockInfo.available || 0} | Damaged: {stockInfo.damaged || 0} | Repair: {stockInfo.repair || 0}</Typography>
          </Paper>
        )}
        <TextField label="Quantity to Send" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} inputProps={{ min: 1, max: stockInfo?.damaged || 9999 }} />
        <DatePickerField label="Transaction Date" value={transactionDate} onChange={(val) => setTransactionDate(val)} />
        <TextField label="Sent By" value={sentBy} onChange={(e) => setSentBy(e.target.value)} required />
        <TextField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} multiline rows={2} />
      </Stack>
    </EnterpriseDialog>
  );
}

// ==================== RECEIVE FROM REPAIR DIALOG ====================

function ReceiveFromRepairDialog({ open, onClose, items, stores, companyId, financialYearId, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  items: any[];
  stores: any[];
  companyId?: number;
  financialYearId?: number;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const theme = useTheme();
  const [itemId, setItemId] = useState<number>(0);
  const [storeId, setStoreId] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [receivedBy, setReceivedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [stockInfo, setStockInfo] = useState<any>(null);

  const handleItemStoreChange = async (iid: number, sid: number) => {
    if (iid > 0 && sid > 0 && companyId && financialYearId) {
      try {
        const breakdown = await window.electronAPI.getStockBreakdown(companyId, financialYearId, iid, sid);
        setStockInfo(breakdown);
      } catch { setStockInfo(null); }
    } else {
      setStockInfo(null);
    }
  };

  const handleSubmit = () => {
    if (itemId && storeId && quantity > 0 && receivedBy && transactionDate) {
      onSubmit({ itemId, storeId, quantity, receivedBy, remarks, transactionDate });
    }
  };

  const isValid = itemId > 0 && storeId > 0 && quantity > 0 && receivedBy.trim() && transactionDate;

  return (
    <EnterpriseDialog open={open} onClose={onClose} title="Receive from Repair" subtitle="Receive repaired items back to available stock" icon={<Inventory2 />} maxWidth="sm"
      actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" onClick={handleSubmit} disabled={!isValid || isPending} startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {isPending ? 'Receiving...' : 'Receive from Repair'}
        </Button>
      </>}
    >
      <Stack spacing={2.5}>
        <Autocomplete options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
          value={items?.find((i: any) => i.id === itemId) || null}
          onChange={(_, v: any) => { const id = v?.id || 0; setItemId(id); handleItemStoreChange(id, storeId); }}
          renderInput={(params) => <TextField {...params} label="Item" />} />
        <Autocomplete options={stores || []} getOptionLabel={(o: any) => o.name}
          value={stores?.find((s: any) => s.id === storeId) || null}
          onChange={(_, v: any) => { const id = v?.id || 0; setStoreId(id); handleItemStoreChange(itemId, id); }}
          renderInput={(params) => <TextField {...params} label="Store" />} />
        {stockInfo && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: alpha(theme.palette.info.main, 0.04), border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`, borderRadius: 2 }}>
            <Typography variant="caption" color="info.main" fontWeight={600}>Stock Breakdown:</Typography>
            <Typography variant="caption" display="block" color="text.secondary">Available: {stockInfo.available || 0} | Damaged: {stockInfo.damaged || 0} | Repair: {stockInfo.repair || 0}</Typography>
          </Paper>
        )}
        <TextField label="Quantity to Receive" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} inputProps={{ min: 1, max: stockInfo?.repair || 9999 }} />
        <DatePickerField label="Transaction Date" value={transactionDate} onChange={(val) => setTransactionDate(val)} />
        <TextField label="Received By" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} required />
        <TextField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} multiline rows={2} />
      </Stack>
    </EnterpriseDialog>
  );
}

// ==================== SCRAP ITEM DIALOG ====================

function ScrapItemDialog({ open, onClose, items, stores, companyId, financialYearId, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  items: any[];
  stores: any[];
  companyId?: number;
  financialYearId?: number;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const theme = useTheme();
  const [itemId, setItemId] = useState<number>(0);
  const [storeId, setStoreId] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [stockInfo, setStockInfo] = useState<any>(null);

  const handleItemStoreChange = async (iid: number, sid: number) => {
    if (iid > 0 && sid > 0 && companyId && financialYearId) {
      try {
        const breakdown = await window.electronAPI.getStockBreakdown(companyId, financialYearId, iid, sid);
        setStockInfo(breakdown);
      } catch { setStockInfo(null); }
    } else {
      setStockInfo(null);
    }
  };

  const handleSubmit = () => {
    if (itemId && storeId && quantity > 0 && reason && reportedBy && transactionDate) {
      onSubmit({ itemId, storeId, quantity, reason, reportedBy, remarks, transactionDate });
    }
  };

  const isValid = itemId > 0 && storeId > 0 && quantity > 0 && reason.trim() && reportedBy.trim() && transactionDate;

  return (
    <EnterpriseDialog open={open} onClose={onClose} title="Scrap Item" subtitle="Permanently remove items from usable stock" icon={<DeleteForever />} maxWidth="sm"
      actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleSubmit} disabled={!isValid || isPending} startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {isPending ? 'Scrapping...' : 'Scrap Item'}
        </Button>
      </>}
    >
      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: alpha(theme.palette.error.main, 0.06), border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`, borderRadius: 2 }}>
        <Typography variant="body2" color="error.main" fontWeight={600}>
          Warning: Scrapped items will no longer be available as usable stock. This action cannot be undone.
        </Typography>
      </Paper>
      <Stack spacing={2.5}>
        <Autocomplete options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
          value={items?.find((i: any) => i.id === itemId) || null}
          onChange={(_, v: any) => { const id = v?.id || 0; setItemId(id); handleItemStoreChange(id, storeId); }}
          renderInput={(params) => <TextField {...params} label="Item" />} />
        <Autocomplete options={stores || []} getOptionLabel={(o: any) => o.name}
          value={stores?.find((s: any) => s.id === storeId) || null}
          onChange={(_, v: any) => { const id = v?.id || 0; setStoreId(id); handleItemStoreChange(itemId, id); }}
          renderInput={(params) => <TextField {...params} label="Store" />} />
        {stockInfo && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.04), border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`, borderRadius: 2 }}>
            <Typography variant="caption" color="warning.main" fontWeight={600}>Stock Breakdown:</Typography>
            <Typography variant="caption" display="block" color="text.secondary">Available: {stockInfo.available || 0} | Damaged: {stockInfo.damaged || 0} | Scrap: {stockInfo.scrap || 0}</Typography>
          </Paper>
        )}
        <TextField label="Quantity to Scrap" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} inputProps={{ min: 1, max: stockInfo?.damaged || 9999 }} />
        <DatePickerField label="Transaction Date" value={transactionDate} onChange={(val) => setTransactionDate(val)} />
        <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
        <TextField label="Reported By" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} required />
        <TextField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} multiline rows={2} />
      </Stack>
    </EnterpriseDialog>
  );
}

export default function DamageEntryPage() {
  const { company } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [repairSendOpen, setRepairSendOpen] = useState(false);
  const [repairReceiveOpen, setRepairReceiveOpen] = useState(false);
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);
  const [selectedRepairItem, setSelectedRepairItem] = useState<any>(null);
  const [selectedReceiveItem, setSelectedReceiveItem] = useState<any>(null);
  const [selectedScrapItem, setSelectedScrapItem] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const {
    control, register, handleSubmit, formState: { isValid, isDirty }, reset, setValue, watch,
  } = useForm<DamageFormData>({
    resolver: zodResolver(damageSchema),
    defaultValues: {
      itemId: 0, departmentId: null, locationId: null, storeId: null, date: todayISO(),
      quantity: 1, reason: 'Damaged', reportedBy: '', workType: '', responsiblePerson: '', remarks: '',
    },
  });

  useUnsavedChangesWarning({ isDirty });

  const watchedItemId = watch('itemId');

  const exportColumns = [
    { header: 'Date', key: 'transactionDate' },
    { header: 'Item', key: 'itemName' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Reason', key: 'reason' },
    { header: 'Location', key: 'location' },
    { header: 'Reported By', key: 'reportedBy' },
    { header: 'Work Type', key: 'workType' },
    { header: 'Responsible Person', key: 'responsiblePerson' },
    { header: 'Original Vendor', key: 'originalVendorName' },
    { header: 'Original Rate', key: 'originalRate' },
  ];

  const { data: allDamages } = useQuery({
    queryKey: ['damages', company?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('damageEntry', 'findMany', {
      where: { companyId: company?.id },
      include: { details: { include: { item: true } }, fromLocation: true, department: true, vendor: true },
      orderBy: { transactionDate: 'desc' },
    }),
    enabled: !!company?.id,
    refetchOnMount: true,
  });

  const getExportData = () => (allDamages || []).map((d: any) => ({
    transactionDate: formatDateDDMMYYYY(d.transactionDate || d.createdAt),
    itemName: d.details?.[0]?.item?.itemName || '',
    quantity: d.details?.[0]?.quantity || 0,
    reason: d.remarks?.replace('Damage: ', '').split('.')[0] || '',
    location: d.fromLocation ? `${d.fromLocation.locationType} - ${d.fromLocation.name}` : '',
    reportedBy: d.createdBy || '',
    workType: d.workType || '',
    responsiblePerson: d.responsiblePerson || '',
    originalVendorName: d.vendor?.vendorName || '',
    originalRate: d.details?.[0]?.rate || '',
  }));

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, include: { unit: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', company?.id],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', { where: { store: { companyId: company!.id }, isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', company?.id],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { companyId: company?.id, departmentType: 'Department', isActive: true }, orderBy: { name: 'asc' } }),
    enabled: !!company?.id,
  });

  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.listStores(company!.id),
    enabled: !!company?.id,
  });

  const { data: currentFY } = useQuery({
    queryKey: ['currentFY', company?.id],
    queryFn: () => window.electronAPI.getCurrentFinancialYear(company!.id),
    enabled: !!company?.id,
  });

  const { data: purchaseHistory } = useQuery({
    queryKey: ['purchaseHistory', watchedItemId, company?.id],
    queryFn: () => window.electronAPI.dbQuery('stockTransaction', 'findMany', {
      where: { companyId: company!.id, itemId: watchedItemId, transactionType: 'PURCHASE' },
      orderBy: { date: 'desc' },
    }),
    enabled: watchedItemId > 0,
  });

  const { data: damages, isLoading } = useQuery({
    queryKey: ['damages', company?.id, page, rowsPerPage],
    queryFn: async () => {
      const [data, total] = await Promise.all([
        window.electronAPI.dbQuery('damageEntry', 'findMany', {
          where: { companyId: company?.id },
          include: { details: { include: { item: true } }, fromLocation: true, department: true, vendor: true },
          skip: page * rowsPerPage, take: rowsPerPage, orderBy: { transactionDate: 'desc' },
        }),
        window.electronAPI.dbQuery('damageEntry', 'count', { where: { companyId: company?.id } }),
      ]);
      return { data, total };
    },
    refetchOnMount: true,
  });

  const handleImportDamages = async (rows: any[]) => {
    const total = rows.length;
    let created = 0, skipped = 0;
    const errors: string[] = [];
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const itemName = row['Item'] || row['itemName'] || '';
          if (!itemName) { skipped++; errors.push(`Row ${i + 1}: Missing item`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const item = items?.find((i: any) => i.itemName === itemName);
          if (!item) { skipped++; errors.push(`Row ${i + 1}: Item "${itemName}" not found`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const transactionDate = normalizeDate(row['Date'] || row['date'] || '');
          if (!transactionDate) {
            skipped++;
            errors.push(`Row ${i + 1} (${itemName}): Invalid date`);
            setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors }));
            continue;
          }
          await window.electronAPI.createDamageEntry({
            itemId: item.itemId || item.id, companyId: company?.id,
            date: transactionDate, quantity: Number(row['Quantity'] || row['quantity'] || 1),
            reason: row['Reason'] || row['reason'] || 'Damaged',
            reportedBy: row['Reported By'] || row['reportedBy'] || '',
          });
          created++;
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1, created, skipped, errors }));
      }
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.success(`Import: ${created} created, ${skipped} skipped`);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error(getErrorMessage(err, 'Import failed'));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: DamageFormData) => {
      return window.electronAPI.createDamageEntry({
        ...data, companyId: company?.id, date: new Date(data.date),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockLedger'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      suppressUnsavedWarning();
      toast.success('Damage entry recorded');
      setDialogOpen(false);
      reset({ itemId: 0, departmentId: null, locationId: null, storeId: null, date: todayISO(), quantity: 1, reason: 'Damaged', reportedBy: '', workType: '', responsiblePerson: '', remarks: '' });
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to save damage entry'));
    },
  });

  const sendRepairMutation = useMutation({
    mutationFn: async (data: { itemId: number; storeId: number; quantity: number; sentBy: string; remarks?: string; transactionDate: string }) => {
      return window.electronAPI.sendToRepair({
        ...data,
        companyId: company?.id,
        financialYearId: currentFY?.id,
        transactionDate: new Date(data.transactionDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Item sent to repair successfully');
      setRepairSendOpen(false);
      setSelectedRepairItem(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to send to repair'));
    },
  });

  const receiveRepairMutation = useMutation({
    mutationFn: async (data: { itemId: number; storeId: number; quantity: number; receivedBy: string; remarks?: string; transactionDate: string }) => {
      return window.electronAPI.receiveFromRepair({
        ...data,
        companyId: company?.id,
        financialYearId: currentFY?.id,
        transactionDate: new Date(data.transactionDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Item received from repair successfully');
      setRepairReceiveOpen(false);
      setSelectedReceiveItem(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to receive from repair'));
    },
  });

  const scrapMutation = useMutation({
    mutationFn: async (data: { itemId: number; storeId: number; quantity: number; reason: string; reportedBy: string; remarks?: string; transactionDate: string }) => {
      return window.electronAPI.createScrapEntry({
        ...data,
        companyId: company?.id,
        transactionDate: new Date(data.transactionDate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      queryClient.invalidateQueries({ queryKey: ['stockTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Item scrapped successfully');
      setScrapDialogOpen(false);
      setSelectedScrapItem(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to scrap item'));
    },
  });

  return (
    <Box>
      <PageHeader
        title="Damage Entries"
        subtitle="Record damaged, lost, or scrapped items"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="damage-entry" />
            <Tooltip title="Back to Material Operations">
              <IconButton onClick={() => navigate('/inventory/movement')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <ImportExportButtons
              data={getExportData()}
              columns={exportColumns}
              fileName="damage-entries"
              onImport={handleImportDamages}
            />
            <Button variant="outlined" color="warning" startIcon={<Build />} onClick={() => setRepairSendOpen(true)}>Send to Repair</Button>
            <Button variant="outlined" color="success" startIcon={<Inventory2 />} onClick={() => setRepairReceiveOpen(true)}>Receive from Repair</Button>
            <Button variant="outlined" color="error" startIcon={<DeleteForever />} onClick={() => setScrapDialogOpen(true)}>Scrap Item</Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New Damage Entry</Button>
          </Stack>
        }
      />

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="damage entries" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Reported By</TableCell>
              <TableCell>Work Type</TableCell>
              <TableCell>Responsible Person</TableCell>
              <TableCell>Original Vendor</TableCell>
              <TableCell>Original Rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ p: 0, border: 'none' }}>
                  <Box sx={{ py: 2 }}>
                    <TableSkeleton rows={5} columns={8} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : damages?.data?.map((d: any) => (
              <TableRow key={d.id} hover>
                <TableCell>{formatDateDDMMYYYY(d.transactionDate || d.createdAt)}</TableCell>
                <TableCell>{d.details?.[0]?.item?.itemName}</TableCell>
                <TableCell>{d.details?.[0]?.quantity}</TableCell>
                <TableCell>
                  <Box sx={{
                    display: 'inline-flex', px: 1, py: 0.25, borderRadius: 1,
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    color: 'error.main', fontWeight: 500, fontSize: '0.75rem',
                  }}>
                    {d.remarks?.replace('Damage: ', '').split('.')[0] || 'Damaged'}
                  </Box>
                </TableCell>
                <TableCell>{d.fromLocation ? `${d.fromLocation.locationType} - ${d.fromLocation.name}` : '-'}</TableCell>
                <TableCell>{d.createdBy}</TableCell>
                <TableCell>{d.workType || '-'}</TableCell>
                <TableCell>{d.responsiblePerson || '-'}</TableCell>
                <TableCell>{d.vendor?.vendorName || '-'}</TableCell>
                <TableCell>{d.details?.[0]?.rate ? `₹${toNumber(d.details[0].rate).toFixed(2)}` : '-'}</TableCell>
              </TableRow>
            ))}
            {(!damages?.data || damages.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={10}>
                  <EmptyState icon={<Warning />} title="No damage entries" description="Record your first damage entry" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination component="div" count={damages?.total || 0} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />

      <EnterpriseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="New Damage Entry"
        icon={<ReportProblem />}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" type="submit" form="damage-form" disabled={!isValid || saveMutation.isPending} startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
              {saveMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="damage-form" onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
          <FormSection title="Item Details" subtitle="Select item and purchase info">
            <Controller control={control} name="itemId" render={({ field }) => (
              <Autocomplete options={items || []} getOptionLabel={(o: any) => `${o.itemCode} - ${o.itemName}`}
                value={items?.find((i: any) => i.id === field.value) || null}
                onChange={(_, v: any) => field.onChange(v?.id || 0)}
                renderInput={(params) => <TextField {...params} label="Item" />} />
            )} />
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Store</InputLabel>
              <Controller control={control} name="storeId" render={({ field: { value, onChange } }) => (
                <Select value={value ?? ''} label="Store" onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                  <MenuItem value=""><em>Select Store</em></MenuItem>
                  {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              )} />
            </FormControl>
            {purchaseHistory && purchaseHistory.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, bgcolor: alpha(theme.palette.info.main, 0.04), border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`, borderRadius: 2 }}>
                <Typography variant="caption" color="info.main" display="block" mb={0.5} fontWeight={600}>Purchase History (Latest First):</Typography>
                {purchaseHistory.slice(0, 3).map((ph: any) => (
                  <Typography key={ph.id} variant="caption" display="block" color="text.secondary">
                    {formatDateDDMMYYYY(ph.transactionDate || ph.createdAt)} - Qty: {toNumber(ph.quantityIn) || toNumber(ph.quantityOut) || 0} @ ₹{toNumber(ph.rate).toFixed(2)} {ph.voucherNo ? `[${ph.voucherNo}]` : ''}
                  </Typography>
                ))}
              </Paper>
            )}
          </FormSection>
          <FormSection title="Damage Details" subtitle="Date, quantity, and reason">
            <Stack spacing={2.5}>
              <Controller control={control} name="date" render={({ field: { value, onChange } }) => (
                <DatePickerField label="Date" value={value} onChange={(val) => onChange(val)} />
              )} />
              <TextField label="Quantity" type="number" {...register('quantity', { valueAsNumber: true })} inputProps={{ min: 0.01 }} />
              <FormControl fullWidth>
                <InputLabel>Department (Optional)</InputLabel>
                <Controller control={control} name="departmentId" render={({ field: { value, onChange } }) => (
                  <Select value={value ?? ''} label="Department (Optional)" onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                    <MenuItem value=""><em>None (Global)</em></MenuItem>
                    {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                )} />
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Reason</InputLabel>
                <Controller control={control} name="reason" render={({ field: { value, onChange } }) => (
                  <Select value={value} label="Reason" onChange={onChange} MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                    {DAMAGE_REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                )} />
              </FormControl>
              <Controller control={control} name="locationId" render={({ field }) => (
                <Autocomplete options={locations || []} getOptionLabel={(o: any) => `${o.locationType} - ${o.name}`}
                  value={locations?.find((l: any) => l.id === field.value) || null}
                  onChange={(_, v: any) => field.onChange(v?.id || null)}
                  renderInput={(params) => <TextField {...params} label="Location (Optional)" />} />
              )} />
            </Stack>
          </FormSection>
          <FormSection title="Additional Info" divider={false}>
            <Stack spacing={2.5}>
              <TextField label="Reported By" {...register('reportedBy')} required />
              <FormControl fullWidth>
                <InputLabel>Work Type (Optional)</InputLabel>
                <Controller control={control} name="workType" render={({ field: { value, onChange } }) => (
                  <Select value={value || ''} label="Work Type (Optional)" onChange={onChange} MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {WORK_TYPES.map((wt) => <MenuItem key={wt} value={wt}>{wt}</MenuItem>)}
                  </Select>
                )} />
              </FormControl>
              <TextField label="Responsible Person (Optional)" {...register('responsiblePerson')} />
              <TextField label="Remarks" {...register('remarks')} multiline rows={2} />
            </Stack>
          </FormSection>
        </form>
      </EnterpriseDialog>

      {/* ==================== SEND TO REPAIR DIALOG ==================== */}
      <SendToRepairDialog
        open={repairSendOpen}
        onClose={() => { setRepairSendOpen(false); setSelectedRepairItem(null); }}
        items={items || []}
        stores={stores || []}
        companyId={company?.id}
        financialYearId={currentFY?.id}
        onSubmit={(data) => sendRepairMutation.mutate(data)}
        isPending={sendRepairMutation.isPending}
      />

      {/* ==================== RECEIVE FROM REPAIR DIALOG ==================== */}
      <ReceiveFromRepairDialog
        open={repairReceiveOpen}
        onClose={() => { setRepairReceiveOpen(false); setSelectedReceiveItem(null); }}
        items={items || []}
        stores={stores || []}
        companyId={company?.id}
        financialYearId={currentFY?.id}
        onSubmit={(data) => receiveRepairMutation.mutate(data)}
        isPending={receiveRepairMutation.isPending}
      />

      {/* ==================== SCRAP ITEM DIALOG ==================== */}
      <ScrapItemDialog
        open={scrapDialogOpen}
        onClose={() => { setScrapDialogOpen(false); setSelectedScrapItem(null); }}
        items={items || []}
        stores={stores || []}
        companyId={company?.id}
        financialYearId={currentFY?.id}
        onSubmit={(data) => scrapMutation.mutate(data)}
        isPending={scrapMutation.isPending}
      />
    </Box>
  );
}
