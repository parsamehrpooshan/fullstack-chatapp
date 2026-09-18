"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, clearSession } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { getSocket, disconnectSocket, sendMessage } from "@/lib/socket";
import type { ConversationSummary, Message } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";
import { MessagePane } from "@/components/MessagePane";

// Matches the server's message page size; a full page means more may exist.
const MESSAGES_PAGE = 50;

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [active, setActive] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [connected, setConnected] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);

  // Mirror of the open conversation id for use inside socket listeners, which
  // are attached once and would otherwise close over a stale value.
  const activeIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active]);

  const signOut = useCallback(() => {
    disconnectSocket();
    clearSession();
    router.replace("/login");
  }, [router]);

  const refetchConversations = useCallback(() => {
    const token = getToken();
    if (!token) return;
    api.listConversations(token).then(setConversations).catch(() => {});
  }, []);

  const loadHistory = useCallback(
    (conversationId: number) => {
      const token = getToken();
      if (!token) return;
      setLoadingHistory(true);
      api
        .getMessages(token, conversationId)
        .then((msgs) => {
          if (activeIdRef.current === conversationId) {
            setMessages(msgs);
            setHasMoreHistory(msgs.length === MESSAGES_PAGE);
          }
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) signOut();
        })
        .finally(() => {
          if (activeIdRef.current === conversationId) setLoadingHistory(false);
        });
    },
    [signOut],
  );


  // Initial load: validate the session, then fetch the conversation list.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setMeId(getUser()?.id ?? null);
    api
      .me(token)
      .then((me) => {
        setMeId(me.id);
        return api.listConversations(token);
      })
      .then((list) => {
        setConversations(list);
        setLoading(false);
        setReady(true);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          signOut();
          return;
        }
        setLoading(false);
        setReady(true);
      });
  }, [router, signOut]);

  // Socket lifecycle + incoming messages. The singleton stays connected across
  // in-app navigation; only logout (or a dead token) closes it.
  useEffect(() => {
    if (!getToken()) return;
    const socket = getSocket();
    setConnected(socket.connected);

    const onConnect = () => {
      setConnected(true);
      setEverConnected(true);
      const id = activeIdRef.current;
      if (id != null) loadHistory(id); // recover anything missed while offline
    };
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err: Error) => {
      if (err.message === "Not authenticated") signOut();
      else setConnected(false);
    };
    const onMessageNew = (m: Message) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === m.conversation_id);
        if (!existing) {
          refetchConversations(); // a brand-new conversation reached us
          return prev;
        }
        const updated = { ...existing, last_message: m };
        return [updated, ...prev.filter((c) => c.id !== m.conversation_id)];
      });
      if (m.conversation_id === activeIdRef.current) {
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m],
        );
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("message:new", onMessageNew);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("message:new", onMessageNew);
    };
  }, [signOut, refetchConversations, loadHistory]);

  // Load history when the open conversation changes; clearing first so messages
  // from one conversation never flash in another.
  useEffect(() => {
    setMessages([]);
    setHasMoreHistory(false);
    setLoadingOlder(false);
    if (active) loadHistory(active.id);
  }, [active, loadHistory]);

  async function openUser(username: string) {
    const token = getToken();
    if (!token) return;
    try {
      const summary = await api.openConversation(token, username);
      setConversations((prev) => [
        summary,
        ...prev.filter((c) => c.id !== summary.id),
      ]);
      setActive(summary);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOut();
      // 404/409/400 surface via the search UI; a toast system arrives in F6.
    }
  }

  async function handleSend(content: string): Promise<string | null> {
    if (!active) return "No conversation selected.";
    const ack = await sendMessage(active.id, content);
    return ack.ok ? null : ack.error;
  }

  // Fetch the page of messages just older than the ones we already have and
  // prepend them (deduped). Called when the reader scrolls near the top.
  function loadOlder() {
    const token = getToken();
    const conversationId = activeIdRef.current;
    if (!token || conversationId == null || loadingOlder) return;
    const before = messages[0]?.id;
    if (before === undefined) return;
    setLoadingOlder(true);
    api
      .getMessages(token, conversationId, before)
      .then((older) => {
        if (activeIdRef.current !== conversationId) return;
        setMessages((cur) => {
          const known = new Set(cur.map((m) => m.id));
          const fresh = older.filter((m) => !known.has(m.id));
          return fresh.length > 0 ? [...fresh, ...cur] : cur;
        });
        setHasMoreHistory(older.length === MESSAGES_PAGE);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) signOut();
      })
      .finally(() => setLoadingOlder(false));
  }

  if (!ready) {
    return (
      <div className="flex h-dvh flex-col">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center">
          <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-signal" />
          <span className="sr-only">Loading</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />
      {everConnected && !connected && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-danger/20 bg-danger-soft px-4 py-1.5 text-xs font-medium text-danger"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger" />
          Disconnected — reconnecting…
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside
          className={`w-full flex-col border-line md:flex md:w-80 md:border-r ${
            active ? "hidden md:flex" : "flex"
          }`}
        >
          <Sidebar
            conversations={conversations}
            activeId={active?.id ?? null}
            loading={loading}
            onSelect={setActive}
            onOpenUser={openUser}
          />
        </aside>

        <section
          className={`min-h-0 flex-1 flex-col ${
            active ? "flex" : "hidden md:flex"
          }`}
        >
          <MessagePane
            conversation={active}
            messages={messages}
            meId={meId}
            loadingHistory={loadingHistory}
            hasMore={hasMoreHistory}
            loadingOlder={loadingOlder}
            onLoadOlder={loadOlder}
            onBack={() => setActive(null)}
            onSend={handleSend}
          />
        </section>
      </div>
    </div>
  );
}
