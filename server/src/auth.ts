import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { JWT_SECRET } from "./env.js";
import type { UserProfile } from "./types.js";

// requireAuth attaches the authenticated user's id to the request. Declared
// globally so every route handler sees it on `req` after the middleware runs.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = "7d";
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  bio: string;
  deleted_at: string | null;
  created_at: string;
}

// Map a DB row to the wire shape. A deleted user exposes no profile data.
export function toUserProfile(row: UserRow): UserProfile {
  const deleted = row.deleted_at !== null;
  return {
    id: row.id,
    username: row.username,
    first_name: deleted ? "" : row.first_name,
    last_name: deleted ? "" : row.last_name,
    bio: deleted ? "" : row.bio,
    deleted,
  };
}

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Prepared statements only — never interpolate values into SQL (rule 5).
const insertUser = db.prepare(
  "INSERT INTO users (username, password_hash) VALUES (?, ?)",
);
const findByUsername = db.prepare(
  "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
);
const findById = db.prepare("SELECT * FROM users WHERE id = ?");

// Row lookups shared with the users/conversations routers.
export function getUserRowById(id: number): UserRow | undefined {
  return findById.get(id) as UserRow | undefined;
}

export function getUserRowByUsername(username: string): UserRow | undefined {
  return findByUsername.get(username) as UserRow | undefined;
}

// Used by other routers (e.g. GET /api/me) to fetch the caller's profile
// without re-implementing the row → wire mapping.
export function getProfileById(id: number): UserProfile | undefined {
  const row = getUserRowById(id);
  return row ? toUserProfile(row) : undefined;
}

export const authRouter = Router();

authRouter.post("/signup", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error:
        "Username must be 3–20 characters using letters, numbers, or underscore.",
    });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  }

  if (findByUsername.get(username)) {
    return res.status(409).json({ error: "That username is taken." });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { lastInsertRowid } = insertUser.run(username, passwordHash);
  const user = getProfileById(Number(lastInsertRowid))!;

  return res.status(201).json({ token: signToken(user.id), user });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  const row = findByUsername.get(username) as UserRow | undefined;
  // The error never reveals which field was wrong (rule 9). A deleted account
  // has a blank password_hash, so it can never authenticate.
  const valid =
    !!row && row.deleted_at === null && row.password_hash.length > 0
      ? await bcrypt.compare(password, row.password_hash)
      : false;
  if (!valid || !row) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const user = toUserProfile(row);
  return res.json({ token: signToken(user.id), user });
});

// Gate for protected routes: a valid, unexpired JWT whose user still exists and
// is not deleted. A deleted account's token is dead even before it expires.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = (req.header("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  let userId: number;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "string" || typeof payload.userId !== "number") {
      throw new Error("malformed token payload");
    }
    userId = payload.userId;
  } catch {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const row = findById.get(userId) as UserRow | undefined;
  if (!row || row.deleted_at !== null) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  req.userId = row.id;
  next();
}
