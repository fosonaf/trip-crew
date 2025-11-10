"use client";

import type { User } from "@/types/auth";

const TOKEN_KEY = "tripcrew_token";
const USER_KEY = "tripcrew_user";

const isBrowser = typeof window !== "undefined";

export const loadToken = (): string | null => {
  if (!isBrowser) {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
};

export const persistToken = (token: string | null): void => {
  if (!isBrowser) {
    return;
  }
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const loadUser = (): User | null => {
  if (!isBrowser) {
    return null;
  }
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const persistUser = (user: User | null): void => {
  if (!isBrowser) {
    return;
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

export const clearAuthStorage = (): void => {
  if (!isBrowser) {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

