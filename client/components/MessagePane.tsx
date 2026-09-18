"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { displayName } from "@/lib/user";
import { formatClockTime } from "@/lib/time";
import type { ConversationSummary, Message } from "@/lib/types";
import { Avatar } from "./Avatar";

const NEAR_BOTTOM_PX = 80;
const NEAR_TOP_PX = 80;

export function MessagePane({
  conversation,
  messages,
  meId,
  loadingHistory,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onBack,
  onSend,
}: {
  conversation: ConversationSummary | null;
  messages: Message[];
  meId: number | null;
  loadingHistory: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onBack: () => void;
  onSend: (content: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unseenBelow, setUnseenBelow] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevConvId = useRef<number | null>(null);
  const prevLen = useRef(0);
  const prevFirstId = useRef<number | null>(null);
  const prevLastId = useRef<number | null>(null);
  // Scroll height captured the instant we request older messages, so we can
  // keep the viewport anchored when they prepend (no jump).
  const prependAnchor = useRef<number | null>(null);

  // Manage scrolling before paint: jump to the bottom on a conversation switch
  // or a message we sent, follow along if already at the bottom, anchor in place
  // when older history prepends, and otherwise show a "new messages" nudge.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const convId = conversation?.id ?? null;
    const convChanged = prevConvId.current !== convId;
    const first = messages[0];
    const last = messages[messages.length - 1];
    const grew = messages.length > prevLen.current;
    const lastMine = !!last && last.sender_id === meId;
    const prepended =
      grew &&
      prependAnchor.current !== null &&
      !!first &&
      prevFirstId.current !== null &&
      first.id !== prevFirstId.current &&
      !!last &&
      last.id === prevLastId.current;
    const appended = grew && !!last && last.id !== prevLastId.current;

    if (el) {
      if (convChanged) {
        el.scrollTop = el.scrollHeight;
        atBottomRef.current = true;
        setUnseenBelow(false);
      } else if (prepended) {
        el.scrollTop = el.scrollHeight - prependAnchor.current!;
        prependAnchor.current = null;
      } else if (appended && (atBottomRef.current || lastMine)) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: prevLen.current === 0 ? "auto" : "smooth",
        });
        atBottomRef.current = true;
        setUnseenBelow(false);
      } else if (appended) {
        setUnseenBelow(true);
      }
    }
    prevConvId.current = convId;
    prevLen.current = messages.length;
    prevFirstId.current = first ? first.id : null;
    prevLastId.current = last ? last.id : null;
  }, [messages, conversation?.id, meId]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = nearBottom;
    if (nearBottom) setUnseenBelow(false);
    if (
      el.scrollTop < NEAR_TOP_PX &&
      hasMore &&
      !loadingOlder &&
      messages.length > 0
    ) {
      prependAnchor.current = el.scrollHeight;
      onLoadOlder();
    }
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    atBottomRef.current = true;
    setUnseenBelow(false);
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-signal" />
        </div>
        <p className="mt-4 font-display text-lg font-semibold text-ink">
          Pick a conversation
        </p>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Choose someone on the left, or search a username to start a new one.
        </p>
      </div>
    );
  }

  const peer = conversation.peer;

  async function submit() {
    const content = draft.trim();
    if (content.length === 0 || sending) return;
    setSending(true);
    setError(null);
    const err = await onSend(content);
    setSending(false);
    if (err) {
      setError(err); // draft is preserved so the message can be resent
    } else {
      setDraft(""); // the message arrives via message:new and renders itself
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className="rounded-lg p-1.5 text-muted transition hover:bg-canvas hover:text-ink md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M12 15l-5-5 5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <Avatar user={peer} size={40} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">
            {displayName(peer)}
          </p>
          <p className="truncate text-sm text-muted">@{peer.username}</p>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto px-3 py-4 sm:px-5"
        >
          {loadingHistory ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="mx-auto max-w-sm py-10 text-center text-sm text-muted">
              This is the start of your conversation with {displayName(peer)}.
              Say hello.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {loadingOlder && (
                <li className="py-2 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
                  Loading earlier…
                </li>
              )}
              {messages.map((m, i) => {
                const mine = m.sender_id === meId;
                const prev = messages[i - 1];
                const startsGroup = !prev || prev.sender_id !== m.sender_id;
                return (
                  <li
                    key={m.id}
                    className={`flex flex-col ${mine ? "items-end" : "items-start"} ${
                      startsGroup ? "mt-3 first:mt-0" : ""
                    }`}
                  >
                    {startsGroup && (
                      <span className="mb-1 px-1 text-xs font-medium text-muted">
                        {mine ? "You" : displayName(peer)}
                      </span>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                        mine
                          ? "rounded-br-md bg-brand text-white"
                          : "rounded-bl-md border border-line bg-surface text-ink"
                      }`}
                    >
                      <span className="whitespace-pre-wrap break-words">
                        {m.content}
                      </span>
                    </div>
                    <span className="mt-0.5 px-1 font-mono text-[10px] text-muted">
                      {formatClockTime(m.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {unseenBelow && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink shadow-md transition hover:bg-canvas"
          >
            ↓ New messages
          </button>
        )}
      </div>

      <div className="border-t border-line px-3 py-3 sm:px-5">
        {peer.deleted ? (
          <p className="py-1 text-center text-sm text-muted">
            This account was deleted. You can&rsquo;t send new messages here.
          </p>
        ) : (
          <>
            {error && (
              <p className="mb-2 text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <textarea
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-muted/50 focus:border-signal focus:ring-4 focus:ring-signal/15"
                rows={1}
                value={draft}
                placeholder={`Message ${displayName(peer)}`}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <button
                type="submit"
                disabled={draft.trim().length === 0 || sending}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-4 text-[15px] font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
