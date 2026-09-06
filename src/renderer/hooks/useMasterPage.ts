import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useDebouncedSearch } from './useDebounce';
import { useTableSort, SortConfig } from './useTableSort';

interface UseMasterPageOptions<TData, TFormData> {
  queryKey: string;
  fetchFn: (params: {
    where: any;
    skip?: number;
    take?: number;
    orderBy: any;
  }) => Promise<{ data: TData[]; total: number } | TData[]>;
  countFn?: (params: { where: any }) => Promise<number>;
  createFn: (data: TFormData) => Promise<any>;
  updateFn: (id: number, data: TFormData) => Promise<any>;
  deleteFn: (id: number) => Promise<any>;
  defaultFormData: TFormData;
  defaultSortBy?: string;
  pageSize?: number;
  companyScoped?: boolean;
  companyId?: number;
  transformWhere?: (where: any) => any;
}

export function useMasterPage<TData extends { id: number }, TFormData>({
  queryKey,
  fetchFn,
  countFn,
  createFn,
  updateFn,
  deleteFn,
  defaultFormData,
  defaultSortBy = 'name',
  pageSize = 50,
  companyScoped = false,
  companyId,
  transformWhere,
}: UseMasterPageOptions<TData, TFormData>) {
  const queryClient = useQueryClient();
  const { search, setSearch, debouncedSearch } = useDebouncedSearch();
  const { sortBy, sortOrder, handleSort, sortConfig } = useTableSort(defaultSortBy);

  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TData | null>(null);
  const [deleting, setDeleting] = useState<TData | null>(null);

  const buildWhere = useCallback(() => {
    const where: any = {};
    if (companyScoped && companyId) where.companyId = companyId;
    if (debouncedSearch) {
      where.OR = [{ name: { contains: debouncedSearch } }];
    }
    if (transformWhere) return transformWhere(where);
    return where;
  }, [debouncedSearch, companyScoped, companyId, transformWhere]);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, companyScoped ? companyId : undefined, page, pageSize, debouncedSearch, sortBy, sortOrder].filter(Boolean),
    queryFn: async () => {
      const where = buildWhere();
      const orderBy = { [sortBy]: sortOrder };

      if (countFn) {
        const [items, total] = await Promise.all([
          fetchFn({ where, skip: page * pageSize, take: pageSize, orderBy }),
          countFn({ where }),
        ]);
        return { items: Array.isArray(items) ? items : (items as any).data || items, total };
      }

      const items = await fetchFn({ where, orderBy });
      return { items: Array.isArray(items) ? items : (items as any).data || items, total: 0 };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: TFormData) => {
      if (editing) return updateFn(editing.id, formData);
      return createFn(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'Updated successfully' : 'Created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeleteDialogOpen(false);
      setDeleting(null);
      toast.success('Deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete');
    },
  });

  const openAddDialog = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((item: TData) => {
    setEditing(item);
    setDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((item: TData) => {
    setDeleting(item);
    setDeleteDialogOpen(true);
  }, []);

  const closeDialogs = useCallback(() => {
    setDialogOpen(false);
    setDeleteDialogOpen(false);
    setEditing(null);
    setDeleting(null);
  }, []);

  return {
    search,
    setSearch,
    debouncedSearch,
    sortBy,
    sortOrder,
    handleSort,
    sortConfig,
    page,
    setPage,
    data: data?.items || [],
    total: data?.total || 0,
    isLoading,
    dialogOpen,
    deleteDialogOpen,
    editing,
    deleting,
    saveMutation,
    deleteMutation,
    openAddDialog,
    openEditDialog,
    openDeleteDialog,
    closeDialogs,
    setDialogOpen,
    setDeleteDialogOpen,
    setEditing,
    setDeleting,
    defaultFormData,
    pageSize,
  };
}
