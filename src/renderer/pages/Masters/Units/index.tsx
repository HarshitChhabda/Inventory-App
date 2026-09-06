import React, { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, TextField, Stack, Tooltip, alpha, useTheme, TableSortLabel,
  Chip, Switch, FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, Search, Straighten } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { unitSchema } from '../../../../shared/zod-schemas';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ConfirmDialog from '../../../components/ConfirmDialog';
import ImportExportButtons from '../../../components/ImportExportButtons';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import FormSection from '../../../components/FormSection';
import { useDebouncedSearch, useTableSort } from '../../../hooks';
import { TableSkeleton } from '../../../components/LoadingSkeleton';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import { GuideButton } from '../../../components/GuideSystem';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../../components/ImportProgressDialog';

type UnitFormData = z.infer<typeof unitSchema>;

interface Unit {
  id: number;
  name: string;
  symbol: string | null;
  isActive: boolean;
  _count?: { items: number };
}

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Symbol', key: 'symbol' },
  { header: 'Items', key: 'items' },
];

export default function UnitsPage() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { search, setSearch, debouncedSearch } = useDebouncedSearch();
  const { sortBy, sortOrder, handleSort, sortData } = useTableSort('name');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const [deletingItemCount, setDeletingItemCount] = useState(0);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isValid } } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    mode: 'onChange',
    defaultValues: { name: '', symbol: '' },
  });

  const { data: units, isLoading } = useQuery({
    queryKey: ['units', debouncedSearch],
    queryFn: () => {
      const where: any = {};
      if (debouncedSearch) {
        where.OR = [
          { name: { contains: debouncedSearch } },
          { symbol: { contains: debouncedSearch } },
        ];
      }
      return window.electronAPI.dbQuery('unit', 'findMany', {
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { name: 'asc' },
      });
    },
  });

  const sortedUnits = useMemo(() => sortData(units || []) as Unit[], [units, sortData]);

  const getExportData = useCallback(
    () => (units || []).map((u: Unit) => ({ name: u.name, symbol: u.symbol || '', items: u._count?.items || 0 })),
    [units]
  );

  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImportUnits = async (rows: any[]) => {
    const total = rows.length;
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const name = row['Name'] || row['name'] || '';
          if (!name) { skipped++; errors.push(`Row ${i + 1}: Missing name`); setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors })); continue; }
          const symbol = row['Symbol'] || row['symbol'] || '';
          const existing = await window.electronAPI.dbQuery('unit', 'findFirst', { where: { name } });
          if (existing) {
            await window.electronAPI.updateUnit(existing.id, { symbol });
            updated++;
          } else {
            await window.electronAPI.createUnit({ name, symbol });
            created++;
          }
        } catch (err: any) {
          skipped++;
          errors.push(`Row ${i + 1}: ${err?.message || 'Unknown error'}`);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1, created, updated, skipped, errors }));
      }
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) {
      setImportProgress(prev => ({ ...prev, active: false }));
      toast.error('Import failed: ' + err.message);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: UnitFormData) => {
      if (editing) return window.electronAPI.updateUnit(editing.id, data);
      return window.electronAPI.createUnit(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setDialogOpen(false);
      setEditing(null);
      reset({ name: '', symbol: '' });
      toast.success(editing ? 'Unit updated' : 'Unit created');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to save unit'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const itemCount = await window.electronAPI.dbQuery('item', 'count', { where: { unitId: id } });
      if (itemCount > 0) {
        throw new Error(`Cannot delete: ${itemCount} item(s) use this unit. Change item units first.`);
      }
      return window.electronAPI.deleteUnit(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setDeleteDialogOpen(false);
      setDeleting(null);
      setDeletingItemCount(0);
      toast.success('Unit deleted');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete unit'));
    },
  });

  const handleEdit = useCallback((unit: Unit) => {
    setEditing(unit);
    reset({ name: unit.name, symbol: unit.symbol || '' });
    setDialogOpen(true);
  }, [reset]);

  const handleAdd = useCallback(() => {
    setEditing(null);
    reset({ name: '', symbol: '' });
    setDialogOpen(true);
  }, [reset]);

  const columns = [
    { id: 'name', label: 'Name' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'items', label: 'Items' },
  ];

  return (
    <Box>
      <PageHeader
        title="Units"
        subtitle="Define measurement units for items"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <GuideButton pageId="units" />
            <ImportExportButtons data={getExportData()} columns={EXPORT_COLUMNS} fileName="units" onImport={handleImportUnits}
              importColumns={['Name', 'Symbol']} />
            <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>
              Add Unit
            </Button>
          </Stack>
        }
      />

      <Paper sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          placeholder="Search units..."
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
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => handleSort(col.id)}
                >
                  <TableSortLabel active={sortBy === col.id} direction={sortBy === col.id ? sortOrder : 'asc'}>
                    <Typography variant="body2" fontWeight={600}>{col.label}</Typography>
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell align="right">
                <Typography variant="body2" fontWeight={600}>Actions</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ p: 0, border: 'none' }}>
                  <Box sx={{ py: 2 }}>
                    <TableSkeleton rows={5} columns={3} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : sortedUnits.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.info.main, 0.08),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Straighten sx={{ fontSize: 16, color: 'info.main' }} />
                    </Box>
                    <Typography fontWeight={500}>{u.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{u.symbol || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${u._count?.items || 0} items`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(u)}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={async () => {
                        const count = await window.electronAPI.dbQuery('item', 'count', { where: { unitId: u.id } });
                        setDeletingItemCount(count);
                        setDeleting(u);
                        setDeleteDialogOpen(true);
                      }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && sortedUnits.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState icon={<Straighten />} title="No units found" description="Define measurement units like Kg, Meter, Nos" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <EnterpriseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit Unit' : 'Add New Unit'}
        subtitle={editing ? `Update details for ${editing.name}` : 'Create a new measurement unit'}
        icon={<Straighten />}
        maxWidth="sm"
        loading={saveMutation.isPending}
        actions={
          <>
            <Button onClick={() => setDialogOpen(false)} sx={{ fontWeight: 500 }}>Cancel</Button>
            <Button
              type="submit"
              form="unit-form"
              variant="contained"
              disabled={!isValid || saveMutation.isPending}
              sx={{ fontWeight: 600, minWidth: 100 }}
            >
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} id="unit-form">
          <FormSection title="Unit Details" divider={false}>
            <Stack spacing={2.5}>
              <TextField
                label="Unit Name (e.g. Nos, Meter, Kg)"
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
                fullWidth
                size="small"
              />
              <TextField
                label="Symbol (optional)"
                {...register('symbol')}
                error={!!errors.symbol}
                helperText={errors.symbol?.message}
                fullWidth
                size="small"
              />
            </Stack>
          </FormSection>
        </form>
      </EnterpriseDialog>

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="units" />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Unit"
        message={
          deletingItemCount > 0
            ? <>Cannot delete <strong>"{deleting?.name}"</strong> — <strong>{deletingItemCount}</strong> item(s) use this unit. Change item units first.</>
            : <>Are you sure you want to delete <strong>"{deleting?.name}"</strong>? This action cannot be undone.</>
        }
        confirmText="Delete"
        confirmColor="error"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => { setDeleteDialogOpen(false); setDeleting(null); setDeletingItemCount(0); }}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
