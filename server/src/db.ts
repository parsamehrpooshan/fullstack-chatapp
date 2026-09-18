import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

// chat.db lives at the server/ root whether we run from src/ (tsx, dev) or
// dist/ (compiled, start) — this file sits one level below in both cases.
const DB_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "chat.db",
);

// The schema is the source of truth in docs/architecture.md §Data model.
// It runs on every startup (IF NOT EXISTS) so a fresh clone boots with zero
// setup; deleting chat.db* resets all data.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  first_name    TEXT    NOT NULL DEFAULT '',
  last_name     TEXT    NOT NULL DEFAULT '',
  bio           TEXT    NOT NULL DEFAULT '',
  deleted_at    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES users(id),
  user_b     INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id),
  content         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_conversations_a ON conversations(user_a);
CREATE INDEX IF NOT EXISTS idx_conversations_b ON conversations(user_b);
`;

export const db = new Database(DB_PATH);

// WAL lets readers proceed without blocking the single writer; foreign key
// enforcement must be switched on per connection (SQLite ships it OFF).
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);
