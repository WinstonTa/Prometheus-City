import { describe, expect, it } from "vitest";
import { BRIDGES, PLAZA, SATELLITES, TOWERS, type ObstacleDef } from "../lib/cityLayout";
import { PLAYER_RADIUS, STEP_HEIGHT, bridgeDeckHeight, groundHeightAt, pointInsideObstacle, resolveObstacles } from "../lib/physics";
import { SPAWN_POINT } from "../shared/protocol";

describe("groundHeightAt", () => {
  it("finds the plaza surface at spawn", () => {
    expect(groundHeightAt(SPAWN_POINT.x, SPAWN_POINT.z, SPAWN_POINT.y)).toBe(PLAZA.top);
  });

  it("returns null over the void", () => {
    expect(groundHeightAt(0, 45, 0)).toBeNull();
    expect(groundHeightAt(200, 200, 0)).toBeNull();
  });

  it("ignores surfaces too far above the feet", () => {
    const forge = SATELLITES.find((s) => s.id === "forge")!;
    // Standing far below the Forge Terrace: its top is out of step reach.
    expect(groundHeightAt(forge.center[0], forge.center[1], forge.top - STEP_HEIGHT - 1)).toBeNull();
    expect(groundHeightAt(forge.center[0], forge.center[1], forge.top)).toBe(forge.top);
  });

  it("every bridge is continuous with both platforms", () => {
    for (const [i, bridge] of BRIDGES.entries()) {
      const target = SATELLITES[i];
      const steps = 40;
      let y: number = PLAZA.top;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = bridge.from[0] + (bridge.to[0] - bridge.from[0]) * t;
        const z = bridge.from[2] + (bridge.to[2] - bridge.from[2]) * t;
        const ground = groundHeightAt(x, z, y);
        expect(ground, `${bridge.id} at t=${t}`).not.toBeNull();
        y = ground!;
      }
      expect(y).toBeCloseTo(target.top, 5);
    }
  });
});

describe("bridgeDeckHeight", () => {
  it("interpolates along the deck and rejects points off the side", () => {
    const b = BRIDGES[0];
    const mid = bridgeDeckHeight(b, (b.from[0] + b.to[0]) / 2, (b.from[2] + b.to[2]) / 2);
    expect(mid).toBeCloseTo((b.from[1] + b.to[1]) / 2, 5);
    expect(bridgeDeckHeight(b, b.from[0] + 50, b.from[2])).toBeNull();
  });
});

describe("resolveObstacles", () => {
  const box: ObstacleDef = { kind: "box", x: 0, z: 0, hx: 2, hz: 1, rot: 0, yMin: 0, yMax: 10 };
  const cyl: ObstacleDef = { kind: "cylinder", x: 0, z: 0, r: 2, yMin: 0, yMax: 10 };

  it("pushes out of a cylinder radially", () => {
    const pos = resolveObstacles({ x: 1, z: 0 }, 0, PLAYER_RADIUS, [cyl]);
    expect(pos.x).toBeCloseTo(2 + PLAYER_RADIUS);
    expect(pos.z).toBeCloseTo(0);
  });

  it("pushes out of a box face", () => {
    const pos = resolveObstacles({ x: 0, z: 1.2 }, 0, PLAYER_RADIUS, [box]);
    expect(pos.z).toBeCloseTo(1 + PLAYER_RADIUS);
  });

  it("respects box rotation", () => {
    const rotated: ObstacleDef = { ...box, rot: Math.PI / 2 };
    // Rotated 90°: the long axis (hx=2) now lies along world z.
    const pos = resolveObstacles({ x: 0, z: 1.5 }, 0, PLAYER_RADIUS, [rotated]);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(2 + PLAYER_RADIUS);
    const pushed = resolveObstacles({ x: 1.2, z: 0 }, 0, PLAYER_RADIUS, [rotated]);
    expect(Math.abs(pushed.x)).toBeCloseTo(1 + PLAYER_RADIUS);
  });

  it("lets the player step over low obstacles", () => {
    const low: ObstacleDef = { ...cyl, yMax: STEP_HEIGHT * 0.5 };
    const pos = resolveObstacles({ x: 1, z: 0 }, 0, PLAYER_RADIUS, [low]);
    expect(pos.x).toBe(1);
  });

  it("does not block a player standing on top of a platform slab", () => {
    const pos = resolveObstacles({ x: 5, z: 5 }, PLAZA.top);
    expect(pos).toEqual({ x: 5, z: 5 });
  });

  it("keeps the spawn point clear", () => {
    expect(pointInsideObstacle(SPAWN_POINT.x, SPAWN_POINT.y + 1, SPAWN_POINT.z)).toBe(false);
    for (const t of TOWERS) expect(pointInsideObstacle(t.x, t.base + 1, t.z)).toBe(true);
  });
});
