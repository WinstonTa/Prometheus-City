"use client";

import AdminModal from "@/components/AdminModal";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ChatOverlay from "@/components/ChatOverlay";
import JoinScreen from "@/components/JoinScreen";
import WorldCanvas from "@/components/WorldCanvas";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { useGameStore, type ConnectionStatus } from "@/lib/store";
import { MAX_PLAYERS } from "@/shared/protocol";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Offline",
  connecting: "Connecting…",
  connected: "Linked",
  reconnecting: "Reconnecting…",
  full: "Room full",
};

function StatusBadge() {
  const status = useGameStore((s) => s.status);
  const count = useGameStore((s) => Object.keys(s.players).length + (s.selfId ? 1 : 0));
  const live = status === "connected";
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-20 flex items-center gap-2 rounded-full hud-panel px-3 py-1.5 text-[11px]">
      <span className={`size-2 rounded-full ${live ? "bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]" : "bg-amber animate-pulse"}`} />
      <span className="font-display tracking-[0.15em] text-ink/90">{STATUS_LABEL[status].toUpperCase()}</span>
      {live && (
        <span className="text-muted tabular-nums">
          {count}/{MAX_PLAYERS}
        </span>
      )}
    </div>
  );
}

function ControlsHint() {
  return (
    <p className="pointer-events-none fixed top-4 left-4 z-20 hidden rounded-lg hud-panel px-3 py-1.5 text-[11px] text-muted md:block">
      <span className="font-display text-[10px] tracking-[0.2em] text-cyan/80">PROMETHEUS CITY</span>
      <span className="mx-2 text-edge">|</span>
      WASD move · Space jump · Shift sprint · Drag/click look · Wheel zoom · Enter chat
    </p>
  );
}

/** Client-only game root: world canvas plus HUD, wired to the multiplayer connection. */
export default function Game() {
  const username = useGameStore((s) => s.username);
  const status = useGameStore((s) => s.status);
  const net = useMultiplayer(status === "full" ? null : username);
  const inGame = username !== null && status !== "full";

  return (
    <main className="fixed inset-0 select-none">
      <WorldCanvas playing={inGame} onLocalState={net.sendState} />
      {inGame ? (
        <>
          <ControlsHint />
          <StatusBadge />
          <AnnouncementBanner />
          <ChatOverlay onSend={net.sendChat} />
          <AdminModal api={net} />
        </>
      ) : (
        <JoinScreen />
      )}
    </main>
  );
}
