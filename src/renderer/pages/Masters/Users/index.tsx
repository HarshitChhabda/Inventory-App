import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Stack, Tooltip, alpha, useTheme,
  FormControl, InputLabel, Select, MenuItem, Chip, Switch, FormControlLabel,
  Checkbox, FormGroup, CircularProgress, Avatar,
} from '@mui/material';
import { Add, Edit, Delete, Search, People, Lock, VpnKey } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';

function parsePermissions(p: any): string[] {
  if (Array.isArray(p)) return p;
  if (typeof p === 'string') { try { return JSON.parse(p); } catch { return []; } }
  return [];
}

const PERMISSION_LABELS: Record<string, string> = {
  cancel_challan: 'Cancel Challans',
  delete_challan: 'Delete Challans',
  manage_masters: 'Manage Masters',
  manage_financial_year: 'Manage Financial Year',
  manage_backup: 'Manage Backup',
  manage_users: 'Manage Users',
  view_audit_log: 'View Audit Log',
  manage_company: 'Manage Company',
};

const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

export default function UsersPage() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newTempPassword, setNewTempPassword] = useState('');

  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'USER',
  });

  const [editForm, setEditForm] = useState({
    fullName: '',
    role: 'USER',
    isActive: true,
  });

  const [permissionForm, setPermissionForm] = useState<string[]>([]);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => window.electronAPI.listUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => window.electronAPI.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateDialogOpen(false);
      setCreateForm({ username: '', password: '', fullName: '', role: 'USER' });
      toast.success('User created successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: any }) =>
      window.electronAPI.updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditDialogOpen(false);
      setSelectedUser(null);
      toast.success('User updated successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update user'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      window.electronAPI.updateUser(userId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update user'),
  });

  const savePermissionsMutation = useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: string[] }) =>
      window.electronAPI.updateUser(userId, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setPermissionDialogOpen(false);
      setSelectedUser(null);
      toast.success('Permissions updated');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update permissions'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      window.electronAPI.adminResetPassword(userId, password),
    onSuccess: (_data: any) => {
      setNewTempPassword(resetPasswordValue);
      setResetPasswordDialogOpen(false);
      setResetPasswordValue('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Password reset successfully');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reset password'),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => window.electronAPI.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      toast.success('User deleted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete user'),
  });

  const filteredUsers = (users || []).filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.username?.toLowerCase().includes(q) || u.fullName?.toLowerCase().includes(q);
  });

  const canDeleteUser = (user: any) => {
    if (user.id === currentUser?.id) return false;
    if (user.role === 'ADMIN') {
      const adminCount = (users || []).filter((u: any) => u.role === 'ADMIN' && u.isActive).length;
      return adminCount > 1;
    }
    return true;
  };

  const handleCreate = () => {
    if (!createForm.username || !createForm.password || !createForm.fullName) {
      toast.error('All fields are required');
      return;
    }
    createMutation.mutate(createForm);
  };

  const handleEdit = () => {
    if (!selectedUser) return;
    updateMutation.mutate({ userId: selectedUser.id, data: editForm });
  };

  const handleSavePermissions = () => {
    if (!selectedUser) return;
    savePermissionsMutation.mutate({ userId: selectedUser.id, permissions: permissionForm });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !resetPasswordValue) return;
    if (resetPasswordValue.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    resetPasswordMutation.mutate({ userId: selectedUser.id, password: resetPasswordValue });
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteMutation.mutate(selectedUser.id);
  };

  return (
    <Box>
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts, roles, and permissions"
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create User
          </Button>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          variant="outlined"
          size="small"
        />
      </Paper>

      <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><Typography variant="body2" fontWeight={600}>User</Typography></TableCell>
              <TableCell><Typography variant="body2" fontWeight={600}>Username</Typography></TableCell>
              <TableCell><Typography variant="body2" fontWeight={600}>Role</Typography></TableCell>
              <TableCell><Typography variant="body2" fontWeight={600}>Permissions</Typography></TableCell>
              <TableCell><Typography variant="body2" fontWeight={600}>Status</Typography></TableCell>
              <TableCell align="right"><Typography variant="body2" fontWeight={600}>Actions</Typography></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user: any) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar
                      sx={{
                        width: 32, height: 32,
                        background: user.role === 'ADMIN'
                          ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                          : 'linear-gradient(135deg, #2563EB, #60A5FA)',
                        color: '#FFFFFF', fontSize: '0.6875rem', fontWeight: 700,
                      }}
                    >
                      {user.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Avatar>
                    <Typography fontWeight={500}>{user.fullName}</Typography>
                  </Stack>
                </TableCell>
                <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{user.username}</Typography></TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    size="small"
                    color={user.role === 'ADMIN' ? 'primary' : 'default'}
                    variant={user.role === 'ADMIN' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {user.role === 'ADMIN' ? (
                      <Chip label="Full Access" size="small" color="primary" variant="outlined" />
                    ) : (
                      parsePermissions(user.permissions).slice(0, 2).map((p: string) => (
                        <Chip key={p} label={PERMISSION_LABELS[p] || p} size="small" variant="outlined" />
                      ))
                    )}
                    {user.role !== 'ADMIN' && parsePermissions(user.permissions).length > 2 && (
                      <Chip label={`+${parsePermissions(user.permissions).length - 2}`} size="small" variant="outlined" />
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography
                    color={user.isActive ? 'success.main' : 'text.secondary'}
                    fontWeight={500}
                    fontSize="0.8125rem"
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedUser(user);
                        setEditForm({ fullName: user.fullName, role: user.role, isActive: user.isActive });
                        setEditDialogOpen(true);
                      }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Permissions">
                    <IconButton
                      size="small"
                      disabled={user.role === 'ADMIN'}
                      onClick={() => {
                        setSelectedUser(user);
                        setPermissionForm(user.permissions || []);
                        setPermissionDialogOpen(true);
                      }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                    >
                      <Lock fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset Password">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedUser(user);
                        setResetPasswordValue('');
                        setNewTempPassword('');
                        setResetPasswordDialogOpen(true);
                      }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'warning.main', bgcolor: alpha(theme.palette.warning.main, 0.08) } }}
                    >
                      <VpnKey fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={user.id === currentUser?.id ? "Can't delete yourself" : !canDeleteUser(user) ? "Can't delete last admin" : 'Delete'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!canDeleteUser(user)}
                        onClick={() => { setSelectedUser(user); setDeleteDialogOpen(true); }}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={<People />} title="No users found" description="Click 'Create User' to add a new user" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Username"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              fullWidth
              required
              helperText="At least 3 characters"
            />
            <TextField
              label="Password"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              fullWidth
              required
              helperText="At least 6 characters"
            />
            <TextField
              label="Full Name"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={createForm.role}
                label="Role"
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              >
                <MenuItem value="USER">USER</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!createForm.username || !createForm.password || !createForm.fullName}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User — {selectedUser?.username}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Full Name"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={editForm.role}
                label="Role"
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                disabled={selectedUser?.id === currentUser?.id}
              >
                <MenuItem value="USER">USER</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  disabled={selectedUser?.id === currentUser?.id}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Permission Overrides Dialog */}
      <Dialog open={permissionDialogOpen} onClose={() => setPermissionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Permission Overrides — {selectedUser?.username}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Grant individual permissions to this USER account. ADMIN role has full access automatically.
          </Typography>
          <FormGroup>
            {ALL_PERMISSION_KEYS.map((key) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={permissionForm.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPermissionForm([...permissionForm, key]);
                      } else {
                        setPermissionForm(permissionForm.filter((p) => p !== key));
                      }
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{PERMISSION_LABELS[key]}</Typography>
                    <Typography variant="caption" color="text.secondary">{key}</Typography>
                  </Box>
                }
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePermissions}>
            Save Permissions
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password — {selectedUser?.username}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="New Password"
              type="password"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              fullWidth
              required
              helperText="At least 6 characters"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={!resetPasswordValue}>
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Temp Password Display Dialog */}
      <Dialog open={!!newTempPassword} onClose={() => setNewTempPassword('')} maxWidth="sm" fullWidth>
        <DialogTitle>Password Reset Complete</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The password has been reset. Share this temporary password with the user. It will not be shown again.
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '1.1rem', textAlign: 'center' }}>
              {newTempPassword}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setNewTempPassword('')}>
            I've Saved It — Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "<strong>{selectedUser?.fullName}</strong>" ({selectedUser?.username})?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
