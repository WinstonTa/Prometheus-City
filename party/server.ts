import { routePartykitRequest, Server, type Connection, type ConnectionContext } from "partyserver";
import {
  CHAT_HISTORY_LIMIT,
  CLOSE_ROOM_FULL,
  MAX_PLAYERS,
  SPAWN_POINT,
  parseClientMessage,
  sanitizeUsername,
  type ChatKind,
  type ChatMessage,
  type PlayerSnapshot,
  type ServerMessage,
} from "../shared/protocol";

interface Env {
  PrometheusRoom: DurableObjectNamespace;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}

interface Session extends PlayerSnapshot {
  isAdmin: boolean;
  lastStateAt: number;
  chatTimestamps: number[];
}

const CHAT_WINDOW_MS = 5_000;
const CHAT_MAX_PER_WINDOW = 6;
/** Drop state packets arriving faster than ~50 Hz (clients send at 30 Hz). */
const MIN_STATE_INTERVAL_MS = 20;

/**
 * One instance per room. Authoritative for the roster, join/leave events,
 * chat relay, and admin permissions. Not hibernating: it lives only while players are
 * connected, and all room state is ephemeral by design.
 */
export class PrometheusRoom extends Server<Env> {
  private players = new Map<string, Session>();
  private history: ChatMessage[] = [];

  onConnect(conn: Connection, ctx: ConnectionContext) {
    const existing = this.players.get(conn.id);
    if (!existing && this.players.size >= MAX_PLAYERS) {
      this.send(conn, { type: "room-full", max: MAX_PLAYERS });
      conn.close(CLOSE_ROOM_FULL, "Simulation at capacity");
      return;
    }

    const requested = sanitizeUsername(new URL(ctx.request.url).searchParams.get("username"));
    const session: Session = existing ?? {
      id: conn.id,
      username: this.uniqueUsername(requested),
      ...SPAWN_POINT,
      rotY: 0,
      isMoving: false,
      isAdmin: false,
      lastStateAt: 0,
      chatTimestamps: [],
    };
    this.players.set(conn.id, session);

    this.send(conn, {
      type: "welcome",
      selfId: conn.id,
      username: session.username,
      players: [...this.players.values()].filter((p) => p.id !== conn.id).map(toSnapshot),
      history: this.history,
    });

    // A reconnect that raced its own close keeps the session silently.
    if (!existing) {
      this.broadcastMessage({ type: "player-joined", player: toSnapshot(session) }, [conn.id]);
      this.postChat("system", `${session.username} has connected to the simulation.`);
    }
  }

  onMessage(conn: Connection, raw: string | ArrayBuffer | ArrayBufferView) {
    const session = this.players.get(conn.id);
    if (!session) return;
    const msg = parseClientMessage(raw);
    if (!msg) return;

    switch (msg.type) {
      case "state": {
        const now = Date.now();
        if (now - session.lastStateAt < MIN_STATE_INTERVAL_MS) return;
        session.lastStateAt = now;
        session.x = msg.x;
        session.y = msg.y;
        session.z = msg.z;
        session.rotY = msg.rotY;
        session.isMoving = msg.isMoving;
        this.broadcastMessage({ type: "state", ...toSnapshot(session) }, [conn.id]);
        return;
      }

      case "chat": {
        const now = Date.now();
        session.chatTimestamps = session.chatTimestamps.filter((t) => now - t < CHAT_WINDOW_MS);
        if (session.chatTimestamps.length >= CHAT_MAX_PER_WINDOW) return;
        session.chatTimestamps.push(now);
        this.postChat("user", msg.text, session);
        return;
      }

      case "admin-auth": {
        const ok =
          msg.username === (this.env.ADMIN_USERNAME ?? "admin") &&
          msg.password === (this.env.ADMIN_PASSWORD ?? "password");
        session.isAdmin = ok;
        this.send(conn, ok ? { type: "admin-auth-result", ok } : { type: "admin-auth-result", ok, error: "Invalid credentials." });
        return;
      }

      case "admin-logout":
        session.isAdmin = false;
        this.send(conn, { type: "admin-auth-result", ok: false });
        return;

      case "admin-announce":
        if (!session.isAdmin) return;
        this.postChat("admin", msg.text, session);
        return;

      case "admin-teleport": {
        if (!session.isAdmin) return;
        const teleport: ServerMessage = { type: "teleport", ...SPAWN_POINT };
        if (msg.target === "all") {
          this.broadcastMessage(teleport);
        } else {
          const target = this.getConnection(msg.target);
          if (target) this.send(target, teleport);
        }
        return;
      }
    }
  }

  onClose(conn: Connection) {
    this.removePlayer(conn.id);
  }

  onError(conn: Connection) {
    this.removePlayer(conn.id);
  }

  private removePlayer(id: string) {
    const session = this.players.get(id);
    if (!session) return;
    this.players.delete(id);
    this.broadcastMessage({ type: "player-left", id });
    this.postChat("system", `${session.username} has departed the simulation.`);
  }

  private postChat(kind: ChatKind, text: string, sender?: Session) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      kind,
      text,
      ts: Date.now(),
      ...(sender ? { from: sender.username, fromId: sender.id } : {}),
    };
    this.history.push(message);
    if (this.history.length > CHAT_HISTORY_LIMIT) this.history.splice(0, this.history.length - CHAT_HISTORY_LIMIT);
    this.broadcastMessage({ type: "chat", message });
  }

  private uniqueUsername(requested: string): string {
    const taken = new Set([...this.players.values()].map((p) => p.username.toLowerCase()));
    if (!taken.has(requested.toLowerCase())) return requested;
    for (let n = 2; ; n++) {
      const candidate = `${requested.slice(0, 15)}#${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  private send(conn: Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcastMessage(msg: ServerMessage, without?: string[]) {
    this.broadcast(JSON.stringify(msg), without);
  }
}

function toSnapshot(s: Session): PlayerSnapshot {
  return { id: s.id, username: s.username, x: s.x, y: s.y, z: s.z, rotY: s.rotY, isMoving: s.isMoving };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Prometheus City room server. Connect via /parties/prometheus-room/prometheus", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
