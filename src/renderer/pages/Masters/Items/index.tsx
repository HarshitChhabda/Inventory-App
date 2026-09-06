import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, TextField, Chip, TablePagination, Stack, Tooltip, alpha, useTheme,
  FormControl, InputLabel, Select, MenuItem, TableSortLabel, CircularProgress,
  Card, CardContent, Checkbox, Collapse, Badge, LinearProgress, Divider, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Inventory2, FilterList, ViewModule, ViewList,
  ExpandMore, ExpandLess, Star, StarBorder, History, CheckBox, CheckBoxOutlineBlank,
  DeleteSweep, FilterAltOff, Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import { useListState } from '../../../hooks/useListState';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ConfirmDialog from '../../../components/ConfirmDialog';
import ImportExportButtons from '../../../components/ImportExportButtons';
import EnterpriseDialog from '../../../components/EnterpriseDialog';
import FormSection from '../../../components/FormSection';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';
import { GuideButton } from '../../../components/GuideSystem';
import ImportProgressDialog, { getInitialProgress, ImportProgress } from '../../../components/ImportProgressDialog';

const itemSchema = z.object({
  itemCode: z.string().min(1, 'Item code is required'),
  itemName: z.string().min(1, 'Item name is required'),
  unitId: z.number().min(1, 'Unit is required'),
  minimumStockLevel: z.number().min(0),
});
type ItemFormData = z.infer<typeof itemSchema>;

export default function ItemsPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const {
    state: ls, setSearch: setLsSearch, setPage: setLsPage, setPageSize: setLsPageSize,
    setSort: setLsSort, setFilter: setLsFilter,
  } = useListState('items', { pageSize: 50, sortBy: 'itemName', sortOrder: 'asc' as const });

  const [page, setPage] = useState(ls.page);
  const [rowsPerPage, setRowsPerPage] = useState(ls.pageSize);
  const [search, setSearchLocal] = useState(ls.search);
  const [debouncedSearch, setDebouncedSearch] = useState(ls.search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isValid } } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    mode: 'onChange',
    defaultValues: { itemCode: '', itemName: '', unitId: 0, minimumStockLevel: 0 },
  });
  const [newUnitName, setNewUnitName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [filterStore, setFilterStoreLocal] = useState<number | ''>((ls.filters.store as any) || '');
  const [sortBy, setSortByLocal] = useState(ls.sortBy || 'itemName');
  const [sortOrder, setSortOrderLocal] = useState<'asc' | 'desc'>(ls.sortOrder || 'asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('favoriteItems') || '[]')); } catch { return new Set(); }
  });

  const handleSearchChange = (v: string) => {
    setSearchLocal(v);
    setLsSearch(v);
  };
  const handleFilterStoreChange = (v: number | '') => {
    setFilterStoreLocal(v);
    setLsFilter('store', String(v));
  };
  const handlePageChange = (_: any, newPage: number) => {
    setPage(newPage);
    setLsPage(newPage);
  };
  const handleRowsPerPageChange = (e: any) => {
    const val = parseInt(e.target.value, 10);
    setRowsPerPage(val);
    setLsPageSize(val);
    setPage(0);
  };

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['items', company?.id, page, rowsPerPage, debouncedSearch, filterStore, sortBy, sortOrder],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = {};
      if (debouncedSearch) {
        where.OR = [
          { itemName: { contains: debouncedSearch } },
          { itemCode: { contains: debouncedSearch } },
        ];
      }
      if (filterStore !== '') where.category = { storeId: filterStore };

      let orderBy: any = {};
      if (sortBy === 'category') orderBy = { category: { name: sortOrder } };
      else if (sortBy === 'unit') orderBy = { unit: { name: sortOrder } };
      else orderBy = { [sortBy]: sortOrder };

      const [items, total] = await Promise.all([
        api.dbQuery('item', 'findMany', {
          where, include: { category: true, unit: true },
          skip: page * rowsPerPage, take: rowsPerPage, orderBy,
        }),
        api.dbQuery('item', 'count', { where }),
      ]);
      return { items, total };
    },
    enabled: !!company?.id,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', filterStore],
    queryFn: () => {
      const where: any = {};
      if (filterStore !== '') {
        // Show global categories (storeId=null) + categories belonging to this store
        where.OR = [{ storeId: null }, { storeId: filterStore }];
      }
      return window.electronAPI.dbQuery('itemCategory', 'findMany', { where, orderBy: { name: 'asc' } });
    },
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => window.electronAPI.dbQuery('store', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: () => window.electronAPI.dbQuery('unit', 'findMany', { orderBy: { name: 'asc' } }),
  });

  const { data: allItemsData } = useQuery({
    queryKey: ['items', company?.id, 'all'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', {
      include: { category: true, unit: true }, orderBy: { itemName: 'asc' },
    }),
    enabled: !!company?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const api = window.electronAPI;
      let unitId = data.unitId;

      if (!unitId && newUnitName.trim()) {
        const existingUnit = units?.find((u: any) => u.name.toLowerCase() === newUnitName.trim().toLowerCase());
        if (existingUnit) {
          unitId = existingUnit.id;
        } else {
          const created: any = await api.createUnit({ name: newUnitName.trim() });
          unitId = created.id;
          queryClient.invalidateQueries({ queryKey: ['units'] });
        }
      }

      let categoryId = data.categoryId;
      if (!categoryId) {
        let defaultCat = categories?.[0];
        if (!defaultCat) {
          const created: any = await api.createCategory({ name: 'General', prefix: 'GEN' });
          defaultCat = created;
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
        categoryId = defaultCat.id;
      }

      data = { ...data, unitId, categoryId };

      if (editingItem) return api.updateItem(editingItem.id, data);
      return api.createItem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setDialogOpen(false);
      setEditingItem(null);
      setNewUnitName('');
      reset({ itemCode: '', itemName: '', unitId: 0, minimumStockLevel: 0 });
      toast.success(editingItem ? 'Item updated' : 'Item created');
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to save item'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const api = window.electronAPI;
      const txnCount = await api.dbQuery('stockTransaction', 'count', { where: { itemId: id } });
      if (txnCount > 0) throw new Error('Cannot delete: item has stock transactions');
      return api.deleteItem(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      toast.success('Item deleted');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to delete item')),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const api = window.electronAPI;
      let deleted = 0, skipped = 0;
      for (const id of ids) {
        const txnCount = await api.dbQuery('stockTransaction', 'count', { where: { itemId: id } });
        if (txnCount > 0) { skipped++; continue; }
        await api.deleteItem(id);
        deleted++;
      }
      return { deleted, skipped };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setSelected(new Set());
      toast.success(`Deleted ${result.deleted} items${result.skipped ? `, ${result.skipped} skipped` : ''}`);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete items'));
    },
  });

  const handleSave = handleSubmit((data) => saveMutation.mutate(data));

  const handleEdit = useCallback((item: any) => {
    setEditingItem(item);
    reset({ itemCode: item.itemCode, itemName: item.itemName, unitId: item.unitId, minimumStockLevel: item.minimumStockLevel });
    setDialogOpen(true);
  }, [reset]);

  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setNewUnitName('');
    reset({ itemCode: '', itemName: '', unitId: 0, minimumStockLevel: 0 });
    setDialogOpen(true);
  }, [reset]);

  const handleSort = useCallback((field: string) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrderLocal(newOrder);
    setSortByLocal(field);
    setLsSort(field, newOrder);
    setPage(0);
  }, [sortBy, sortOrder, setLsSort]);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('favoriteItems', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!data?.items) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((i: any) => i.id)));
    }
  }, [data?.items, selected.size]);

  const handleBulkDelete = useCallback(() => {
    if (selected.size === 0) return;
    bulkDeleteMutation.mutate([...selected]);
  }, [selected, bulkDeleteMutation]);

  const exportColumns = [
    { header: 'Item Code', key: 'itemCode' },
    { header: 'Item Name', key: 'itemName' },
    { header: 'Category', key: 'categoryName' },
    { header: 'Unit', key: 'unitName' },
    { header: 'Min Stock', key: 'minimumStockLevel' },
    { header: 'Active', key: 'isActive' },
  ];

  const getExportData = () => (allItemsData || []).map((item: any) => ({
    itemCode: item.itemCode, itemName: item.itemName,
    categoryName: item.category?.name || '', unitName: item.unit?.name || '',
    minimumStockLevel: item.minimumStockLevel, isActive: item.isActive ? 'Yes' : 'No',
  }));

  const [importProgress, setImportProgress] = useState<ImportProgress>(getInitialProgress);

  const handleImportItems = async (rows: any[]) => {
    const api = window.electronAPI;
    const total = rows.length;
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    setImportProgress({ active: true, current: 0, total, created: 0, updated: 0, skipped: 0, errors: [] });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const itemCode = row['Item Code'] || row['itemCode'] || '';
        const itemName = row['Item Name'] || row['itemName'] || '';
        if (!itemCode || !itemName) {
          skipped++;
          errors.push(`Row ${i + 1}: Missing item code or name`);
          setImportProgress(prev => ({ ...prev, current: i + 1, skipped, errors }));
          continue;
        }

        const catName = row['Category'] || row['categoryName'] || '';
        const unitName = row['Unit'] || row['unitName'] || '';
        const minStock = Number(row['Min Stock'] || row['minimumStockLevel'] || 0);
        const isActive = (row['Active'] || row['isActive'] || 'Yes') !== 'No';

        let categoryId = 0;
        let unitId = 0;

        if (catName) {
          let cat = categories?.find((c: any) => c.name.toLowerCase() === catName.toLowerCase());
          if (!cat) {
            const allCats = await api.dbQuery('itemCategory', 'findMany', { where: {} });
            cat = allCats.find((c: any) => c.name.toLowerCase() === catName.toLowerCase());
          }
          if (cat) {
            categoryId = cat.id;
          } else {
            try {
              const createdCat: any = await api.createCategory({ name: catName, prefix: catName.substring(0, 3).toUpperCase() });
              categoryId = createdCat.id;
            } catch {
              const allCats = await api.dbQuery('itemCategory', 'findMany', { where: {} });
              cat = allCats.find((c: any) => c.name.toLowerCase() === catName.toLowerCase());
              if (cat) categoryId = cat.id;
            }
            queryClient.invalidateQueries({ queryKey: ['categories'] });
          }
        } else {
          let defaultCat = categories?.[0];
          if (!defaultCat) {
            try {
              const createdCat: any = await api.createCategory({ name: 'General', prefix: 'GEN' });
              defaultCat = createdCat;
            } catch {
              const allCats = await api.dbQuery('itemCategory', 'findMany', { where: {} });
              defaultCat = allCats[0];
            }
            queryClient.invalidateQueries({ queryKey: ['categories'] });
          }
          if (defaultCat) categoryId = defaultCat.id;
        }

        if (unitName) {
          let unit = units?.find((u: any) => u.name.toLowerCase() === unitName.toLowerCase());
          if (!unit) {
            const allUnits = await api.dbQuery('unit', 'findMany', { where: {} });
            unit = allUnits.find((u: any) => u.name.toLowerCase() === unitName.toLowerCase());
          }
          if (unit) {
            unitId = unit.id;
          } else {
            try {
              const createdUnit: any = await api.createUnit({ name: unitName });
              unitId = createdUnit.id;
            } catch {
              const allUnits = await api.dbQuery('unit', 'findMany', { where: {} });
              unit = allUnits.find((u: any) => u.name.toLowerCase() === unitName.toLowerCase());
              if (unit) unitId = unit.id;
            }
            queryClient.invalidateQueries({ queryKey: ['units'] });
          }
        } else {
          let defaultUnit = units?.[0];
          if (!defaultUnit) {
            try {
              const createdUnit: any = await api.createUnit({ name: 'Pcs' });
              defaultUnit = createdUnit;
            } catch {
              const allUnits = await api.dbQuery('unit', 'findMany', { where: {} });
              defaultUnit = allUnits[0];
            }
            queryClient.invalidateQueries({ queryKey: ['units'] });
          }
          if (defaultUnit) unitId = defaultUnit.id;
        }

        const existing = await api.dbQuery('item', 'findFirst', { where: { itemCode } });
        if (existing) {
          await api.updateItem(existing.id, { itemName, categoryId, unitId, minimumStockLevel: minStock, isActive });
          updated++;
        } else {
          await api.createItem({ itemCode, itemName, categoryId, unitId, minimumStockLevel: minStock, isActive });
          created++;
        }
      } catch (err: any) {
        skipped++;
        const msg = err?.message || 'Unknown error';
        if (msg.includes('Foreign key constraint')) {
          errors.push(`Row ${i + 1} (${row['Item Code'] || row['itemCode'] || '?'}): Category or Unit not found in database`);
        } else if (msg.includes('Unique constraint')) {
          errors.push(`Row ${i + 1} (${row['Item Code'] || row['itemCode'] || '?'}): Item code already exists`);
        } else {
          errors.push(`Row ${i + 1} (${row['Item Code'] || row['itemCode'] || '?'}): ${msg}`);
        }
      }
      setImportProgress(prev => ({ ...prev, current: i + 1, created, updated, skipped, errors }));
    }

    queryClient.invalidateQueries({ queryKey: ['items'] });
    setImportProgress(prev => ({ ...prev, active: false }));
    if (skipped === 0) {
      toast.success(`Import complete: ${created} created, ${updated} updated`);
    } else {
      toast(`Import: ${created} created, ${updated} updated, ${skipped} skipped`, { icon: '⚠️' });
    }
  };

  const activeFiltersCount = filterStore !== '' ? 1 : 0;

  return (
    <Box>
      <PageHeader
        title="Items Master"
        subtitle={`${data?.total || 0} items in inventory`}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <GuideButton pageId="items" />
            <ImportExportButtons data={getExportData()} columns={exportColumns} fileName="items" onImport={handleImportItems}
              importColumns={['Item Code', 'Item Name', 'Category', 'Unit', 'Min Stock', 'Active']} />
            <Button variant="contained" startIcon={<Add />} onClick={handleAdd} sx={{ borderRadius: '10px', fontWeight: 600 }}>
              Add Item
            </Button>
          </Stack>
        }
      />

      {/* Toolbar */}
      <Paper sx={{
        mb: 2, p: 1, border: '1px solid', borderColor: 'divider',
        borderRadius: '12px',
      }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
              sx: {
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                fontSize: '0.8125rem',
                '& fieldset': { border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}'` },
              },
            }}
          />

          {/* Filter Toggle */}
          <Tooltip title="Filters">
            <IconButton
              onClick={() => setShowFilters(!showFilters)}
              sx={{
                borderRadius: '10px', width: 36, height: 36,
                border: '1px solid', borderColor: showFilters ? 'primary.main' : 'divider',
                backgroundColor: showFilters ? alpha('#2563EB', 0.08) : 'transparent',
                color: showFilters ? 'primary.main' : 'text.secondary',
              }}
            >
              <Badge badgeContent={activeFiltersCount} color="primary" variant="dot" invisible={activeFiltersCount === 0}>
                <FilterAltOff sx={{ fontSize: 18 }} />
              </Badge>
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

          {/* View Toggle */}
          <Tooltip title="Table View">
            <IconButton
              onClick={() => setViewMode('table')}
              sx={{
                borderRadius: '10px', width: 36, height: 36,
                border: '1px solid', borderColor: viewMode === 'table' ? 'primary.main' : 'divider',
                backgroundColor: viewMode === 'table' ? alpha('#2563EB', 0.08) : 'transparent',
                color: viewMode === 'table' ? 'primary.main' : 'text.secondary',
              }}
            >
              <ViewList sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Card View">
            <IconButton
              onClick={() => setViewMode('card')}
              sx={{
                borderRadius: '10px', width: 36, height: 36,
                border: '1px solid', borderColor: viewMode === 'card' ? 'primary.main' : 'divider',
                backgroundColor: viewMode === 'card' ? alpha('#2563EB', 0.08) : 'transparent',
                color: viewMode === 'card' ? 'primary.main' : 'text.secondary',
              }}
            >
              <ViewModule sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Expandable Filters */}
        <Collapse in={showFilters}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ fontSize: '0.8125rem' }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <FilterList sx={{ fontSize: 14 }} />
                  <span>Store</span>
                </Stack>
              </InputLabel>
              <Select
                value={filterStore}
                label="Store"
                onChange={(e) => { handleFilterStoreChange(e.target.value as number | ''); }}
                sx={{ fontSize: '0.8125rem', borderRadius: '8px' }}
              >
                <MenuItem value="">All Stores</MenuItem>
                {stores?.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>

            {filterStore !== '' && (
              <Button
                size="small"
                startIcon={<FilterAltOff sx={{ fontSize: 14 }} />}
                onClick={() => { handleFilterStoreChange(''); }}
                sx={{ fontSize: '0.75rem', textTransform: 'none', color: 'text.secondary' }}
              >
                Clear Filter
              </Button>
            )}

            <Box sx={{ flex: 1 }} />

            {/* Bulk Actions */}
            {selected.size > 0 && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`${selected.size} selected`}
                  size="small"
                  onDelete={() => setSelected(new Set())}
                  color="primary"
                  variant="outlined"
                  sx={{ height: 28, fontWeight: 600 }}
                />
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteSweep sx={{ fontSize: 14 }} />}
                  onClick={handleBulkDelete}
                  sx={{ fontSize: '0.75rem', textTransform: 'none', fontWeight: 600 }}
                >
                  Delete Selected
                </Button>
              </Stack>
            )}
          </Stack>
        </Collapse>
      </Paper>

      {/* Table View */}
      {viewMode === 'table' && (
        <>
          <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 48 }}>
                    <Checkbox
                      size="small"
                      indeterminate={selected.size > 0 && data?.items && selected.size < data.items.length}
                      checked={data?.items ? selected.size === data.items.length && data.items.length > 0 : false}
                      onChange={toggleSelectAll}
                    />
                  </TableCell>
                  {[
                    { id: 'itemCode', label: 'Code' },
                    { id: 'itemName', label: 'Item Name' },
                    { id: 'category', label: 'Category' },
                    { id: 'unit', label: 'Unit' },
                    { id: 'minimumStockLevel', label: 'Min Stock' },
                    { id: 'isActive', label: 'Status' },
                  ].map((col) => (
                    <TableCell
                      key={col.id}
                      sx={{ cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                      onClick={() => handleSort(col.id)}
                    >
                      <TableSortLabel active={sortBy === col.id} direction={sortBy === col.id ? sortOrder : 'asc'}>
                        <Typography variant="body2" fontWeight={600} fontSize="0.75rem">{col.label}</Typography>
                      </TableSortLabel>
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ width: 100 }}>
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">Actions</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items?.map((item: any) => (
                  <TableRow
                    key={item.id}
                    hover
                    selected={selected.has(item.id)}
                    sx={{ '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.itemCode}
                        size="small"
                        sx={{
                          fontWeight: 600, fontSize: '0.6875rem',
                          bgcolor: alpha('#2563EB', isDark ? 0.15 : 0.08),
                          color: isDark ? '#60A5FA' : '#2563EB',
                          border: `1px solid ${alpha('#2563EB', 0.2)}`,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={500} fontSize="0.8125rem" color="text.primary">{item.itemName}</Typography>
                    </TableCell>
                    <TableCell><Typography fontSize="0.8125rem" color="text.primary">{item.category?.name || '-'}</Typography></TableCell>
                    <TableCell><Typography fontSize="0.8125rem" color="text.primary">{item.unit?.name || '-'}</Typography></TableCell>
                    <TableCell>
                      <Typography fontWeight={600} fontSize="0.8125rem" color="text.primary">{item.minimumStockLevel}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={item.isActive ? 'success' : 'default'}
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.625rem', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={favorites.has(item.id) ? 'Unfavorite' : 'Favorite'}>
                        <IconButton size="small" onClick={() => toggleFavorite(item.id)} sx={{ color: favorites.has(item.id) ? '#F59E0B' : 'text.secondary' }}>
                          {favorites.has(item.id) ? <Star sx={{ fontSize: 16 }} /> : <StarBorder sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(item)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => { setDeletingItem(item); setDeleteDialogOpen(true); }} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        icon={<Inventory2 />}
                        title="No items found"
                        description={debouncedSearch ? `No items match "${debouncedSearch}"` : "Create your first item to get started"}
                        action={!debouncedSearch ? { label: 'Add Item', onClick: handleAdd, icon: <Add /> } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.total || 0}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </>
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.5 }}>
          {data?.items?.map((item: any, index: number) => (
            <Card
              key={item.id}
              sx={{
                cursor: 'pointer',
                animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 30}ms forwards`,
                opacity: 0,
                transition: 'all 200ms ease-out',
                border: selected.has(item.id) ? `2px solid ${alpha('#2563EB', 0.5)}` : '1px solid',
                borderColor: selected.has(item.id) ? 'primary.main' : 'divider',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.1)',
                  borderColor: 'primary.main',
                },
              }}
              onClick={() => toggleSelect(item.id)}
            >
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Chip
                    label={item.itemCode}
                    size="small"
                    sx={{
                      fontWeight: 600, fontSize: '0.625rem',
                      bgcolor: alpha('#2563EB', isDark ? 0.15 : 0.08),
                      color: isDark ? '#60A5FA' : '#2563EB',
                    }}
                  />
                  <Checkbox
                    size="small"
                    checked={selected.has(item.id)}
                    icon={<CheckBoxOutlineBlank sx={{ fontSize: 18 }} />}
                    checkedIcon={<CheckBox sx={{ fontSize: 18 }} />}
                    sx={{ p: 0, color: 'text.secondary' }}
                  />
                </Stack>
                <Typography fontWeight={600} fontSize="0.8125rem" color="text.primary" sx={{ mb: 0.5, lineHeight: 1.3 }}>
                  {item.itemName}
                </Typography>
                <Stack direction="row" spacing={0.5} mb={1} flexWrap="wrap" gap={0.5}>
                  <Chip label={item.category?.name || 'N/A'} size="small" sx={{ height: 20, fontSize: '0.5625rem' }} />
                  <Chip label={item.unit?.name || 'N/A'} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.5625rem' }} />
                </Stack>
                <Divider sx={{ my: 0.75 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.5625rem' }}>Min Stock</Typography>
                    <Typography fontWeight={600} fontSize="0.75rem" color="text.primary">{item.minimumStockLevel}</Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Favorite">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} sx={{ color: favorites.has(item.id) ? '#F59E0B' : 'text.secondary', p: 0.25 }}>
                        {favorites.has(item.id) ? <Star sx={{ fontSize: 14 }} /> : <StarBorder sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(item); }} sx={{ color: 'text.secondary', p: 0.25 }}>
                        <Edit sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeletingItem(item); setDeleteDialogOpen(true); }} sx={{ color: 'text.secondary', p: 0.25 }}>
                        <Delete sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
          {data?.items?.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <EmptyState
                icon={<Inventory2 />}
                title="No items found"
                description={debouncedSearch ? `No items match "${debouncedSearch}"` : "Create your first item to get started"}
                action={!debouncedSearch ? { label: 'Add Item', onClick: handleAdd, icon: <Add /> } : undefined}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <EnterpriseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
        subtitle={editingItem ? `Update details for ${editingItem.itemName}` : 'Create a new inventory item'}
        icon={<Inventory2 />}
        maxWidth="sm"
        loading={saveMutation.isPending}
        actions={
          <>
            <Button onClick={() => setDialogOpen(false)} sx={{ fontWeight: 500 }}>Cancel</Button>
            <Button
              variant="contained" onClick={handleSave}
              disabled={!isValid || saveMutation.isPending}
              startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ fontWeight: 600, minWidth: 100 }}
            >
              {saveMutation.isPending ? 'Saving...' : editingItem ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
          <FormSection title="Item Details" divider={false}>
            <Stack spacing={2}>
              <TextField
                label="Item Code"
                {...register('itemCode')}
                fullWidth required size="small"
                error={!!errors.itemCode}
                helperText={errors.itemCode?.message}
                disabled={!!editingItem}
              />
              <TextField
                label="Item Name"
                {...register('itemName')}
                fullWidth required autoFocus size="small"
                error={!!errors.itemName}
                helperText={errors.itemName?.message}
              />
              <Autocomplete
                freeSolo
                options={units || []}
                getOptionLabel={(o) => typeof o === 'string' ? o : o.name}
                value={units?.find((u: any) => u.id === watch('unitId')) || null}
                onChange={(_, v) => {
                  if (typeof v === 'string') {
                    const match = units?.find((u: any) => u.name.toLowerCase() === v.toLowerCase());
                    setValue('unitId', match?.id || 0, { shouldValidate: true });
                    setNewUnitName(match ? '' : v);
                  } else {
                    setValue('unitId', v?.id || 0, { shouldValidate: true });
                    setNewUnitName('');
                  }
                }}
                onInputChange={(_, v) => { if (!v) { setValue('unitId', 0, { shouldValidate: true }); setNewUnitName(''); } }}
                renderInput={(params) => <TextField {...params} label="Unit" placeholder="Type or select..." />}
                size="small" fullWidth
              />
              <TextField
                label="Minimum Stock Level" type="number"
                {...register('minimumStockLevel', { valueAsNumber: true })}
                fullWidth size="small" helperText="Set to 0 if no minimum tracking needed"
              />
            </Stack>
          </FormSection>
      </EnterpriseDialog>

      <ImportProgressDialog progress={importProgress} onClose={() => setImportProgress(getInitialProgress())} entityLabel="items" />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Item"
        message={
          <>
            Are you sure you want to delete "<strong>{deletingItem?.itemName}</strong>" ({deletingItem?.itemCode})?
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Items with stock transactions cannot be deleted.
            </Typography>
          </>
        }
        confirmText="Delete"
        confirmColor="error"
        onConfirm={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
        onCancel={() => { setDeleteDialogOpen(false); setDeletingItem(null); }}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
