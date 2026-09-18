import type {
  AuthResponse,
  ConversationSummary,
  Message,
  UserProfile,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Carries the server's HTTP status alongside its `{ error }` message so callers
// can both show the message and branch on the status (e.g. 401 → sign out).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "Something went wrong. Please try again.";
    throw new ApiError(res.status, message);
  }

  return data as T;
}

// Typed calls for the endpoints the client uses. Grows with each feature.
export const api = {
  signup: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: { username, password },
    }),
  login: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    }),
  me: (token: string) => request<UserProfile>("/api/me", { token }),
  updateMe: (
    token: string,
    patch: Partial<Pick<UserProfile, "first_name" | "last_name" | "bio">>,
  ) => request<UserProfile>("/api/me", { method: "PATCH", body: patch, token }),
  searchUsers: (token: string, q: string, offset = 0) =>
    request<UserProfile[]>(
      `/api/users?q=${encodeURIComponent(q)}&offset=${offset}`,
      { token },
    ),
  listConversations: (token: string) =>
    request<ConversationSummary[]>("/api/conversations", { token }),
  openConversation: (token: string, username: string) =>
    request<ConversationSummary>("/api/conversations", {
      method: "POST",
      body: { username },
      token,
    }),
  getMessages: (token: string, conversationId: number, before?: number) =>
    request<Message[]>(
      `/api/conversations/${conversationId}/messages${
        before ? `?before=${before}` : ""
      }`,
      { token },
    ),
  deleteMe: (token: string, password: string) =>
    request<null>("/api/me", { method: "DELETE", body: { password }, token }),
};
