"use client";

import { Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { COLORS, FORGE_RING, GARDEN_TREES, OBSERVATORY_DOME, SATELLITES } from "@/lib/cityLayout";
import { glassMaterial, glowMaterial, hullLightMaterial, hullMaterial } from "./materials";

const forge = SATELLITES.find((s) => s.id === "forge")!;
const observatory = SATELLITES.find((s) => s.id === "observatory")!;

/** Forge Terrace: a vertical ceremonial ring with a slowly counter-rotating inner ring. */
function ForgeGate() {
  const inner = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (inner.current) inner.current.rotation.z += dt * 0.5;
  });
  const { x, z, radius, tube, footRadius } = FORGE_RING;
  return (
    <group position={[x, forge.top, z]}>
      <mesh position-y={radius} material={hullMaterial}>
        <torusGeometry args={[radius, tube, 16, 96]} />
      </mesh>
      <mesh position-y={radius} material={glowMaterial(COLORS.flame)}>
        <torusGeometry args={[radius - tube - 0.05, 0.08, 8, 96]} />
      </mesh>
      <mesh ref={inner} position-y={radius} material={glowMaterial(COLORS.amber, 0.7)}>
        <torusGeometry args={[radius * 0.7, 0.06, 6, 6]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * radius, 0.6, 0]} material={hullLightMaterial}>
          <cylinderGeometry args={[footRadius * 0.8, footRadius, 1.2, 16]} />
        </mesh>
      ))}
    </group>
  );
}

/** Skygarden: crystalline trees with bobbing glowing canopies. */
function CrystalGrove() {
  return (
    <group>
      {GARDEN_TREES.map((t, i) => (
        <group key={i} position={[t.x, t.base, t.z]}>
          <mesh position-y={t.height * 0.35} material={hullLightMaterial}>
            <cylinderGeometry args={[t.trunkRadius * 0.55, t.trunkRadius, t.height * 0.7, 8]} />
          </mesh>
          <Float speed={1.2 + i * 0.15} floatIntensity={0.6} rotationIntensity={0.4}>
            <mesh position-y={t.height * 0.8} material={glowMaterial(i % 2 ? COLORS.cyan : "#7dffb2", 0.85)}>
              <octahedronGeometry args={[t.height * 0.22, 0]} />
            </mesh>
          </Float>
        </group>
      ))}
    </group>
  );
}

/** Observatory Deck: a glass dome over a rotating holo-globe. */
function Observatory() {
  const globe = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (globe.current) globe.current.rotation.y += dt * 0.3;
  });
  const { x, z, radius } = OBSERVATORY_DOME;
  return (
    <group position={[x, observatory.top, z]}>
      <mesh material={glassMaterial}>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.05} material={glowMaterial(COLORS.violet)}>
        <torusGeometry args={[radius, 0.1, 8, 64]} />
      </mesh>
      <mesh ref={globe} position-y={2} material={glowMaterial(COLORS.violet, 0.55)}>
        <icosahedronGeometry args={[1.2, 1]} />
      </mesh>
    </group>
  );
}

export function Landmarks() {
  return (
    <>
      <ForgeGate />
      <CrystalGrove />
      <Observatory />
    </>
  );
}
