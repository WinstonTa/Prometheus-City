"use client";

import { PartySocket } from "partysocket";
import { useEffect, useMemo, useRef } from "react";
import { localPlayer, remoteTargets } from "@/lib/remoteState";
import { useGameStore } from "@/lib/store";
import {
  CLOSE_ROOM_FULL,
  PARTY_NAME,
  ROOM_ID,
  parseServerMessage,
  type ClientMessage,
  type PlayerSnapshot,
  type PlayerState,
  type ServerMessage,
  type TeleportTarget,
} from "@/shared/protocol";

export interface MultiplayerApi {
  /** Dispatch the local player's state. Dropped (not queued) while disconnected. */
  sendState: (state: PlayerState) => void;
  sendChat: (text: string) => void;
  adminLogin: (username: string, password: string) => void;
  adminLogout: () => void;
  announce: (text: string) => void;
  teleport: (target: TeleportTarget) => void;
}

/** Party host: explicit env var in production, otherwise the dev worker on this machine/LAN. */
function resolvePartyHost(): string {
  const configured = process.env.NEXT_PUBLIC_PARTY_HOST;
  if (configured) return configured;
  return `${window.location.hostname}:8787`;
}

function trackRemote(p: PlayerSnapshot) {
  remoteTargets.set(p.id, { x: p.x, y: p.y, z: p.z, rotY: p.rotY, isMoving: p.isMoving, receivedAt: performance.now() });
}

function handleServerMessage(msg: ServerMessage, socket: PartySocket) {
  const store = useGameStore.getState();

  switch (msg.type) {
    case "welcome":
      remoteTargets.clear();
      msg.players.forEach(trackRemote);
      store.welcome(msg.selfId, msg.username, msg.players, msg.history);
      return;

    case "room-full":
      // Stop reconnecting; the join screen offers a manual retry.
      socket.close();
      store.setStatus("full");
      return;

    case "player-joined":
      trackRemote(msg.player);
      store.addPlayer({ id: msg.player.id, username: msg.player.username });
      return;

    case "player-left":
      remoteTargets.delete(msg.id);
      store.removePlayer(msg.id);
      return;

    case "state":
      trackRemote(msg);
      // Late state for someone we haven't seen join (e.g. after a reconnect race).
      if (!(msg.id in store.players)) store.addPlayer({ id: msg.id, username: msg.username });
      return;

    case "chat":
      store.pushMessage(msg.message);
      return;

    case "admin-auth-result":
      store.setAdminResult(msg.ok, msg.error);
      return;

    case "teleport":
      store.requestTeleport(msg.x, msg.y, msg.z);
      return;
  }
}

/**
 * Owns the room connection: peer lifecycle (join/leave/reconnect/room-full),
 * state broadcasting, chat relay, and admin commands. Mount once.
 */
export function useMultiplayer(username: string | null): MultiplayerApi {
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!username) return;
    const store = useGameStore.getState();

    const socket = new PartySocket({
      host: resolvePartyHost(),
      party: PARTY_NAME,
      room: ROOM_ID,
      query: { username },
      // Connect on the next tick so React StrictMode's dev double-mount doesn't
      // spam the room with connect/depart events.
      startClosed: true,
    });
    socketRef.current = socket;
    const connectTimer = setTimeout(() => socket.reconnect(), 0);

    const onMessage = (event: MessageEvent) => {
      const msg = parseServerMessage(event.data);
      if (msg) handleServerMessage(msg, socket);
    };
    const onClose = (event: CloseEvent) => {
      if (event.code === CLOSE_ROOM_FULL) {
        socket.close();
        store.setStatus("full");
        return;
      }
      if (useGameStore.getState().status !== "full") store.setStatus("reconnecting");
    };
    const onOpen = () => {
      // Re-announce our position right away so peers don't wait for the next movement.
      if (socket.readyState === WebSocket.OPEN) send({ type: "state", ...localPlayer });
    };
    const send = (msg: ClientMessage) => socket.send(JSON.stringify(msg));

    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    socket.addEventListener("open", onOpen);

    return () => {
      clearTimeout(connectTimer);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("open", onOpen);
      socket.close();
      socketRef.current = null;
      remoteTargets.clear();
    };
  }, [username]);

  return useMemo<MultiplayerApi>(() => {
    const send = (msg: ClientMessage, queueIfClosed = true) => {
      const socket = socketRef.current;
      if (!socket) return;
      if (!queueIfClosed && socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify(msg));
    };
    return {
      sendState: (state) => send({ type: "state", ...state }, false),
      sendChat: (text) => send({ type: "chat", text }),
      adminLogin: (user, password) => {
        useGameStore.getState().setAdminPending(true);
        send({ type: "admin-auth", username: user, password });
      },
      adminLogout: () => send({ type: "admin-logout" }),
      announce: (text) => send({ type: "admin-announce", text }),
      teleport: (target) => send({ type: "admin-teleport", target }),
    };
  }, []);
}
