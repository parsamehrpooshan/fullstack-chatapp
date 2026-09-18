import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET, CLIENT_URL } from "./env.js";
import { db } from "./db.js";
import { getUserRowById } from "./auth.js";
import type { Message } from "./types.js";

const MAX_CONTENT = 2000;

// --- Socket event contract (mirrors architecture.md §Socket.IO) ---

type SendAck =
  | { ok: true; message: Message }
  | { ok: false; error: string };

interface ClientToServerEvents {
  "message:send": (
    payload: { conversation_id: number; content: string },
    ack: (res: SendAck) => void,
  ) => void;
}

interface ServerToClientEvents {
  "message:new": (message: Message) => void;
}

interface SocketData {
  userId: number;
}

type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

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

const getConversation = db.prepare(
  "SELECT * FROM conversations WHERE id = ?",
);
const insertMessage = db.prepare(
  "INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)",
);
const getMessageById = db.prepare("SELECT * FROM messages WHERE id = ?");

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: row.content,
    created_at: row.created_at,
  };
}

// The room a user's messages are delivered to. Every socket joins its own on
// connect; delivering a message is just an emit to both participants' rooms
// (architecture.md §Socket routing model).
function room(userId: number): string {
  return `user:${userId}`;
}

// Module-level handle to the running server so non-socket code (e.g. the
// account-deletion route) can act on live connections.
let ioRef: ChatServer | null = null;

// Force every live socket for a user to disconnect — used the moment an account
// is deleted, so a still-open tab can't keep acting as that user.
export function disconnectUser(userId: number): void {
  ioRef?.in(room(userId)).disconnectSockets(true);
}

export function createSocketServer(httpServer: HttpServer): ChatServer {
  const io: ChatServer = new Server(httpServer, {
    cors: { origin: CLIENT_URL },
  });
  ioRef = io;

  // Authenticate once, at the handshake — there is no per-event auth. A missing,
  // invalid, expired, or deleted-account token is rejected with connect_error.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0) {
      return next(new Error("Not authenticated"));
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (typeof payload === "string" || typeof payload.userId !== "number") {
        throw new Error("bad payload");
      }
      const user = getUserRowById(payload.userId);
      if (!user || user.deleted_at !== null) {
        throw new Error("no such user");
      }
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(room(userId));

    socket.on("message:send", (payload, ack) => {
      const done =
        typeof ack === "function" ? ack : () => undefined;

      const conversationId = Number(payload?.conversation_id);
      const content =
        typeof payload?.content === "string" ? payload.content.trim() : "";

      if (!Number.isInteger(conversationId)) {
        return done({ ok: false, error: "Unknown conversation." });
      }
      if (content.length === 0) {
        return done({ ok: false, error: "Message can't be empty." });
      }
      if (content.length > MAX_CONTENT) {
        return done({
          ok: false,
          error: `Message is too long (max ${MAX_CONTENT} characters).`,
        });
      }

      const conv = getConversation.get(conversationId) as
        | ConversationRow
        | undefined;
      if (!conv || (conv.user_a !== userId && conv.user_b !== userId)) {
        return done({ ok: false, error: "Conversation not found." });
      }

      const peerId = conv.user_a === userId ? conv.user_b : conv.user_a;
      const peer = getUserRowById(peerId);
      if (!peer || peer.deleted_at !== null) {
        return done({ ok: false, error: "That account no longer exists." });
      }

      const info = insertMessage.run(conversationId, userId, content);
      const message = toMessage(
        getMessageById.get(info.lastInsertRowid) as MessageRow,
      );

      done({ ok: true, message });
      // Deliver to both participants (the sender's own tabs included, so the
      // UI renders sent messages from the authoritative row, not optimistically).
      io.to(room(userId)).to(room(peerId)).emit("message:new", message);
    });
  });

  return io;
}
