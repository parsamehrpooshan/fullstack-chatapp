# done — Completed Work Log

Append-only. One entry per finished feature, newest at the top. Format:

```
## YYYY-MM-DD — F# Feature name
- What shipped (1-3 bullets)
- Deviations from the spec, if any, and where the docs were updated
```

---

## 2026-07-10 — F6 Polish  ·  build order complete
Polish:
- Message pane: bottom-aware auto-scroll — jumps to the latest on a conversation
  switch or a message you sent, follows along when you're already at the bottom,
  and otherwise shows a "↓ New messages" nudge instead of yanking the view while
  you read history.
- Connection status: a global, unobtrusive "Disconnected — reconnecting…" banner
  under the header, shown only after the socket has connected at least once (no
  startup flash) and cleared automatically on reconnect.
- Loading/empty states: a small loader instead of a blank screen during initial
  load; consistent empty and loading states across the sidebar and message pane.
- Failed send: the error is surfaced and the typed draft is preserved so it can
  be resent; the error clears as soon as you edit the draft.
- Consistency + responsiveness: coherent spacing/radii/focus rings; layout holds
  at 375px (one-pane-at-a-time chat, no horizontal scroll).

Added to F6 mid-feature (spec edit in features.md):
- **Infinite scroll + pagination.** `GET /api/users` is now paginated by `offset`
  (≤ 15/page) and the sidebar search loads more matches as you scroll.
  `GET /api/conversations/:id/messages` takes an optional `before=<id>` cursor
  (50/page) and the message pane pages older history upward, anchoring the scroll
  position so it doesn't jump on prepend. API contract updated for both.
- **Logout confirmation** — the header's "Log out" now opens a small confirm
  dialog (`LogoutDialog`) before tearing down the session.
- Verified pagination over HTTP: search returns 15 then 6 with no overlap;
  messages return the latest 50, then the 10 older via `before`, then empty.

Client builds/type-checks clean; server type-checks clean.

This is the last item in the planned build order (F0–F6). The project's stated
"Done means" criteria are met. Anything further lives in features.md → "Later"
and must be promoted to a numbered feature before implementation.

## 2026-07-10 — F5 Delete account
- Server: `DELETE /api/me` re-checks the password (bcrypt; 401 on mismatch), then
  anonymizes the row in one transaction — `username = 'deleted#<id>'`, profile
  fields and `password_hash` blanked, `deleted_at` set — and force-disconnects the
  user's live sockets via a new `disconnectUser(id)` in `sockets.ts`. Messages are
  kept (valid sender_id), so peers retain history. Returns 204.
- Client: a "Danger zone" on `/profile` opens a `DeleteAccountDialog`
  (type-password-to-confirm, Escape/backdrop to cancel); on success it tears down
  the socket + session and returns to `/login`, surfacing a wrong-password 401
  inline. The message pane disables the composer for a deleted peer with a note.
- Verified end to end: wrong/right password → 401/204; the deleting user's socket
  is force-disconnected; the old JWT is dead on REST (401) and the socket
  (`connect_error`); login as the deleted user → 401; the peer sees the
  conversation as "Deleted User" (username `deleted#<id>`, blank fields) with
  history intact and `message:send` acking an error; the DB row confirms no
  profile data or password hash remains. Server type-checks and client builds
  clean.
- Docs: added `DeleteAccountDialog` to architecture.md's component list. No
  contract change (DELETE shape + anonymize decision were already specified).

## 2026-07-10 — F4 Realtime messaging
- Server: `sockets.ts` attaches Socket.IO to the HTTP server (index.ts now builds
  an `http.Server` so REST + WebSockets share one port). JWT is authenticated in
  the handshake — missing/invalid/expired/deleted-account tokens are rejected
  with `connect_error("Not authenticated")`; each socket joins `user:<id>`.
  `message:send` validates (participant → non-empty, ≤ 2000 → peer not deleted),
  INSERTs, acks `{ok,message}`, and emits `message:new` to both participants'
  rooms. `GET /api/conversations/:id/messages` returns the last 50 oldest-first
  (403 non-participant, 404 missing).
- Client: `lib/socket.ts` singleton (connect with token, `sendMessage` with ack,
  close on logout). MessagePane now renders history (REST) + live messages with
  own/peer bubbles, sender captions, local-time stamps, and a composer (Enter to
  send, never optimistic). The chat page wires `message:new` to append to the
  open conversation and bump/insert the sidebar (refetching when the conversation
  is unknown), recovers history on reconnect, shows a reconnecting note, and
  signs out on an auth `connect_error`.
- Verified with a two-client socket test: instant delivery to both sides, room
  isolation (a third user gets nothing), bad/empty token → connect_error, and
  ack errors for empty/too-long/non-participant/unknown-conversation sends;
  content is trimmed and persisted (survives restart); history REST returns
  oldest-first with 403/404. Server type-checks and client builds clean.
- No architecture/contract change: `sockets.ts`, `lib/socket.ts`, and the socket
  event/endpoint shapes were already specified.

## 2026-07-10 — F3 Find people & conversations
- Server: `GET /api/users?q=` (username prefix search, ≤ 10, excludes self and
  deleted, escapes LIKE metacharacters so `_` matches literally, 400 on empty q);
  `POST /api/conversations` get-or-create (normalizes the pair to
  `user_a < user_b` so exactly one row exists per pair — 201 created / 200
  existing, 404 unknown, 409 deleted, 400 self); `GET /api/conversations`
  (peer + last message, ordered by last activity). New `conversations.ts`; shared
  `Message`/`ConversationSummary` types; row-mapping helpers exported from
  `auth.ts`.
- Client: `/chat` is now a real two-pane layout — a sidebar with debounced
  username search and a conversation list (avatar, display name, last-message
  preview, local time), beside a message pane that shows the selected peer's
  header. Responsive: one pane at a time under `md`, with a back control. Added
  `lib/time.ts` (UTC→local at render) and the `api` calls. The message pane is
  intentionally empty — history + sending land in F4.
- Verified over HTTP: search excludes self/deleted and 400s on empty q;
  get-or-create returns the same conversation id from either direction (one DB
  row per pair confirmed); self/unknown/deleted → 400/404/409; list ordering and
  peer/last-message shape correct. Client type-checks/builds clean.
- Docs: added `lib/time.ts` and Sidebar/MessagePane to architecture.md's layout.
  No contract change (endpoints/shapes were already specified).

## 2026-07-10 — F2 Profile
- Server: `PATCH /api/me` — updates any of first_name / last_name / bio, trimming
  and length-checking each field it receives (names ≤ 40, bio ≤ 200, all may be
  empty). Uses a single static, fully parameterized UPDATE seeded from current
  values, so fields not sent are left untouched without any dynamic SQL (rule 5).
- Client: `lib/user.ts` (display-name rule, initials, deterministic per-username
  avatar color — all ~4.5:1 on white, gray for deleted); `Avatar` component;
  `AppHeader` (brand + profile chip + logout) now shared by `/chat` and
  `/profile`. `/profile` is a view+edit form with a live "how you appear"
  preview, a bio counter, server-driven validation errors, and explicit
  saved/unsaved feedback; on save it adopts the server's trimmed values and
  refreshes the cached session.
- Verified over HTTP: partial updates (bio-only leaves names intact), trimming,
  clear-to-empty, over-long name/bio → 400 with the server's message, non-string
  → 400, no-auth → 401; `GET /api/me` reflects saves. Client type-checks/builds
  clean; display-name and initials logic traced against the contract.
- Docs: added `lib/user.ts` and `AppHeader` to architecture.md's client layout.
  No contract change (PATCH shape was already specified).

## 2026-07-10 — F1 Auth
- Server: `POST /api/auth/signup` and `/api/auth/login` (bcrypt hashing, JWT with
  7-day expiry, all raw parameterized SQL), a `requireAuth` middleware that
  rejects missing/invalid/expired tokens **and** deleted accounts, and the first
  protected route `GET /api/me`. Shared `UserProfile`/`AuthResponse` in
  `src/types.ts`. Login returns one generic 401 for both wrong-password and
  unknown-user (no account enumeration, rule 9).
- Client: `lib/types.ts` (contract mirror), `lib/api.ts` (fetch wrapper + typed
  `ApiError`), `lib/auth.ts` (localStorage session). `/signup` + `/login` share
  an `AuthForm` with inline server errors; root `page.tsx` redirects on token;
  `/chat` is a placeholder that validates the token via `GET /api/me` and hosts
  logout.
- Verified: signup/login/me and every error path over HTTP (409 dup, 400 format,
  401 bad creds with identical message, 401 no/bad token); password stored as a
  60-char `$2b$` bcrypt hash; JWT TTL = 7 days; both apps type-check/build clean;
  all pages serve.
- Design system (first UI; source of truth is `client/app/globals.css`): concept
  "a direct line between two people" — warm porcelain canvas `#F6F5F1`, deep pine
  brand `#1F4D3D`, live emerald signal `#12B886`, ink `#16201B`. Type: Bricolage
  Grotesque (display) + Inter (body) + JetBrains Mono (uppercase micro-labels).
  Signature: a two-node-joined-by-a-line mark with a pulsing emerald node. Carry
  this into F2/F3/F6.
- No contract or architecture changes (endpoints/shapes were already specified);
  `Brand`/`AuthForm` fit the existing `components/` slot.

## 2026-07-10 — F0 Scaffolding
- Monorepo skeleton: a hand-written TypeScript Express server (`GET /api/health`,
  `db.ts` creating the full schema, `env.ts` config validation that refuses to
  start without `JWT_SECRET`) and a create-next-app client (TypeScript, Tailwind,
  App Router, ESLint, no `src/` dir).
- Added env files, `.gitignore`s, and a root `README.md`. Verified: both apps
  type-check/build clean and run (server :4000, client :3000); the health endpoint
  answers `{"ok":true}`; first server start creates `chat.db` with the
  users/conversations/messages tables (WAL + foreign keys on); starting without
  `JWT_SECRET` exits cleanly and creates no database.
- Deviations: added `server/src/env.ts` (config validation, not in the original
  folder layout) — recorded in `architecture.md`. Installed only F0's runtime deps
  (express, cors, better-sqlite3); jsonwebtoken/bcryptjs/socket.io land with the
  features that use them.

## 2026-07-09 — Context designed
- Project defined: DM messenger (instant DMs, initials avatars, anonymize on
  delete). Seven context docs written; no code yet.
