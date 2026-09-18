import type { UserProfile } from "./types";

// The token and a snapshot of the user live in localStorage. It's the simplest
// thing that survives a reload; the decision log (architecture.md) notes the
// XSS trade-off and that httpOnly cookies are required before any deployment.
const TOKEN_KEY = "dm.token";
const USER_KEY = "dm.user";

export function saveSession(token: string, user: UserProfile): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
