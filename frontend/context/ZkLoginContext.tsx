"use client";

/**
 * ZkLoginContext — provides the current zkLogin session to all components.
 * No traditional auth (no JWT cookies, no DB users) — identity = wallet address.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getZkLoginSession, clearZkLoginSession, initiateZkLogin } from "@/utils/zklogin";
import { suiClient } from "@/utils/sui";
import type { ZkLoginSession } from "@/utils/zklogin";

interface ZkLoginContextValue {
  session: ZkLoginSession | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const ZkLoginContext = createContext<ZkLoginContextValue | null>(null);

export function ZkLoginProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ZkLoginSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const s = getZkLoginSession();
    setSession(s);
    setIsLoading(false);
  }, []);

  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      await initiateZkLogin(suiClient);
      // Page will redirect to Google — execution stops here
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
    <ZkLoginContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </ZkLoginContext.Provider>
  );
}

export function useZkLogin(): ZkLoginContextValue {
  const ctx = useContext(ZkLoginContext);
  if (!ctx) throw new Error("useZkLogin must be used inside ZkLoginProvider");
  return ctx;
}
