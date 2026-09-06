import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack, Alert, Chip, alpha, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Divider,
  IconButton, Tooltip, Grid, Card, CardContent, TextField,
} from '@mui/material';
import {
  SwapHoriz, Outbox, AssignmentReturn, Build, Warning, Delete,
  CheckCircle, Error, Info, Preview, Download, Refresh,
  Inventory, Business, RoomService, BuildCircle,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { formatDateDDMMYYYY, todayISO } from '../../utils/dateUtils';
import { downloadBuffer } from '../../utils/importExport';
import { useCompany } from '../../context/CompanyContext';
import DatePickerField from '../../components/DatePickerField';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';

interface BulkOperation {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const BULK_OPERATIONS: BulkOperation[] = [
  {
    id: 'transfer',
    name: 'Bulk Transfer',
    icon: <SwapHoriz />,
    description: 'Transfer items between stores',
    color: '#2196F3',
  },
  {
    id: 'issue',
    name: 'Bulk Issue',
    icon: <Outbox />,
    description: 'Issue items to departments',
    color: '#FF9800',
  },
  {
    id: 'return',
    name: 'Bulk Return',
    icon: <AssignmentReturn />,
    description: 'Return items from departments',
    color: '#4CAF50',
  },
  {
    id: 'install',
    name: 'Bulk Install',
    icon: <Build />,
    description: 'Install items at locations',
    color: '#9C27B0',
  },
  {
    id: 'uninstall',
    name: 'Bulk Uninstall',
    icon: <BuildCircle />,
    description: 'Uninstall items from locations',
    color: '#795548',
  },
  {
    id: 'damage',
    name: 'Bulk Damage',
    icon: <Warning />,
    description: 'Record damaged items',
    color: '#F44336',
  },
];

interface BulkResult {
  success: boolean;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  transactionIds: number[];
  errors: Array<{
    index: number;
    itemId?: number;
    error: string;
    severity: string;
  }>;
  warnings: string[];
  summary: string;
}

export default function BulkOperationsPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { company, financialYear } = useCompany();
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [operationDialog, setOperationDialog] = useState(false);
  const [resultDialog, setResultDialog] = useState(false);
  const [operationResult, setOperationResult] = useState<BulkResult | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form state for different operations
  const [transferForm, setTransferForm] = useState({
    fromStoreId: '',
    toStoreId: '',
    transactionDate: todayISO(),
    items: [{ itemId: '', quantity: 0 }],
  });

  const [issueForm, setIssueForm] = useState({
    storeId: '',
    toStoreId: '',
    transactionDate: todayISO(),
    items: [{ itemId: '', quantity: 0 }],
  });

  const [damageForm, setDamageForm] = useState({
    storeId: '',
    transactionDate: todayISO(),
    items: [{ itemId: '', quantity: 0, reason: '', damageType: 'DAMAGED' }],
  });

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.listStores(company!.id),
    enabled: !!company?.id,
  });

  // Fetch departments (legacy compatibility for return operations)
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany'),
    enabled: false,
  });

  // Fetch items
  const { data: items } = useQuery({
    queryKey: ['items', company?.id],
    queryFn: () => window.electronAPI.listItemsEnterprise(company!.id),
    enabled: !!company?.id,
  });

  // Handle bulk operation
  const handleBulkOperation = useCallback(async () => {
    if (!company?.id || !financialYear?.id) {
      toast.error('Select a company and financial year first');
      return;
    }

    if (!selectedOperation) {
      toast.error('Select an operation first');
      return;
    }

    setProcessing(true);
    try {
      let result: BulkResult = {
        success: false,
        totalItems: 0,
        processedItems: 0,
        failedItems: 0,
        transactionIds: [],
        errors: [],
        warnings: [],
        summary: '',
      };

      switch (selectedOperation) {
        case 'transfer':
          if (!transferForm.transactionDate) {
            toast.error('Transaction Date is required for bulk transfer');
            setProcessing(false);
            return;
          }
          result = await window.electronAPI.bulkTransfer({
            companyId: company.id,
            financialYearId: financialYear.id,
            fromStoreId: parseInt(transferForm.fromStoreId),
            toStoreId: parseInt(transferForm.toStoreId),
            transactionDate: new Date(transferForm.transactionDate),
            items: transferForm.items.map(item => ({
              itemId: parseInt(item.itemId),
              quantity: item.quantity,
            })),
            createdBy: 'current-user',
          });
          break;

        case 'issue':
          if (!issueForm.transactionDate) {
            toast.error('Transaction Date is required for bulk issue');
            setProcessing(false);
            return;
          }
          result = await window.electronAPI.bulkIssue({
            companyId: company.id,
            financialYearId: financialYear.id,
            storeId: parseInt(issueForm.storeId),
            toStoreId: parseInt(issueForm.toStoreId),
            transactionDate: new Date(issueForm.transactionDate),
            items: issueForm.items.map(item => ({
              itemId: parseInt(item.itemId),
              quantity: item.quantity,
            })),
            createdBy: 'current-user',
          });
          break;

        case 'damage':
          if (!damageForm.transactionDate) {
            toast.error('Transaction Date is required for bulk damage');
            setProcessing(false);
            return;
          }
          result = await window.electronAPI.bulkDamage({
            companyId: company.id,
            financialYearId: financialYear.id,
            storeId: parseInt(damageForm.storeId),
            transactionDate: new Date(damageForm.transactionDate),
            items: damageForm.items.map(item => ({
              itemId: parseInt(item.itemId),
              quantity: item.quantity,
              reason: item.reason,
              damageType: item.damageType,
            })),
            createdBy: 'current-user',
          });
          break;
      }

      setOperationResult(result);
      setResultDialog(true);

      if (result.success) {
        toast.success(`Operation completed: ${result.summary}`);
      } else {
        toast.error(`Operation failed: ${result.failedItems} items failed`);
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Operation failed'));
    } finally {
      setProcessing(false);
    }
  }, [selectedOperation, company?.id, financialYear?.id, transferForm, issueForm, damageForm]);

  // Export report
  const handleExportReport = useCallback(async () => {
    if (!operationResult || !selectedOperation) return;

    try {
      const filePath = await window.electronAPI.exportBulkReport(operationResult, selectedOperation);
      toast.success('Report exported');
      const buffer = await window.electronAPI.readFileBuffer(filePath);
      downloadBuffer(buffer, `bulk-${selectedOperation}-report.xlsx`);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Export failed'));
    }
  }, [operationResult, selectedOperation]);

  // Reset form
  const handleReset = useCallback(() => {
    setSelectedOperation(null);
    setTransferForm({ fromStoreId: '', toStoreId: '', transactionDate: todayISO(), items: [{ itemId: '', quantity: 0 }] });
    setIssueForm({ storeId: '', toStoreId: '', transactionDate: todayISO(), items: [{ itemId: '', quantity: 0 }] });
    setDamageForm({ storeId: '', transactionDate: todayISO(), items: [{ itemId: '', quantity: 0, reason: '', damageType: 'DAMAGED' }] });
    setOperationResult(null);
  }, []);

  return (
    <Box>
      <PageHeader
        title="Bulk Operations"
        subtitle="Perform bulk inventory operations like transfer, issue, return, and more"
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleReset}
            >
              Reset
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2}>
        {BULK_OPERATIONS.map((op) => (
          <Grid item xs={12} sm={6} md={4} key={op.id}>
            <Card
              sx={{
                cursor: 'pointer',
                border: selectedOperation === op.id ? `2px solid ${op.color}` : '2px solid transparent',
                '&:hover': {
                  borderColor: op.color,
                  boxShadow: `0 4px 20px ${alpha(op.color, 0.2)}`,
                },
              }}
              onClick={() => {
                setSelectedOperation(op.id);
                setOperationDialog(true);
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: alpha(op.color, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: op.color,
                    }}
                  >
                    {op.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {op.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {op.description}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Operation Dialog */}
      <Dialog open={operationDialog} onClose={() => setOperationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            {BULK_OPERATIONS.find(op => op.id === selectedOperation)?.icon}
            <Typography variant="h6">
              {BULK_OPERATIONS.find(op => op.id === selectedOperation)?.name}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedOperation === 'transfer' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                Transfer items from one store to another. Stock will be deducted from source and added to destination.
              </Alert>
              <DatePickerField
                label="Transaction Date"
                value={transferForm.transactionDate}
                onChange={(v) => setTransferForm({ ...transferForm, transactionDate: v })}
                fullWidth size="small"
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>From Store</InputLabel>
                    <Select
                      value={transferForm.fromStoreId}
                      label="From Store"
                      onChange={(e) => setTransferForm({ ...transferForm, fromStoreId: e.target.value })}
                    >
                      {stores?.map((store: any) => (
                        <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>To Store</InputLabel>
                    <Select
                      value={transferForm.toStoreId}
                      label="To Store"
                      onChange={(e) => setTransferForm({ ...transferForm, toStoreId: e.target.value })}
                    >
                      {stores?.map((store: any) => (
                        <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Divider />
              <Typography variant="subtitle2">Items to Transfer</Typography>
              {transferForm.items.map((item, idx) => (
                <Grid container spacing={2} key={idx}>
                  <Grid item xs={8}>
                    <FormControl fullWidth>
                      <InputLabel>Item</InputLabel>
                      <Select
                        value={item.itemId}
                        label="Item"
                        onChange={(e) => {
                          const newItems = [...transferForm.items];
                          newItems[idx].itemId = e.target.value;
                          setTransferForm({ ...transferForm, items: newItems });
                        }}
                      >
                        {items?.map((item: any) => (
                          <MenuItem key={item.id} value={item.id}>{item.itemName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...transferForm.items];
                        newItems[idx].quantity = parseInt(e.target.value) || 0;
                        setTransferForm({ ...transferForm, items: newItems });
                      }}
                    />
                  </Grid>
                </Grid>
              ))}
              <Button
                size="small"
                onClick={() => setTransferForm({
                  ...transferForm,
                  items: [...transferForm.items, { itemId: '', quantity: 0 }],
                })}
              >
                + Add Item
              </Button>
            </Stack>
          )}

          {selectedOperation === 'issue' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                Issue items from a store to another store. Stock will be deducted from the source store and added to the destination store.
              </Alert>
              <DatePickerField
                label="Transaction Date"
                value={issueForm.transactionDate}
                onChange={(v) => setIssueForm({ ...issueForm, transactionDate: v })}
                fullWidth size="small"
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>From Store</InputLabel>
                    <Select
                      value={issueForm.storeId}
                      label="From Store"
                      onChange={(e) => setIssueForm({ ...issueForm, storeId: e.target.value })}
                    >
                      {stores?.map((store: any) => (
                        <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>To Store</InputLabel>
                    <Select
                      value={issueForm.toStoreId}
                      label="To Store"
                      onChange={(e) => setIssueForm({ ...issueForm, toStoreId: e.target.value })}
                    >
                      {stores?.map((store: any) => (
                        <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Divider />
              <Typography variant="subtitle2">Items to Issue</Typography>
              {issueForm.items.map((item, idx) => (
                <Grid container spacing={2} key={idx}>
                  <Grid item xs={8}>
                    <FormControl fullWidth>
                      <InputLabel>Item</InputLabel>
                      <Select
                        value={item.itemId}
                        label="Item"
                        onChange={(e) => {
                          const newItems = [...issueForm.items];
                          newItems[idx].itemId = e.target.value;
                          setIssueForm({ ...issueForm, items: newItems });
                        }}
                      >
                        {items?.map((item: any) => (
                          <MenuItem key={item.id} value={item.id}>{item.itemName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...issueForm.items];
                        newItems[idx].quantity = parseInt(e.target.value) || 0;
                        setIssueForm({ ...issueForm, items: newItems });
                      }}
                    />
                  </Grid>
                </Grid>
              ))}
              <Button
                size="small"
                onClick={() => setIssueForm({
                  ...issueForm,
                  items: [...issueForm.items, { itemId: '', quantity: 0 }],
                })}
              >
                + Add Item
              </Button>
            </Stack>
          )}

          {selectedOperation === 'damage' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning">
                Record damaged items. Stock will be moved to damaged category.
              </Alert>
              <DatePickerField
                label="Transaction Date"
                value={damageForm.transactionDate}
                onChange={(v) => setDamageForm({ ...damageForm, transactionDate: v })}
                fullWidth size="small"
              />
              <FormControl fullWidth>
                <InputLabel>Store</InputLabel>
                <Select
                  value={damageForm.storeId}
                  label="Store"
                  onChange={(e) => setDamageForm({ ...damageForm, storeId: e.target.value })}
                >
                  {stores?.map((store: any) => (
                    <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Divider />
              <Typography variant="subtitle2">Damaged Items</Typography>
              {damageForm.items.map((item, idx) => (
                <Grid container spacing={2} key={idx}>
                  <Grid item xs={4}>
                    <FormControl fullWidth>
                      <InputLabel>Item</InputLabel>
                      <Select
                        value={item.itemId}
                        label="Item"
                        onChange={(e) => {
                          const newItems = [...damageForm.items];
                          newItems[idx].itemId = e.target.value;
                          setDamageForm({ ...damageForm, items: newItems });
                        }}
                      >
                        {items?.map((item: any) => (
                          <MenuItem key={item.id} value={item.id}>{item.itemName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...damageForm.items];
                        newItems[idx].quantity = parseInt(e.target.value) || 0;
                        setDamageForm({ ...damageForm, items: newItems });
                      }}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControl fullWidth>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={item.damageType}
                        label="Type"
                        onChange={(e) => {
                          const newItems = [...damageForm.items];
                          newItems[idx].damageType = e.target.value;
                          setDamageForm({ ...damageForm, items: newItems });
                        }}
                      >
                        <MenuItem value="DAMAGED">Damaged</MenuItem>
                        <MenuItem value="LOST">Lost</MenuItem>
                        <MenuItem value="BROKEN">Broken</MenuItem>
                        <MenuItem value="SCRAP">Scrap</MenuItem>
                        <MenuItem value="EXPIRED">Expired</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      label="Reason"
                      value={item.reason}
                      onChange={(e) => {
                        const newItems = [...damageForm.items];
                        newItems[idx].reason = e.target.value;
                        setDamageForm({ ...damageForm, items: newItems });
                      }}
                    />
                  </Grid>
                </Grid>
              ))}
              <Button
                size="small"
                onClick={() => setDamageForm({
                  ...damageForm,
                  items: [...damageForm.items, { itemId: '', quantity: 0, reason: '', damageType: 'DAMAGED' }],
                })}
              >
                + Add Item
              </Button>
            </Stack>
          )}

          {!selectedOperation && (
            <Alert severity="info">
              Select an operation from the cards to get started.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOperationDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBulkOperation}
            disabled={!selectedOperation || processing}
            startIcon={processing ? <CircularProgress size={16} /> : null}
          >
            {processing ? 'Processing...' : 'Execute Operation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={resultDialog} onClose={() => setResultDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            {operationResult?.success ? (
              <CheckCircle color="success" />
            ) : (
              <Error color="error" />
            )}
            <Typography variant="h6">
              Operation {operationResult?.success ? 'Completed' : 'Failed'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {operationResult && (
            <Stack spacing={2}>
              <Typography variant="body1">{operationResult.summary}</Typography>
              <Stack direction="row" spacing={2}>
                <Chip label={`Total: ${operationResult.totalItems}`} />
                <Chip label={`Processed: ${operationResult.processedItems}`} color="success" />
                <Chip label={`Failed: ${operationResult.failedItems}`} color="error" />
              </Stack>

              {operationResult.errors.length > 0 && (
                <Alert severity="error">
                  {operationResult.errors.slice(0, 5).map((err, idx) => (
                    <div key={idx}>Item {err.itemId || err.index + 1}: {err.error}</div>
                  ))}
                </Alert>
              )}

              {operationResult.warnings.length > 0 && (
                <Alert severity="warning">
                  {operationResult.warnings.slice(0, 3).map((warn, idx) => (
                    <div key={idx}>{warn}</div>
                  ))}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportReport} startIcon={<Download />}>
            Export Report
          </Button>
          <Button onClick={() => setResultDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
