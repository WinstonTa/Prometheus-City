// Single source of truth for Prometheus City's walkable geometry and colliders.
// Rendering (components/city/*) and physics (lib/physics.ts) both read from here,
// so what you see is exactly what you can stand on.

export type Vec2 = readonly [x: number, z: number];
export type Vec3 = readonly [x: number, y: number, z: number];

export interface PlatformDef {
  id: string;
  name: string;
  center: Vec2;
  radius: number;
  /** Walkable surface height. */
  top: number;
  /** Solid slab depth below `top` (collides from the side). */
  thickness: number;
  /** Decorative underside cone depth. */
  undersideDepth: number;
  accent: string;
}

export interface BridgeDef {
  id: string;
  /** Deck centerline endpoints (deck surface height in y). */
  from: Vec3;
  to: Vec3;
  width: number;
}

export type ObstacleDef =
  | { kind: "cylinder"; x: number; z: number; r: number; yMin: number; yMax: number }
  | { kind: "box"; x: number; z: number; hx: number; hz: number; rot: number; yMin: number; yMax: number };

export interface TowerDef {
  id: string;
  x: number;
  z: number;
  /** Footprint width (x) and depth (z) before rotation. */
  w: number;
  d: number;
  height: number;
  /** Base height (platform top it stands on). */
  base: number;
  rot: number;
  accent: string;
}

export const COLORS = {
  cyan: "#4de8ff",
  amber: "#ffb347",
  flame: "#ff7a2f",
  violet: "#a78bfa",
  hull: "#1a2030",
  hullLight: "#2a3347",
  deck: "#222a3b",
} as const;

export const PLAZA: PlatformDef = {
  id: "plaza",
  name: "Prometheus Plaza",
  center: [0, 0],
  radius: 30,
  top: 0,
  thickness: 3,
  undersideDepth: 26,
  accent: COLORS.cyan,
};

export const SATELLITES: PlatformDef[] = [
  {
    id: "forge",
    name: "Forge Terrace",
    center: [0, -72],
    radius: 14,
    top: 3,
    thickness: 2.5,
    undersideDepth: 16,
    accent: COLORS.flame,
  },
  {
    id: "observatory",
    name: "Observatory Deck",
    center: [62.35, 36],
    radius: 12,
    top: -2,
    thickness: 2.5,
    undersideDepth: 14,
    accent: COLORS.violet,
  },
  {
    id: "garden",
    name: "Skygarden",
    center: [-62.35, 36],
    radius: 13,
    top: 1,
    thickness: 2.5,
    undersideDepth: 15,
    accent: COLORS.cyan,
  },
];

export const PLATFORMS: PlatformDef[] = [PLAZA, ...SATELLITES];

/** How far a bridge deck overlaps into each platform so the walkable surface is continuous. */
export const BRIDGE_OVERLAP = 1.5;
export const BRIDGE_WIDTH = 5;
export const RAIL_HEIGHT = 1.1;
export const RAIL_THICKNESS = 0.25;
/** Rails stop this far short of each deck end so platform entrances stay open. */
export const RAIL_END_INSET = BRIDGE_OVERLAP + 0.5;

function bridgeBetween(a: PlatformDef, b: PlatformDef): BridgeDef {
  const dx = b.center[0] - a.center[0];
  const dz = b.center[1] - a.center[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const startDist = a.radius - BRIDGE_OVERLAP;
  const endDist = len - (b.radius - BRIDGE_OVERLAP);
  return {
    id: `${a.id}-${b.id}`,
    from: [a.center[0] + ux * startDist, a.top, a.center[1] + uz * startDist],
    to: [a.center[0] + ux * endDist, b.top, a.center[1] + uz * endDist],
    width: BRIDGE_WIDTH,
  };
}

export const BRIDGES: BridgeDef[] = SATELLITES.map((s) => bridgeBetween(PLAZA, s));

// ---------------------------------------------------------------- towers

/** Plaza skyline: placed on a ring, skipping the bridge headings and the spawn approach. */
const PLAZA_TOWER_SPECS: Array<[angleDeg: number, radius: number, w: number, d: number, h: number, accent: string]> = [
  [32, 22, 6, 6, 34, COLORS.cyan],
  [100, 21, 5, 7, 46, COLORS.amber],
  [138, 23, 6, 5, 28, COLORS.cyan],
  [222, 22, 7, 5, 40, COLORS.violet],
  [258, 21, 5, 6, 30, COLORS.cyan],
  [328, 22, 6, 6, 38, COLORS.amber],
];

export const TOWERS: TowerDef[] = [
  ...PLAZA_TOWER_SPECS.map(([deg, r, w, d, h, accent], i) => {
    const a = (deg * Math.PI) / 180;
    return { id: `plaza-tower-${i}`, x: Math.sin(a) * r, z: Math.cos(a) * r, w, d, height: h, base: PLAZA.top, rot: a, accent };
  }),
  // Observatory Deck twin spires.
  { id: "obs-tower-a", x: 66.5, z: 31, w: 3.5, d: 3.5, height: 22, base: -2, rot: 0.4, accent: COLORS.violet },
  { id: "obs-tower-b", x: 58.5, z: 41, w: 3, d: 3, height: 16, base: -2, rot: 0.4, accent: COLORS.violet },
];

/** Central "Prometheus Flame" beacon on the plaza. */
export const BEACON = { x: 0, z: 0, baseRadius: 3, height: 26 } as const;

/** Forge Terrace ceremonial ring (decorative arch with two solid feet). */
export const FORGE_RING = { x: 0, z: -76, radius: 7, tube: 0.45, footRadius: 1 } as const;

/** Observatory Deck glass dome (far side of the deck from its bridge). */
export const OBSERVATORY_DOME = { x: 66.7, z: 38.5, radius: 4 } as const;

/** Skygarden crystal trees, placed around the garden away from its bridge entrance. */
export const GARDEN_TREES: Array<{ x: number; z: number; base: number; height: number; trunkRadius: number }> = (() => {
  const garden = SATELLITES.find((s) => s.id === "garden")!;
  const specs: Array<[angleDeg: number, dist: number, height: number]> = [
    [0, 8, 6],
    [50, 9, 7.5],
    [180, 8.5, 5.5],
    [230, 7.5, 8],
    [290, 9, 6.5],
    [340, 4, 5],
  ];
  return specs.map(([deg, dist, height]) => {
    const a = (deg * Math.PI) / 180;
    return { x: garden.center[0] + Math.sin(a) * dist, z: garden.center[1] + Math.cos(a) * dist, base: garden.top, height, trunkRadius: 0.45 };
  });
})();

// ---------------------------------------------------------------- colliders

function railObstacles(bridge: BridgeDef): ObstacleDef[] {
  const [fx, fy, fz] = bridge.from;
  const [tx, ty, tz] = bridge.to;
  const dx = tx - fx;
  const dz = tz - fz;
  const len = Math.hypot(dx, dz);
  // Box local x = across the deck, local z = along the deck.
  const rot = Math.atan2(dx, dz);
  const nx = Math.cos(rot);
  const nz = -Math.sin(rot);
  const offset = bridge.width / 2 - RAIL_THICKNESS / 2;
  const cx = (fx + tx) / 2;
  const cz = (fz + tz) / 2;
  const yMin = Math.min(fy, ty) - 0.5;
  const yMax = Math.max(fy, ty) + RAIL_HEIGHT;
  const hz = len / 2 - RAIL_END_INSET;
  return [1, -1].map((side) => ({
    kind: "box" as const,
    x: cx + nx * offset * side,
    z: cz + nz * offset * side,
    hx: RAIL_THICKNESS / 2,
    hz,
    rot,
    yMin,
    yMax,
  }));
}

export const OBSTACLES: ObstacleDef[] = [
  ...PLATFORMS.map((p) => ({
    kind: "cylinder" as const,
    x: p.center[0],
    z: p.center[1],
    r: p.radius,
    yMin: p.top - p.thickness,
    yMax: p.top,
  })),
  ...TOWERS.map((t) => ({
    kind: "box" as const,
    x: t.x,
    z: t.z,
    hx: t.w / 2,
    hz: t.d / 2,
    rot: t.rot,
    yMin: t.base,
    yMax: t.base + t.height,
  })),
  { kind: "cylinder", x: BEACON.x, z: BEACON.z, r: BEACON.baseRadius, yMin: PLAZA.top, yMax: PLAZA.top + BEACON.height },
  ...[-1, 1].map((side) => ({
    kind: "cylinder" as const,
    x: FORGE_RING.x + side * FORGE_RING.radius,
    z: FORGE_RING.z,
    r: FORGE_RING.footRadius,
    yMin: 3,
    yMax: 3 + FORGE_RING.radius,
  })),
  { kind: "cylinder", x: OBSERVATORY_DOME.x, z: OBSERVATORY_DOME.z, r: OBSERVATORY_DOME.radius, yMin: -2, yMax: -2 + OBSERVATORY_DOME.radius },
  ...GARDEN_TREES.map((t) => ({
    kind: "cylinder" as const,
    x: t.x,
    z: t.z,
    r: t.trunkRadius,
    yMin: t.base,
    yMax: t.base + t.height,
  })),
  ...BRIDGES.flatMap(railObstacles),
];
