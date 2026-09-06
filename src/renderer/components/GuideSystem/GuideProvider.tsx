import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { GuideData, GuideContextType } from './types';
import { guideRegistry } from './guides';

const GuideContext = createContext<GuideContextType | undefined>(undefined);

const SEEN_GUIDES_KEY = 'mahaveerji-seen-guides';

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [currentGuide, setCurrentGuide] = useState<GuideData | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);
  const [seenGuides, setSeenGuides] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(SEEN_GUIDES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(SEEN_GUIDES_KEY, JSON.stringify(seenGuides));
  }, [seenGuides]);

  const openGuide = useCallback((pageId: string) => {
    const guide = guideRegistry[pageId];
    if (guide) {
      setCurrentGuide(guide);
      setIsGuideOpen(true);
      setSeenGuides(prev => {
        if (!prev.includes(pageId)) {
          return [...prev, pageId];
        }
        return prev;
      });
    }
  }, []);

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setCurrentGuide(null), 300);
  }, []);

  const markAsSeen = useCallback((pageId: string) => {
    setSeenGuides(prev => {
      if (!prev.includes(pageId)) {
        return [...prev, pageId];
      }
      return prev;
    });
  }, []);

  return (
    <GuideContext.Provider value={{ openGuide, closeGuide, currentGuide, isGuideOpen, seenGuides, markAsSeen }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return context;
}
