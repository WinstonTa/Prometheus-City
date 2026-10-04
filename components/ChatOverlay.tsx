"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { colorFromId } from "@/lib/remoteState";
import { useGameStore } from "@/lib/store";
import { MAX_CHAT_LENGTH, type ChatMessage } from "@/shared/protocol";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatLine({ message }: { message: ChatMessage }) {
  const time = (
    <span className="mr-1.5 align-middle text-[10px] text-muted/60 tabular-nums">{formatTime(message.ts)}</span>
  );

  if (message.kind === "system") {
    return (
      <li className="px-2 py-0.5 text-[13px] italic text-muted">
        {time}
        <span className="not-italic text-muted/80">[System]</span> {message.text}
      </li>
    );
  }

  if (message.kind === "admin") {
    return (
      <li className="my-1 rounded-md border border-amber/50 bg-amber/10 px-2 py-1.5 text-[13px] animate-glow">
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-amber px-1.5 py-px font-display text-[9px] font-bold tracking-widest text-void">
            GLOBAL BROADCAST
          </span>
          {time}
        </div>
        <p className="mt-1 font-semibold text-amber text-glow-amber break-words">{message.text}</p>
      </li>
    );
  }

  return (
    <li className="px-2 py-0.5 text-[13.5px] leading-snug break-words">
      {time}
      <span className="font-semibold" style={{ color: colorFromId(message.fromId) }}>
        [{message.from}]
      </span>
      <span className="text-ink/90">: {message.text}</span>
    </li>
  );
}

/**
 * Bottom-left HUD chat. Enter focuses the input (from anywhere in the game);
 * Enter again sends and returns to navigation; Escape returns without sending.
 */
export default function ChatOverlay({ onSend }: { onSend: (text: string) => void }) {
  const messages = useGameStore((s) => s.messages);
  const collapsed = useGameStore((s) => s.chatCollapsed);
  const unread = useGameStore((s) => s.unread);
  const focused = useGameStore((s) => s.chatFocused);
  const setCollapsed = useGameStore((s) => s.setChatCollapsed);
  const setFocused = useGameStore((s) => s.setChatFocused);

  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);

  // Global Enter → focus chat.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Enter" || e.isComposing || e.repeat) return;
      if (e.target === inputRef.current) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLButtonElement) return;
      if (useGameStore.getState().adminOpen) return;
      e.preventDefault();
      if (document.pointerLockElement) document.exitPointerLock();
      setCollapsed(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCollapsed]);

  // Auto-scroll to the newest message unless the reader scrolled up.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages, collapsed]);

  const onScroll = () => {
    const list = listRef.current;
    if (list) stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text) {
      onSend(text);
      stickToBottom.current = true;
    }
    setDraft("");
    inputRef.current?.blur();
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Keep game keys (WASD, Space…) from reaching any window listeners while typing.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  return (
    <section
      aria-label="Chat"
      className="pointer-events-auto fixed bottom-4 left-4 z-20 flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl hud-panel shadow-[0_8px_40px_rgb(0_0_0/0.35)]"
    >
      <header className="flex items-center justify-between border-b border-edge px-3 py-1.5">
        <h2 className="font-display text-[10px] font-bold tracking-[0.3em] text-cyan/90">COMMS</h2>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 rounded px-1.5 py-0.5 text-[11px] text-muted transition hover:bg-white/5 hover:text-ink"
          aria-expanded={!collapsed}
        >
          {collapsed && unread > 0 && (
            <span className="rounded-full bg-cyan px-1.5 font-semibold text-void">{unread > 99 ? "99+" : unread}</span>
          )}
          {collapsed ? "Expand ▴" : "Collapse ▾"}
        </button>
      </header>

      {!collapsed && (
        <ol ref={listRef} onScroll={onScroll} className="hud-scroll max-h-[min(36vh,320px)] min-h-24 overflow-y-auto py-1.5" aria-live="polite">
          {messages.length === 0 && <li className="px-2 py-1 text-[13px] italic text-muted/70">No transmissions yet.</li>}
          {messages.map((m) => (
            <ChatLine key={m.id} message={m} />
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="border-t border-edge">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onInputKeyDown}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={focused ? "Transmit a message…" : "Press Enter to chat"}
          className="w-full bg-transparent px-3 py-2 text-[13.5px] text-ink placeholder:text-muted/70 focus:bg-white/[0.03] focus:outline-none"
          aria-label="Chat message"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </section>
  );
}
