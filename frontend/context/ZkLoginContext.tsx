"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getZkLoginSession, clearZkLoginSession, initiateZkLogin } from "@/utils/zklogin";
import { suiClient } from "@/utils/sui";
import type { ZkLoginSession } from "@/utils/zklogin";

interface ZkLoginContextValue {
  session: ZkLoginSession | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  refreshSession: () => void;
}

const ZkLoginContext = createContext<ZkLoginContextValue | null>(null);

export function ZkLoginProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ZkLoginSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(() => {
    const s = getZkLoginSession();
    setSession(s);
  }, []);

  // Read session on mount
  useEffect(() => {
    refreshSession();
    setIsLoading(false);
  }, [refreshSession]);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      await initiateZkLogin(suiClient);
      // Redirects to Google — execution stops here
    } catch (err) {
      console.error("zkLogin initiation failed:", err);
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearZkLoginSession();
    setSession(null);
  }, []);

  return (
    <ZkLoginContext.Provider value={{ session, isLoading, login, logout, refreshSession }}>
      {children}
    </ZkLoginContext.Provider>
  );
}

export function useZkLogin(): ZkLoginContextValue {
  const ctx = useContext(ZkLoginContext);
  if (!ctx) throw new Error("useZkLogin must be used inside ZkLoginProvider");
  return ctx;
}
