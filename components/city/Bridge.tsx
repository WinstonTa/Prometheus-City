"use client";

import { useMemo } from "react";
import { COLORS, RAIL_END_INSET, RAIL_HEIGHT, RAIL_THICKNESS, type BridgeDef } from "@/lib/cityLayout";
import { deckMaterial, glassMaterial, glowMaterial, hullMaterial } from "./materials";

const DECK_THICKNESS = 0.4;

/** Sloped light-bridge. Geometry is derived from the same BridgeDef the physics uses. */
export function Bridge({ def }: { def: BridgeDef }) {
  const { mid, yaw, pitch, length, railLength } = useMemo(() => {
    const [fx, fy, fz] = def.from;
    const [tx, ty, tz] = def.to;
    const horizontal = Math.hypot(tx - fx, tz - fz);
    const slope = Math.hypot(horizontal, ty - fy);
    return {
      mid: [(fx + tx) / 2, (fy + ty) / 2, (fz + tz) / 2] as const,
      yaw: Math.atan2(tx - fx, tz - fz),
      pitch: Math.atan2(ty - fy, horizontal),
      length: slope,
      // Rails are inset from each end in horizontal distance; convert to slope length.
      railLength: (horizontal - RAIL_END_INSET * 2) * (slope / horizontal),
    };
  }, [def]);

  const half = def.width / 2;
  const railX = half - RAIL_THICKNESS / 2;

  return (
    <group position={[mid[0], mid[1], mid[2]]} rotation-y={yaw}>
      {/* Local +z runs along the deck; tilt it to follow the slope. */}
      <group rotation-x={-pitch}>
        <mesh position-y={-DECK_THICKNESS / 2} material={deckMaterial}>
          <boxGeometry args={[def.width, DECK_THICKNESS, length]} />
        </mesh>
        {/* Underside spine */}
        <mesh position-y={-DECK_THICKNESS - 0.5} material={hullMaterial}>
          <boxGeometry args={[def.width * 0.35, 1, length * 0.98]} />
        </mesh>
        <mesh position-y={-DECK_THICKNESS - 1.02} material={glowMaterial(COLORS.cyan, 0.8)}>
          <boxGeometry args={[0.12, 0.05, length * 0.98]} />
        </mesh>
        {/* Deck edge light strips */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (half - 0.05), 0.02, 0]} material={glowMaterial(COLORS.cyan)}>
            <boxGeometry args={[0.1, 0.05, length]} />
          </mesh>
        ))}
        {/* Center lane chevrons */}
        <mesh position-y={0.015} rotation-x={-Math.PI / 2} material={glowMaterial(COLORS.cyan, 0.18)}>
          <planeGeometry args={[0.5, length * 0.95]} />
        </mesh>
        {/* Glass rails with glowing handrails */}
        {[-1, 1].map((side) => (
          <group key={side} position-x={side * railX}>
            <mesh position-y={RAIL_HEIGHT / 2} material={glassMaterial}>
              <boxGeometry args={[RAIL_THICKNESS * 0.4, RAIL_HEIGHT, railLength]} />
            </mesh>
            <mesh position-y={RAIL_HEIGHT} material={glowMaterial(COLORS.cyan)}>
              <boxGeometry args={[RAIL_THICKNESS, 0.08, railLength]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
