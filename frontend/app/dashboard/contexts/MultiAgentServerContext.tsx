"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useMultiAgentServer, type UseMultiAgentServerReturn } from '../hooks/useMultiAgentServer';

const MultiAgentServerContext = createContext<UseMultiAgentServerReturn | undefined>(undefined);

interface MultiAgentServerProviderProps {
  children: ReactNode;
  authToken?: string | null;
}

export function MultiAgentServerProvider({ children, authToken }: MultiAgentServerProviderProps) {
  const server = useMultiAgentServer({ authToken });
  return (
    <MultiAgentServerContext.Provider value={server}>
      {children}
    </MultiAgentServerContext.Provider>
  );
}

export function useMultiAgentServerContext(): UseMultiAgentServerReturn {
  const context = useContext(MultiAgentServerContext);
  if (context === undefined) {
    throw new Error('useMultiAgentServerContext must be used within a MultiAgentServerProvider');
  }
  return context;
}
