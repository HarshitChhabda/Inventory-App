import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, TablePagination, Stack, Tooltip, alpha, useTheme,
  FormControl, InputLabel, Select, MenuItem, TableSortLabel, CircularProgress,
  Card, CardContent, Checkbox, Collapse, Badge, LinearProgress, Divider,
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Inventory2, FilterList, ViewModule, ViewList,
  ExpandMore, ExpandLess, Star, StarBorder, History, CheckBox, CheckBoxOutlineBlank,
  DeleteSweep, FilterAltOff, Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import ImportExportButtons from '../../../components/ImportExportButtons';
import toast from 'react-hot-toast';

export default function ItemsPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    itemCode: '', itemName: '', categoryId: 0, unitId: 0, minimumStockLevel: 0,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [filterCategory, setFilterCategory] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState('itemName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('favoriteItems') || '[]')); } catch { return new Set(); }
  });

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['items', company?.id, page, rowsPerPage, debouncedSearch, filterCategory, sortBy, sortOrder],
    queryFn: async () => {
      const api = window.electronAPI;
      const where: any = {};
      if (debouncedSearch) {
        where.OR = [
          { itemName: { contains: debouncedSearch } },
          { itemCode: { contains: debouncedSearch } },
        ];
      }
      if (filterCategory !== '') where.categoryId = filterCategory;

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
    queryKey: ['categories'],
    queryFn: () => window.electronAPI.dbQuery('itemCategory', 'findMany', { orderBy: { name: 'asc' } }),
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
      if (!editingItem) {
        const category = categories?.find((c: any) => c.id === data.categoryId);
        if (!category) throw new Error('Category is required');
        const prefix = category.prefix;
        const existingItems: any[] = await api.dbQuery('item', 'findMany', {
          where: { categoryId: data.categoryId }, select: { itemCode: true }, orderBy: { itemCode: 'asc' },
        });
        const existingNumbers = new Set<number>();
        let maxPadLength = 4;
        for (const item of existingItems) {
          const numStr = item.itemCode.replace(`${prefix}-`, '');
          const num = parseInt(numStr);
          if (!isNaN(num)) { existingNumbers.add(num); if (numStr.length > maxPadLength) maxPadLength = numStr.length; }
        }
        let nextNo = 1;
        while (existingNumbers.has(nextNo)) nextNo++;
        data = { ...data, itemCode: `${prefix}-${String(nextNo).padStart(maxPadLength, '0')}` };
      }
      if (editingItem) return api.updateItem(editingItem.id, data);
      return api.createItem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ itemCode: '', itemName: '', categoryId: 0, unitId: 0, minimumStockLevel: 0 });
      toast.success(editingItem ? 'Item updated' : 'Item created');
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
    onError: (err: any) => toast.error(err.message),
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
  });

  const handleSave = useCallback(() => saveMutation.mutate(formData), [saveMutation, formData]);

  const handleEdit = useCallback((item: any) => {
    setEditingItem(item);
    setFormData({ itemCode: item.itemCode, itemName: item.itemName, categoryId: item.categoryId, unitId: item.unitId, minimumStockLevel: item.minimumStockLevel });
    setDialogOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setFormData({ itemCode: '', itemName: '', categoryId: 0, unitId: 0, minimumStockLevel: 0 });
    setDialogOpen(true);
  }, []);

  const handleSort = useCallback((field: string) => {
    setSortOrder((prev) => sortBy === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortBy(field);
    setPage(0);
  }, [sortBy]);

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

  const handleImportItems = async (rows: any[]) => {
    try {
      const api = window.electronAPI;
      let created = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        try {
          const itemCode = row['Item Code'] || row['itemCode'] || '';
          const itemName = row['Item Name'] || row['itemName'] || '';
          if (!itemCode || !itemName) { skipped++; continue; }
          const catName = row['Category'] || row['categoryName'] || '';
          const unitName = row['Unit'] || row['unitName'] || '';
          const minStock = Number(row['Min Stock'] || row['minimumStockLevel'] || 0);
          const isActive = (row['Active'] || row['isActive'] || 'Yes') !== 'No';
          let categoryId = 0, unitId = 0;
          if (catName) { const cat = categories?.find((c: any) => c.name === catName); categoryId = cat?.id || 0; }
          if (unitName) { const unit = units?.find((u: any) => u.name === unitName); unitId = unit?.id || 0; }
          const existing = await api.dbQuery('item', 'findFirst', { where: { itemCode } });
          if (existing) {
            await api.updateItem(existing.id, { itemName, ...(categoryId ? { categoryId } : {}), ...(unitId ? { unitId } : {}), minimumStockLevel: minStock, isActive });
            updated++;
          } else {
            await api.createItem({ itemCode, itemName, categoryId: categoryId || categories?.[0]?.id || 1, unitId: unitId || units?.[0]?.id || 1, minimumStockLevel: minStock, isActive });
            created++;
          }
        } catch { skipped++; }
      }
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (err: any) { toast.error('Import failed: ' + err.message); }
  };

  const activeFiltersCount = (filterCategory !== '' ? 1 : 0);

  return (
    <Box>
      <PageHeader
        title="Items Master"
        subtitle={`${data?.total || 0} items in inventory`}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <ImportExportButtons data={getExportData()} columns={exportColumns} fileName="items" onImport={handleImportItems} />
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
            onChange={(e) => setSearch(e.target.value)}
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
                  <span>Category</span>
                </Stack>
              </InputLabel>
              <Select
                value={filterCategory}
                label="Category"
                onChange={(e) => { setFilterCategory(e.target.value as number | ''); setPage(0); }}
                sx={{ fontSize: '0.8125rem', borderRadius: '8px' }}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories?.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name} ({c.prefix})</MenuItem>)}
              </Select>
            </FormControl>

            {activeFiltersCount > 0 && (
              <Button
                size="small"
                startIcon={<FilterAltOff sx={{ fontSize: 14 }} />}
                onClick={() => { setFilterCategory(''); setPage(0); }}
                sx={{ fontSize: '0.75rem', textTransform: 'none', color: 'text.secondary' }}
              >
                Clear Filters
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
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
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
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', border: '1px solid', borderColor: 'divider' } }}
      >
        <DialogTitle sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontWeight: 700, fontSize: '1rem',
        }}>
          {editingItem ? 'Edit Item' : 'Add New Item'}
          <IconButton onClick={() => setDialogOpen(false)} size="small"><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stack spacing={2}>
            {!editingItem ? (
              <TextField
                label="Item Code (Auto-generated)"
                value={(() => {
                  const cat = categories?.find((c: any) => c.id === formData.categoryId);
                  return cat?.prefix ? `${cat.prefix}-____` : 'Select Category first';
                })()}
                fullWidth size="small" disabled InputProps={{ readOnly: true }}
                sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: isDark ? '#94A3B8' : '#64748B' } }}
              />
            ) : (
              <TextField label="Item Code" value={formData.itemCode} fullWidth size="small" disabled />
            )}
            <TextField
              label="Item Name" value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              fullWidth required autoFocus size="small"
              error={formData.itemName === '' && formData.categoryId > 0}
              helperText={formData.itemName === '' && formData.categoryId > 0 ? 'Required' : ''}
            />
            <TextField
              select label="Category" value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: Number(e.target.value) })}
              fullWidth SelectProps={{ native: true }} size="small"
            >
              <option value={0}>Select Category</option>
              {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.prefix})</option>)}
            </TextField>
            <TextField
              select label="Unit" value={formData.unitId}
              onChange={(e) => setFormData({ ...formData, unitId: Number(e.target.value) })}
              fullWidth SelectProps={{ native: true }} size="small"
            >
              <option value={0}>Select Unit</option>
              {units?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </TextField>
            <TextField
              label="Minimum Stock Level" type="number"
              value={formData.minimumStockLevel}
              onChange={(e) => setFormData({ ...formData, minimumStockLevel: Number(e.target.value) })}
              fullWidth size="small" helperText="Set to 0 if no minimum tracking needed"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ fontWeight: 500 }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave}
            disabled={!formData.itemName || !formData.categoryId || !formData.unitId || saveMutation.isPending}
            startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 600, minWidth: 100 }}
          >
            {saveMutation.isPending ? 'Saving...' : editingItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '16px', border: '1px solid', borderColor: 'divider' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Delete Item</DialogTitle>
        <DialogContent>
          <Typography fontSize="0.875rem">
            Are you sure you want to delete "<strong>{deletingItem?.itemName}</strong>" ({deletingItem?.itemCode})?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Items with stock transactions cannot be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ fontWeight: 500 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)} sx={{ fontWeight: 600 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
