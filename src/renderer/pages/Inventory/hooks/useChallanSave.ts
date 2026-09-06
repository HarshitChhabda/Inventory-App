import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../../context/CompanyContext';
import { useTabs } from '../../../context/TabContext';
import { suppressUnsavedWarning } from '../../../hooks/useUnsavedChangesWarning';
import { invalidateChallanQueries } from './useQueryInvalidation';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errorUtils';

interface UseChallanSaveOptions {
  challanType: 'RC' | 'IC' | 'TC' | 'DS' | 'DP';
  listKey: string;
  entityName: string;
  editPath: string;
  saveFn: (
    payload: Record<string, unknown>,
    items: unknown[],
    isEdit: boolean,
    id?: number
  ) => Promise<{ id: number }>;
  postFn: (id: number) => Promise<unknown>;
  buildPayload: () => { payload: Record<string, unknown>; items: unknown[] };
  isEdit: boolean;
  editId?: string;
}

export interface ChallanSaveResult {
  id: number;
  status: 'Draft' | 'Posted';
  challanNo?: string;
}

export function useChallanSave({
  challanType,
  listKey,
  entityName,
  editPath,
  saveFn,
  postFn,
  buildPayload,
  isEdit,
  editId,
}: UseChallanSaveOptions) {
  const queryClient = useQueryClient();
  const { company, financialYear } = useCompany();
  const { closeTabOnSave, activeTabId } = useTabs();
  const [savedResult, setSavedResult] = useState<ChallanSaveResult | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (status: 'Draft' | 'Posted') => {
      const { payload, items } = buildPayload();
      let savedChallan: { id: number };

      if (isEdit) {
        savedChallan = await saveFn(payload, items, true, Number(editId));
      } else {
        const challans = await window.electronAPI.dbQuery(
          listKey,
          'findMany',
          {
            where: { companyId: company!.id, financialYearId: financialYear!.id },
            orderBy: { id: 'desc' },
            take: 1,
          }
        );
        const lastNo =
          challans.length > 0
            ? parseInt((challans[0].voucherNo || '').replace(`${challanType}-`, '')) + 1
            : 1;
        const challanNo = `${challanType}-${String(lastNo).padStart(5, '0')}`;
        savedChallan = await saveFn({ ...payload, challanNo }, items, false);
      }

      if (status === 'Posted' && savedChallan) {
        await postFn(savedChallan.id);
      }
      return savedChallan;
    },
    onSuccess: async (savedChallan) => {
      await invalidateChallanQueries(queryClient, listKey);
      suppressUnsavedWarning();
      closeTabOnSave(activeTabId);
      const status = saveMutation.variables === 'Posted' ? 'Posted' : 'Draft';
      setSavedResult({ id: savedChallan.id, status });
      toast.success(status === 'Draft' ? `${entityName} saved as draft` : `${entityName} posted successfully`);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, `Failed to save ${entityName}`));
    },
  });

  const clearSavedResult = useCallback(() => {
    setSavedResult(null);
  }, []);

  return { saveMutation, savedResult, clearSavedResult };
}
