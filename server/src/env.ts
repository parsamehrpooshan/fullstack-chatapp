// Central place where every environment variable is read and validated.
// Imported *first* in index.ts so a misconfigured server fails fast, before
// the database is opened or the HTTP port is bound.
//
// .env is loaded by Node's built-in --env-file flag (see package.json scripts),
// so there is no dotenv dependency.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing required environment variable ${name}. ` +
        `Copy server/.env.example to server/.env and fill it in. Refusing to start.`,
    );
    process.exit(1);
  }
  return value;
}

export const PORT = Number(process.env.PORT ?? 4000);

// Rule 10: JWT_SECRET has no in-code fallback — the server refuses to start
// without it. It is consumed from F1 onwards (auth), validated here from F0 on.
export const JWT_SECRET = required("JWT_SECRET");

export const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
