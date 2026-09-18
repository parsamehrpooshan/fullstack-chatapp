import { io, type Socket } from "socket.io-client";
import { getToken } from "./auth";
import type { Message } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type SendAck =
  | { ok: true; message: Message }
  | { ok: false; error: string };

interface ServerToClientEvents {
  "message:new": (message: Message) => void;
}
interface ClientToServerEvents {
  "message:send": (
    payload: { conversation_id: number; content: string },
    ack: (res: SendAck) => void,
  ) => void;
}

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// One shared connection for the whole app. The token is sent once at the
// handshake (architecture.md §Socket.IO); socket.io reconnects automatically.
let socket: ChatSocket | null = null;

export function getSocket(): ChatSocket {
  if (!socket) {
    socket = io(BASE_URL, { auth: { token: getToken() ?? "" } });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Send a message and resolve with the server's ack. The DB row in the ack (and
// the matching message:new broadcast) is the source of truth — callers never
// render optimistically.
export function sendMessage(
  conversationId: number,
  content: string,
): Promise<SendAck> {
  const s = getSocket();
  return new Promise((resolve) => {
    s.timeout(8000).emit(
      "message:send",
      { conversation_id: conversationId, content },
      (err, ack) => {
        resolve(
          err
            ? { ok: false, error: "Message didn't send — check your connection." }
            : ack,
        );
      },
    );
  });
}
