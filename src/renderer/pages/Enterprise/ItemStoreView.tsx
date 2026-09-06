import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, Grid, Chip,
  Alert, Button, Stack, Autocomplete, InputAdornment, Tooltip, Skeleton,
} from '@mui/material';
import { Warehouse, Inventory, Warning, CheckCircle, ArrowBack, Search, Info } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { GuideButton } from '../../components/GuideSystem';
import EmptyState from '../../components/EmptyState';

interface ItemOption { id: number; itemName: string; itemCode: string; }

interface StoreStock {
  storeId: number; storeName: string; storeType: string;
  available: number; installed: number; damaged: number; repair: number;
  transit: number; scrap: number; lost: number; total: number; consumed: number;
  received: number;
}

export default function ItemStoreView() {
  const navigate = useNavigate();
  const { company, financialYear } = useCompany();
  const companyId = company?.id || 1;
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const fyId = financialYear?.id || 0;

  const { data: items = [] } = useQuery<ItemOption[]>({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', { where: { isActive: true }, orderBy: { itemName: 'asc' } }),
  });

  const { data: stockData = [], isLoading } = useQuery<StoreStock[]>({
    queryKey: ['itemStockAcrossStores', companyId, fyId, selectedItem?.id],
    queryFn: () => window.electronAPI.getItemStockAcrossStores(companyId, fyId, selectedItem!.id),
    enabled: !!companyId && !!fyId && !!selectedItem,
  });

  const getStoreTypeColor = (type: string) => {
    switch (type) {
      case 'MAIN_STORE': return 'primary';
      case 'DEPARTMENT_STORE': return 'secondary';
      case 'DHARMSHALA_STORE': return 'success';
      default: return 'default';
    }
  };

  const getTotalStatus = (stock: StoreStock) => {
    if (stock.available === 0 && stock.installed === 0) return { color: 'error', label: 'No Stock' };
    if (stock.damaged > 0 || stock.lost > 0) return { color: 'warning', label: 'Issues' };
    return { color: 'success', label: 'Good' };
  };

  const grandTotal = stockData.reduce((sum, s) => sum + s.total, 0);
  const grandAvailable = stockData.reduce((sum, s) => sum + s.available, 0);
  const grandInstalled = stockData.reduce((sum, s) => sum + s.installed, 0);
  const grandDamaged = stockData.reduce((sum, s) => sum + s.damaged, 0);
  const grandConsumed = stockData.reduce((sum, s) => sum + s.consumed, 0);
  const grandReceived = stockData.reduce((sum, s) => sum + s.received, 0);

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/enterprise/stock')}>Back</Button>
          <Typography variant="h4" fontWeight={600}>Item → Store View</Typography>
        </Box>
        <GuideButton pageId="item-store-view" />
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        See which stores carry a specific item and their stock breakdown across all states.
      </Alert>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Autocomplete
              options={items}
              getOptionLabel={(o) => `${o.itemCode} - ${o.itemName}`}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={selectedItem}
              onChange={(_, v) => setSelectedItem(v)}
              renderInput={(params) => (
                <TextField {...params} label="Search item..." placeholder="Type to search..." size="small"
                  InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
              )}
              sx={{ minWidth: 350 }}
              size="small"
            />
          </Stack>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ p: 3 }}>
          <Stack spacing={1}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={40} sx={{ borderRadius: '8px' }} />
            ))}
          </Stack>
        </Box>
      ) : stockData.length > 0 ? (
        <>
          <Card sx={{ mb: 2, bgcolor: '#f8fafc' }}>
            <CardContent sx={{ py: '12px !important' }}>
              <Grid container spacing={2}>
                <Grid item xs={2}>
                  <Typography variant="body2" color="textSecondary">Total</Typography>
                  <Typography variant="h5" fontWeight={600}>{grandTotal}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="body2" color="textSecondary">Received</Typography>
                  <Typography variant="h5" fontWeight={600} color="primary.main">{grandReceived}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="body2" color="textSecondary">Available</Typography>
                  <Typography variant="h5" fontWeight={600} color="success.main">{grandAvailable}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="body2" color="textSecondary">Installed</Typography>
                  <Typography variant="h5" fontWeight={600} color="info.main">{grandInstalled}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="body2" color="textSecondary">Damaged</Typography>
                  <Typography variant="h5" fontWeight={600} color="error.main">{grandDamaged}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="body2" color="textSecondary">Consumed</Typography>
                  <Typography variant="h5" fontWeight={600} color="warning.main">{grandConsumed}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Store</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Total quantity received (Purchases + Opening + Transfers)">
                      <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
                        <Typography variant="body2" fontWeight={600}>Received</Typography>
                        <Info fontSize="small" sx={{ fontSize: 14, color: 'text.secondary' }} />
                      </Stack>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell align="right">Installed</TableCell>
                  <TableCell align="right">Damaged</TableCell>
                  <TableCell align="right">Repair</TableCell>
                  <TableCell align="right">Scrap</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Consumed</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockData.map((store) => {
                  const status = getTotalStatus(store);
                  return (
                    <TableRow key={store.storeId} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Warehouse fontSize="small" />
                          <Typography variant="body2" fontWeight={500}>{store.storeName}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell><Chip label={store.storeType.replace('_', ' ')} color={getStoreTypeColor(store.storeType) as any} size="small" /></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500} color="primary.main">{store.received}</Typography>
                      </TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={500}>{store.available}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2">{store.installed}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={store.damaged > 0 ? 'error.main' : 'inherit'} fontWeight={store.damaged > 0 ? 600 : 400}>{store.damaged}</Typography>
                      </TableCell>
                      <TableCell align="right"><Typography variant="body2">{store.repair}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2">{store.scrap}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={700}>{store.total}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={store.consumed > 0 ? 'warning.main' : 'inherit'} fontWeight={store.consumed > 0 ? 600 : 400}>
                          {store.consumed}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip icon={status.color === 'error' ? <Warning /> : status.color === 'success' ? <CheckCircle /> : undefined}
                          label={status.label} color={status.color as any} size="small" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : selectedItem ? (
        <Alert severity="info">No stock data found for this item across any store.</Alert>
      ) : (
        <Alert severity="info">Select an item to see its stock across all stores.</Alert>
      )}
    </Box>
  );
}
