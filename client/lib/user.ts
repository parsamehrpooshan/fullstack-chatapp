import type { UserProfile } from "./types";

// The fields any user-facing display needs. Accepting a subset keeps callers
// flexible (e.g. a live form preview that isn't a full UserProfile yet).
export type DisplayUser = Pick<
  UserProfile,
  "username" | "first_name" | "last_name" | "deleted"
>;

// Display-name rule (architecture.md §API contract): "First Last" if either
// name is set, else the username; "Deleted User" when deleted.
export function displayName(user: DisplayUser): string {
  if (user.deleted) return "Deleted User";
  const full = `${user.first_name} ${user.last_name}`.trim();
  return full || user.username;
}

// Up to two initials from the display name, uppercased.
export function initials(user: DisplayUser): string {
  const name = displayName(user);
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  const alnum = name.replace(/[^a-zA-Z0-9]/g, "");
  return (alnum || name).slice(0, 2).toUpperCase();
}

// Deterministic per-username color. Same identity → same color everywhere;
// usernames are case-insensitive, so we hash the lowercased form. Every color
// clears ~4.5:1 contrast against white text.
const AVATAR_COLORS = [
  "#2e6f5e", // teal
  "#9c5228", // rust
  "#3f57b3", // indigo
  "#7a4b96", // plum
  "#a23b6d", // magenta
  "#23713f", // green
  "#8a6d15", // ochre
  "#2d6f8a", // blue
];
const DELETED_COLOR = "#6b716c"; // muted gray

function hashUsername(username: string): number {
  const s = username.toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function avatarColor(user: DisplayUser): string {
  if (user.deleted) return DELETED_COLOR;
  return AVATAR_COLORS[hashUsername(user.username) % AVATAR_COLORS.length];
}
