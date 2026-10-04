# Prometheus City

A lightweight, browser-based 3D multiplayer world: a sci-fi city floating above a sea of clouds, for up to 10 players in real time. It's built with **Next.js 16 (App Router)**, **React Three Fiber**, **Tailwind CSS v4**, and a **PartyServer** room on Cloudflare Durable Objects.

## Quick start

```bash
npm install
npm run dev
```

`npm run dev` starts two processes:

| Process | URL | What |
| --- | --- | --- |
| `next` | http://localhost:3000 | The game client |
| `party` | http://localhost:8787 | The realtime room server (`wrangler dev`) |

Open the client in two browser windows with different callsigns to see multiplayer.

### Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move (relative to camera) |
| Space | Jump |
| Shift | Sprint |
| Mouse drag | Orbit camera |
| Click | Lock pointer (mouse-look); Esc releases |
| Wheel | Zoom |
| Enter | Focus chat. Enter again sends, Esc cancels |
| Ctrl+Shift+A or ⚙ (bottom-right) | Admin panel |

Falling below `y < -20` respawns you at the central plaza.

### Admin panel

Mock credentials: `admin` / `password`.

The **room server** checks these credentials (`ADMIN_USERNAME` / `ADMIN_PASSWORD` in `wrangler.jsonc`), so a client cannot forge announcements or teleports.

Once logged in you get:
- A message composer with two modes:
  - **Global broadcast**: an amber chat entry plus a top banner for every player.
  - **Chat message**: a normal chat line with a green speaker label. Start it with `[name]:` to choose the label (`[admin]: hello world` shows as **[admin]:** hello world). Without a prefix it is sent under your own name. Only authenticated admins can send these, because the label can name anyone.
- A live room roster (peer ids, usernames, positions).
- Per-player, "me", and "all" resets to spawn.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Client and room server together |
| `npm run typecheck` | Next route types + app + Worker type checks |
| `npm run lint` | ESLint |
| `npm test` | Vitest: physics + protocol validation |
| `npm run test:room` | End-to-end room checks against the running server (capacity, relay, admin auth, chat) |
| `npm run build` | Production build of the client |
| `npm run party:deploy` | Deploy the room server to Cloudflare |

## Architecture

```
app/page.tsx (server) ─► components/ClientApp.tsx ── dynamic(ssr:false) ──► components/Game.tsx
                                                                            │
     ┌──────────────────────────────────────────────────────────────────────┤
     ▼                                                                      ▼
components/WorldCanvas.tsx (R3F Canvas)                      HUD: ChatOverlay, AnnouncementBanner,
 ├─ city/Atmosphere.tsx   Sky, fog, lights, CloudSea               AdminModal, JoinScreen
 ├─ city/City.tsx         platforms, bridges, towers, beacon
 ├─ PlayerController.tsx  local kinematics, camera, 30 Hz sync
 └─ RemotePlayers.tsx     interpolated avatars + name tags
                     ▲                          │
       lib/remoteState.ts (30 Hz, non-React)    │ sendState / sendChat / admin*
                     ▲                          ▼
               hooks/useMultiplayer.ts ◄──── partysocket ────► party/server.ts (Durable Object)
                     │
               lib/store.ts (zustand: roster, chat, banners, UI flags)
```

- **No SSR for WebGL.** Everything that touches three.js loads through `next/dynamic` with `ssr: false` inside a client component. The home route prerenders as a static shell.
- **One source of truth for the world.** `lib/cityLayout.ts` defines platforms, bridges, towers, and colliders. The city components render from it, and `lib/physics.ts` (no physics engine) collides against it. Moving a platform updates both automatically.
- **High-frequency data stays out of React.** Remote positions go into a plain `Map` that `useFrame` reads. React re-renders only on join/leave and chat.
- **Interpolation.** Remote avatars ease toward the latest sample with frame-rate-independent exponential damping (`lerp` / quaternion `slerp`). They snap on large jumps (respawns, teleports).
- **Wire protocol** (`shared/protocol.ts`): typed and validated on the server. State packets carry `{ id, username, x, y, z, rotY, isMoving }` and are sent at up to 30 Hz (only on change, plus a 1 s keepalive).

### Room server rules (`party/server.ts`)

- Maximum of 10 players. Extra connections get `room-full` and close code `4001`.
- Duplicate usernames get a `#2` (or higher) suffix.
- Join and leave system messages: `<name> has connected to the simulation.` / `<name> has departed the simulation.`
- Chat is sanitized, capped at 240 characters, and limited to 6 messages per 5 s. The last 50 messages are replayed to late joiners.
- Admin commands are accepted only from connections that authenticated.
- All state is ephemeral: nothing is persisted.

## Deploying

1. **Room server (Cloudflare, free plan works):**
   ```bash
   npx wrangler login
   npm run party:deploy
   npx wrangler secret put ADMIN_PASSWORD   # optional: replace the mock password
   ```
   Note the printed host, e.g. `prometheus-city-party.<you>.workers.dev`.
2. **Client (Vercel):** import the repo and set `NEXT_PUBLIC_PARTY_HOST` to that host (no protocol). Then deploy.

Without `NEXT_PUBLIC_PARTY_HOST`, the client connects to `<page hostname>:8787`. That covers localhost and LAN testing; for LAN, run `wrangler dev --ip 0.0.0.0`.

> Why PartyServer rather than the `partykit` CLI: the PartyKit CLI hasn't been released since 2025. `partyserver` is its maintained successor on Cloudflare Durable Objects, with the same room model and the same `partysocket` client.
