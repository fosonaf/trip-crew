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
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ user, token, isHydrated }, setAuthState] = useState(() => ({
    user: null as User | null,
    token: null as string | null,
    isHydrated: false,
  }));

  const normalizeUser = useCallback(
    (value: User): User => ({
      ...value,
      avatarUrl: value.avatarUrl ?? null,
      phone: value.phone ?? null,
    }),
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    startTransition(() => {
      const storedUser = loadUser();
      setAuthState({
        user: storedUser ? normalizeUser(storedUser) : null,
        token: loadToken(),
        isHydrated: true,
      });
    });
  }, [normalizeUser]);

  const login = useCallback(
    (data: { user: User; token: string }) => {
      const normalized = normalizeUser(data.user);
      setAuthState({ user: normalized, token: data.token, isHydrated: true });
      persistToken(data.token);
      persistUser(normalized);
    },
    [normalizeUser],
  );

  const logout = useCallback(() => {
    setAuthState({ user: null, token: null, isHydrated: true });
    clearAuthStorage();
  }, []);

  const updateUser = useCallback(
    (nextUser: User) => {
      const normalized = normalizeUser(nextUser);
      setAuthState((prev) => ({
        user: normalized,
        token: prev.token,
        isHydrated: true,
      }));
      persistUser(normalized);
    },
    [normalizeUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isHydrated,
      login,
      logout,
      updateUser,
    }),
    [user, token, isHydrated, login, logout, updateUser],
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

