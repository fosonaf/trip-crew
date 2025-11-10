import type { AuthResponse } from "@/types/auth";
import { loadToken } from "./storage";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const token = auth ? loadToken() : null;
  const mergedHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth && token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: mergedHeaders,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type");
  const payload = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      (payload as { error?: string; message?: string })?.error ??
      (payload as { message?: string })?.message ??
      `Erreur API (${response.status})`;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      auth: false,
    }),
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) =>
    apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    }),
  profile: () => apiFetch<{ user: AuthResponse["user"] }>("/api/auth/profile"),
};

