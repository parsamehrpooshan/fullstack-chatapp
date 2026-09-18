import { Router, type Request, type Response } from "express";
import { db } from "./db.js";
import {
  requireAuth,
  getUserRowById,
  getUserRowByUsername,
  toUserProfile,
} from "./auth.js";
import type { ConversationSummary, Message } from "./types.js";

export const conversationsRouter = Router();

interface ConversationRow {
  id: number;
  user_a: number;
  user_b: number;
  created_at: string;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
}

// Prepared statements — raw, parameterized SQL only (rule 5).
const findPair = db.prepare(
  "SELECT * FROM conversations WHERE user_a = ? AND user_b = ?",
);
const insertConversation = db.prepare(
  "INSERT INTO conversations (user_a, user_b) VALUES (?, ?)",
);
const getConversationById = db.prepare(
  "SELECT * FROM conversations WHERE id = ?",
);
const lastMessageStmt = db.prepare(
  "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1",
);
// One page of 50 messages, returned oldest-first for direct rendering. The
// `before` variant pages backwards through history (ids strictly older than the
// cursor) to support infinite scroll upward.
const MESSAGES_PAGE = 50;
const messagesPageStmt = db.prepare(
  `SELECT * FROM (
     SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?
   ) ORDER BY id ASC`,
);
const messagesBeforeStmt = db.prepare(
  `SELECT * FROM (
     SELECT * FROM messages
     WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT ?
   ) ORDER BY id ASC`,
);
// The caller's conversations, each joined to its most recent message, ordered
// by last activity (last message time, else the conversation's creation time).
const listForUser = db.prepare(
  `SELECT c.*
   FROM conversations c
   WHERE c.user_a = ? OR c.user_b = ?
   ORDER BY COALESCE(
     (SELECT m.created_at FROM messages m
      WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1),
     c.created_at
   ) DESC, c.id DESC`,
);

// A conversation between users X and Y is stored once, canonically, with the
// smaller id in user_a (matches the CHECK (user_a < user_b) constraint).
function orderedPair(x: number, y: number): [number, number] {
  return x < y ? [x, y] : [y, x];
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: row.content,
    created_at: row.created_at,
  };
}

function lastMessageFor(conversationId: number): Message | null {
  const row = lastMessageStmt.get(conversationId) as MessageRow | undefined;
  return row ? toMessage(row) : null;
}

// Build the wire summary for one conversation from the viewer's perspective:
// the peer is whichever participant isn't the viewer.
function toSummary(conv: ConversationRow, viewerId: number): ConversationSummary {
  const peerId = conv.user_a === viewerId ? conv.user_b : conv.user_a;
  const peerRow = getUserRowById(peerId)!;
  return {
    id: conv.id,
    peer: toUserProfile(peerRow),
    last_message: lastMessageFor(conv.id),
  };
}

// POST /api/conversations { username } — get-or-create a 1:1 conversation.
conversationsRouter.post("/", requireAuth, (req: Request, res: Response) => {
  const me = req.userId!;
  const body: Record<string, unknown> =
    req.body && typeof req.body === "object" ? req.body : {};
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  if (username.length === 0) {
    return res.status(400).json({ error: "Who do you want to message?" });
  }

  const peer = getUserRowByUsername(username);
  if (!peer) {
    return res.status(404).json({ error: "No user with that username." });
  }
  if (peer.id === me) {
    return res.status(400).json({ error: "You can't message yourself." });
  }
  if (peer.deleted_at !== null) {
    return res.status(409).json({ error: "That account no longer exists." });
  }

  const [a, b] = orderedPair(me, peer.id);
  const existing = findPair.get(a, b) as ConversationRow | undefined;
  if (existing) {
    return res.status(200).json(toSummary(existing, me));
  }

  const { lastInsertRowid } = insertConversation.run(a, b);
  const created = getConversationById.get(lastInsertRowid) as ConversationRow;
  return res.status(201).json(toSummary(created, me));
});

// GET /api/conversations — the caller's conversations, most recent first.
conversationsRouter.get("/", requireAuth, (req: Request, res: Response) => {
  const me = req.userId!;
  const rows = listForUser.all(me, me) as ConversationRow[];
  return res.json(rows.map((conv) => toSummary(conv, me)));
});

// GET /api/conversations/:id/messages?before= — a page of 50 messages, oldest
// first. Without `before`, the latest page; with it, the 50 messages just older
// than that id (infinite scroll upward). Participants only.
conversationsRouter.get(
  "/:id/messages",
  requireAuth,
  (req: Request, res: Response) => {
    const me = req.userId!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    const conv = getConversationById.get(id) as ConversationRow | undefined;
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    if (conv.user_a !== me && conv.user_b !== me) {
      return res.status(403).json({ error: "You're not in this conversation." });
    }
    const before = Number(req.query.before);
    const rows = (
      Number.isInteger(before) && before > 0
        ? messagesBeforeStmt.all(id, before, MESSAGES_PAGE)
        : messagesPageStmt.all(id, MESSAGES_PAGE)
    ) as MessageRow[];
    return res.json(rows.map(toMessage));
  },
);
