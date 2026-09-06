import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardActions, Button,
  Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Chip, Divider,
} from '@mui/material';
import { Add, Edit, Delete, Settings, ToggleOn, ToggleOff, Save } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useCompany } from '../../../context/CompanyContext';
import { getErrorMessage } from '../../../utils/errorUtils';

const WORKFLOW_TYPES = [
  { value: 'ISSUE', label: 'Issue', color: '#3B82F6' },
  { value: 'TRANSFER', label: 'Transfer', color: '#8B5CF6' },
  { value: 'INSTALLATION', label: 'Installation', color: '#22C55E' },
  { value: 'REPAIR', label: 'Repair', color: '#F97316' },
  { value: 'REPLACEMENT', label: 'Replacement', color: '#EC4899' },
  { value: 'DAMAGE', label: 'Damage', color: '#EF4444' },
  { value: 'ADJUSTMENT', label: 'Adjustment', color: '#F59E0B' },
  { value: 'PURCHASE', label: 'Purchase', color: '#6366F1' },
  { value: 'RETURN', label: 'Return', color: '#14B8A6' },
  { value: 'SCRAP', label: 'Scrap', color: '#6B7280' },
  { value: 'FINANCIAL', label: 'Financial', color: '#059669' },
];

const APPROVER_TYPES = [
  { value: 'USER', label: 'Specific User' },
  { value: 'ROLE', label: 'Role' },
  { value: 'DEPARTMENT_HEAD', label: 'Department Head' },
  { value: 'STORE_MANAGER', label: 'Store Manager' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function WorkflowConfigPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const queryClient = useQueryClient();

  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null);
  const [editingLevel, setEditingLevel] = useState<any>(null);

  // Workflow form
  const [wfName, setWfName] = useState('');
  const [wfType, setWfType] = useState('ISSUE');
  const [wfEnabled, setWfEnabled] = useState(false);
  const [wfDesc, setWfDesc] = useState('');

  // Level form
  const [lvlNumber, setLvlNumber] = useState(1);
  const [lvlName, setLvlName] = useState('');
  const [lvlApproverType, setLvlApproverType] = useState('ADMIN');
  const [lvlAutoApprove, setLvlAutoApprove] = useState(false);
  const [lvlTimeout, setLvlTimeout] = useState(24);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows', companyId],
    queryFn: () => window.electronAPI.getWorkflows(companyId),
  });

  const createWfMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.createWorkflow(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Workflow created'); setWorkflowDialogOpen(false); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create workflow')),
  });

  const updateWfMutation = useMutation({
    mutationFn: ({ id, data }: any) => window.electronAPI.updateWorkflow(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Updated'); setWorkflowDialogOpen(false); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update workflow')),
  });

  const toggleWfMutation = useMutation({
    mutationFn: ({ id, enabled }: any) => window.electronAPI.toggleWorkflow(id, enabled),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Toggled'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to toggle workflow')),
  });

  const deleteWfMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.deleteWorkflow(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Deleted'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to delete workflow')),
  });

  const addLevelMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.addApprovalLevel(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Level added'); setLevelDialogOpen(false); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to add approval level')),
  });

  const deleteLevelMutation = useMutation({
    mutationFn: (id: number) => window.electronAPI.deleteApprovalLevel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Level removed'); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to remove level')),
  });

  const seedMutation = useMutation({
    mutationFn: () => window.electronAPI.seedWorkflows(companyId),
    onSuccess: (result: any) => { queryClient.invalidateQueries({ queryKey: ['workflows'] }); toast.success(result.message); },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to seed workflows')),
  });

  const handleOpenWorkflow = (wf?: any) => {
    if (wf) {
      setEditingWorkflow(wf);
      setWfName(wf.name);
      setWfType(wf.workflowType);
      setWfEnabled(wf.isEnabled);
      setWfDesc(wf.description || '');
    } else {
      setEditingWorkflow(null);
      setWfName('');
      setWfType('ISSUE');
      setWfEnabled(false);
      setWfDesc('');
    }
    setWorkflowDialogOpen(true);
  };

  const handleSaveWorkflow = () => {
    if (!wfName) { toast.error('Name required'); return; }
    if (editingWorkflow) {
      updateWfMutation.mutate({ id: editingWorkflow.id, data: { name: wfName, isEnabled: wfEnabled, description: wfDesc } });
    } else {
      createWfMutation.mutate({ companyId, name: wfName, workflowType: wfType, isEnabled: wfEnabled, description: wfDesc });
    }
  };

  const handleOpenLevel = (wfId: number, existingLevel?: any) => {
    setEditingWorkflow({ id: wfId });
    if (existingLevel) {
      setEditingLevel(existingLevel);
      setLvlNumber(existingLevel.levelNumber);
      setLvlName(existingLevel.levelName);
      setLvlApproverType(existingLevel.approverType);
      setLvlAutoApprove(existingLevel.autoApprove);
      setLvlTimeout(existingLevel.timeoutHours || 24);
    } else {
      setEditingLevel(null);
      setLvlNumber((workflows?.find((w: any) => w.id === wfId)?.levels?.length || 0) + 1);
      setLvlName('');
      setLvlApproverType('ADMIN');
      setLvlAutoApprove(false);
      setLvlTimeout(24);
    }
    setLevelDialogOpen(true);
  };

  const handleSaveLevel = () => {
    if (!lvlName) { toast.error('Level name required'); return; }
    addLevelMutation.mutate({
      workflowId: editingWorkflow.id,
      levelNumber: lvlNumber,
      levelName: lvlName,
      approverType: lvlApproverType,
      autoApprove: lvlAutoApprove,
      timeoutHours: lvlTimeout,
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Workflow Configuration</Typography>
          <Typography variant="body2" color="text.secondary">Configure approval workflows for each request type</Typography>
        </Box>
        <Box display="gap" gap={1}>
          <Button variant="outlined" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            Seed Defaults
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenWorkflow()}>
            New Workflow
          </Button>
        </Box>
      </Box>

      {isLoading && <Typography color="text.secondary">Loading...</Typography>}

      <Grid container spacing={2}>
        {workflows?.map((wf: any) => {
          const typeInfo = WORKFLOW_TYPES.find(t => t.value === wf.workflowType);
          return (
            <Grid item xs={12} md={6} lg={4} key={wf.id}>
              <Card sx={{ borderLeft: `4px solid ${typeInfo?.color || '#999'}` }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6" fontWeight={600}>{wf.name}</Typography>
                    <Switch checked={wf.isEnabled} onChange={e => toggleWfMutation.mutate({ id: wf.id, enabled: e.target.checked })}
                      color="success" size="small" />
                  </Box>
                  <Chip size="small" label={typeInfo?.label || wf.workflowType}
                    sx={{ bgcolor: typeInfo?.color + '20', color: typeInfo?.color, mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {wf.description || 'No description'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" mb={1}>
                    Approval Levels ({wf.levels?.length || 0})
                  </Typography>
                  {wf.levels?.length > 0 ? (
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {wf.levels.map((lvl: any) => (
                        <Chip key={lvl.id} size="small" label={`L${lvl.levelNumber}: ${lvl.levelName}`}
                          onDelete={() => deleteLevelMutation.mutate(lvl.id)}
                          color={lvl.autoApprove ? 'success' : 'default'} variant="outlined" />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">No levels configured</Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<Add />} onClick={() => handleOpenLevel(wf.id)}>Add Level</Button>
                  <Button size="small" startIcon={<Edit />} onClick={() => handleOpenWorkflow(wf)}>Edit</Button>
                  <Button size="small" color="error" startIcon={<Delete />}
                    onClick={() => { if (confirm(`Are you sure you want to delete the workflow "${wf.name}"? This action cannot be undone and all approval levels will be removed.`)) deleteWfMutation.mutate(wf.id); }}>Delete</Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Workflow Dialog */}
      <Dialog open={workflowDialogOpen} onClose={() => setWorkflowDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingWorkflow ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Workflow Name" value={wfName} onChange={e => setWfName(e.target.value)} />
            </Grid>
            {!editingWorkflow && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Request Type</InputLabel>
                  <Select value={wfType} label="Request Type" onChange={e => setWfType(e.target.value)}>
                    {WORKFLOW_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={wfEnabled} onChange={e => setWfEnabled(e.target.checked)} />}
                label="Enable Workflow" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Description" value={wfDesc} onChange={e => setWfDesc(e.target.value)} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkflowDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveWorkflow}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Level Dialog */}
      <Dialog open={levelDialogOpen} onClose={() => setLevelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Approval Level</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Level Number" type="number" value={lvlNumber}
                onChange={e => setLvlNumber(Number(e.target.value))} inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Level Name" value={lvlName} onChange={e => setLvlName(e.target.value)}
                placeholder="e.g. Department Head" />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Approver Type</InputLabel>
                <Select value={lvlApproverType} label="Approver Type" onChange={e => setLvlApproverType(e.target.value)}>
                  {APPROVER_TYPES.map(a => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel control={<Switch checked={lvlAutoApprove} onChange={e => setLvlAutoApprove(e.target.checked)} />}
                label="Auto-Approve" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Timeout (hours)" type="number" value={lvlTimeout}
                onChange={e => setLvlTimeout(Number(e.target.value))} inputProps={{ min: 1 }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLevelDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveLevel}>Add Level</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
