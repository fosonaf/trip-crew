import type { AuthResponse, User } from "@/types/auth";
import type {
  CreateEventPayload,
  Event,
  EventDetail,
  EventSummary,
  CreateStepPayload,
  EventStep,
  PendingInvitation,
} from "@/types/event";
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
  login: (credentials: { phone: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      auth: false,
    }),
  register: (payload: {
    email?: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatarUrl?: string | null;
  }) =>
    apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    }),
  profile: () => apiFetch<{ user: User }>("/api/auth/profile"),
  updateProfile: (payload: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string | null;
  }) =>
    apiFetch<{ user: User }>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

export const eventApi = {
  create: (payload: CreateEventPayload) =>
    apiFetch<Event>("/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  list: () => apiFetch<EventSummary[]>("/api/events"),
  detail: (eventId: string) => apiFetch<EventDetail>(`/api/events/${eventId}`),
  createStep: (eventId: string, payload: CreateStepPayload) =>
    apiFetch<EventStep>(`/api/events/${eventId}/steps`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  invite: (eventId: string, payload: { phone: string }) =>
    apiFetch<{ memberId: number; message: string }>(`/api/events/${eventId}/invitations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const invitationApi = {
  pending: () => apiFetch<PendingInvitation[]>("/api/events/invitations/pending"),
  accept: (memberId: number) =>
    apiFetch<{ message: string; eventId: number }>(`/api/events/invitations/${memberId}/accept`, {
      method: "POST",
    }),
  decline: (memberId: number) =>
    apiFetch<{ message: string }>(`/api/events/invitations/${memberId}/decline`, {
      method: "POST",
    }),
};

