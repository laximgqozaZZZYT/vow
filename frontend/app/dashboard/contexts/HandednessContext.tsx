"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Handedness = 'left' | 'right';

interface HandednessContextType {
  handedness: Handedness;
  setHandedness: (handedness: Handedness) => void;
  isLeftHanded: boolean;
  isRightHanded: boolean;
}

const HandednessContext = createContext<HandednessContextType | undefined>(undefined);

const STORAGE_KEY = 'vow-handedness';

export function HandednessProvider({ children }: { children: ReactNode }) {
  const [handedness, setHandednessState] = useState<Handedness>('right');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'left' || stored === 'right') {
      setHandednessState(stored);
    }
  }, []);

  const setHandedness = (newHandedness: Handedness) => {
    setHandednessState(newHandedness);
    if (isClient) {
      localStorage.setItem(STORAGE_KEY, newHandedness);
    }
  };

  const value: HandednessContextType = {
    handedness,
    setHandedness,
    isLeftHanded: handedness === 'left',
    isRightHanded: handedness === 'right',
  };

  return (
    <HandednessContext.Provider value={value}>
      {children}
    </HandednessContext.Provider>
  );
}

export function useHandedness() {
  const context = useContext(HandednessContext);
  if (context === undefined) {
    throw new Error('useHandedness must be used within a HandednessProvider');
  }
  return context;
}
