"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { displayName } from "@/lib/user";
import { formatListTime } from "@/lib/time";
import type { ConversationSummary, UserProfile } from "@/lib/types";
import { Avatar } from "./Avatar";

// Matches the server's search page size; a full page means more may exist.
const USERS_PAGE = 15;

export function Sidebar({
  conversations,
  activeId,
  loading,
  onSelect,
  onOpenUser,
}: {
  conversations: ConversationSummary[];
  activeId: number | null;
  loading: boolean;
  onSelect: (conversation: ConversationSummary) => void;
  onOpenUser: (username: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const trimmed = query.trim();
  const loadingMoreRef = useRef(false);

  // Debounced first-page search. A request counter drops any response that a
  // newer keystroke has already superseded.
  const seq = useRef(0);
  useEffect(() => {
    if (trimmed.length === 0) {
      setResults([]);
      setSearching(false);
      setHasMore(false);
      return;
    }
    const token = getToken();
    if (!token) return;

    setSearching(true);
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .searchUsers(token, trimmed, 0)
        .then((users) => {
          if (mine !== seq.current) return;
          setResults(users);
          setHasMore(users.length === USERS_PAGE);
        })
        .catch(() => {
          if (mine === seq.current) {
            setResults([]);
            setHasMore(false);
          }
        })
        .finally(() => {
          if (mine === seq.current) setSearching(false);
        });
    }, 220);
    return () => clearTimeout(timer);
  }, [trimmed]);

  // Infinite scroll: fetch the next page of matches when the list nears bottom.
  function loadMoreUsers() {
    if (!hasMore || loadingMoreRef.current) return;
    const token = getToken();
    if (!token) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const mine = seq.current;
    api
      .searchUsers(token, trimmed, results.length)
      .then((more) => {
        if (mine !== seq.current) return;
        setResults((prev) => [...prev, ...more]);
        setHasMore(more.length === USERS_PAGE);
      })
      .catch(() => {})
      .finally(() => {
        loadingMoreRef.current = false;
        if (mine === seq.current) setLoadingMore(false);
      });
  }

  function onListScroll(e: React.UIEvent<HTMLDivElement>) {
    if (trimmed.length === 0) return; // only search results paginate
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) loadMoreUsers();
  }

  async function pick(username: string) {
    setOpening(username);
    try {
      await onOpenUser(username);
      setQuery("");
      setResults([]);
      setHasMore(false);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M11 11L14 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-[15px] text-ink outline-none transition placeholder:text-muted/60 focus:border-signal focus:ring-4 focus:ring-signal/15"
            type="text"
            value={query}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Find someone by username"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={onListScroll}>
        {trimmed.length > 0 ? (
          <SearchResults
            results={results}
            searching={searching}
            loadingMore={loadingMore}
            query={trimmed}
            opening={opening}
            onPick={pick}
          />
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            loading={loading}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>
  );
}

function SearchResults({
  results,
  searching,
  loadingMore,
  query,
  opening,
  onPick,
}: {
  results: UserProfile[];
  searching: boolean;
  loadingMore: boolean;
  query: string;
  opening: string | null;
  onPick: (username: string) => void;
}) {
  if (searching && results.length === 0) {
    return <SectionNote>Searching…</SectionNote>;
  }
  if (results.length === 0) {
    return (
      <SectionNote>
        No one matches “<span className="text-ink">{query}</span>”.
      </SectionNote>
    );
  }
  return (
    <ul>
      {results.map((user) => (
        <li key={user.id}>
          <button
            onClick={() => onPick(user.username)}
            disabled={opening !== null}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-canvas disabled:opacity-60"
          >
            <Avatar user={user} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-ink">
                {displayName(user)}
              </span>
              <span className="block truncate text-sm text-muted">
                @{user.username}
              </span>
            </span>
            {opening === user.username && (
              <span className="text-xs text-muted">Opening…</span>
            )}
          </button>
        </li>
      ))}
      {loadingMore && (
        <li className="px-4 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
          Loading more…
        </li>
      )}
    </ul>
  );
}

function ConversationList({
  conversations,
  activeId,
  loading,
  onSelect,
}: {
  conversations: ConversationSummary[];
  activeId: number | null;
  loading: boolean;
  onSelect: (conversation: ConversationSummary) => void;
}) {
  if (loading) {
    return <SectionNote>Loading conversations…</SectionNote>;
  }
  if (conversations.length === 0) {
    return (
      <SectionNote>
        No conversations yet. Search a username above to start one.
      </SectionNote>
    );
  }
  return (
    <ul>
      {conversations.map((c) => {
        const active = c.id === activeId;
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c)}
              className={`flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition ${
                active
                  ? "border-brand bg-signal-soft"
                  : "border-transparent hover:bg-canvas"
              }`}
            >
              <Avatar user={c.peer} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-[15px] font-medium ${
                      active ? "text-brand" : "text-ink"
                    }`}
                  >
                    {displayName(c.peer)}
                  </span>
                  {c.last_message && (
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {formatListTime(c.last_message.created_at)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted">
                  {c.last_message ? (
                    c.last_message.content
                  ) : (
                    <span className="italic">No messages yet</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
