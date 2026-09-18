"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { displayName } from "@/lib/user";
import type { UserProfile } from "@/lib/types";
import { Brand } from "./Brand";
import { Avatar } from "./Avatar";
import { LogoutDialog } from "./LogoutDialog";

// Shared chrome for signed-in pages: the brand (home), a chip linking to the
// profile, and logout. Reads the cached user for instant paint.
export function AppHeader() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => setUser(getUser()), []);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8 sm:py-4">
      <Link href="/chat" aria-label="Home" className="rounded-lg">
        <Brand />
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        {user && (
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition hover:border-ink/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
          >
            <Avatar user={user} size={28} />
            <span className="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
              {displayName(user)}
            </span>
          </Link>
        )}
        <button
          onClick={() => setConfirmingLogout(true)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-ink/20 hover:bg-canvas focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
        >
          Log out
        </button>
      </div>

      {confirmingLogout && (
        <LogoutDialog onClose={() => setConfirmingLogout(false)} />
      )}
    </header>
  );
}
