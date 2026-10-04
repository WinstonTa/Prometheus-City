// High-frequency (25–30 Hz) player data lives outside React so position updates never re-render.
// Writers: hooks/useMultiplayer.ts (remote) and components/PlayerController.tsx (local).
// Readers: useFrame loops and the admin roster (polled).

import type { PlayerState } from "@/shared/protocol";
import { SPAWN_POINT } from "@/shared/protocol";

export interface RemoteSample extends PlayerState {
  receivedAt: number;
}

export const remoteTargets = new Map<string, RemoteSample>();

export const localPlayer: PlayerState = { ...SPAWN_POINT, rotY: 0, isMoving: false };

/** Stable, distinct accent color per player id. */
export function colorFromId(id: string | null | undefined): string {
  if (!id) return "#4de8ff";
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 90%, 62%)`;
}
