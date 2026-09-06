import { useRef, useMemo } from 'react';

export function useDeepCompare<T>(value: T): boolean {
  const ref = useRef<string>('');

  const serialized = useMemo(() => JSON.stringify(value), [value]);

  const isFirst = ref.current === '';
  if (isFirst) {
    ref.current = serialized;
  }

  const changed = ref.current !== serialized;
  return changed;
}
