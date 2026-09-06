import { useEffect, useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTabs } from '../context/TabContext';

let suppressNavigationWarning = false;

export function suppressUnsavedWarning() {
  suppressNavigationWarning = true;
}

interface UseUnsavedChangesWarningOptions {
  isDirty: boolean;
  onSaveDraft?: () => void;
  hasDraftSupport?: boolean;
}

export function useUnsavedChangesWarning({
  isDirty,
  onSaveDraft,
  hasDraftSupport = false,
}: UseUnsavedChangesWarningOptions) {
  const { activeTabId, setTabDirty } = useTabs();
  const location = useLocation();
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const isDirtyRef = useRef(isDirty);
  const activeTabIdRef = useRef(activeTabId);
  const mountedRef = useRef(true);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setTabDirty(activeTabId, isDirty);
  }, [activeTabId, isDirty, setTabDirty]);

  const handleConfirmNavigation = useCallback(() => {
    suppressNavigationWarning = true;
    setShowDialog(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [pendingNavigation, navigate]);

  const handleCancelNavigation = useCallback(() => {
    setShowDialog(false);
    setPendingNavigation(null);
  }, []);

  const handleSaveDraft = useCallback(() => {
    if (onSaveDraft) {
      onSaveDraft();
      setShowDialog(false);
      setPendingNavigation(null);
    }
  }, [onSaveDraft]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && !suppressNavigationWarning) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    if (suppressNavigationWarning) {
      suppressNavigationWarning = false;
    }
  }, [location.pathname]);

  return {
    showDialog,
    setShowDialog,
    pendingNavigation,
    setPendingNavigation,
    handleConfirmNavigation,
    handleCancelNavigation,
    handleSaveDraft,
    hasDraftSupport,
  };
}
