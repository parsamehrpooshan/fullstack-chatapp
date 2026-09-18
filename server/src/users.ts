import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import {
  requireAuth,
  getProfileById,
  getUserRowById,
  toUserProfile,
  type UserRow,
} from "./auth.js";
import { disconnectUser } from "./sockets.js";

export const usersRouter = Router();

// One page of prefix search results, excluding the caller and deleted accounts.
// ESCAPE '\' so that `_` (a valid username char and a LIKE wildcard) matches
// literally instead of any-single-character.
const USERS_PAGE = 15;
const searchUsers = db.prepare(
  `SELECT * FROM users
   WHERE username LIKE ? ESCAPE '\\' COLLATE NOCASE
     AND id != ?
     AND deleted_at IS NULL
   ORDER BY username COLLATE NOCASE
   LIMIT ? OFFSET ?`,
);

// Editable profile fields and their limits (architecture.md §validation). Order
// matches the UPDATE statement below.
const FIELDS = [
  { key: "first_name", label: "First name", max: 40 },
  { key: "last_name", label: "Last name", max: 40 },
  { key: "bio", label: "Bio", max: 200 },
] as const;

const updateProfile = db.prepare(
  "UPDATE users SET first_name = ?, last_name = ?, bio = ? WHERE id = ?",
);

// Anonymize on delete (architecture.md §Data model): the row stays so messages
// keep a valid sender_id, but every trace of the person is erased and the
// username is moved outside the registerable alphabet via `#`.
const anonymizeUser = db.prepare(
  `UPDATE users
   SET username = ?, first_name = '', last_name = '', bio = '',
       password_hash = '', deleted_at = datetime('now')
   WHERE id = ?`,
);

// GET /api/me — the caller's own profile. requireAuth has already verified the
// user exists and is not deleted, so a miss here is a safety net, not expected.
usersRouter.get("/me", requireAuth, (req: Request, res: Response) => {
  const profile = getProfileById(req.userId!);
  if (!profile) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  return res.json(profile);
});

// PATCH /api/me — update any of first_name / last_name / bio. Fields not present
// in the body keep their current value; the server trims and length-checks every
// field it does receive (rule 7).
usersRouter.patch("/me", requireAuth, (req: Request, res: Response) => {
  const current = getProfileById(req.userId!);
  if (!current) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const body: Record<string, unknown> =
    req.body && typeof req.body === "object" ? req.body : {};

  // Start from the current values so a static, fully parameterized UPDATE can
  // rewrite all three columns while leaving unsent fields effectively untouched.
  const next = {
    first_name: current.first_name,
    last_name: current.last_name,
    bio: current.bio,
  };

  for (const { key, label, max } of FIELDS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (typeof value !== "string") {
      return res.status(400).json({ error: `${label} must be text.` });
    }
    const trimmed = value.trim();
    if (trimmed.length > max) {
      return res
        .status(400)
        .json({ error: `${label} must be at most ${max} characters.` });
    }
    next[key] = trimmed;
  }

  updateProfile.run(next.first_name, next.last_name, next.bio, req.userId!);
  return res.json(getProfileById(req.userId!));
});

// DELETE /api/me — permanently delete the caller's account. Requires the current
// password; anonymizes the row in one transaction; then drops the user's live
// sockets. The old JWT is dead immediately (requireAuth + the socket handshake
// both check deleted_at).
usersRouter.delete("/me", requireAuth, async (req: Request, res: Response) => {
  const me = req.userId!;
  const body: Record<string, unknown> =
    req.body && typeof req.body === "object" ? req.body : {};
  const password = typeof body.password === "string" ? body.password : "";

  const row = getUserRowById(me);
  if (!row || row.deleted_at !== null) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  const ok = row.password_hash.length > 0 && (await bcrypt.compare(password, row.password_hash));
  if (!ok) {
    return res.status(401).json({ error: "Password is incorrect." });
  }

  db.transaction(() => anonymizeUser.run(`deleted#${me}`, me))();
  disconnectUser(me);

  return res.status(204).end();
});

// GET /api/users?q=&offset= — paginated username prefix search. Returns up to
// USERS_PAGE results per call; the client requests the next page by offset and
// keeps loading until a short page comes back.
usersRouter.get("/users", requireAuth, (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length === 0) {
    return res.status(400).json({ error: "Search for a username." });
  }
  const parsedOffset = Number(req.query.offset);
  const offset = Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
  // Escape LIKE metacharacters in the user's input, then anchor as a prefix.
  const pattern = q.replace(/[\\%_]/g, (c) => `\\${c}`) + "%";
  const rows = searchUsers.all(
    pattern,
    req.userId!,
    USERS_PAGE,
    offset,
  ) as UserRow[];
  return res.json(rows.map(toUserProfile));
});
