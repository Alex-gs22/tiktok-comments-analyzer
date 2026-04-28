"use client";

import { createContext, useContext, useMemo, useState } from 'react';

const SidebarStateContext = createContext(null);

export function SidebarStateProvider({ children }) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const value = useMemo(() => {
    const isOpen = isPinned || isHovered;

    return {
      isPinned,
      setIsPinned,
      isHovered,
      setIsHovered,
      isOpen,
    };
  }, [isPinned, isHovered]);

  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>;
}

export function useSidebarState() {
  const context = useContext(SidebarStateContext);

  if (!context) {
    throw new Error('useSidebarState must be used within a SidebarStateProvider');
  }

  return context;
}