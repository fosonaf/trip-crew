import { apiClient } from "./client";
import type { AuthResponse, User } from "@/types/auth";

export type LoginPayload = {
  phone: string;
  password: string;
};

export const authApi = {
  login(payload: LoginPayload) {
    return apiClient.post<AuthResponse>("/auth/login", payload).then((res) => res.data);
  },
  profile() {
    return apiClient.get<{ user: User }>("/auth/profile").then((res) => res.data);
  },
  updateProfile(payload: {
    email?: string;
    phone?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }) {
    return apiClient.put<{ user: User }>("/auth/profile", payload).then((res) => res.data);
  },
};

