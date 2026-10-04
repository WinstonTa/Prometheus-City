// Lightweight analytic kinematics for the local player. No physics engine:
// ground and obstacles are evaluated directly from lib/cityLayout.ts.

import { BRIDGES, OBSTACLES, PLATFORMS, type BridgeDef, type ObstacleDef, type PlatformDef } from "./cityLayout";

export const PLAYER_RADIUS = 0.45;
export const PLAYER_HEIGHT = 1.8;
/** Max ledge height the player walks up without jumping. */
export const STEP_HEIGHT = 0.6;

export const WALK_SPEED = 7;
export const SPRINT_SPEED = 11.5;
export const GROUND_ACCEL = 60;
export const AIR_ACCEL = 14;
export const GRAVITY = 26;
export const JUMP_VELOCITY = 9.5;
export const MAX_FALL_SPEED = 55;
export const VOID_Y = -20;

/** Height of the walkable surface at (x, z), from the point of view of a player whose feet are at `footY`. */
export function groundHeightAt(
  x: number,
  z: number,
  footY: number,
  platforms: readonly PlatformDef[] = PLATFORMS,
  bridges: readonly BridgeDef[] = BRIDGES,
): number | null {
  const reach = footY + STEP_HEIGHT;
  let best = -Infinity;

  for (const p of platforms) {
    if (p.top > reach || p.top <= best) continue;
    if (Math.hypot(x - p.center[0], z - p.center[1]) <= p.radius) best = p.top;
  }

  for (const b of bridges) {
    const h = bridgeDeckHeight(b, x, z);
    if (h !== null && h <= reach && h > best) best = h;
  }

  return best === -Infinity ? null : best;
}

/** Deck height of a (possibly sloped) bridge at (x, z), or null if outside the deck. */
export function bridgeDeckHeight(b: BridgeDef, x: number, z: number): number | null {
  const [fx, fy, fz] = b.from;
  const [tx, ty, tz] = b.to;
  const dx = tx - fx;
  const dz = tz - fz;
  const lenSq = dx * dx + dz * dz;
  const t = ((x - fx) * dx + (z - fz) * dz) / lenSq;
  if (t < 0 || t > 1) return null;
  const lateral = Math.abs((x - fx) * dz - (z - fz) * dx) / Math.sqrt(lenSq);
  if (lateral > b.width / 2) return null;
  return fy + (ty - fy) * t;
}

/**
 * Push a circle (the player's footprint) out of every obstacle it overlaps vertically.
 * Obstacles whose top is within STEP_HEIGHT of the feet are ignored (they can be stepped onto).
 * Mutates and returns `pos`.
 */
export function resolveObstacles<T extends { x: number; z: number }>(
  pos: T,
  footY: number,
  radius = PLAYER_RADIUS,
  obstacles: readonly ObstacleDef[] = OBSTACLES,
): T {
  for (const o of obstacles) {
    if (o.yMax <= footY + STEP_HEIGHT || o.yMin >= footY + PLAYER_HEIGHT) continue;

    if (o.kind === "cylinder") {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const dist = Math.hypot(dx, dz);
      const minDist = o.r + radius;
      if (dist >= minDist) continue;
      if (dist < 1e-6) {
        pos.x = o.x + minDist;
        continue;
      }
      pos.x = o.x + (dx / dist) * minDist;
      pos.z = o.z + (dz / dist) * minDist;
      continue;
    }

    // Oriented box: work in its local frame (local x across, local z along).
    const c = Math.cos(o.rot);
    const s = Math.sin(o.rot);
    const wx = pos.x - o.x;
    const wz = pos.z - o.z;
    let lx = c * wx - s * wz;
    let lz = s * wx + c * wz;

    const qx = Math.max(-o.hx, Math.min(o.hx, lx));
    const qz = Math.max(-o.hz, Math.min(o.hz, lz));
    const ox = lx - qx;
    const oz = lz - qz;
    const distSq = ox * ox + oz * oz;

    if (distSq > 0) {
      if (distSq >= radius * radius) continue;
      const dist = Math.sqrt(distSq);
      lx = qx + (ox / dist) * radius;
      lz = qz + (oz / dist) * radius;
    } else {
      // Center is inside the box: exit along the axis of least penetration.
      const penX = o.hx - Math.abs(lx);
      const penZ = o.hz - Math.abs(lz);
      if (penX < penZ) lx = Math.sign(lx || 1) * (o.hx + radius);
      else lz = Math.sign(lz || 1) * (o.hz + radius);
    }

    pos.x = o.x + c * lx + s * lz;
    pos.z = o.z - s * lx + c * lz;
  }
  return pos;
}

/** True if a point is inside any obstacle (used to keep the camera out of towers). */
export function pointInsideObstacle(x: number, y: number, z: number, margin = 0.3): boolean {
  for (const o of OBSTACLES) {
    if (y < o.yMin - margin || y > o.yMax + margin) continue;
    if (o.kind === "cylinder") {
      if (Math.hypot(x - o.x, z - o.z) < o.r + margin) return true;
      continue;
    }
    const c = Math.cos(o.rot);
    const s = Math.sin(o.rot);
    const wx = x - o.x;
    const wz = z - o.z;
    if (Math.abs(c * wx - s * wz) < o.hx + margin && Math.abs(s * wx + c * wz) < o.hz + margin) return true;
  }
  return false;
}

/** Exponential smoothing factor that is frame-rate independent. */
export function damp(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

/** Shortest signed difference between two angles (radians). */
export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
