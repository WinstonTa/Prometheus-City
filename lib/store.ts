import { create } from "zustand";
import type { ChatMessage, PlayerSnapshot } from "@/shared/protocol";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "full";

export interface RosterEntry {
  id: string;
  username: string;
}

export interface TeleportRequest {
  x: number;
  y: number;
  z: number;
  nonce: number;
}

const MESSAGE_LIMIT = 200;
const USERNAME_STORAGE_KEY = "prometheus-city:username";

interface GameState {
  /** Requested username; null until the player submits the join screen. */
  username: string | null;
  /** Server-assigned connection id and (possibly de-duplicated) username. */
  selfId: string | null;
  selfName: string | null;
  status: ConnectionStatus;
  /** Remote players only (high-frequency positions live in lib/remoteState.ts). */
  players: Record<string, RosterEntry>;
  messages: ChatMessage[];
  /** Admin announcements waiting to be shown as a top banner. */
  banners: ChatMessage[];
  unread: number;

  isAdmin: boolean;
  adminPending: boolean;
  adminError: string | null;

  adminOpen: boolean;
  chatFocused: boolean;
  chatCollapsed: boolean;
  teleport: TeleportRequest | null;

  join: (username: string) => void;
  leave: () => void;
  setStatus: (status: ConnectionStatus) => void;
  welcome: (selfId: string, selfName: string, players: PlayerSnapshot[], history: ChatMessage[]) => void;
  addPlayer: (player: RosterEntry) => void;
  removePlayer: (id: string) => void;
  pushMessage: (message: ChatMessage) => void;
  shiftBanner: () => void;
  setAdminResult: (ok: boolean, error?: string) => void;
  setAdminPending: (pending: boolean) => void;
  setAdminOpen: (open: boolean) => void;
  setChatFocused: (focused: boolean) => void;
  setChatCollapsed: (collapsed: boolean) => void;
  requestTeleport: (x: number, y: number, z: number) => void;
}

export const useGameStore = create<GameState>()((set) => ({
  username: null,
  selfId: null,
  selfName: null,
  status: "idle",
  players: {},
  messages: [],
  banners: [],
  unread: 0,
  isAdmin: false,
  adminPending: false,
  adminError: null,
  adminOpen: false,
  chatFocused: false,
  chatCollapsed: false,
  teleport: null,

  join: (username) => {
    try {
      localStorage.setItem(USERNAME_STORAGE_KEY, username);
    } catch {
      // Storage unavailable (private mode); the name just won't be remembered.
    }
    set({ username, status: "connecting" });
  },

  leave: () =>
    set({
      username: null,
      selfId: null,
      selfName: null,
      status: "idle",
      players: {},
      messages: [],
      banners: [],
      unread: 0,
      isAdmin: false,
      adminPending: false,
      adminError: null,
      adminOpen: false,
      chatFocused: false,
    }),

  setStatus: (status) => set({ status }),

  welcome: (selfId, selfName, players, history) =>
    set({
      selfId,
      selfName,
      status: "connected",
      players: Object.fromEntries(players.map((p) => [p.id, { id: p.id, username: p.username }])),
      messages: history,
      // Admin rights are per-connection; a reconnect starts unprivileged.
      isAdmin: false,
      adminPending: false,
    }),

  addPlayer: (player) => set((s) => ({ players: { ...s.players, [player.id]: player } })),

  removePlayer: (id) =>
    set((s) => {
      if (!(id in s.players)) return s;
      const players = { ...s.players };
      delete players[id];
      return { players };
    }),

  pushMessage: (message) =>
    set((s) => ({
      messages: [...s.messages.slice(-(MESSAGE_LIMIT - 1)), message],
      banners: message.kind === "admin" ? [...s.banners, message] : s.banners,
      unread: s.chatCollapsed ? s.unread + 1 : 0,
    })),

  shiftBanner: () => set((s) => ({ banners: s.banners.slice(1) })),

  setAdminResult: (ok, error) => set({ isAdmin: ok, adminPending: false, adminError: error ?? null }),
  setAdminPending: (adminPending) => set({ adminPending, adminError: null }),
  setAdminOpen: (adminOpen) => set({ adminOpen }),
  setChatFocused: (chatFocused) => set({ chatFocused }),
  setChatCollapsed: (chatCollapsed) => set((s) => ({ chatCollapsed, unread: chatCollapsed ? s.unread : 0 })),

  requestTeleport: (x, y, z) => set((s) => ({ teleport: { x, y, z, nonce: (s.teleport?.nonce ?? 0) + 1 } })),
}));

export function loadSavedUsername(): string {
  try {
    return localStorage.getItem(USERNAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** True while a text field or modal owns the keyboard, so movement keys must be ignored. */
export function isGameInputBlocked(): boolean {
  const { chatFocused, adminOpen } = useGameStore.getState();
  if (chatFocused || adminOpen) return true;
  const el = typeof document !== "undefined" ? document.activeElement : null;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement | null)?.isContentEditable === true;
}
