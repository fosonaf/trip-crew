import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type LoginPayload } from "@/api/auth";
import { setApiToken } from "@/api/client";
import type { User } from "@/types/auth";
import { clearToken, loadToken, saveToken } from "@/storage/token";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const isLoading = status === "idle" || status === "loading";

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      const storedToken = await loadToken();
      if (!storedToken) {
        setStatus("unauthenticated");
        return;
      }

      setApiToken(storedToken);
      setToken(storedToken);

      const { user: profile } = await authApi.profile();
      setUser(profile);
      setStatus("authenticated");
    } catch (error) {
      await clearToken();
      setStatus("unauthenticated");
      setToken(null);
      setUser(null);
      setApiToken(null);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setStatus("loading");
      try {
        const { token: authToken, user: authUser } = await authApi.login(payload);
        await saveToken(authToken);
        setApiToken(authToken);
        setToken(authToken);
        setUser(authUser);
        setStatus("authenticated");
      } catch (error) {
        setStatus("unauthenticated");
        setToken(null);
        setUser(null);
        setApiToken(null);
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    setApiToken(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      return;
    }
    const { user: profile } = await authApi.profile();
    setUser(profile);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      isLoading,
      login,
      logout,
      refreshProfile,
    }),
    [isLoading, login, logout, refreshProfile, status, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

