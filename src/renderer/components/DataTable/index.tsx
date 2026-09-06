import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TableSortLabel, TablePagination,
  Checkbox, IconButton, Tooltip, Menu, MenuItem, ListItemIcon,
  ListItemText, Divider, Chip, alpha, useTheme, TextField,
  InputAdornment, Popover, Button, Stack,
} from '@mui/material';
import {
  ViewColumn, Search, FilterList, GetApp, Refresh,
  ArrowUpward, ArrowDownward, FirstPage, LastPage,
  KeyboardArrowLeft, KeyboardArrowRight,
} from '@mui/icons-material';

// ============================================================
// TYPES
// ============================================================

export interface DataTableColumn<T = any> {
  id: string;
  label: string;
  accessor: (row: T) => any;
  sortable?: boolean;
  sortAccessor?: (row: T) => any;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
  headerRender?: (column: DataTableColumn<T>) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sticky?: boolean;
  hidden?: boolean;
}

export interface DataTableSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface DataTableFilter {
  column: string;
  value: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
}

export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  totalRows?: number;
  page?: number;
  pageSize?: number;
  sortBy?: DataTableSort[];
  filters?: DataTableFilter[];
  selectedRows?: T[];
  rowKey?: string | ((row: T) => string | number);
  onSortChange?: (sort: DataTableSort[]) => void;
  onFilterChange?: (filters: DataTableFilter[]) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'excel') => void;
  serverSide?: boolean;
  selectable?: boolean;
  exportable?: boolean;
  refreshable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  paginated?: boolean;
  stickyHeader?: boolean;
  height?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  actions?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

// ============================================================
// DATA TABLE COMPONENT
// ============================================================

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  totalRows,
  page = 0,
  pageSize = 25,
  sortBy = [],
  filters = [],
  selectedRows = [],
  rowKey = 'id',
  onSortChange,
  onFilterChange,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onRowDoubleClick,
  onSelectionChange,
  onRefresh,
  onExport,
  serverSide = false,
  selectable = false,
  exportable = false,
  refreshable = false,
  sortable = true,
  filterable = true,
  paginated = true,
  stickyHeader = false,
  height,
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = 'No data found',
  emptyIcon,
  actions,
  title,
  subtitle,
}: DataTableProps<T>) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tableRef = useRef<HTMLDivElement>(null);

  // State for column visibility
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<HTMLElement | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>(columns.map(c => c.id));

  // State for filters
  const [filterPopoverAnchor, setFilterPopoverAnchor] = useState<HTMLElement | null>(null);
  const [activeFilters, setActiveFilters] = useState<DataTableFilter[]>(filters);

  // State for sorting
  const [localSort, setLocalSort] = useState<DataTableSort[]>(sortBy);

  // Visible columns
  const visibleColumns = useMemo(() => {
    return columnOrder
      .map(id => columns.find(c => c.id === id))
      .filter((c): c is DataTableColumn<T> => !!c && !columnVisibility[c.id]);
  }, [columns, columnOrder, columnVisibility]);

  // Sorted data (client-side)
  const sortedData = useMemo(() => {
    if (serverSide || localSort.length === 0) return data;

    return [...data].sort((a, b) => {
      for (const sort of localSort) {
        const col = columns.find(c => c.id === sort.column);
        if (!col) continue;

        const aVal = col.sortAccessor ? col.sortAccessor(a) : col.accessor(a);
        const bVal = col.sortAccessor ? col.sortAccessor(b) : col.accessor(b);

        if (aVal === bVal) continue;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const comparison = aVal < bVal ? -1 : 1;
        return sort.direction === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }, [data, localSort, columns, serverSide]);

  // Filtered data (client-side)
  const filteredData = useMemo(() => {
    if (serverSide || activeFilters.length === 0) return sortedData;

    return sortedData.filter(row => {
      return activeFilters.every(filter => {
        const col = columns.find(c => c.id === filter.column);
        if (!col) return true;

        const value = String(col.accessor(row) ?? '').toLowerCase();
        const filterValue = filter.value.toLowerCase();

        switch (filter.operator) {
          case 'contains': return value.includes(filterValue);
          case 'equals': return value === filterValue;
          case 'startsWith': return value.startsWith(filterValue);
          case 'endsWith': return value.endsWith(filterValue);
          case 'gt': return Number(value) > Number(filterValue);
          case 'lt': return Number(value) < Number(filterValue);
          case 'gte': return Number(value) >= Number(filterValue);
          case 'lte': return Number(value) <= Number(filterValue);
          default: return true;
        }
      });
    });
  }, [sortedData, activeFilters, columns, serverSide]);

  // Paginated data (client-side)
  const paginatedData = useMemo(() => {
    if (serverSide || !paginated) return filteredData;
    const start = page * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize, serverSide, paginated]);

  // Get row key
  const getRowKey = useCallback((row: T): string | number => {
    if (typeof rowKey === 'function') return rowKey(row);
    return row[rowKey] ?? JSON.stringify(row);
  }, [rowKey]);

  // Check if row is selected
  const isRowSelected = useCallback((row: T): boolean => {
    return selectedRows.some(sr => getRowKey(sr) === getRowKey(row));
  }, [selectedRows, getRowKey]);

  // Handle sort
  const handleSort = useCallback((column: DataTableColumn<T>) => {
    if (!sortable || column.sortable === false) return;

    const newSort: DataTableSort[] = [];
    const existingSort = localSort.find(s => s.column === column.id);

    if (existingSort) {
      if (existingSort.direction === 'asc') {
        newSort.push({ column: column.id, direction: 'desc' });
      }
      // If desc, remove sort
    } else {
      newSort.push({ column: column.id, direction: 'asc' });
    }

    setLocalSort(newSort);
    onSortChange?.(newSort);
  }, [sortable, localSort, onSortChange]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedRows.length === paginatedData.length) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(paginatedData);
    }
  }, [selectedRows, paginatedData, onSelectionChange]);

  // Handle row select
  const handleRowSelect = useCallback((row: T) => {
    const key = getRowKey(row);
    const isSelected = selectedRows.some(sr => getRowKey(sr) === key);

    if (isSelected) {
      onSelectionChange?.(selectedRows.filter(sr => getRowKey(sr) !== key));
    } else {
      onSelectionChange?.([...selectedRows, row]);
    }
  }, [selectedRows, getRowKey, onSelectionChange]);

  // Handle column visibility toggle
  const toggleColumnVisibility = useCallback((columnId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  }, []);

  // Handle page change
  const handlePageChange = useCallback((_: any, newPage: number) => {
    onPageChange?.(newPage);
  }, [onPageChange]);

  // Handle rows per page change
  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(event.target.value, 10);
    onPageSizeChange?.(newSize);
    onPageChange?.(0);
  }, [onPageSizeChange, onPageChange]);

  // Initialize column order
  useEffect(() => {
    setColumnOrder(columns.map(c => c.id));
  }, [columns]);

  // Calculate total count
  const totalCount = serverSide ? (totalRows ?? 0) : filteredData.length;

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      {(title || actions || exportable || refreshable || filterable) && (
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {title && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
                  {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
                </Box>
              )}
              {selectedRows.length > 0 && (
                <Chip
                  label={`${selectedRows.length} selected`}
                  size="small"
                  color="primary"
                  onDelete={() => onSelectionChange?.([])}
                />
              )}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {actions}
              {filterable && (
                <Tooltip title="Filters">
                  <IconButton
                    size="small"
                    aria-label="Toggle filters"
                    onClick={(e) => setFilterPopoverAnchor(e.currentTarget)}
                    color={activeFilters.length > 0 ? 'primary' : 'default'}
                  >
                    <FilterList fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Column Visibility">
                <IconButton size="small" aria-label="Toggle column visibility" onClick={(e) => setColumnMenuAnchor(e.currentTarget)}>
                  <ViewColumn fontSize="small" />
                </IconButton>
              </Tooltip>
              {exportable && (
                <Tooltip title="Export">
                  <IconButton size="small" aria-label="Export data" onClick={() => onExport?.('excel')}>
                    <GetApp fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {refreshable && (
                <Tooltip title="Refresh">
                  <IconButton size="small" aria-label="Refresh data" onClick={onRefresh}>
                    <Refresh fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Table */}
      <TableContainer
        ref={tableRef}
        sx={{
          height: height || 'auto',
          maxHeight: height || 'auto',
          '&::-webkit-scrollbar': { width: 6, height: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: isDark ? '#475569' : '#CBD5E1',
            borderRadius: 3,
          },
        }}
      >
        <Table
          size="small"
          stickyHeader={stickyHeader}
          sx={{ minWidth: 600 }}
        >
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox" sx={{ bgcolor: isDark ? '#1E293B' : '#F8FAFC' }}>
                  <Checkbox
                    indeterminate={selectedRows.length > 0 && selectedRows.length < paginatedData.length}
                    checked={paginatedData.length > 0 && selectedRows.length === paginatedData.length}
                    onChange={handleSelectAll}
                    size="small"
                  />
                </TableCell>
              )}
              {visibleColumns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || 'left'}
                  sx={{
                    width: col.width,
                    minWidth: col.minWidth,
                    maxWidth: col.maxWidth,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'text.secondary',
                    bgcolor: isDark ? '#1E293B' : '#F8FAFC',
                    borderBottom: 2,
                    borderBottomColor: isDark ? '#334155' : '#E2E8F0',
                    whiteSpace: 'nowrap',
                    ...(col.sticky && {
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      bgcolor: isDark ? '#1E293B' : '#F8FAFC',
                    }),
                    ...(col.headerClassName ? { className: col.headerClassName } : {}),
                  }}
                >
                  {col.headerRender ? col.headerRender(col) : (
                    sortable && col.sortable !== false ? (
                      <TableSortLabel
                        active={localSort.some(s => s.column === col.id)}
                        direction={localSort.find(s => s.column === col.id)?.direction || 'asc'}
                        onClick={() => handleSort(col)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0)} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">Loading...</Typography>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0)} align="center" sx={{ py: 6 }}>
                  {emptyIcon || <Typography color="text.secondary">{emptyMessage}</Typography>}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, idx) => {
                const isSelected = isRowSelected(row);
                return (
                  <TableRow
                    key={getRowKey(row)}
                    hover
                    selected={isSelected}
                    onClick={() => onRowClick?.(row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    sx={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      '&:last-child td': { border: 0 },
                    }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowSelect(row);
                          }}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => {
                      const value = col.accessor(row);
                      return (
                        <TableCell
                          key={col.id}
                          align={col.align || 'left'}
                          sx={{
                            fontSize: '0.8125rem',
                            whiteSpace: 'nowrap',
                            ...(col.sticky && {
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              bgcolor: isDark ? '#0F172A' : '#FFFFFF',
                            }),
                            ...(col.className ? { className: col.className } : {}),
                          }}
                        >
                          {col.render ? col.render(value, row) : String(value ?? '')}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {paginated && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={pageSize}
          onRowsPerPageChange={handlePageSizeChange}
          rowsPerPageOptions={pageSizeOptions}
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            '& .MuiTablePagination-toolbar': { minHeight: 44 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: '0.8125rem',
            },
          }}
        />
      )}

      {/* Column Visibility Menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
        PaperProps={{ sx: { maxHeight: 300, minWidth: 200 } }}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 600 }}>
          Toggle Columns
        </Typography>
        <Divider />
        {columns.map((col) => (
          <MenuItem key={col.id} onClick={() => toggleColumnVisibility(col.id)}>
            <Checkbox
              checked={!columnVisibility[col.id]}
              size="small"
            />
            <ListItemText primary={col.label} />
          </MenuItem>
        ))}
      </Menu>

      {/* Filter Popover */}
      <Popover
        open={Boolean(filterPopoverAnchor)}
        anchorEl={filterPopoverAnchor}
        onClose={() => setFilterPopoverAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Filters
          </Typography>
          {activeFilters.map((filter, idx) => (
            <Stack key={idx} direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                value={filter.value}
                onChange={(e) => {
                  const newFilters = [...activeFilters];
                  newFilters[idx].value = e.target.value;
                  setActiveFilters(newFilters);
                  onFilterChange?.(newFilters);
                }}
                placeholder="Filter value..."
                fullWidth
              />
              <IconButton
                size="small"
                aria-label="Remove filter"
                onClick={() => {
                  const newFilters = activeFilters.filter((_, i) => i !== idx);
                  setActiveFilters(newFilters);
                  onFilterChange?.(newFilters);
                }}
              >
                <Typography variant="body2">×</Typography>
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            onClick={() => {
              const newFilter: DataTableFilter = {
                column: visibleColumns[0]?.id || '',
                value: '',
                operator: 'contains',
              };
              setActiveFilters([...activeFilters, newFilter]);
            }}
          >
            + Add Filter
          </Button>
        </Box>
      </Popover>
    </Paper>
  );
}

export default DataTable;
