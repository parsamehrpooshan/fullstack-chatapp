"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { Brand } from "@/components/Brand";

type Mode = "login" | "signup";

const COPY = {
  login: {
    eyebrow: "Sign in",
    heading: "Welcome back.",
    sub: "Pick up right where you left off.",
    action: "Sign in",
    pending: "Signing in…",
    altPrompt: "New here?",
    altLink: "Create an account",
    altHref: "/signup",
    passwordAutoComplete: "current-password",
    usernameHint: undefined as string | undefined,
  },
  signup: {
    eyebrow: "Create account",
    heading: "Start a direct line.",
    sub: "Claim a username and start messaging in seconds.",
    action: "Create account",
    pending: "Creating account…",
    altPrompt: "Already have an account?",
    altLink: "Sign in",
    altHref: "/login",
    passwordAutoComplete: "new-password",
    usernameHint: "3–20 characters — letters, numbers, or underscore.",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const result =
        mode === "signup"
          ? await api.signup(username.trim(), password)
          : await api.login(username.trim(), password);
      saveSession(result.token, result.user);
      router.replace("/chat");
      // Leave `pending` true — we're navigating away, so the button stays busy.
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Can't reach the server. Make sure it's running on port 4000.",
      );
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-muted/50 focus:border-signal focus:ring-4 focus:ring-signal/15";

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      {/* Ambient signal glow — quiet supporting atmosphere. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-signal/10 blur-3xl" />
      </div>

      <div className="animate-rise w-full max-w-100">
        <header className="mb-8 flex flex-col items-start gap-7">
          <Brand />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2.5 font-display text-[2rem] font-semibold leading-[1.1] tracking-tight text-ink">
              {copy.heading}
            </h1>
            <p className="mt-2 text-sm text-muted">{copy.sub}</p>
          </div>
        </header>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Username</span>
              <input
                className={inputClass}
                type="text"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Parsa Mehrpooshan"
              />
              {copy.usernameHint && (
                <span className="text-xs text-muted">{copy.usernameHint}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Password</span>
              <input
                className={inputClass}
                type="password"
                name="password"
                autoComplete={copy.passwordAutoComplete}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-[15px] font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? copy.pending : copy.action}
            {!pending && (
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {copy.altPrompt}{" "}
          <Link
            href={copy.altHref}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            {copy.altLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
