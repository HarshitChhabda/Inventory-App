import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Stack, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button,
  Chip, Card, CardContent, Skeleton, IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem,
  Breadcrumbs, Link, Tab, Tabs,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Hotel, MeetingRoom, Inventory, OpenInNew, Search, ArrowBack, Warehouse, Store as StoreIcon,
  Build, History, SwapHoriz, Add, ChevronRight, Inbox,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { GuideButton } from '../../components/GuideSystem';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  DS: 'Dharmshala Shift',
  DP: 'Department Shift',
  SH: 'Room Shift',
  IS: 'Installation',
  UN: 'Uninstallation',
  IC: 'Store Issue',
  TC: 'Store Transfer',
};

interface RoomSummary {
  room: any;
  totalInstalled: number;
  uniqueItems: number;
}

export default function RoomDetails() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [editDialog, setEditDialog] = useState<{ open: boolean; building: any }>({ open: false, building: null });
  const [selectedStoreId, setSelectedStoreId] = useState<number>(0);
  const [roomTab, setRoomTab] = useState(0);

  const getDescendantLocationIds = useCallback(async (rootId: number): Promise<number[]> => {
    const descendantIds: number[] = [];
    const visited = new Set<number>();
    let frontier = [rootId];

    while (frontier.length > 0) {
      const children: any[] = await window.electronAPI.dbQuery('location', 'findMany', {
        where: { parentId: { in: frontier }, isActive: true },
        select: { id: true },
      });

      const next: number[] = [];
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          descendantIds.push(child.id);
          next.push(child.id);
        }
      }
      frontier = next;
    }

    return descendantIds;
  }, []);

  const { data: buildings, isLoading: buildingsLoading } = useQuery({
    queryKey: ['buildings', company?.id],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', {
      where: { locationType: 'Dharamshala', isActive: true, store: { companyId: company?.id || 1 } },
      orderBy: { name: 'asc' },
      include: {
        store: { select: { id: true, name: true, storeType: true } },
        children: { select: { id: true } },
      },
    }),
    enabled: !!company?.id,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', company?.id],
    queryFn: () => window.electronAPI.listStores(company?.id || 1),
    enabled: !!company?.id,
  });

  const buildingIds = useMemo(() => (buildings || []).map((b: any) => b.id), [buildings]);

  const { data: buildingRooms } = useQuery({
    queryKey: ['buildingRoomCounts', buildingIds],
    queryFn: async () => {
      if (buildingIds.length === 0) return {};
      const counts: Record<number, number> = {};

      for (const buildingId of buildingIds) {
        const descendantIds = await getDescendantLocationIds(buildingId);
        if (descendantIds.length === 0) {
          counts[buildingId] = 0;
          continue;
        }
        const roomLocs: any[] = await window.electronAPI.dbQuery('location', 'findMany', {
          where: { id: { in: descendantIds }, locationType: 'Room', isActive: true },
          select: { id: true },
        });
        counts[buildingId] = roomLocs.length;
      }
      return counts;
    },
    enabled: buildingIds.length > 0,
  });

  const { data: roomLocations, isLoading: roomsLoading } = useQuery({
    queryKey: ['roomLocations', selectedBuilding?.id],
    queryFn: async () => {
      if (!selectedBuilding?.id) return [];
      const descendantIds = await getDescendantLocationIds(selectedBuilding.id);
      if (descendantIds.length === 0) return [];
      return window.electronAPI.dbQuery('location', 'findMany', {
        where: { id: { in: descendantIds }, locationType: 'Room', isActive: true },
        orderBy: { name: 'asc' },
      });
    },
    enabled: !!selectedBuilding?.id,
  });

  const roomLocationIds = useMemo(() => (roomLocations || []).map((r: any) => r.id), [roomLocations]);

  const { data: roomRecords } = useQuery({
    queryKey: ['roomRecords', roomLocationIds],
    queryFn: () => window.electronAPI.dbQuery('room', 'findMany', {
      where: { locationId: { in: roomLocationIds } },
      select: { id: true, locationId: true },
    }),
    enabled: roomLocationIds.length > 0,
  });

  const roomIds = useMemo(() => (roomRecords || []).map((r: any) => r.id), [roomRecords]);

  const { data: installations, isLoading: installationsLoading } = useQuery({
    queryKey: ['roomInstallations', roomIds],
    queryFn: () => window.electronAPI.dbQuery('assetInstallation', 'findMany', {
      where: { roomId: { in: roomIds }, status: 'ACTIVE' },
      include: { item: true, store: { select: { name: true } } },
    }),
    enabled: roomIds.length > 0,
  });

  // Movement history for selected room
  const selectedRoomRecord = useMemo(() => {
    if (!selectedRoom || !roomRecords) return null;
    return (roomRecords as any[]).find((r: any) => r.locationId === selectedRoom.id) || null;
  }, [selectedRoom, roomRecords]);

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['roomMovements', selectedRoomRecord?.id],
    queryFn: () => window.electronAPI.dbQuery('stockTransaction', 'findMany', {
      where: {
        OR: [
          { fromRoomId: selectedRoomRecord!.id },
          { toRoomId: selectedRoomRecord!.id },
        ],
      },
      include: { item: { select: { itemName: true, itemCode: true } } },
      orderBy: { transactionDate: 'desc' },
      take: 50,
    }),
    enabled: !!selectedRoomRecord?.id,
  });

  const updateStoreMutation = useMutation({
    mutationFn: async ({ locationId, storeId }: { locationId: number; storeId: number }) => {
      return window.electronAPI.updateLocation(locationId, { storeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['roomLocations'] });
      setEditDialog({ open: false, building: null });
      toast.success('Store updated successfully');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to update store'));
    },
  });

  const handleEditStore = useCallback((building: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDialog({ open: true, building });
    setSelectedStoreId(building.store?.id || 0);
  }, []);

  const handleSaveStore = useCallback(() => {
    if (!editDialog.building || !selectedStoreId) {
      toast.error('Please select a store');
      return;
    }
    updateStoreMutation.mutate({ locationId: editDialog.building.id, storeId: selectedStoreId });
  }, [editDialog.building, selectedStoreId, updateStoreMutation]);

  const buildingOverview = useMemo((): RoomSummary[] => {
    if (!roomLocations) return [];

    const locationToRoomId = new Map<number, number>();
    for (const rr of (roomRecords || []) as any[]) {
      locationToRoomId.set(rr.locationId, rr.id);
    }

    const installMap = new Map<number, { count: number; items: Set<number> }>();
    (installations || []).forEach((ai: any) => {
      if (!installMap.has(ai.roomId)) {
        installMap.set(ai.roomId, { count: 0, items: new Set() });
      }
      const stats = installMap.get(ai.roomId)!;
      stats.count += Number(ai.quantity || 1);
      stats.items.add(ai.itemId);
    });

    return roomLocations.map((roomLoc: any) => {
      const roomId = locationToRoomId.get(roomLoc.id);
      const stats = roomId != null ? installMap.get(roomId) : undefined;
      return {
        room: roomLoc,
        totalInstalled: stats?.count || 0,
        uniqueItems: stats?.items.size || 0,
      };
    });
  }, [roomLocations, roomRecords, installations]);

  const filteredBuildingOverview = useMemo(() => {
    if (!searchText) return buildingOverview;
    const q = searchText.toLowerCase();
    return buildingOverview.filter(r =>
      r.room.name.toLowerCase().includes(q) ||
      (r.room.floor || '').toLowerCase().includes(q)
    );
  }, [buildingOverview, searchText]);

  const buildingStats = useMemo(() => {
    const totalRooms = buildingOverview.length;
    const totalInstalled = buildingOverview.reduce((s, r) => s + r.totalInstalled, 0);
    const totalSKUs = new Set(
      (installations || []).map((ai: any) => ai.itemId)
    ).size;
    return { totalRooms, totalInstalled, totalSKUs };
  }, [buildingOverview, installations]);

  const selectedRoomInstallations = useMemo(() => {
    if (!selectedRoom || !installations || !roomRecords) return [];
    const roomRec = (roomRecords as any[]).find((r: any) => r.locationId === selectedRoom.id);
    if (!roomRec) return [];
    return installations.filter((ai: any) => ai.roomId === roomRec.id);
  }, [selectedRoom, installations, roomRecords]);

  const getDharamshalaStore = (building: any) => {
    const matchingStore = stores.find((s: any) =>
      s.name === building.name && s.storeType === 'DHARMSHALA_STORE'
    );
    return matchingStore || building.store;
  };

  // Breadcrumb builder
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; path?: string }[] = [{ label: 'Room Details', path: '/facilities/room-details' }];
    if (selectedBuilding) {
      crumbs.push({ label: selectedBuilding.name });
    }
    if (selectedRoom) {
      crumbs.push({ label: selectedRoom.name });
    }
    return crumbs;
  }, [selectedBuilding, selectedRoom]);

  return (
    <Box p={3}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<ChevronRight sx={{ fontSize: 14 }} />} sx={{ mb: 2 }}>
        {breadcrumbs.map((crumb, idx) => (
          crumb.path ? (
            <Link
              key={idx}
              component="button"
              variant="body2"
              onClick={() => {
                if (crumb.path === '/facilities/room-details') {
                  setSelectedBuilding(null);
                  setSelectedRoom(null);
                }
              }}
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                fontSize: '0.75rem',
                fontWeight: 500,
                '&:hover': { color: 'primary.main' },
                cursor: 'pointer',
              }}
            >
              {crumb.label}
            </Link>
          ) : (
            <Typography key={idx} variant="body2" sx={{
              color: 'text.primary', fontWeight: 600, fontSize: '0.75rem',
            }}>
              {crumb.label}
            </Typography>
          )
        ))}
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight={600}>
              {selectedBuilding ? selectedBuilding.name : 'Dharamshala Room Inventory'}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {selectedBuilding
                ? `${buildingStats.totalRooms} rooms | ${buildingStats.totalInstalled} installed items | ${buildingStats.totalSKUs} unique items`
                : 'Select a Dharamshala to view rooms and installed items'}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          {selectedBuilding && !selectedRoom && (
            <Button
              variant="outlined"
              startIcon={<SwapHoriz />}
              onClick={() => navigate('/inventory/ds/new')}
              size="small"
            >
              Room Shift
            </Button>
          )}
          <GuideButton pageId="room-details" />
        </Box>
      </Box>

      {!selectedBuilding ? (
        <Box>
          <Typography variant="h6" fontWeight={600} mb={2}>
            <Hotel sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} />
            Select Dharamshala
          </Typography>
          {buildingsLoading ? (
            <Grid container spacing={2}>
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={12} md={4} key={i}>
                  <Skeleton variant="rounded" height={100} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              {(buildings || []).map((building: any) => {
                const correctStore = getDharamshalaStore(building);
                const isStoreWrong = building.store?.id !== correctStore?.id;
                return (
                  <Grid item xs={12} md={4} key={building.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: isStoreWrong ? '2px solid' : '1px solid',
                        borderColor: isStoreWrong ? 'warning.main' : 'divider',
                        '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                      }}
                      onClick={() => setSelectedBuilding(building)}
                    >
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Hotel sx={{ fontSize: 24, color: 'primary.main' }} />
                          <Box flex={1}>
                            <Typography fontWeight={600}>{building.name}</Typography>
                            {building.store && (
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <StoreIcon sx={{ fontSize: 12, color: isStoreWrong ? 'warning.main' : 'text.secondary' }} />
                                <Typography
                                  variant="body2"
                                  color={isStoreWrong ? 'warning.main' : 'text.secondary'}
                                  sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/enterprise/stores?storeId=${building.store.id}`);
                                  }}
                                >
                                  {building.store.name}
                                </Typography>
                              </Stack>
                            )}
                            {isStoreWrong && (
                              <Typography variant="caption" color="warning.main" display="block">
                                Should be: {correctStore?.name || 'No store'}
                              </Typography>
                            )}
                          </Box>
                          <Stack alignItems="flex-end" spacing={0.5}>
                            {(buildingRooms?.[building.id] ?? 0) > 0 && (
                              <Chip label={`${buildingRooms?.[building.id] ?? 0} rooms`} size="small" variant="outlined" />
                            )}
                            <Tooltip title="Fix Store Assignment">
                              <IconButton
                                size="small"
                                onClick={(e) => handleEditStore(building, e)}
                                sx={{ color: isStoreWrong ? 'warning.main' : 'text.secondary' }}
                              >
                                <Build fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
              {(!buildings || buildings.length === 0) && (
                <Grid item xs={12}>
                  <EmptyState
                    icon={<Hotel />}
                    title="No Dharamshalas found"
                    description="Create Dharamshalas in the Departments & Dharamshalas page first."
                    action={{
                      label: 'Go to Departments',
                      onClick: () => navigate('/masters/departments'),
                    }}
                  />
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      ) : (
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Tooltip title="Back to building list">
              <IconButton onClick={() => { setSelectedBuilding(null); setSelectedRoom(null); setRoomTab(0); }} aria-label="Back to building list">
                <ArrowBack />
              </IconButton>
            </Tooltip>
            <TextField
              placeholder="Search rooms..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="small"
              sx={{ minWidth: 300 }}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
            {selectedBuilding.store && (
              <Chip
                icon={<Warehouse sx={{ fontSize: 16 }} />}
                label={selectedBuilding.store?.name || 'No Store'}
                variant="outlined"
                onClick={() => selectedBuilding.store?.id && navigate(`/enterprise/stores?storeId=${selectedBuilding.store.id}`)}
                sx={{ cursor: 'pointer' }}
              />
            )}
          </Box>

          {!selectedRoom ? (
            <>
              <Card sx={{ mb: 2, bgcolor: '#f8fafc' }}>
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">Total Rooms</Typography>
                      <Typography variant="h5" fontWeight={600}>{buildingStats.totalRooms}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">Total Installed</Typography>
                      <Typography variant="h5" fontWeight={600} color="primary.main">{buildingStats.totalInstalled}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">Unique Items</Typography>
                      <Typography variant="h5" fontWeight={600} color="info.main">{buildingStats.totalSKUs}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {roomsLoading || installationsLoading ? (
                <Box py={4}>
                  <Skeleton variant="rounded" height={300} />
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Room Name</TableCell>
                        <TableCell>Floor</TableCell>
                        <TableCell align="right">Installed Items</TableCell>
                        <TableCell align="right">Unique Items</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredBuildingOverview.map((roomData) => (
                        <TableRow
                          key={roomData.room.id}
                          hover
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f1f5f9' } }}
                          onClick={() => setSelectedRoom(roomData.room)}
                        >
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <MeetingRoom sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography fontWeight={500}>{roomData.room.name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{roomData.room.floor || '—'}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight={600}>{roomData.totalInstalled}</Typography>
                          </TableCell>
                          <TableCell align="right">{roomData.uniqueItems}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Installed Items">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/enterprise/location-items?storeId=${roomData.room.storeId}`);
                                }}
                              >
                                <OpenInNew sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredBuildingOverview.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <EmptyState
                              icon={<MeetingRoom />}
                              size="compact"
                              title={searchText ? 'No rooms match your search' : 'No rooms found in this Dharamshala'}
                              description={searchText ? 'Try a different search term.' : undefined}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          ) : (
            <>
              <Card sx={{ mb: 2, bgcolor: '#f8fafc' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={1}>
                      <MeetingRoom color="primary" />
                      <Typography variant="h6" fontWeight={600}>{selectedRoom.name}</Typography>
                      {selectedRoom.floor && (
                        <Chip label={`Floor ${selectedRoom.floor}`} size="small" variant="outlined" />
                      )}
                    </Box>
                    <Box display="flex" gap={1}>
                      <Chip
                        label={`${selectedRoomInstallations.length} items installed`}
                        color="primary"
                        variant="outlined"
                      />
                      <Chip
                        label="View Full Inventory"
                        color="info"
                        onClick={() => navigate(`/enterprise/location-items?storeId=${selectedRoom.storeId}`)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Tabs value={roomTab} onChange={(_, v) => setRoomTab(v)} sx={{ mb: 2 }}>
                <Tab label={`Installed Items (${selectedRoomInstallations.length})`} icon={<Inventory />} iconPosition="start" />
                <Tab label={`Movement History (${movements.length})`} icon={<History />} iconPosition="start" />
              </Tabs>

              {roomTab === 0 && (
                <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Condition</TableCell>
                        <TableCell>Installed Date</TableCell>
                        <TableCell>Installed By</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedRoomInstallations.map((inst: any) => (
                        <TableRow key={inst.id}>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Inventory sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography fontWeight={500}>{inst.item?.itemName || 'Unknown'}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{inst.item?.itemCode || '—'}</TableCell>
                          <TableCell align="right">{Number(inst.quantity || 1)}</TableCell>
                          <TableCell>
                            <Chip
                              label={inst.condition || 'Installed'}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{inst.installedDate ? formatDateDDMMYYYY(new Date(inst.installedDate)) : '—'}</TableCell>
                          <TableCell>{inst.installedBy || '—'}</TableCell>
                        </TableRow>
                      ))}
                      {selectedRoomInstallations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <EmptyState
                              icon={<Inventory />}
                              size="compact"
                              title="No items are currently installed in this room"
                              description="Install items from the Asset Installations page."
                              action={{
                                label: 'Go to Installations',
                                onClick: () => navigate('/assets/installations'),
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {roomTab === 1 && (
                <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Voucher</TableCell>
                        <TableCell>Movement</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell>From</TableCell>
                        <TableCell>To</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movements.map((tx: any) => (
                        <TableRow
                          key={tx.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => {
                            const type = tx.voucherType?.toLowerCase();
                            if (type === 'ds' || type === 'dp') navigate(`/inventory/${type}/${tx.headerId}`);
                            else if (type === 'ic') navigate(`/inventory/issue-challan/${tx.headerId}`);
                            else if (type === 'tc') navigate(`/inventory/transfer-challan/${tx.headerId}`);
                          }}
                        >
                          <TableCell>{tx.transactionDate ? formatDateDDMMYYYY(new Date(tx.transactionDate)) : '—'}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{tx.voucherNo || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={MOVEMENT_TYPE_LABELS[tx.voucherType] || tx.voucherType}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{tx.item?.itemName || '—'}</TableCell>
                          <TableCell align="right">
                            {tx.quantityIn ? `+${tx.quantityIn}` : tx.quantityOut ? `-${tx.quantityOut}` : '—'}
                          </TableCell>
                          <TableCell>{tx.fromRoom?.name || tx.fromStore?.name || '—'}</TableCell>
                          <TableCell>{tx.toRoom?.name || tx.toStore?.name || '—'}</TableCell>
                          <TableCell>
                            <StatusBadge status={tx.status || 'UNKNOWN'} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {movements.length === 0 && !movementsLoading && (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <EmptyState
                              icon={<History />}
                              size="compact"
                              title="No movement history found"
                              description=" movements involving this room will appear here."
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Box>
      )}

      {/* Edit Store Assignment Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, building: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Build color="warning" />
            <Typography variant="h6" fontWeight={600}>Fix Store Assignment</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Select the correct store for "{editDialog.building?.name}" Dharamshala.
            This should be a DHARMSHALA_STORE type store with the same name.
          </Typography>
          {editDialog.building?.store && (
            <Typography variant="body2" mb={2}>
              Current store: <strong>{editDialog.building.store.name}</strong> ({editDialog.building.store.storeType})
            </Typography>
          )}
          <FormControl fullWidth size="small">
            <InputLabel>Correct Store *</InputLabel>
            <Select
              value={selectedStoreId || ''}
              label="Correct Store *"
              onChange={(e) => setSelectedStoreId(Number(e.target.value))}
            >
              <MenuItem value="">
                <em>Select a store</em>
              </MenuItem>
              {stores
                .filter((s: any) => s.storeType === 'DHARMSHALA_STORE' || s.storeType === 'DEPARTMENT_STORE')
                .map((s: any) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name} ({s.storeType.replace('_', ' ')})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, building: null })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveStore}
            disabled={!selectedStoreId || updateStoreMutation.isPending}
            color="warning"
          >
            {updateStoreMutation.isPending ? 'Updating...' : 'Update Store'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
