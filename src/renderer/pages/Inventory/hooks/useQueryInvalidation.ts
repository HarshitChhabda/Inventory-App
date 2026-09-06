import { QueryClient } from '@tanstack/react-query';

const CHALLAN_RELATED_KEYS = [
  'stockTransactions',
  'stockBalance',
  'stockLedger',
  'dashboard',
  'itemHistory',
  'locationBalances',
  'report',
] as const;

export async function invalidateChallanQueries(
  queryClient: QueryClient,
  listKey: string
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [listKey] }),
    ...CHALLAN_RELATED_KEYS.map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    ),
  ]);
}
