"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { PlatformDef } from "@/lib/cityLayout";
import { deckMaterial, glowMaterial, hullMaterial } from "./materials";

const RING_FRACTIONS = [0.22, 0.5, 0.78] as const;

/** A floating disc: walkable deck, glowing rim, and an inverted hull cone with pulsing anti-grav rings. */
export function Platform({ def, spokes = 0 }: { def: PlatformDef; spokes?: number }) {
  const { center, radius: r, top, thickness, undersideDepth, accent } = def;

  // Per-platform pulse material (own instance so each platform breathes out of phase).
  const pulseMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accent, toneMapped: false, transparent: true, depthWrite: false }),
    [accent],
  );
  const phase = useMemo(() => center[0] * 0.1 + center[1] * 0.07, [center]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.6 + phase;
    pulseMaterial.opacity = 0.55 + Math.sin(t) * 0.35;
  });

  const coneTop = -thickness;
  const coneRadius = r * 0.96;

  return (
    <group position={[center[0], top, center[1]]}>
      {/* Solid slab */}
      <mesh position-y={-thickness / 2} material={hullMaterial}>
        <cylinderGeometry args={[r, coneRadius, thickness, 72]} />
      </mesh>

      {/* Deck surface + markings */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} material={deckMaterial}>
        <circleGeometry args={[r - 0.5, 72]} />
      </mesh>
      {[0.32, 0.62, 0.88].map((f) => (
        <mesh key={f} rotation-x={-Math.PI / 2} position-y={0.025} material={glowMaterial(accent, 0.35)}>
          <ringGeometry args={[r * f - 0.06, r * f + 0.06, 96]} />
        </mesh>
      ))}
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2;
        const inner = r * 0.32;
        const outer = r * 0.88;
        const mid = (inner + outer) / 2;
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * mid, 0.025, Math.cos(a) * mid]}
            rotation={[-Math.PI / 2, 0, -a]}
            material={glowMaterial(accent, 0.25)}
          >
            <planeGeometry args={[0.1, outer - inner]} />
          </mesh>
        );
      })}

      {/* Glowing rim */}
      <mesh rotation-x={Math.PI / 2} position-y={0.06} material={glowMaterial(accent)}>
        <torusGeometry args={[r - 0.15, 0.14, 8, 128]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={-thickness} material={glowMaterial(accent, 0.6)}>
        <torusGeometry args={[coneRadius, 0.08, 6, 128]} />
      </mesh>

      {/* Underside hull */}
      <mesh position-y={coneTop - undersideDepth / 2} rotation-x={Math.PI} material={hullMaterial}>
        <coneGeometry args={[coneRadius, undersideDepth, 48]} />
      </mesh>
      {RING_FRACTIONS.map((f) => (
        <mesh key={f} position-y={coneTop - undersideDepth * f} rotation-x={Math.PI / 2} material={pulseMaterial}>
          <torusGeometry args={[coneRadius * (1 - f) + 0.25, 0.18, 8, 72]} />
        </mesh>
      ))}
      {/* Core glow at the tip */}
      <mesh position-y={coneTop - undersideDepth - 0.6} material={pulseMaterial}>
        <sphereGeometry args={[0.9, 16, 16]} />
      </mesh>
      <pointLight position-y={coneTop - undersideDepth - 2} color={accent} intensity={120} distance={45} decay={2} />
    </group>
  );
}

