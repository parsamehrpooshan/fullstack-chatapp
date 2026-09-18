# DM Messenger — Learning Project

A 1-on-1 realtime messenger: username/password auth, editable profiles, find
people by username, instant chat over websockets, delete account. This is a
learning project: prefer readable, idiomatic code; record decisions in docs,
never only in chat.

## Session protocol

1. Read `docs/current-task.md` first — it defines the only work in scope.
2. Read whichever docs the task touches (see map below) before writing code.
3. Implement the task as a vertical slice (DB → API → UI); verify every item
   on its checklist.
4. On completion: append an entry to `docs/done.md`, load the next feature
   from `docs/features.md` into `docs/current-task.md`, update any doc the
   implementation changed, then commit.

Everything in `docs/rules.md` is binding for every change.

## Commands

- Server dev: `npm run dev --prefix server` → http://localhost:4000
- Client dev: `npm run dev --prefix client` → http://localhost:3000

## Tooling

- **Context7 MCP**: before implementing against a library API (Next.js App
  Router, Socket.IO, better-sqlite3, Tailwind config), fetch current docs via
  Context7 and prefer them over training data — at plan time and
  implementation time, not only when I ask a question.
- **frontend-design skill**: invoke it before building or restyling any UI
  (F2 profile page, F3 chat layout, F6 polish pass).

## Docs map

| File | What it answers |
|---|---|
| `docs/project.md` | What are we building and why? What's out of scope? |
| `docs/features.md` | Every feature's spec and acceptance criteria, in build order |
| `docs/stack.md` | Technologies, why each was chosen, commands, env vars |
| `docs/rules.md` | Non-negotiable engineering rules |
| `docs/architecture.md` | System design, data model, API contract, decision log |
| `docs/done.md` | Log of completed features |
| `docs/current-task.md` | The single active task and its checklist |
