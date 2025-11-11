const FALLBACK_API_BASE_URL = "http://localhost:3000/api";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || FALLBACK_API_BASE_URL;

if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    `[env] EXPO_PUBLIC_API_BASE_URL non défini, fallback sur ${FALLBACK_API_BASE_URL}`,
  );
}

export const env = {
  API_BASE_URL,
};

