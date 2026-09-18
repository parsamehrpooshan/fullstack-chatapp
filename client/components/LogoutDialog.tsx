"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { disconnectSocket } from "@/lib/socket";

// Small confirm step before signing out, so a stray click doesn't drop the
// session.
export function LogoutDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function confirm() {
    disconnectSocket();
    clearSession();
    router.replace("/login");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="animate-rise w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="logout-title"
          className="font-display text-xl font-semibold text-ink"
        >
          Log out?
        </h2>
        <p className="mt-2 text-sm text-muted">
          You&rsquo;ll need your username and password to sign back in.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[15px] font-medium text-ink transition hover:bg-canvas"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={confirm}
            className="rounded-xl bg-brand px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
