import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, CardActions, Button, Chip, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel, FormGroup,
  TextField, Switch, Alert, Stack, Divider, Tooltip, Skeleton, Paper,
} from '@mui/material';
import { Add, Edit, Delete, People, Shield, Check, Close } from '@mui/icons-material';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { GuideButton } from '../../../components/GuideSystem';
import { useCompany } from '../../../context/CompanyContext';
import { getErrorMessage } from '../../../utils/errorUtils';

interface Role {
  id: number; name: string; displayName: string; description?: string; isSystem: boolean; isActive: boolean;
  _count?: { users: number };
  rolePermissions?: Array<{ permission: { id: number; key: string; module: string; action: string; description?: string } }>;
}

interface Permission {
  id: number; key: string; module: string; action: string; description?: string;
}

interface PermissionsByModule { [module: string]: Permission[] }

const MODULE_ICONS: Record<string, string> = {
  ITEM: '📦', TRANSACTION: '🔄', ASSET: '🏭', PURCHASE: '🛒', MAINTENANCE: '🔧',
  REQUISITION: '📋', REPORT: '📊', SETTINGS: '⚙️', USER: '👥', AUDIT: '📝',
  FINANCIAL_YEAR: '📅', BACKUP: '💾',
};

const ROLE_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' | 'default'> = {
  ADMIN: 'error', STORE_MANAGER: 'primary', DEPARTMENT_MANAGER: 'secondary',
  PURCHASE_MANAGER: 'warning', VIEWER: 'info',
};

export default function RolesPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsByModule, setPermissionsByModule] = useState<PermissionsByModule>({});
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; role: Role | null }>({ open: false, role: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; role: Role | null }>({ open: false, role: null });
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, , pByModule] = await Promise.all([
        window.electronAPI.findAllRoles(companyId),
        window.electronAPI.getPermissions(),
        window.electronAPI.getPermissionsByModule(),
      ]);
      setRoles(r);
      setPermissionsByModule(pByModule);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load data'));
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEdit = (role: Role) => {
    setEditDialog({ open: true, role });
    setSelectedPerms(role.rolePermissions?.map((rp) => rp.permission.id) || []);
  };

  const handleSaveEdit = async () => {
    if (!editDialog.role) return;
    setSaving(true);
    try {
      await window.electronAPI.updateRole(editDialog.role.id, { permissionIds: selectedPerms });
      toast.success('Role updated');
      setEditDialog({ open: false, role: null });
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update role'));
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newDisplayName.trim()) {
      toast.error('Role name and display name are required');
      return;
    }
    setSaving(true);
    try {
      await window.electronAPI.createRole({
        companyId, name: newName.toUpperCase().replace(/\s+/g, '_'),
        displayName: newDisplayName, description: newDescription, permissionIds: selectedPerms,
      });
      toast.success('Role created');
      setCreateDialog(false);
      setNewName(''); setNewDisplayName(''); setNewDescription('');
      setSelectedPerms([]);
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to create role'));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteDialog.role) return;
    try {
      await window.electronAPI.deleteRole(deleteDialog.role.id);
      toast.success('Role deleted');
      setDeleteDialog({ open: false, role: null });
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to delete role'));
    }
  };

  const togglePerm = (permId: number) => {
    setSelectedPerms((prev) => prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]);
  };

  const toggleModule = (module: string) => {
    const modulePerms = permissionsByModule[module] || [];
    const moduleIds = modulePerms.map((p) => p.id);
    const allSelected = moduleIds.every((id) => selectedPerms.includes(id));
    setSelectedPerms((prev) => allSelected ? prev.filter((id) => !moduleIds.includes(id)) : [...new Set([...prev, ...moduleIds])]);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Roles & Permissions</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage what each role can do in the system
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <GuideButton pageId="roles" />
          <Button variant="contained" startIcon={<Add />} onClick={() => { setCreateDialog(true); setSelectedPerms([]); }}>
            New Role
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={120} />)}
        </Stack>
      ) : (
        <Stack spacing={2}>
          {roles.map((role) => (
            <Card key={role.id} variant="outlined" sx={{ '&:hover': { boxShadow: 2 } }}>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="h6" fontWeight={600}>{role.displayName}</Typography>
                      <Chip
                        label={role.isSystem ? 'System' : 'Custom'}
                        size="small"
                        color={role.isSystem ? 'primary' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                    {role.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{role.description}</Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Chip icon={<People sx={{ fontSize: 16 }} />} label={`${role._count?.users || 0} users`} size="small" variant="outlined" />
                      <Chip icon={<Shield sx={{ fontSize: 16 }} />} label={`${role.rolePermissions?.length || 0} permissions`} size="small" variant="outlined" />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {!role.isSystem && (
                      <>
                        <Tooltip title="Edit permissions">
                          <IconButton size="small" onClick={() => handleEdit(role)}><Edit fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete role">
                          <IconButton size="small" onClick={() => setDeleteDialog({ open: true, role })} color="error"><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Edit Permissions Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, role: null })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit />
            <Box>
              <Typography variant="h6" fontWeight={600}>Edit Permissions</Typography>
              <Typography variant="body2" color="text.secondary">{editDialog.role?.displayName}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Toggle permissions on/off for this role. Changes take effect immediately.
          </Alert>
          <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
            {Object.entries(permissionsByModule).map(([module, perms]) => (
              <Box key={module} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Checkbox size="small"
                    checked={perms.every((p) => selectedPerms.includes(p.id))}
                    indeterminate={perms.some((p) => selectedPerms.includes(p.id)) && !perms.every((p) => selectedPerms.includes(p.id))}
                    onChange={() => toggleModule(module)} />
                  <Typography variant="subtitle2" fontWeight={600}>{MODULE_ICONS[module] || '📋'} {module.replace(/_/g, ' ')}</Typography>
                </Box>
                <Box sx={{ pl: 4 }}>
                  {perms.map((p) => (
                    <FormControlLabel key={p.id} control={
                      <Checkbox size="small" checked={selectedPerms.includes(p.id)} onChange={() => togglePerm(p.id)} />
                    } label={<Typography variant="body2">{p.description || p.action.replace(/_/g, ' ')}</Typography>} />
                  ))}
                </Box>
              </Box>
            ))}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, role: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={saving} startIcon={saving ? undefined : <Check />}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Add />
            <Typography variant="h6" fontWeight={600}>Create New Role</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              Create a custom role and assign specific permissions. You can edit permissions after creation.
            </Alert>
            <TextField fullWidth label="Role Name (e.g. Floor Manager)" value={newName}
              onChange={(e) => setNewName(e.target.value)} helperText="Internal code — will be auto-formatted" />
            <TextField fullWidth label="Display Name (e.g. Floor Manager)" value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)} helperText="Name shown in the UI" />
            <TextField fullWidth label="Description (optional)" value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Role'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Role"
        message={`Delete "${deleteDialog.role?.displayName}"? Users with this role will lose its permissions.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, role: null })}
      />
    </Box>
  );
}
