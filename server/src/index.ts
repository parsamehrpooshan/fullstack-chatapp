// Import order matters: env.js validates configuration (and exits on failure)
// before db.js opens the SQLite file or the port is bound.
import { PORT, CLIENT_URL } from "./env.js";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { authRouter } from "./auth.js";
import { usersRouter } from "./users.js";
import { conversationsRouter } from "./conversations.js";
import { createSocketServer } from "./sockets.js";

const app = express();

// Client and server run on different ports, so CORS is required.
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter); // POST /api/auth/signup, /api/auth/login
app.use("/api", usersRouter); // GET /api/me, PATCH /api/me, GET /api/users
app.use("/api/conversations", conversationsRouter); // REST + message history

// Socket.IO shares the HTTP server so REST and WebSockets live on one port.
const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(PORT, () => {
  // Touch db so the import is not flagged unused and the schema is created
  // eagerly on startup rather than on first query.
  const tables = db
    .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'")
    .get() as { n: number };
  console.log(
    `Server listening on http://localhost:${PORT} (${tables.n} tables ready)`,
  );
});
