"use client";

import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import { COLORS } from "@/lib/cityLayout";
import { distantHullMaterial } from "./materials";

/** Deterministic PRNG so every client sees the same skyline. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type V3 = [number, number, number];
const ACCENTS = [COLORS.cyan, COLORS.amber, COLORS.violet, COLORS.flame];

/** Non-interactive floating islands on the horizon, faded by fog for depth. */
export function DistantSkyline() {
  const { islands, towers, lights } = useMemo(() => {
    const rand = mulberry32(1337);
    const islands: Array<{ position: V3; radius: number; depth: number }> = [];
    const towers: Array<{ position: V3; scale: V3 }> = [];
    const lights: Array<{ position: V3; scale: V3; color: string }> = [];

    const count = 9;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.4;
      const dist = 240 + rand() * 220;
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;
      const y = -10 + rand() * 45;
      const radius = 14 + rand() * 22;
      const depth = radius * (1.1 + rand() * 0.6);
      islands.push({ position: [x, y, z], radius, depth });

      const towerCount = 3 + Math.floor(rand() * 5);
      for (let j = 0; j < towerCount; j++) {
        const a = rand() * Math.PI * 2;
        const r = rand() * radius * 0.7;
        const w = 3 + rand() * 5;
        const h = 12 + rand() * 50;
        const tx = x + Math.sin(a) * r;
        const tz = z + Math.cos(a) * r;
        towers.push({ position: [tx, y + h / 2, tz], scale: [w, h, w] });
        lights.push({ position: [tx, y + h + 0.1, tz], scale: [w + 0.2, 0.25, w + 0.2], color: ACCENTS[Math.floor(rand() * ACCENTS.length)] });
        lights.push({ position: [tx, y + h * 0.5, tz], scale: [w + 0.1, 0.18, w + 0.1], color: ACCENTS[Math.floor(rand() * ACCENTS.length)] });
      }
    }
    return { islands, towers, lights };
  }, []);

  return (
    <group>
      {islands.map((island, i) => (
        <group key={i} position={island.position}>
          <mesh position-y={-0.75} material={distantHullMaterial}>
            <cylinderGeometry args={[island.radius, island.radius * 0.95, 1.5, 32]} />
          </mesh>
          <mesh position-y={-1.5 - island.depth / 2} rotation-x={Math.PI} material={distantHullMaterial}>
            <coneGeometry args={[island.radius * 0.95, island.depth, 24]} />
          </mesh>
        </group>
      ))}
      <Instances limit={towers.length} material={distantHullMaterial}>
        <boxGeometry />
        {towers.map((t, i) => (
          <Instance key={i} position={t.position} scale={t.scale} />
        ))}
      </Instances>
      <Instances limit={lights.length}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
        {lights.map((l, i) => (
          <Instance key={i} position={l.position} scale={l.scale} color={l.color} />
        ))}
      </Instances>
    </group>
  );
}
