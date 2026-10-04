// Wire protocol shared by the Next.js client and the PartyServer room worker.
// Keep this file dependency-free: it is compiled for both the browser and Workers.

export const PARTY_NAME = "prometheus-room";
export const ROOM_ID = "prometheus";
export const MAX_PLAYERS = 10;
export const MAX_USERNAME_LENGTH = 18;
export const MAX_CHAT_LENGTH = 240;
export const CHAT_HISTORY_LIMIT = 50;

/** Central plaza spawn point (feet position). */
export const SPAWN_POINT = { x: 0, y: 1, z: 10 } as const;

/** WebSocket close code used when the room is at capacity. */
export const CLOSE_ROOM_FULL = 4001;

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  rotY: number;
  isMoving: boolean;
}

/** Sync payload: `{ id, username, x, y, z, rotY, isMoving }`. */
export interface PlayerSnapshot extends PlayerState {
  id: string;
  username: string;
}

export type ChatKind = "user" | "system" | "admin";

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  /** Sender username and connection id (user and admin messages). */
  from?: string;
  fromId?: string;
  text: string;
  ts: number;
}

export type TeleportTarget = string | "all";

// ---------------------------------------------------------------- client → server

export type ClientMessage =
  | ({ type: "state" } & PlayerState)
  | { type: "chat"; text: string }
  | { type: "admin-auth"; username: string; password: string }
  | { type: "admin-logout" }
  | { type: "admin-announce"; text: string }
  | { type: "admin-teleport"; target: TeleportTarget };

// ---------------------------------------------------------------- server → client

export type ServerMessage =
  | {
      type: "welcome";
      selfId: string;
      username: string;
      players: PlayerSnapshot[];
      history: ChatMessage[];
    }
  | { type: "room-full"; max: number }
  | { type: "player-joined"; player: PlayerSnapshot }
  | { type: "player-left"; id: string }
  | ({ type: "state" } & PlayerSnapshot)
  | { type: "chat"; message: ChatMessage }
  | { type: "admin-auth-result"; ok: boolean; error?: string }
  | { type: "teleport"; x: number; y: number; z: number };

// ---------------------------------------------------------------- helpers

/** Collapse whitespace, strip control characters, and cap length. */
export function sanitizeText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUsername(input: unknown): string {
  const name = sanitizeText(input, MAX_USERNAME_LENGTH);
  return name.length > 0 ? name : "Wanderer";
}

const POSITION_LIMIT = 10_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampPosition(value: number): number {
  return Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, value));
}

/** Parse and validate an untrusted message from a client. Returns null if invalid. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Record<string, unknown>;

  switch (msg.type) {
    case "state": {
      const { x, y, z, rotY, isMoving } = msg;
      if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z) || !isFiniteNumber(rotY)) {
        return null;
      }
      return {
        type: "state",
        x: clampPosition(x),
        y: clampPosition(y),
        z: clampPosition(z),
        rotY,
        isMoving: isMoving === true,
      };
    }
    case "chat": {
      const text = sanitizeText(msg.text, MAX_CHAT_LENGTH);
      return text ? { type: "chat", text } : null;
    }
    case "admin-auth":
      if (typeof msg.username !== "string" || typeof msg.password !== "string") return null;
      return { type: "admin-auth", username: msg.username.slice(0, 64), password: msg.password.slice(0, 128) };
    case "admin-logout":
      return { type: "admin-logout" };
    case "admin-announce": {
      const text = sanitizeText(msg.text, MAX_CHAT_LENGTH);
      return text ? { type: "admin-announce", text } : null;
    }
    case "admin-teleport":
      if (typeof msg.target !== "string" || msg.target.length === 0 || msg.target.length > 64) return null;
      return { type: "admin-teleport", target: msg.target };
    default:
      return null;
  }
}

/** Parse a message from the server. The server is trusted, so this only guards against bad JSON. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const data = JSON.parse(raw) as ServerMessage;
    return typeof data === "object" && data !== null && typeof data.type === "string" ? data : null;
  } catch {
    return null;
  }
}
