import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, Grid, Chip,
  Alert, Button, Stack, Autocomplete, InputAdornment, IconButton, Tooltip, Collapse,
  Skeleton,
} from '@mui/material';
import { Warehouse, LocationOn, Inventory, ExpandMore, ExpandLess, ArrowBack, Search, CheckCircle, Build, Warning } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { GuideButton } from '../../components/GuideSystem';
import EmptyState from '../../components/EmptyState';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';

interface LocationRoom {
  roomId: number; roomName: string; storeId: number; storeName: string; locationName: string;
  totalInstalled: number;
  items: Array<{
    itemId: number; itemName: string; itemCode: string; installedQty: number;
    condition: string; installedDate: Date; installedBy: string;
  }>;
}

interface StoreOption { id: number; name: string; storeType: string; }

export default function LocationItemView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set());
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [roomSearch, setRoomSearch] = useState('');

  const { data: stores = [] } = useQuery<StoreOption[]>({
    queryKey: ['stores', companyId],
    queryFn: () => window.electronAPI.listStores(companyId),
    enabled: !!companyId,
  });

  const { data: fyData } = useQuery({
    queryKey: ['financialYear', companyId],
    queryFn: () => window.electronAPI.dbQuery('financialYear', 'findMany', { where: { companyId, isClosed: false }, take: 1 }),
    enabled: !!companyId,
  });

  const fyId = fyData?.[0]?.id || 0;

  const { data: rooms = [], isLoading } = useQuery<LocationRoom[]>({
    queryKey: ['locationItems', companyId, fyId],
    queryFn: async () => {
      try {
        return await window.electronAPI.getAllLocationItems(companyId, fyId);
      } catch (err: any) {
        toast.error(getErrorMessage(err, 'Failed to load location items'));
        return [];
      }
    },
    enabled: !!companyId && !!fyId,
  });

  const toggleExpand = (roomId: number) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const filteredRooms = useMemo(() => {
    let result = selectedStore ? rooms.filter((r) => r.storeId === selectedStore.id) : rooms;
    if (roomSearch) {
      const q = roomSearch.toLowerCase();
      result = result.filter(r =>
        r.roomName.toLowerCase().includes(q) ||
        r.locationName?.toLowerCase().includes(q) ||
        r.items.some(i => i.itemName.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q))
      );
    }
    return result;
  }, [rooms, selectedStore, roomSearch]);

  const totalRooms = filteredRooms.length;
  const totalItems = filteredRooms.reduce((sum, r) => sum + r.items.length, 0);
  const totalInstalled = filteredRooms.reduce((sum, r) => sum + r.totalInstalled, 0);
  const uniqueStores = new Set(filteredRooms.map(r => r.storeId)).size;

  const getConditionColor = (condition: string) => {
    switch (condition?.toUpperCase()) {
      case 'GOOD': return 'success';
      case 'FAIR': return 'warning';
      case 'DAMAGED': return 'error';
      default: return 'default';
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition?.toUpperCase()) {
      case 'GOOD': return <CheckCircle sx={{ fontSize: 14 }} />;
      case 'FAIR': return <Build sx={{ fontSize: 14 }} />;
      case 'DAMAGED': return <Warning sx={{ fontSize: 14 }} />;
      default: return undefined;
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/enterprise/stock')}>Back</Button>
          <Typography variant="h4" fontWeight={600}>Location → Item View</Typography>
        </Box>
        <GuideButton pageId="location-item-view" />
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        See which items are installed at each room/location. Installed items are owned by the store, not the location.
      </Alert>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important' }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Autocomplete
              options={[{ id: 0, name: 'All Stores', storeType: '' } as StoreOption, ...stores.filter(s => s.storeType === 'DHARMSHALA_STORE' || s.storeType === 'DEPARTMENT_STORE')]}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={selectedStore}
              onChange={(_, v) => setSelectedStore(v?.id === 0 ? null : v)}
              renderInput={(params) => (
                <TextField {...params} label="Filter by store..." size="small"
                  InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><Warehouse fontSize="small" /></InputAdornment> }} />
              )}
              sx={{ minWidth: 250 }}
              size="small"
            />
            <TextField
              placeholder="Search rooms or items..."
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 250 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            />
            <Button size="small" onClick={() => setExpandedRooms(new Set(filteredRooms.map(r => r.roomId)))}>Expand All</Button>
            <Button size="small" onClick={() => setExpandedRooms(new Set())}>Collapse All</Button>
          </Stack>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ p: 3 }}>
          <Stack spacing={1}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={48} sx={{ borderRadius: '8px' }} />
            ))}
          </Stack>
        </Box>
      ) : (
        <>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={3}>
              <Card sx={{ bgcolor: '#f0f9ff' }}>
                <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Locations</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">{totalRooms}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={3}>
              <Card sx={{ bgcolor: '#f0fdf4' }}>
                <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Unique Items</Typography>
                  <Typography variant="h6" fontWeight={700} color="success.main">{totalItems}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={3}>
              <Card sx={{ bgcolor: '#eff6ff' }}>
                <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Total Installed</Typography>
                  <Typography variant="h6" fontWeight={700} color="info.main">{totalInstalled}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={3}>
              <Card sx={{ bgcolor: '#f5f3ff' }}>
                <CardContent sx={{ py: '10px !important', px: '12px !important', textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Stores</Typography>
                  <Typography variant="h6" fontWeight={700} color="secondary.main">{uniqueStores}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {filteredRooms.length === 0 ? (
            <EmptyState
              icon={<LocationOn />}
              title="No installed items"
              description="No items are installed at any location yet."
            />
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: '#f8fafc' } }}>
                    <TableCell width={40}></TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Store</TableCell>
                    <TableCell>Area</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Total Installed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRooms.map((room) => (
                    <React.Fragment key={room.roomId}>
                      <TableRow
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          bgcolor: expandedRooms.has(room.roomId) ? '#f8fafc' : 'inherit',
                        }}
                        onClick={() => toggleExpand(room.roomId)}
                      >
                        <TableCell>
                          <Tooltip title={expandedRooms.has(room.roomId) ? 'Collapse' : 'Expand'}>
                            <IconButton size="small">
                              {expandedRooms.has(room.roomId) ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <LocationOn fontSize="small" color="primary" />
                            <Typography variant="body2" fontWeight={500}>{room.roomName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Warehouse fontSize="small" />
                            <Typography variant="body2">{room.storeName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Typography variant="body2">{room.locationName || '—'}</Typography></TableCell>
                        <TableCell align="right">
                          <Chip label={room.items.length} size="small" sx={{ minWidth: 24 }} />
                        </TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={600}>{room.totalInstalled}</Typography></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0, border: 'none' }}>
                          <Collapse in={expandedRooms.has(room.roomId)}>
                            <Box sx={{ py: 1, pl: 6 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: '#f1f5f9' } }}>
                                    <TableCell>Item</TableCell>
                                    <TableCell>Code</TableCell>
                                    <TableCell align="right">Qty</TableCell>
                                    <TableCell>Condition</TableCell>
                                    <TableCell>Installed Date</TableCell>
                                    <TableCell>Installed By</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {room.items.map((item, idx) => (
                                    <TableRow key={`${room.roomId}-${item.itemId}-${idx}`} hover>
                                      <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                          <Inventory fontSize="small" />
                                          <Typography variant="body2">{item.itemName}</Typography>
                                        </Stack>
                                      </TableCell>
                                      <TableCell><Typography variant="body2">{item.itemCode}</Typography></TableCell>
                                      <TableCell align="right"><Typography variant="body2" fontWeight={500}>{item.installedQty}</Typography></TableCell>
                                      <TableCell>
                                        <Chip
                                          icon={getConditionIcon(item.condition)}
                                          label={item.condition}
                                          color={getConditionColor(item.condition) as any}
                                          size="small"
                                          sx={{ height: 20, fontSize: '0.7rem' }}
                                        />
                                      </TableCell>
                                      <TableCell><Typography variant="body2">{formatDateDDMMYYYY(new Date(item.installedDate))}</Typography></TableCell>
                                      <TableCell><Typography variant="body2">{item.installedBy}</Typography></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
}
