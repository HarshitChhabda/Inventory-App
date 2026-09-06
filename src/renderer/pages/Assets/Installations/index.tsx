import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardHeader, Tabs, Tab,
  TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem,
  Chip, List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Divider, Avatar, LinearProgress, Badge, Collapse,
} from '@mui/material';
import {
  Search, Hotel, Domain, Inventory2, Warning, CheckCircle, Build,
  ExpandMore, ExpandLess, LocationOn, QrCode, Speed, CalendarMonth,
  Engineering, RestartAlt, Visibility, SwapHoriz, Edit,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useCompany } from '../../../context/CompanyContext';
import { useAuth } from '../../../context/AuthContext';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import { getErrorMessage } from '../../../utils/errorUtils';
import StatusBadge from '../../../components/StatusBadge';

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: '#22C55E', GOOD: '#3B82F6', AVERAGE: '#F59E0B',
  POOR: '#F97316', CRITICAL: '#EF4444', SCRAP: '#6B7280',
};

interface RoomGroup {
  roomId: number;
  roomName: string;
  departmentName: string;
  storeName: string;
  assets: any[];
}

export default function AssetInstallationsPage() {
  const { company } = useCompany();
  const { currentUser } = useAuth();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const [groupBy, setGroupBy] = useState<'department' | 'room' | 'none'>('department');
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<number | ''>('');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Uninstall dialog
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstallAsset, setUninstallAsset] = useState<any>(null);
  const [uninstallRemarks, setUninstallRemarks] = useState('');

  // Install dialog
  const [installOpen, setInstallOpen] = useState(false);
  const [installAssetData, setInstallAssetData] = useState<any>(null);
  const [installStoreId, setInstallStoreId] = useState<number>(0);
  const [installLocationId, setInstallLocationId] = useState<number>(0);
  const [installRoomId, setInstallRoomId] = useState<number>(0);
  const [installDepartmentId, setInstallDepartmentId] = useState<number>(0);
  const [installRemarks, setInstallRemarks] = useState('');
  const [installSearch, setInstallSearch] = useState('');
  const [assetSearchOpen, setAssetSearchOpen] = useState(false);

  const { data: installedAssets, isLoading } = useQuery({
    queryKey: ['installedAssets', companyId, storeFilter],
    queryFn: () => window.electronAPI.getInstalledAssetsReport(companyId),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => window.electronAPI.dbQuery('department', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: nonInstalledAssets } = useQuery({
    queryKey: ['nonInstalledAssets', companyId, installSearch],
    queryFn: () => window.electronAPI.searchAssets({
      companyId,
      page: 1,
      pageSize: 50,
      search: installSearch || undefined,
      status: 'AVAILABLE',
    }),
    enabled: assetSearchOpen,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', installStoreId],
    queryFn: () => window.electronAPI.dbQuery('location', 'findMany', { where: { storeId: installStoreId, isActive: true }, orderBy: { name: 'asc' } }),
    enabled: installStoreId > 0,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms', installLocationId],
    queryFn: () => window.electronAPI.dbQuery('room', 'findMany', { where: { locationId: installLocationId, isActive: true }, orderBy: { name: 'asc' } }),
    enabled: installLocationId > 0,
  });

  const installMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.installAsset(
      data.assetId,
      data.storeId,
      data.locationId || undefined,
      data.roomId || undefined,
      data.departmentId || undefined,
      currentUser?.fullName || currentUser?.username || 'admin',
      data.remarks,
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installedAssets'] });
      queryClient.invalidateQueries({ queryKey: ['nonInstalledAssets'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetDashboard'] });
      toast.success('Asset installed successfully');
      setInstallOpen(false);
      resetInstallForm();
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to install asset')),
  });

  const resetInstallForm = () => {
    setInstallAssetData(null);
    setInstallStoreId(0);
    setInstallLocationId(0);
    setInstallRoomId(0);
    setInstallDepartmentId(0);
    setInstallRemarks('');
    setInstallSearch('');
    setAssetSearchOpen(false);
  };

  const uninstallMutation = useMutation({
    mutationFn: ({ assetId, remarks }: any) => window.electronAPI.uninstallAsset(assetId, currentUser?.fullName || currentUser?.username || 'admin', remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installedAssets'] });
      queryClient.invalidateQueries({ queryKey: ['nonInstalledAssets'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetDashboard'] });
      toast.success('Asset uninstalled');
      setUninstallOpen(false);
      setUninstallAsset(null);
      setUninstallRemarks('');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to uninstall asset')),
  });

  const assets = (installedAssets || []).filter((a: any) => {
    if (storeFilter && a.currentStoreId !== storeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.assetCode?.toLowerCase().includes(q) ||
        a.assetName?.toLowerCase().includes(q) ||
        a.serialNumber?.toLowerCase().includes(q) ||
        a.item?.itemName?.toLowerCase().includes(q) ||
        a.currentRoom?.name?.toLowerCase().includes(q) ||
        a.currentDepartment?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by department
  const groupedByDept = assets.reduce((acc: Record<string, any[]>, asset: any) => {
    const deptName = asset.currentDepartment?.name || 'Unassigned';
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(asset);
    return acc;
  }, {});

  // Group by room within departments
  const groupedByRoom = assets.reduce((acc: Record<string, RoomGroup>, asset: any) => {
    const deptName = asset.currentDepartment?.name || 'Unassigned';
    const roomName = asset.currentRoom?.name || 'No Room';
    const key = `${deptName}|${roomName}`;
    if (!acc[key]) {
      acc[key] = {
        roomId: asset.currentRoomId || 0,
        roomName,
        departmentName: deptName,
        storeName: asset.currentStore?.name || '-',
        assets: [],
      };
    }
    acc[key].assets.push(asset);
    return acc;
  }, {});

  const toggleDept = (dept: string) => {
    const next = new Set(expandedDepts);
    if (next.has(dept)) next.delete(dept);
    else next.add(dept);
    setExpandedDepts(next);
  };

  const handleViewProfile = async (asset: any) => {
    const full = await window.electronAPI.getAsset(asset.id);
    setSelectedAsset(full);
    setProfileOpen(true);
  };

  const handleUninstall = (asset: any) => {
    setUninstallAsset(asset);
    setUninstallRemarks('');
    setUninstallOpen(true);
  };

  // Stats
  const totalInstalled = assets.length;
  const avgHealth = assets.length > 0
    ? Math.round(assets.reduce((sum: number, a: any) => sum + (a.healthScore || 0), 0) / assets.length)
    : 0;
  const warrantyExpiring = assets.filter((a: any) => {
    if (!a.warrantyEnd) return false;
    const days = (new Date(a.warrantyEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30;
  }).length;
  const criticalHealth = assets.filter((a: any) => (a.healthScore || 0) < 40).length;

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h4" fontWeight={700}>Asset Installations</Typography>
        <Button
          variant="contained"
          startIcon={<Build />}
          onClick={() => { resetInstallForm(); setInstallOpen(true); }}
        >
          Install Asset
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        View all installed assets organized by department and room.
      </Typography>

      {/* Stats */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}><Build /></Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700}>{totalInstalled}</Typography>
                <Typography variant="body2" color="text.secondary">Installed Assets</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'success.main', width: 48, height: 48 }}><Speed /></Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700} color="success.main">{avgHealth}%</Typography>
                <Typography variant="body2" color="text.secondary">Avg Health</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main', width: 48, height: 48 }}><Warning /></Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700} color="warning.main">{warrantyExpiring}</Typography>
                <Typography variant="body2" color="text.secondary">Warranty Expiring</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'error.main', width: 48, height: 48 }}><RestartAlt /></Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700} color="error.main">{criticalHealth}</Typography>
                <Typography variant="body2" color="text.secondary">Critical Health</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField fullWidth size="small" placeholder="Search by asset ID, name, serial, room..."
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Store</InputLabel>
              <Select value={storeFilter} label="Store" onChange={e => setStoreFilter(e.target.value as any)} MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}>
                <MenuItem value="">All Stores</MenuItem>
                {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Group By</InputLabel>
              <Select value={groupBy} label="Group By" onChange={e => setGroupBy(e.target.value as any)}>
                <MenuItem value="department">Department</MenuItem>
                <MenuItem value="room">Room</MenuItem>
                <MenuItem value="none">None (All)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tab 0: By Department */}
      {groupBy === 'department' && (
        <Box>
          {Object.entries(groupedByDept).map(([deptName, deptAssets]) => (
            <Paper key={deptName} sx={{ mb: 2 }}>
              <Box
                sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => toggleDept(deptName)}
              >
                <Domain color="primary" />
                <Typography variant="h6" fontWeight={600} flex={1}>{deptName}</Typography>
                <Chip size="small" label={`${(deptAssets as any[]).length} assets`} color="primary" variant="outlined" />
                {expandedDepts.has(deptName) ? <ExpandLess /> : <ExpandMore />}
              </Box>
              <Collapse in={expandedDepts.has(deptName)}>
                <Divider />
                <List dense>
                  {(deptAssets as any[]).map((asset: any) => (
                    <ListItem key={asset.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: 'grey.200', width: 36, height: 36 }}>
                          <Inventory2 fontSize="small" />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={600} fontFamily="monospace">{asset.assetCode}</Typography>
                            <Typography variant="body2">{asset.assetName}</Typography>
                            <StatusBadge status={asset.status} />
                          </Box>
                        }
                        secondary={
                          <Box display="flex" gap={2} mt={0.5}>
                            <Typography variant="caption" color="text.secondary">
                              {asset.item?.itemName} | {asset.currentRoom?.name || 'No Room'}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <LinearProgress variant="determinate" value={asset.healthScore || 0}
                                sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.200',
                                  '& .MuiLinearProgress-bar': { bgcolor: (asset.healthScore || 0) > 70 ? 'success.main' : (asset.healthScore || 0) > 40 ? 'warning.main' : 'error.main' } }} />
                              <Typography variant="caption" fontWeight={600}>{asset.healthScore}%</Typography>
                            </Box>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="View Profile"><IconButton size="small" onClick={() => handleViewProfile(asset)}><Visibility fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Uninstall"><IconButton size="small" color="warning" onClick={() => handleUninstall(asset)}><RestartAlt fontSize="small" /></IconButton></Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Paper>
          ))}
          {Object.keys(groupedByDept).length === 0 && !isLoading && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No installed assets found.</Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Tab 1: By Room */}
      {groupBy === 'room' && (
        <Grid container spacing={2}>
          {Object.entries(groupedByRoom as Record<string, RoomGroup>).map(([key, room]) => (
            <Grid item xs={12} md={6} lg={4} key={key}>
              <Card>
                <CardHeader
                  avatar={<Avatar sx={{ bgcolor: 'info.main' }}><Hotel /></Avatar>}
                  title={room.roomName}
                  subheader={`${room.departmentName} | ${room.storeName}`}
                  action={<Chip size="small" label={`${room.assets.length} assets`} />}
                />
                <CardContent sx={{ pt: 0 }}>
                  <List dense>
                    {room.assets.map((asset: any) => (
                      <ListItem key={asset.id} disablePadding sx={{ mb: 1 }}>
                        <Card variant="outlined" sx={{ width: '100%', p: 1 }}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <QrCode fontSize="small" color="action" />
                            <Box flex={1}>
                              <Typography variant="body2" fontWeight={600} fontFamily="monospace" fontSize={11}>{asset.assetCode}</Typography>
                              <Typography variant="caption" color="text.secondary">{asset.assetName}</Typography>
                            </Box>
                            <Chip size="small" label={asset.condition}
                              sx={{ bgcolor: CONDITION_COLORS[asset.condition] + '20', color: CONDITION_COLORS[asset.condition], fontSize: 10 }} />
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <LinearProgress variant="determinate" value={asset.healthScore || 0}
                              sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'grey.200',
                                '& .MuiLinearProgress-bar': { bgcolor: (asset.healthScore || 0) > 70 ? 'success.main' : (asset.healthScore || 0) > 40 ? 'warning.main' : 'error.main' } }} />
                            <Typography variant="caption" fontWeight={600}>{asset.healthScore}%</Typography>
                          </Box>
                          {asset.warrantyEnd && (
                            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                              Warranty: {formatDateDDMMYYYY(new Date(asset.warrantyEnd))}
                              {new Date(asset.warrantyEnd) < new Date() ? ' (Expired)' : ''}
                            </Typography>
                          )}
                        </Card>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {Object.keys(groupedByRoom).length === 0 && !isLoading && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No installed assets found.</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Tab 2: All Assets Table */}
      {groupBy === 'none' && (
        <Paper>
          <List dense>
            {assets.map((asset: any) => (
              <ListItem key={asset.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                <ListItemIcon>
                  <Avatar sx={{ bgcolor: 'grey.200', width: 36, height: 36 }}>
                    <Inventory2 fontSize="small" />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={600} fontFamily="monospace">{asset.assetCode}</Typography>
                      <Typography variant="body2" fontWeight={500}>{asset.assetName}</Typography>
                      <StatusBadge status={asset.status} />
                      <Chip size="small" label={asset.condition}
                        sx={{ bgcolor: CONDITION_COLORS[asset.condition] + '20', color: CONDITION_COLORS[asset.condition], fontWeight: 600, fontSize: 10 }} />
                    </Box>
                  }
                  secondary={
                    <Box display="flex" gap={2} mt={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {asset.item?.itemName} | {asset.currentStore?.name} | {asset.currentDepartment?.name} | {asset.currentRoom?.name || 'No Room'}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <LinearProgress variant="determinate" value={asset.healthScore || 0}
                          sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.200',
                            '& .MuiLinearProgress-bar': { bgcolor: (asset.healthScore || 0) > 70 ? 'success.main' : (asset.healthScore || 0) > 40 ? 'warning.main' : 'error.main' } }} />
                        <Typography variant="caption" fontWeight={600}>{asset.healthScore}%</Typography>
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="View Profile"><IconButton size="small" onClick={() => handleViewProfile(asset)}><Visibility fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Uninstall"><IconButton size="small" color="warning" onClick={() => handleUninstall(asset)}><RestartAlt fontSize="small" /></IconButton></Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {assets.length === 0 && !isLoading && (
              <ListItem><ListItemText primary="No installed assets found." /></ListItem>
            )}
          </List>
        </Paper>
      )}

      {/* Uninstall Dialog */}
      <Dialog open={uninstallOpen} onClose={() => setUninstallOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Uninstall Asset</DialogTitle>
        <DialogContent>
          {uninstallAsset && (
            <Box mb={2}>
              <Typography variant="body2" fontWeight={600}>{uninstallAsset.assetCode} — {uninstallAsset.assetName}</Typography>
              <Typography variant="caption" color="text.secondary">
                Currently at: {uninstallAsset.currentRoom?.name || 'No Room'}, {uninstallAsset.currentDepartment?.name}
              </Typography>
            </Box>
          )}
          <TextField fullWidth label="Remarks (optional)" value={uninstallRemarks} onChange={e => setUninstallRemarks(e.target.value)}
            multiline rows={2} placeholder="Reason for uninstallation..." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUninstallOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => {
            if (uninstallAsset) uninstallMutation.mutate({ assetId: uninstallAsset.id, remarks: uninstallRemarks });
          }}>Uninstall</Button>
        </DialogActions>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="md" fullWidth>
        {selectedAsset && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'grey.200' }}>
                <Inventory2 />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>{selectedAsset.assetName}</Typography>
                <Typography variant="caption" color="text.secondary" fontFamily="monospace">{selectedAsset.assetCode}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>Location</Typography>
                  <List dense>
                    <ListItem><ListItemText primary="Store" secondary={selectedAsset.currentStore?.name || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Department" secondary={selectedAsset.currentDepartment?.name || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Room" secondary={selectedAsset.currentRoom?.name || '-'} /></ListItem>
                    <ListItem><ListItemText primary="Installed" secondary={selectedAsset.installationDate ? formatDateDDMMYYYY(new Date(selectedAsset.installationDate)) : '-'} /></ListItem>
                  </List>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" gutterBottom>Health</Typography>
                  <Box mb={2}>
                    <LinearProgress variant="determinate" value={selectedAsset.healthScore || 0}
                      sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': { bgcolor: (selectedAsset.healthScore || 0) > 70 ? 'success.main' : (selectedAsset.healthScore || 0) > 40 ? 'warning.main' : 'error.main' } }} />
                    <Typography variant="body2" mt={0.5}>{selectedAsset.healthScore}% — {selectedAsset.condition}</Typography>
                  </Box>
                  <List dense>
                    <ListItem><ListItemText primary="Repairs" secondary={selectedAsset.repairCount || 0} /></ListItem>
                    <ListItem><ListItemText primary="Repair Cost" secondary={`₹${Number(selectedAsset.totalRepairCost || 0).toLocaleString()}`} /></ListItem>
                  </List>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setProfileOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Install Dialog */}
      <Dialog open={installOpen} onClose={() => { setInstallOpen(false); resetInstallForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>Install Asset</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={1}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Select Asset</Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Search for non-installed assets..."
                value={installSearch}
                onChange={(e) => { setInstallSearch(e.target.value); setAssetSearchOpen(true); }}
                onFocus={() => setAssetSearchOpen(true)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
                }}
              />
              {assetSearchOpen && nonInstalledAssets?.data?.length > 0 && (
                <Paper variant="outlined" sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                  <List dense>
                    {nonInstalledAssets.data.map((asset: any) => (
                      <ListItem
                        key={asset.id}
                        button
                        selected={installAssetData?.id === asset.id}
                        onClick={() => {
                          setInstallAssetData(asset);
                          setAssetSearchOpen(false);
                          setInstallSearch(`${asset.assetCode} - ${asset.assetName}`);
                        }}
                      >
                        <ListItemText
                          primary={`${asset.assetCode} - ${asset.assetName}`}
                          secondary={asset.item?.itemName || 'No item'}
                        />
                        <StatusBadge status={asset.status} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
              {assetSearchOpen && installSearch && nonInstalledAssets?.data?.length === 0 && (
                <Paper variant="outlined" sx={{ mt: 1, p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No available assets found.</Typography>
                </Paper>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Store *</InputLabel>
                <Select
                  value={installStoreId || ''}
                  label="Store *"
                  onChange={(e) => {
                    setInstallStoreId(Number(e.target.value));
                    setInstallLocationId(0);
                    setInstallRoomId(0);
                  }}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  <MenuItem value={0}><em>Select store</em></MenuItem>
                  {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Location</InputLabel>
                <Select
                  value={installLocationId || ''}
                  label="Location"
                  onChange={(e) => {
                    setInstallLocationId(Number(e.target.value));
                    setInstallRoomId(0);
                  }}
                  disabled={!installStoreId}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  <MenuItem value={0}><em>Select location (optional)</em></MenuItem>
                  {locations?.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Room</InputLabel>
                <Select
                  value={installRoomId || ''}
                  label="Room"
                  onChange={(e) => setInstallRoomId(Number(e.target.value))}
                  disabled={!installLocationId}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  <MenuItem value={0}><em>Select room (optional)</em></MenuItem>
                  {rooms?.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={installDepartmentId || ''}
                  label="Department"
                  onChange={(e) => setInstallDepartmentId(Number(e.target.value))}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  <MenuItem value={0}><em>Select department (optional)</em></MenuItem>
                  {departments?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Remarks"
                value={installRemarks}
                onChange={(e) => setInstallRemarks(e.target.value)}
                multiline
                rows={2}
                placeholder="Installation notes..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInstallOpen(false); resetInstallForm(); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!installAssetData) { toast.error('Please select an asset'); return; }
              if (!installStoreId) { toast.error('Please select a store'); return; }
              installMutation.mutate({
                assetId: installAssetData.id,
                storeId: installStoreId,
                locationId: installLocationId || undefined,
                roomId: installRoomId || undefined,
                departmentId: installDepartmentId || undefined,
                remarks: installRemarks,
              });
            }}
            disabled={!installAssetData || !installStoreId || installMutation.isPending}
          >
            {installMutation.isPending ? 'Installing...' : 'Install'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
