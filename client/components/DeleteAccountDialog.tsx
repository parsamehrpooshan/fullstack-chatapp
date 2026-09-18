"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearSession } from "@/lib/auth";
import { disconnectSocket } from "@/lib/socket";
import { api, ApiError } from "@/lib/api";

// Type-your-password-to-confirm dialog for permanent account deletion. On
// success it tears down the session and returns to sign-in.
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function confirmDelete() {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (password.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteMe(token, password);
      disconnectSocket();
      clearSession();
      router.replace("/login");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Can't reach the server. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="animate-rise w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-danger">
          Danger zone
        </p>
        <h2
          id="delete-title"
          className="mt-2 font-display text-xl font-semibold text-ink"
        >
          Delete your account?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This is permanent. Your profile is erased and your username is
          released. Messages you&rsquo;ve sent stay in other people&rsquo;s
          conversations, shown as “Deleted User.” Enter your password to confirm.
        </p>

        <form
          className="mt-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void confirmDelete();
          }}
        >
          {error && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-2.5 text-sm text-danger"
            >
              {error}
            </div>
          )}
          <input
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-muted/50 focus:border-danger focus:ring-4 focus:ring-danger/15"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            placeholder="Your password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[15px] font-medium text-ink transition hover:bg-canvas disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={password.length === 0 || busy}
              className="rounded-xl bg-danger px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-danger-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-danger/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
