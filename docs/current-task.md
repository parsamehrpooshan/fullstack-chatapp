# current-task — The Single Active Task

**Task:** — none —
**Status:** build order complete (F0–F6 all shipped; see `docs/done.md`).

There is no active task. The planned feature set is finished and the project's
"Done means" criteria in `docs/project.md` are met.

## Starting the next piece of work

Anything beyond this point lives in `features.md` → **Later** (typing indicator,
online presence, unread badges, history pagination, avatar image upload,
blocking users, rate limiting, group chats, httpOnly-cookie auth). None of it is
in scope until promoted.

To pick one up:

1. Promote it into `features.md` as a numbered feature (F7, F8, …) with a spec
   and acceptance criteria, in build order.
2. Copy that feature into this file as the single active task, with a scope,
   out-of-scope, and a verifiable checklist.
3. Follow the session protocol in `CLAUDE.md` (read the docs it touches, build a
   vertical slice, verify, then update `done.md` and commit).

Before any real deployment, the pre-req called out across the docs is
**httpOnly-cookie auth** (replacing the localStorage JWT); blocking users is the
other gate named in `project.md`.
