"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { BEACON, COLORS, PLAZA } from "@/lib/cityLayout";
import { glowMaterial, hullLightMaterial, hullMaterial } from "./materials";

/** The Prometheus Flame: a tapered spire crowned by a pulsing fire core, the city's landmark. */
export function Beacon() {
  const flame = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);

  const spireHeight = BEACON.height - 4;
  const flameY = BEACON.height;

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const flicker = 1 + Math.sin(t * 3.1) * 0.06 + Math.sin(t * 7.3) * 0.03;
    flame.current?.scale.setScalar(flicker);
    flame.current?.rotation.set(t * 0.4, t * 0.7, 0);
    halo.current?.scale.setScalar(1.6 + Math.sin(t * 1.5) * 0.15);
    if (rings.current) rings.current.rotation.y += dt * 0.35;
    if (light.current) light.current.intensity = 900 * flicker;
  });

  return (
    <group position={[BEACON.x, PLAZA.top, BEACON.z]}>
      {/* Stepped base */}
      <mesh position-y={0.4} material={hullLightMaterial}>
        <cylinderGeometry args={[BEACON.baseRadius + 0.8, BEACON.baseRadius + 1.2, 0.8, 48]} />
      </mesh>
      <mesh position-y={0.82} rotation-x={Math.PI / 2} material={glowMaterial(COLORS.flame)}>
        <torusGeometry args={[BEACON.baseRadius + 0.9, 0.08, 8, 64]} />
      </mesh>

      {/* Spire */}
      <mesh position-y={spireHeight / 2} material={hullMaterial}>
        <cylinderGeometry args={[0.45, BEACON.baseRadius, spireHeight, 6]} />
      </mesh>
      {[0.25, 0.5, 0.75].map((f) => (
        <mesh key={f} position-y={spireHeight * f} material={glowMaterial(COLORS.flame, 0.9)}>
          <cylinderGeometry args={[0.47 + (BEACON.baseRadius - 0.45) * (1 - f) + 0.05, 0.47 + (BEACON.baseRadius - 0.45) * (1 - f) + 0.05, 0.18, 6]} />
        </mesh>
      ))}

      {/* Orbiting rings */}
      <group ref={rings} position-y={flameY}>
        <mesh rotation-x={Math.PI / 2.4} material={glowMaterial(COLORS.amber)}>
          <torusGeometry args={[3.4, 0.07, 8, 96]} />
        </mesh>
        <mesh rotation-x={Math.PI / 1.7} rotation-z={0.6} material={glowMaterial(COLORS.cyan, 0.8)}>
          <torusGeometry args={[4.2, 0.05, 8, 96]} />
        </mesh>
      </group>

      {/* Flame core + halo */}
      <mesh ref={flame} position-y={flameY} material={glowMaterial("#ffd08a")}>
        <icosahedronGeometry args={[1.3, 1]} />
      </mesh>
      <mesh ref={halo} position-y={flameY} material={glowMaterial(COLORS.flame, 0.25)}>
        <icosahedronGeometry args={[1.3, 2]} />
      </mesh>
      <pointLight ref={light} position-y={flameY} color={COLORS.flame} intensity={900} distance={90} decay={2} />
    </group>
  );
}
