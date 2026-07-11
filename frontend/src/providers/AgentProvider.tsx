"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";

interface ActiveAgent {
  id: string;
  name: string;
  systemPrompt: string;
}

interface AgentContextType {
  activeAgent: ActiveAgent | null;
  setActiveAgent: (agent: ActiveAgent | null) => void;
  clearAgent: () => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [activeAgent, setActiveAgent] = useState<ActiveAgent | null>(null);

  const clearAgent = useCallback(() => {
    setActiveAgent(null);
  }, []);

  return (
    <AgentContext.Provider value={{ activeAgent, setActiveAgent, clearAgent }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const context = useContext(AgentContext);
  if (!context) {
    // Return a no-op version if not wrapped in provider (graceful fallback)
    return {
      activeAgent: null,
      setActiveAgent: () => {},
      clearAgent: () => {},
    };
  }
  return context;
}
