import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, Grid, Chip,
  Button, TablePagination, Stack, InputAdornment, TableFooter, Tooltip,
  Skeleton,
} from '@mui/material';
import { Inventory, Warehouse, Warning, CheckCircle, LocationOn, Search, Info } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { GuideButton } from '../../components/GuideSystem';
import EmptyState from '../../components/EmptyState';

interface StoreOption { id: number; name: string; storeType: string; }

interface StockItem {
  itemId: number; itemName: string; itemCode: string; storeId: number; storeName: string;
  available: number; installed: number; damaged: number; repair: number;
  scrap: number; total: number; consumed: number; received: number;
  unitName: string; minimumStockLevel: number; totalValue: number;
}

export default function StoreStockPage() {
  const navigate = useNavigate();
  const { company, financialYear } = useCompany();
  const companyId = company?.id || 1;
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [itemSearch, setItemSearch] = useState('');
  const fyId = financialYear?.id || 0;

  const { data: stores = [] } = useQuery<StoreOption[]>({
    queryKey: ['stores', companyId],
    queryFn: () => window.electronAPI.listStores(companyId),
    enabled: !!companyId,
  });

  const effectiveStoreId = selectedStoreId || (stores.length > 0 ? stores[0].id : null);

  const { data: stockData = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ['storeStock', companyId, fyId, effectiveStoreId],
    queryFn: () => window.electronAPI.getStoreStock(companyId, fyId, effectiveStoreId!),
    enabled: !!companyId && !!fyId && !!effectiveStoreId,
  });

  const filtered = useMemo(() => {
    if (!itemSearch) return stockData;
    const q = itemSearch.toLowerCase();
    return stockData.filter(i => i.itemName.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q));
  }, [stockData, itemSearch]);

  const summary = useMemo(() => {
    const s = { available: 0, installed: 0, damaged: 0, scrap: 0, total: 0, consumed: 0, received: 0, value: 0 };
    for (const item of filtered) {
      s.available += item.available;
      s.installed += item.installed;
      s.damaged += item.damaged;
      s.scrap += item.scrap;
      s.total += item.total;
      s.consumed += item.consumed;
      s.received += item.received;
      s.value += item.totalValue;
    }
    return s;
  }, [filtered]);

  const getStockStatus = (item: StockItem) => {
    if (item.available === 0) return { color: 'error', label: 'Out of Stock' };
    if (item.available <= item.minimumStockLevel) return { color: 'warning', label: 'Low Stock' };
    return { color: 'success', label: 'In Stock' };
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight={600}>Store Stock</Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<Inventory />} onClick={() => navigate('/enterprise/item-stores')}>Item → Store</Button>
          <Button variant="outlined" startIcon={<LocationOn />} onClick={() => navigate('/enterprise/location-items')}>Location → Item</Button>
          <GuideButton pageId="store-stock" />
        </Box>
      </Box>

      {/* Store selector chips */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mr: 1 }}>Store:</Typography>
            {stores.map(s => (
              <Chip
                key={s.id}
                icon={<Warehouse sx={{ fontSize: 14 }} />}
                label={s.name}
                onClick={() => setSelectedStoreId(s.id)}
                color={effectiveStoreId === s.id ? 'primary' : 'default'}
                variant={effectiveStoreId === s.id ? 'filled' : 'outlined'}
                size="small"
                sx={{ fontWeight: effectiveStoreId === s.id ? 600 : 400 }}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {stockData.length > 0 && (
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={2}>
            <Card sx={{ bgcolor: '#f0fdf4' }}>
              <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Available</Typography>
                <Typography variant="h6" fontWeight={700} color="success.main">{summary.available}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={2}>
            <Card sx={{ bgcolor: '#eff6ff' }}>
              <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Installed</Typography>
                <Typography variant="h6" fontWeight={700} color="info.main">{summary.installed}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={2}>
            <Card sx={{ bgcolor: '#fef2f2' }}>
              <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Damaged</Typography>
                <Typography variant="h6" fontWeight={700} color="error.main">{summary.damaged}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={2}>
            <Card sx={{ bgcolor: '#fff7ed' }}>
              <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Consumed</Typography>
                <Typography variant="h6" fontWeight={700} color="warning.main">{summary.consumed}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={2}>
            <Card sx={{ bgcolor: '#f0f9ff' }}>
              <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Received</Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main">{summary.received}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={2}>
            <Card sx={{ bgcolor: '#f8fafc' }}>
              <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Value</Typography>
                <Typography variant="h6" fontWeight={700}>₹{summary.value.toLocaleString('en-IN')}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {isLoading ? (
        <Box sx={{ p: 3 }}>
          <Stack spacing={1}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={40} sx={{ borderRadius: '8px' }} />
            ))}
          </Stack>
        </Box>
      ) : stockData.length === 0 ? (
        <EmptyState
          icon={<Inventory />}
          title="No stock data"
          description={effectiveStoreId ? "This store has no stock records yet." : "Select a store to view stock."}
        />
      ) : (
        <>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
            <TextField
              placeholder="Search items by name or code..."
              value={itemSearch}
              onChange={(e) => { setItemSearch(e.target.value); setPage(0); }}
              size="small"
              sx={{ width: 300 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            />
            <Typography variant="body2" color="text.secondary">{filtered.length} items</Typography>
          </Stack>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: '#f8fafc' } }}>
                  <TableCell>Item</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Unit</TableCell>
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
                  <TableCell align="right">Scrap</TableCell>
                  <TableCell align="right">Total Stock</TableCell>
                  <TableCell align="right">Consumed</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell align="right">Min</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(page * 20, page * 20 + 20).map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <TableRow key={item.itemId} hover sx={{ '& td': { py: '6px' } }}>
                      <TableCell><Typography variant="body2" fontWeight={500}>{item.itemName}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{item.itemCode}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{item.unitName || '-'}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500} color="primary.main">{item.received}</Typography>
                      </TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={500}>{item.available}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2">{item.installed}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={item.damaged > 0 ? 'error.main' : 'inherit'} fontWeight={item.damaged > 0 ? 600 : 400}>
                          {item.damaged}
                        </Typography>
                      </TableCell>
                      <TableCell align="right"><Typography variant="body2">{item.scrap}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700}>{item.total}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={item.consumed > 0 ? 'warning.main' : 'inherit'} fontWeight={item.consumed > 0 ? 600 : 400}>
                          {item.consumed}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{item.totalValue > 0 ? `₹${item.totalValue.toLocaleString('en-IN')}` : '-'}</Typography>
                      </TableCell>
                      <TableCell align="right"><Typography variant="body2" color="text.secondary">{item.minimumStockLevel}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          icon={status.color === 'error' ? <Warning sx={{ fontSize: 12 }} /> : status.color === 'success' ? <CheckCircle sx={{ fontSize: 12 }} /> : undefined}
                          label={status.label}
                          color={status.color as any}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      <Typography color="text.secondary" py={3}>No stock data for this store.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: '#f8fafc', py: '8px' } }}>
                    <TableCell colSpan={3}>TOTAL ({filtered.length} items)</TableCell>
                    <TableCell align="right">{summary.received}</TableCell>
                    <TableCell align="right">{summary.available}</TableCell>
                    <TableCell align="right">{summary.installed}</TableCell>
                    <TableCell align="right">{summary.damaged}</TableCell>
                    <TableCell align="right">{summary.scrap}</TableCell>
                    <TableCell align="right">{summary.total}</TableCell>
                    <TableCell align="right">{summary.consumed}</TableCell>
                    <TableCell align="right">₹{summary.value.toLocaleString('en-IN')}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
            <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={20} rowsPerPageOptions={[20]} />
          </TableContainer>
        </>
      )}
    </Box>
  );
}
