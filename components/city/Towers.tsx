"use client";

import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS, type TowerDef } from "@/lib/cityLayout";
import { hullMaterial } from "./materials";

type V3 = [number, number, number];

interface Piece {
  position: V3;
  scale: V3;
  rotY: number;
  color?: string;
}

/** Rotate a local (x, z) offset by a tower's yaw and add its origin. */
function place(t: TowerDef, lx: number, y: number, lz: number): V3 {
  const c = Math.cos(t.rot);
  const s = Math.sin(t.rot);
  return [t.x + c * lx + s * lz, y, t.z - s * lx + c * lz];
}

function buildPieces(towers: readonly TowerDef[]) {
  const hulls: Piece[] = [];
  const glows: Piece[] = [];
  const beacons: Piece[] = [];

  for (const t of towers) {
    const { w, d, height: h, base } = t;
    // Main shaft + stepped crown.
    hulls.push({ position: place(t, 0, base + h / 2, 0), scale: [w, h, d], rotY: t.rot });
    hulls.push({ position: place(t, 0, base + h + 1.5, 0), scale: [w * 0.6, 3, d * 0.6], rotY: t.rot });

    // Vertical corner light strips.
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      glows.push({ position: place(t, (sx * w) / 2, base + h / 2, (sz * d) / 2), scale: [0.16, h, 0.16], rotY: t.rot, color: t.accent });
    }
    // Horizontal window bands, wrapping the shaft.
    for (let y = 4; y < h - 1; y += 3.2) {
      glows.push({ position: place(t, 0, base + y, 0), scale: [w + 0.04, 0.12, d + 0.04], rotY: t.rot, color: y % 2 < 1 ? t.accent : COLORS.amber });
    }
    // Crown cap ring and antenna.
    glows.push({ position: place(t, 0, base + h + 0.05, 0), scale: [w + 0.1, 0.1, d + 0.1], rotY: t.rot, color: t.accent });
    hulls.push({ position: place(t, 0, base + h + 5, 0), scale: [0.15, 4, 0.15], rotY: t.rot });
    beacons.push({ position: place(t, 0, base + h + 7.2, 0), scale: [0.35, 0.35, 0.35], rotY: 0 });
  }
  return { hulls, glows, beacons };
}

/** All towers rendered as three instanced batches (hull, light strips, blinking beacons). */
export function Towers({ towers }: { towers: readonly TowerDef[] }) {
  const { hulls, glows, beacons } = useMemo(() => buildPieces(towers), [towers]);
  const beaconMaterial = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (beaconMaterial.current) beaconMaterial.current.opacity = Math.sin(clock.elapsedTime * 3) > 0.2 ? 1 : 0.15;
  });

  return (
    <group>
      <Instances limit={hulls.length} material={hullMaterial}>
        <boxGeometry />
        {hulls.map((p, i) => (
          <Instance key={i} position={p.position} scale={p.scale} rotation-y={p.rotY} />
        ))}
      </Instances>
      <Instances limit={glows.length}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
        {glows.map((p, i) => (
          <Instance key={i} position={p.position} scale={p.scale} rotation-y={p.rotY} color={p.color} />
        ))}
      </Instances>
      <Instances limit={beacons.length}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial ref={beaconMaterial} color="#ff3b3b" toneMapped={false} transparent />
        {beacons.map((p, i) => (
          <Instance key={i} position={p.position} scale={p.scale} />
        ))}
      </Instances>
    </group>
  );
}
