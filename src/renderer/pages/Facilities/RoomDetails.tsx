import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Autocomplete, TextField, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Chip, Card, CardContent, alpha, useTheme, Skeleton,
  IconButton, Tooltip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  Hotel, Build, History, Inventory, Warning, CheckCircle, TrendingUp,
  Search, ArrowBack, MeetingRoom, HomeWork, SwapHoriz,
} from '@mui/icons-material';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

const COLORS = {
  primary: '#2563EB',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0EA5E9',
  muted: '#64748B',
};

interface RoomSummary {
  room: any;
  totalIssued: number;
  damaged: number;
  current: number;
  uniqueItems: number;
  installations: number;
}

export default function RoomDetails() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [searchText, setSearchText] = useState('');

  const { data: buildings, isLoading: buildingsLoading } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', {
      where: { locationType: 'Dharamshala', isActive: true },
      orderBy: { locationName: 'asc' },
    }),
  });

  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', selectedBuilding?.id],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', {
      where: { parentId: selectedBuilding.id, locationType: 'Room', isActive: true },
      orderBy: { locationName: 'asc' },
    }),
    enabled: !!selectedBuilding?.id,
  });

  const roomIds = useMemo(() => (rooms || []).map((r: any) => r.id), [rooms]);

  const { data: allBuildingIssues, isLoading: buildingIssuesLoading } = useQuery({
    queryKey: ['buildingIssues', selectedBuilding?.id],
    queryFn: () => window.electronAPI.dbQuery('issueChallanItem', 'findMany', {
      where: { locationId: { in: roomIds } },
      include: {
        item: { include: { category: true, unit: true } },
        issueChallan: true,
      },
    }),
    enabled: !!selectedBuilding?.id && roomIds.length > 0 && !selectedRoom,
  });

  const { data: allBuildingDamages, isLoading: buildingDamagesLoading } = useQuery({
    queryKey: ['buildingDamages', selectedBuilding?.id],
    queryFn: () => window.electronAPI.dbQuery('damageEntry', 'findMany', {
      where: { locationId: { in: roomIds } },
      include: { item: true },
    }),
    enabled: !!selectedBuilding?.id && roomIds.length > 0 && !selectedRoom,
  });

  const { data: allBuildingInstallations, isLoading: buildingInstallationsLoading } = useQuery({
    queryKey: ['buildingInstallations', selectedBuilding?.id],
    queryFn: () => window.electronAPI.dbQuery('assetInstallation', 'findMany', {
      where: { locationId: { in: roomIds }, status: 'Active' },
      include: { item: true },
    }),
    enabled: !!selectedBuilding?.id && roomIds.length > 0 && !selectedRoom,
  });

  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ['roomIssues', selectedRoom?.id],
    queryFn: () => window.electronAPI.dbQuery('issueChallanItem', 'findMany', {
      where: { locationId: selectedRoom.id },
      include: { item: { include: { category: true, unit: true } }, issueChallan: true },
      orderBy: { issueChallan: { date: 'desc' } },
    }),
    enabled: !!selectedRoom?.id,
  });

  const { data: damages, isLoading: damagesLoading } = useQuery({
    queryKey: ['roomDamages', selectedRoom?.id],
    queryFn: () => window.electronAPI.dbQuery('damageEntry', 'findMany', {
      where: { locationId: selectedRoom.id },
      include: { item: true },
      orderBy: { date: 'desc' },
    }),
    enabled: !!selectedRoom?.id,
  });

  const { data: installations, isLoading: installationsLoading } = useQuery({
    queryKey: ['roomInstallations', selectedRoom?.id],
    queryFn: () => window.electronAPI.dbQuery('assetInstallation', 'findMany', {
      where: { locationId: selectedRoom.id, status: 'Active' },
      include: { item: true },
      orderBy: { installedDate: 'desc' },
    }),
    enabled: !!selectedRoom?.id,
  });

  const { data: allBuildingTransfersOut, isLoading: buildingTransfersOutLoading } = useQuery({
    queryKey: ['buildingTransfersOut', selectedBuilding?.id],
    queryFn: () => window.electronAPI.dbQuery('transferChallanItem', 'findMany', {
      where: { locationId: { in: roomIds } },
      include: {
        item: { include: { category: true, unit: true } },
        transferChallan: true,
        location: true,
        toLocation: true,
      },
    }),
    enabled: !!selectedBuilding?.id && roomIds.length > 0 && !selectedRoom,
  });

  const { data: allBuildingTransfersIn, isLoading: buildingTransfersInLoading } = useQuery({
    queryKey: ['buildingTransfersIn', selectedBuilding?.id],
    queryFn: () => window.electronAPI.dbQuery('transferChallanItem', 'findMany', {
      where: { toLocationId: { in: roomIds } },
      include: {
        item: { include: { category: true, unit: true } },
        transferChallan: true,
        location: true,
        toLocation: true,
      },
    }),
    enabled: !!selectedBuilding?.id && roomIds.length > 0 && !selectedRoom,
  });

  const { data: transfersOut, isLoading: transfersOutLoading } = useQuery({
    queryKey: ['roomTransfersOut', selectedRoom?.id],
    queryFn: () => window.electronAPI.dbQuery('transferChallanItem', 'findMany', {
      where: { locationId: selectedRoom.id },
      include: { item: { include: { category: true, unit: true } }, transferChallan: true, location: true, toLocation: true },
      orderBy: { transferChallan: { date: 'desc' } },
    }),
    enabled: !!selectedRoom?.id,
  });

  const { data: transfersIn, isLoading: transfersInLoading } = useQuery({
    queryKey: ['roomTransfersIn', selectedRoom?.id],
    queryFn: () => window.electronAPI.dbQuery('transferChallanItem', 'findMany', {
      where: { toLocationId: selectedRoom.id },
      include: { item: { include: { category: true, unit: true } }, transferChallan: true, location: true, toLocation: true },
      orderBy: { transferChallan: { date: 'desc' } },
    }),
    enabled: !!selectedRoom?.id,
  });

  // ---- Building Overview: per-room stock summary ----
  const buildingOverview = useMemo((): RoomSummary[] => {
    if (!rooms || !allBuildingIssues) return [];

    const damageMap = new Map<number, number>();
    (allBuildingDamages || []).forEach((d: any) => {
      if (d.status !== 'Posted') return;
      damageMap.set(d.locationId, (damageMap.get(d.locationId) || 0) + Number(d.quantity));
    });

    const installMap = new Map<number, number>();
    (allBuildingInstallations || []).forEach((ai: any) => {
      installMap.set(ai.locationId, (installMap.get(ai.locationId) || 0) + 1);
    });

    const roomStats = new Map<number, { issued: number; damaged: number; uniqueItems: Set<number> }>();
    (allBuildingIssues || []).forEach((i: any) => {
      if (i.issueChallan?.status !== 'Posted') return;
      const lid = i.locationId;
      if (!roomStats.has(lid)) {
        roomStats.set(lid, { issued: 0, damaged: damageMap.get(lid) || 0, uniqueItems: new Set() });
      }
      const s = roomStats.get(lid)!;
      s.issued += Number(i.quantity);
      s.uniqueItems.add(i.itemId);
    });

    (allBuildingTransfersOut || []).forEach((t: any) => {
      if (t.transferChallan?.status !== 'Posted') return;
      const lid = t.locationId;
      if (!lid) return;
      if (!roomStats.has(lid)) {
        roomStats.set(lid, { issued: 0, damaged: damageMap.get(lid) || 0, uniqueItems: new Set() });
      }
      const s = roomStats.get(lid)!;
      s.issued -= Number(t.quantity);
      s.uniqueItems.add(t.itemId);
    });

    (allBuildingTransfersIn || []).forEach((t: any) => {
      if (t.transferChallan?.status !== 'Posted') return;
      const lid = t.toLocationId;
      if (!lid) return;
      if (!roomStats.has(lid)) {
        roomStats.set(lid, { issued: 0, damaged: damageMap.get(lid) || 0, uniqueItems: new Set() });
      }
      const s = roomStats.get(lid)!;
      s.issued += Number(t.quantity);
      s.uniqueItems.add(t.itemId);
    });

    return (rooms || []).map((room: any) => {
      const s = roomStats.get(room.id);
      const issued = s?.issued || 0;
      const damaged = s?.damaged || damageMap.get(room.id) || 0;
      return {
        room,
        totalIssued: issued,
        damaged,
        current: issued - damaged,
        uniqueItems: s?.uniqueItems.size || 0,
        installations: installMap.get(room.id) || 0,
      };
    });
  }, [rooms, allBuildingIssues, allBuildingDamages, allBuildingInstallations, allBuildingTransfersOut, allBuildingTransfersIn]);

  const filteredBuildingOverview = useMemo(() => {
    if (!searchText) return buildingOverview;
    const q = searchText.toLowerCase();
    return buildingOverview.filter(r =>
      r.room.locationName.toLowerCase().includes(q) ||
      (r.room.floor || '').toLowerCase().includes(q) ||
      (r.room.category || '').toLowerCase().includes(q)
    );
  }, [buildingOverview, searchText]);

  const buildingStats = useMemo(() => {
    const totalRooms = buildingOverview.length;
    const occupiedRooms = buildingOverview.filter(r => r.current > 0).length;
    const totalItems = buildingOverview.reduce((s, r) => s + r.totalIssued, 0);
    const totalDamaged = buildingOverview.reduce((s, r) => s + r.damaged, 0);
    const totalCurrent = buildingOverview.reduce((s, r) => s + r.current, 0);
    const totalSKUs = new Set(buildingOverview.flatMap(r => {
      const items = (allBuildingIssues || []).filter((i: any) => i.locationId === r.room.id && i.issueChallan?.status === 'Posted');
      return items.map((i: any) => i.itemId);
    })).size;
    return { totalRooms, occupiedRooms, totalItems, totalDamaged, totalCurrent, totalSKUs };
  }, [buildingOverview, allBuildingIssues]);

  // ---- Room Detail: inventory summary ----
  const inventorySummary = useMemo(() => {
    if (!issues) return [];
    const map = new Map<number, any>();

    issues.forEach((i: any) => {
      if (i.issueChallan?.status !== 'Posted') return;
      const key = i.itemId;
      if (!map.has(key)) {
        map.set(key, {
          itemId: i.itemId,
          itemCode: i.item.itemCode,
          itemName: i.item.itemName,
          category: i.item.category?.name || 'Uncategorized',
          unit: i.item.unit?.name || '-',
          issued: 0,
          damaged: 0,
          transferredIn: 0,
          transferredOut: 0,
        });
      }
      map.get(key).issued += Number(i.quantity);
    });

    (transfersIn || []).forEach((t: any) => {
      if (t.transferChallan?.status !== 'Posted') return;
      const key = t.itemId;
      if (!map.has(key)) {
        map.set(key, {
          itemId: t.itemId,
          itemCode: t.item.itemCode,
          itemName: t.item.itemName,
          category: t.item.category?.name || 'Uncategorized',
          unit: t.item.unit?.name || '-',
          issued: 0,
          damaged: 0,
          transferredIn: 0,
          transferredOut: 0,
        });
      }
      map.get(key).transferredIn += Number(t.quantity);
    });

    (transfersOut || []).forEach((t: any) => {
      if (t.transferChallan?.status !== 'Posted') return;
      const key = t.itemId;
      if (!map.has(key)) {
        map.set(key, {
          itemId: t.itemId,
          itemCode: t.item.itemCode,
          itemName: t.item.itemName,
          category: t.item.category?.name || 'Uncategorized',
          unit: t.item.unit?.name || '-',
          issued: 0,
          damaged: 0,
          transferredIn: 0,
          transferredOut: 0,
        });
      }
      map.get(key).transferredOut += Number(t.quantity);
    });

    if (damages) {
      damages.forEach((d: any) => {
        if (d.status !== 'Posted') return;
        const key = d.itemId;
        if (map.has(key)) {
          map.get(key).damaged += Number(d.quantity);
        }
      });
    }

    const result = Array.from(map.values()).map((v: any) => ({
      ...v,
      current: v.issued + v.transferredIn - v.transferredOut - v.damaged,
    }));

    if (searchText) {
      const q = searchText.toLowerCase();
      return result.filter((r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.itemCode.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }

    return result;
  }, [issues, damages, transfersIn, transfersOut, searchText]);

  const summaryStats = useMemo(() => {
    const totalItems = inventorySummary.reduce((sum, i) => sum + i.issued, 0);
    const damagedItems = inventorySummary.reduce((sum, i) => sum + i.damaged, 0);
    const activeItems = totalItems - damagedItems;
    const uniqueSKUs = inventorySummary.length;
    return { totalItems, damagedItems, activeItems, uniqueSKUs };
  }, [inventorySummary]);

  const isLoading = issuesLoading || damagesLoading || installationsLoading || transfersOutLoading || transfersInLoading;
  const isBuildingOverviewLoading = buildingIssuesLoading || buildingDamagesLoading || buildingInstallationsLoading || buildingTransfersOutLoading || buildingTransfersInLoading;

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {selectedRoom && (
            <Tooltip title="Back to Building Overview">
              <IconButton onClick={() => { setSelectedRoom(null); setTabIndex(0); }} size="small">
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Hotel sx={{ fontSize: 28, color: COLORS.primary }} />
          <Box>
            <Typography variant="h4" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              {selectedRoom ? selectedRoom.locationName : 'Dharmshala Room Inventory'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedRoom
                ? `${selectedBuilding?.locationName} — Floor: ${selectedRoom.floor || 'N/A'} | Category: ${selectedRoom.category || 'N/A'}`
                : 'Track items issued to rooms across all Dharmshalas'
              }
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Selectors */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={selectedRoom ? 4 : 5}>
            <Autocomplete
              options={buildings || []}
              getOptionLabel={(o: any) => o.locationName}
              value={selectedBuilding}
              onChange={(_, v) => { setSelectedBuilding(v); setSelectedRoom(null); setTabIndex(0); setSearchText(''); }}
              renderInput={(params) => <TextField {...params} label="Select Dharmshala (Building)" size="small" />}
              loading={buildingsLoading}
            />
          </Grid>
          <Grid item xs={12} md={selectedRoom ? 4 : 5}>
            <Autocomplete
              options={rooms || []}
              getOptionLabel={(o: any) => o.locationName}
              value={selectedRoom}
              onChange={(_, v) => { setSelectedRoom(v); setTabIndex(0); }}
              disabled={!selectedBuilding}
              renderInput={(params) => <TextField {...params} label="Select Room (optional — or click a row below)" size="small" />}
              loading={roomsLoading}
            />
          </Grid>
          {selectedRoom && (
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1.5}>
                <Chip icon={<HomeWork sx={{ fontSize: 14 }} />} label={`Floor: ${selectedRoom.floor || 'N/A'}`} size="small" color="primary" variant="outlined" />
                <Chip icon={<MeetingRoom sx={{ fontSize: 14 }} />} label={`${selectedRoom.category || 'N/A'}`} size="small" variant="outlined" />
              </Stack>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* ==================== BUILDING OVERVIEW ==================== */}
      {selectedBuilding && !selectedRoom && (
        <>
          {/* Building Summary Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px -4px rgba(37,99,235,0.15)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    backgroundColor: alpha(COLORS.primary, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.primary,
                  }}>
                    <MeetingRoom sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.5625rem' }}>
                      Total Rooms
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                      {buildingStats.totalRooms}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px -4px rgba(22,163,74,0.15)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    backgroundColor: alpha(COLORS.success, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.success,
                  }}>
                    <CheckCircle sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.5625rem' }}>
                      Occupied Rooms
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, color: COLORS.success, letterSpacing: '-0.02em' }}>
                      {buildingStats.occupiedRooms}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px -4px rgba(14,165,233,0.15)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    backgroundColor: alpha(COLORS.info, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.info,
                  }}>
                    <Inventory sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.5625rem' }}>
                      Total Items
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, color: COLORS.info, letterSpacing: '-0.02em' }}>
                      {buildingStats.totalCurrent}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px -4px rgba(217,119,6,0.15)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    backgroundColor: alpha(COLORS.warning, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.warning,
                  }}>
                    <Warning sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.5625rem' }}>
                      Damaged Items
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, color: COLORS.warning, letterSpacing: '-0.02em' }}>
                      {buildingStats.totalDamaged}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* Rooms Table */}
          <Card sx={{ transition: 'all 200ms ease-out' }}>
            <CardContent sx={{ p: '14px 16px !important' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, fontSize: '1rem' }}>
                  All Rooms in {selectedBuilding.locationName}
                </Typography>
                <TextField
                  size="small"
                  placeholder="Search rooms by name, floor, category..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                  sx={{ maxWidth: 360 }}
                />
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, backgroundColor: alpha(COLORS.primary, 0.04) } }}>
                      <TableCell>Room Name</TableCell>
                      <TableCell>Floor</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="center">Unique Items</TableCell>
                      <TableCell align="right">Total Issued</TableCell>
                      <TableCell align="right">Damaged</TableCell>
                      <TableCell align="right">Current Stock</TableCell>
                      <TableCell align="center">Installations</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isBuildingOverviewLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((__, j) => (
                            <TableCell key={j}><Skeleton width={j < 3 ? 100 : 50} height={16} /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredBuildingOverview.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <Box sx={{ py: 6, textAlign: 'center' }}>
                            <MeetingRoom sx={{ fontSize: 40, color: '#CBD5E1', mb: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              {searchText ? 'No rooms match your search' : 'No rooms found in this Dharmshala'}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBuildingOverview.map((entry) => (
                        <TableRow
                          key={entry.room.id}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: alpha(COLORS.primary, 0.04) },
                          }}
                          onClick={() => { setSelectedRoom(entry.room); setTabIndex(0); }}
                        >
                          <TableCell>
                            <Typography fontWeight={500} sx={{ fontSize: '0.8125rem' }}>
                              {entry.room.locationName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={entry.room.floor || '-'} variant="outlined" sx={{ fontSize: '0.625rem' }} />
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={entry.room.category || '-'} variant="outlined" sx={{ fontSize: '0.625rem' }} />
                          </TableCell>
                          <TableCell align="center" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                            {entry.uniqueItems}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                            {entry.totalIssued || '-'}
                          </TableCell>
                          <TableCell align="right" sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.75rem',
                            color: entry.damaged > 0 ? COLORS.danger : 'text.secondary',
                            fontWeight: entry.damaged > 0 ? 600 : 400,
                          }}>
                            {entry.damaged > 0 ? `-${entry.damaged}` : '-'}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              fontWeight={700}
                              sx={{
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: '0.8125rem',
                                color: entry.current > 0 ? COLORS.success : entry.current === 0 ? COLORS.muted : COLORS.danger,
                              }}
                            >
                              {entry.current}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                            {entry.installations || '-'}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={entry.current > 0 ? 'Occupied' : entry.damaged > 0 ? 'Damaged Only' : 'Empty'}
                              color={entry.current > 0 ? 'success' : entry.damaged > 0 ? 'error' : 'default'}
                              sx={{ fontSize: '0.625rem' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* ==================== ROOM DETAIL VIEW ==================== */}
      {selectedRoom && (
        <>
          {/* Summary Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    backgroundColor: alpha(COLORS.primary, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.primary,
                  }}>
                    <Inventory sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.5625rem' }}>
                      Total Issued
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                      {summaryStats.totalItems}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    backgroundColor: alpha(COLORS.success, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.success,
                  }}>
                    <CheckCircle sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.5625rem' }}>
                      Active Items
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, color: COLORS.success, letterSpacing: '-0.02em' }}>
                      {summaryStats.activeItems}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    backgroundColor: alpha(COLORS.danger, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.danger,
                  }}>
                    <Warning sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.5625rem' }}>
                      Damaged
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, color: COLORS.danger, letterSpacing: '-0.02em' }}>
                      {summaryStats.damagedItems}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'all 200ms ease-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: 1.5,
                    backgroundColor: alpha(COLORS.info, 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: COLORS.info,
                  }}>
                    <TrendingUp sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.625rem' }}>
                      Unique SKUs
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                      {summaryStats.uniqueSKUs}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* Tabs */}
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ px: 2 }}>
                <Tab icon={<Inventory sx={{ fontSize: 18 }} />} iconPosition="start" label="Current Inventory" />
                <Tab icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" label="Issue History" />
                <Tab icon={<SwapHoriz sx={{ fontSize: 18 }} />} iconPosition="start" label="Transfers" />
                <Tab icon={<Warning sx={{ fontSize: 18 }} />} iconPosition="start" label="Damage/Replacement" />
                <Tab icon={<Build sx={{ fontSize: 18 }} />} iconPosition="start" label="Installations" />
              </Tabs>
            </Box>
            <CardContent sx={{ p: '16px !important' }}>
              {/* Search Bar */}
              {tabIndex === 0 && (
                <TextField
                  size="small"
                  placeholder="Search items by name, code, or category..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                  }}
                  sx={{ mb: 2, maxWidth: 400 }}
                />
              )}

              {/* Tab 0: Current Inventory */}
              {tabIndex === 0 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item Code</TableCell>
                        <TableCell>Item Name</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">Issued</TableCell>
                        <TableCell align="right">Damaged</TableCell>
                        <TableCell align="right">Current</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 7 }).map((__, j) => (
                              <TableCell key={j}><Skeleton width={j < 4 ? 80 : 40} height={16} /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : inventorySummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                              <Inventory sx={{ fontSize: 40, color: '#CBD5E1', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">
                                {searchText ? 'No items match your search' : 'No items issued to this room yet'}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        inventorySummary.map((item, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>
                              <Chip label={item.itemCode} size="small" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6875rem' }} />
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight={500}>{item.itemName}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={item.category} variant="outlined" sx={{ fontSize: '0.625rem' }} />
                            </TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                              {item.issued}
                            </TableCell>
                            <TableCell align="right" sx={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '0.75rem',
                              color: item.damaged > 0 ? COLORS.danger : 'text.secondary',
                              fontWeight: item.damaged > 0 ? 600 : 400,
                            }}>
                              {item.damaged > 0 ? `-${item.damaged}` : '-'}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                fontWeight={700}
                                sx={{
                                  fontFamily: '"JetBrains Mono", monospace',
                                  fontSize: '0.8125rem',
                                  color: item.current > 0 ? COLORS.success : item.current === 0 ? COLORS.muted : COLORS.danger,
                                }}
                              >
                                {item.current}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 1: Issue History */}
              {tabIndex === 1 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Challan No</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Purpose / Used At</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 7 }).map((__, j) => (
                              <TableCell key={j}><Skeleton width={j < 5 ? 80 : 50} height={16} /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (!issues || issues.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                              <History sx={{ fontSize: 40, color: '#CBD5E1', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">No issue records found</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        issues.filter((issue: any) => issue.issueChallan?.status === 'Posted').map((issue: any) => (
                          <TableRow key={issue.id} hover>
                            <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                              {formatDateDDMMYYYY(issue.issueChallan.date)}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={issue.issueChallan.challanNo} color="primary" variant="outlined" sx={{ fontSize: '0.625rem' }} />
                            </TableCell>
                            <TableCell>{issue.item.itemName}</TableCell>
                            <TableCell>{issue.item.category?.name || '-'}</TableCell>
                            <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                              {issue.quantity}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={issue.issueChallan.status}
                                color={issue.issueChallan.status === 'Posted' ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{issue.purpose || issue.usedAt || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 2: Transfers */}
              {tabIndex === 2 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Challan No</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Direction</TableCell>
                        <TableCell>Room</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 8 }).map((__, j) => (
                              <TableCell key={j}><Skeleton width={j < 4 ? 80 : 50} height={16} /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : ((!transfersIn || transfersIn.length === 0) && (!transfersOut || transfersOut.length === 0)) ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                              <SwapHoriz sx={{ fontSize: 40, color: '#CBD5E1', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">No transfer records found for this room</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        [
                          ...(transfersIn || []).map((t: any) => ({ ...t, direction: 'In', room: t.location?.locationName || '-' })),
                          ...(transfersOut || []).map((t: any) => ({ ...t, direction: 'Out', room: t.toLocation?.locationName || '-' })),
                        ].filter((t: any) => t.transferChallan?.status === 'Posted').sort((a: any, b: any) => new Date(b.transferChallan?.date || 0).getTime() - new Date(a.transferChallan?.date || 0).getTime())
                        .map((t: any, idx: number) => (
                          <TableRow key={idx} hover>
                            <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                              {formatDateDDMMYYYY(t.transferChallan?.date)}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={t.transferChallan?.challanNo || '-'} color="primary" variant="outlined" sx={{ fontSize: '0.625rem' }} />
                            </TableCell>
                            <TableCell>{t.item?.itemName || '-'}</TableCell>
                            <TableCell>{t.item?.category?.name || '-'}</TableCell>
                            <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 600, color: t.direction === 'In' ? COLORS.success : COLORS.danger }}>
                              {t.direction === 'In' ? '+' : '-'}{t.quantity}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={t.direction} color={t.direction === 'In' ? 'success' : 'warning'} sx={{ fontSize: '0.625rem' }} />
                            </TableCell>
                            <TableCell>{t.room}</TableCell>
                            <TableCell>
                              <Chip size="small" label={t.transferChallan?.status} color={t.transferChallan?.status === 'Posted' ? 'success' : 'default'} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 3: Damage/Replacement */}
              {tabIndex === 3 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Reported By</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 6 }).map((__, j) => (
                              <TableCell key={j}><Skeleton width={j < 4 ? 80 : 50} height={16} /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (!damages || damages.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                              <CheckCircle sx={{ fontSize: 40, color: alpha(COLORS.success, 0.3), mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">No damage records found — room is in good condition</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        damages.map((dmg: any) => (
                          <TableRow key={dmg.id} hover>
                            <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                              {formatDateDDMMYYYY(dmg.date)}
                            </TableCell>
                            <TableCell>{dmg.item.itemName}</TableCell>
                            <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: COLORS.danger, fontWeight: 600 }}>
                              {dmg.quantity}
                            </TableCell>
                            <TableCell>{dmg.reason}</TableCell>
                            <TableCell>{dmg.reportedBy}</TableCell>
                            <TableCell>
                              <Chip size="small" label={dmg.status} color={dmg.status === 'Posted' ? 'error' : 'default'} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 4: Installations */}
              {tabIndex === 4 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Installed Date</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Installed By</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 6 }).map((__, j) => (
                              <TableCell key={j}><Skeleton width={j < 4 ? 80 : 50} height={16} /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (!installations || installations.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                              <Build sx={{ fontSize: 40, color: '#CBD5E1', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">No installations recorded for this room</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        installations.map((inst: any) => (
                          <TableRow key={inst.id} hover>
                            <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem' }}>
                              {formatDateDDMMYYYY(inst.installedDate)}
                            </TableCell>
                            <TableCell>{inst.item.itemName}</TableCell>
                            <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                              {inst.quantity}
                            </TableCell>
                            <TableCell>{inst.installedBy || '-'}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={inst.status}
                                color={inst.status === 'Active' ? 'success' : inst.status === 'Removed' ? 'error' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{inst.remarks || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ==================== EMPTY STATE ==================== */}
      {!selectedBuilding && (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <Hotel sx={{ fontSize: 56, color: '#CBD5E1', mb: 2 }} />
          <Typography variant="h6" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
            Select a Dharmshala
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose a building from the dropdown above to view all rooms and their inventory
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
