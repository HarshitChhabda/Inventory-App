import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface DraftData {
  id: string;
  formId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UseAutosaveDraftOptions {
  formId: string;
  enabled?: boolean;
  interval?: number; // Auto-save interval in ms (default: 30 seconds)
  maxDrafts?: number; // Maximum drafts per form (default: 10)
  onSave?: (draft: DraftData) => void;
  onRestore?: (data: Record<string, any>) => void;
}

export interface UseAutosaveDraftResult {
  currentDraft: DraftData | null;
  drafts: DraftData[];
  isSaving: boolean;
  lastSaved: Date | null;
  saveDraft: (data: Record<string, any>, name?: string) => DraftData;
  restoreDraft: (id: string) => Record<string, any> | null;
  deleteDraft: (id: string) => void;
  clearAllDrafts: () => void;
  hasUnsavedChanges: boolean;
}

// ============================================================
// STORAGE KEY
// ============================================================

const STORAGE_PREFIX = 'form-drafts';

function getStorageKey(formId: string): string {
  return `${STORAGE_PREFIX}:${formId}`;
}

// ============================================================
// HOOK
// ============================================================

export function useAutosaveDraft(options: UseAutosaveDraftOptions): UseAutosaveDraftResult {
  const {
    formId,
    enabled = true,
    interval = 30 * 1000, // 30 seconds
    maxDrafts = 10,
    onSave,
    onRestore,
  } = options;

  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const [currentDraft, setCurrentDraft] = useState<DraftData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const dataRef = useRef<Record<string, any>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formIdRef = useRef(formId);
  formIdRef.current = formId;

  // Load drafts from localStorage
  useEffect(() => {
    if (!enabled) return;

    try {
      const stored = localStorage.getItem(getStorageKey(formId));
      if (stored) {
        const parsed = JSON.parse(stored) as DraftData[];
        setDrafts(parsed);

        // Restore the most recent draft
        if (parsed.length > 0) {
          const mostRecent = parsed.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          setCurrentDraft(mostRecent);
        }
      }
    } catch (err) {
      console.error('Failed to load drafts:', err);
    }
  }, [formId, enabled]);

  // Save drafts to localStorage
  const saveDrafts = useCallback((newDrafts: DraftData[]) => {
    setDrafts(newDrafts);
    try {
      localStorage.setItem(getStorageKey(formIdRef.current), JSON.stringify(newDrafts));
    } catch (err) {
      console.error('Failed to save drafts:', err);
    }
  }, []);

  // Save draft
  const saveDraft = useCallback((
    data: Record<string, any>,
    name?: string
  ): DraftData => {
    const now = new Date();
    const existingDraft = currentDraft;

    const draft: DraftData = {
      id: existingDraft?.id || `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      formId,
      data,
      createdAt: existingDraft?.createdAt || now,
      updatedAt: now,
    };

    // Add name if provided
    if (name) {
      (draft as any).name = name;
    }

    let newDrafts: DraftData[];

    if (existingDraft) {
      // Update existing draft
      newDrafts = drafts.map(d =>
        d.id === existingDraft.id ? draft : d
      );
    } else {
      // Add new draft
      newDrafts = [...drafts, draft];

      // Enforce max drafts limit
      if (newDrafts.length > maxDrafts) {
        newDrafts = newDrafts
          .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
          .slice(-maxDrafts);
      }
    }

    saveDrafts(newDrafts);
    setCurrentDraft(draft);
    setIsSaving(true);
    setLastSaved(now);
    setHasUnsavedChanges(false);

    // Reset saving state after a brief delay
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    savingTimerRef.current = setTimeout(() => setIsSaving(false), 1000);

    onSave?.(draft);

    return draft;
  }, [currentDraft, drafts, formId, maxDrafts, saveDrafts, onSave]);

  // Restore draft
  const restoreDraft = useCallback((id: string): Record<string, any> | null => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return null;

    setCurrentDraft(draft);
    setHasUnsavedChanges(false);
    onRestore?.(draft.data);

    return draft.data;
  }, [drafts, onRestore]);

  // Delete draft
  const deleteDraft = useCallback((id: string) => {
    const newDrafts = drafts.filter(d => d.id !== id);
    saveDrafts(newDrafts);

    if (currentDraft?.id === id) {
      setCurrentDraft(null);
    }
  }, [drafts, currentDraft, saveDrafts]);

  // Clear all drafts
  const clearAllDrafts = useCallback(() => {
    saveDrafts([]);
    setCurrentDraft(null);
    setHasUnsavedChanges(false);
  }, [saveDrafts]);

  // Update data reference
  const updateData = useCallback((data: Record<string, any>) => {
    dataRef.current = data;
    setHasUnsavedChanges(true);
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      if (hasUnsavedChanges && Object.keys(dataRef.current).length > 0) {
        saveDraft(dataRef.current);
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, hasUnsavedChanges, saveDraft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (savingTimerRef.current) {
        clearTimeout(savingTimerRef.current);
      }
    };
  }, []);

  return {
    currentDraft,
    drafts,
    isSaving,
    lastSaved,
    saveDraft,
    restoreDraft,
    deleteDraft,
    clearAllDrafts,
    hasUnsavedChanges,
  };
}

// ============================================================
// CONVENIENCE HOOKS
// ============================================================

export function useQuickDraft(formId: string, data: Record<string, any>) {
  const draft = useAutosaveDraft({
    formId,
    enabled: true,
    interval: 30 * 1000,
  });

  // Update data when it changes
  useEffect(() => {
    draft.saveDraft(data);
  }, [data]);

  return draft;
}

export default useAutosaveDraft;
