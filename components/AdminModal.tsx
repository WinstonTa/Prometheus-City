"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { MultiplayerApi } from "@/hooks/useMultiplayer";
import { colorFromId, localPlayer, remoteTargets } from "@/lib/remoteState";
import { useGameStore } from "@/lib/store";
import { MAX_CHAT_LENGTH, SPAWN_POINT } from "@/shared/protocol";

type AdminApi = Pick<MultiplayerApi, "adminLogin" | "adminLogout" | "announce" | "teleport">;

interface RosterRow {
  id: string;
  username: string;
  isSelf: boolean;
  position: string;
}

const formatPos = (p: { x: number; y: number; z: number } | undefined) =>
  p ? `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}` : "—";

/** Live roster with positions polled from the non-reactive position buffers. */
function useRosterRows(): RosterRow[] {
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const selfName = useGameStore((s) => s.selfName);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(interval);
  }, []);

  const rows: RosterRow[] = [];
  if (selfId) rows.push({ id: selfId, username: selfName ?? "You", isSelf: true, position: formatPos(localPlayer) });
  for (const p of Object.values(players)) {
    rows.push({ id: p.id, username: p.username, isSelf: false, position: formatPos(remoteTargets.get(p.id)) });
  }
  return rows;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-display text-[10px] font-bold tracking-[0.3em] text-cyan/80">{title}</h3>
      {children}
    </section>
  );
}

const inputClass =
  "w-full rounded-md border border-edge bg-black/30 px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-cyan/60 focus:outline-none";
const buttonClass =
  "rounded-md border px-3 py-2 text-xs font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40";

function LoginForm({ api }: { api: AdminApi }) {
  const pending = useGameStore((s) => s.adminPending);
  const error = useGameStore((s) => s.adminError);
  const status = useGameStore((s) => s.status);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    api.adminLogin(username, password);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">Authenticate to access simulation controls.</p>
      <input className={inputClass} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" autoFocus />
      <input className={inputClass} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {status !== "connected" && <p className="text-xs text-amber/80">Not connected to the room server.</p>}
      <button
        type="submit"
        disabled={pending || !username || !password || status !== "connected"}
        className={`${buttonClass} w-full border-cyan/50 bg-cyan/15 text-cyan hover:bg-cyan/25`}
      >
        {pending ? "Verifying…" : "Authenticate"}
      </button>
    </form>
  );
}

function AdminControls({ api }: { api: AdminApi }) {
  const rows = useRosterRows();
  const [announcement, setAnnouncement] = useState("");
  const requestTeleport = useGameStore((s) => s.requestTeleport);

  const broadcast = (e: FormEvent) => {
    e.preventDefault();
    const text = announcement.trim();
    if (!text) return;
    api.announce(text);
    setAnnouncement("");
  };

  const resetSelf = () => requestTeleport(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z);

  return (
    <div className="space-y-6">
      <Section title="GLOBAL ANNOUNCEMENT">
        <form onSubmit={broadcast} className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Broadcast to every player…"
            value={announcement}
            maxLength={MAX_CHAT_LENGTH}
            onChange={(e) => setAnnouncement(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={!announcement.trim()} className={`${buttonClass} shrink-0 border-amber/60 bg-amber/15 text-amber hover:bg-amber/25`}>
            Broadcast
          </button>
        </form>
      </Section>

      <Section title={`ROOM ROSTER · ${rows.length}`}>
        <div className="hud-scroll max-h-56 overflow-y-auto rounded-md border border-edge">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-hud-strong text-[10px] tracking-wider text-muted">
              <tr>
                <th className="px-2 py-1.5 font-medium">PLAYER</th>
                <th className="px-2 py-1.5 font-medium">PEER ID</th>
                <th className="px-2 py-1.5 font-medium">POSITION</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-edge/60">
                  <td className="px-2 py-1.5">
                    <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: colorFromId(row.id) }} />
                    <span className="font-semibold">{row.username}</span>
                    {row.isSelf && <span className="ml-1 text-muted">(you)</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted" title={row.id}>
                    {row.id.slice(0, 8)}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] tabular-nums text-ink/80">{row.position}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => (row.isSelf ? resetSelf() : api.teleport(row.id))}
                      className="rounded border border-cyan/40 px-1.5 py-0.5 text-[10px] text-cyan hover:bg-cyan/15"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="TELEPORT / RESET">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={resetSelf} className={`${buttonClass} border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20`}>
            Reset me to spawn
          </button>
          <button type="button" onClick={() => api.teleport("all")} className={`${buttonClass} border-flame/60 bg-flame/10 text-flame hover:bg-flame/20`}>
            Reset ALL players to spawn
          </button>
        </div>
      </Section>

      <button type="button" onClick={api.adminLogout} className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
        Log out of admin
      </button>
    </div>
  );
}

/**
 * Developer admin panel. Toggle with Ctrl+Shift+A or the corner gear button.
 * Credentials are checked by the room server, so broadcasts can't be forged client-side.
 */
export default function AdminModal({ api }: { api: AdminApi }) {
  const open = useGameStore((s) => s.adminOpen);
  const setOpen = useGameStore((s) => s.setAdminOpen);
  const isAdmin = useGameStore((s) => s.isAdmin);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyA") {
        e.preventDefault();
        setOpen(!useGameStore.getState().adminOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  useEffect(() => {
    if (open && document.pointerLockElement) document.exitPointerLock();
  }, [open]);

  const onDialogKeyDown = (e: KeyboardEvent) => {
    // Keep keystrokes inside the panel (no chat focus / movement).
    if (!(e.ctrlKey && e.shiftKey && e.code === "KeyA")) e.stopPropagation();
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          setOpen(!open);
          e.currentTarget.blur();
        }}
        title="Admin panel (Ctrl+Shift+A)"
        aria-label="Open admin panel"
        className="pointer-events-auto fixed right-4 bottom-4 z-20 grid size-8 place-items-center rounded-full border border-edge bg-hud text-sm text-muted/50 transition hover:text-cyan hover:border-cyan/40"
      >
        ⚙
      </button>

      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin panel"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onDialogKeyDown}
            className="hud-panel w-full max-w-lg rounded-2xl bg-hud-strong p-5 shadow-[0_20px_80px_rgb(0_0_0/0.6)]"
          >
            <header className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-display text-base font-bold tracking-[0.2em] text-ink">ADMIN CONSOLE</h2>
                <p className="text-[11px] text-muted">{isAdmin ? "Authenticated · simulation controls unlocked" : "Restricted access"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded px-2 text-lg leading-none text-muted hover:text-ink" aria-label="Close">
                ×
              </button>
            </header>
            {isAdmin ? <AdminControls api={api} /> : <LoginForm api={api} />}
          </div>
        </div>
      )}
    </>
  );
}
