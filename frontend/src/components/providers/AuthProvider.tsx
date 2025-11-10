"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@/types/auth";
import {
  clearAuthStorage,
  loadToken,
  loadUser,
  persistToken,
  persistUser,
} from "@/lib/storage";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  login: (data: { user: User; token: string }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ user, token, isHydrated }, setAuthState] = useState(() => ({
    user: null as User | null,
    token: null as string | null,
    isHydrated: false,
  }));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    startTransition(() => {
      setAuthState({
        user: loadUser(),
        token: loadToken(),
        isHydrated: true,
      });
    });
  }, []);

  const login = useCallback((data: { user: User; token: string }) => {
    setAuthState({ user: data.user, token: data.token, isHydrated: true });
    persistToken(data.token);
    persistUser(data.user);
  }, []);

  const logout = useCallback(() => {
    setAuthState({ user: null, token: null, isHydrated: true });
    clearAuthStorage();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isHydrated,
      login,
      logout,
    }),
    [user, token, isHydrated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}

