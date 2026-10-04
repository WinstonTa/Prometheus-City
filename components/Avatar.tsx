"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { groundHeightAt } from "@/lib/physics";

const bodyGeometry = new THREE.CapsuleGeometry(0.38, 0.8, 6, 16);
const visorGeometry = new THREE.BoxGeometry(0.46, 0.12, 0.14);
const bandGeometry = new THREE.TorusGeometry(0.4, 0.035, 8, 32);
const shadowGeometry = new THREE.CircleGeometry(0.55, 24);
const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#c9d3e6", metalness: 0.55, roughness: 0.3 });
const shadowMaterial = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.35, depthWrite: false });

const NAME_FONT = "/fonts/orbitron-700.woff";

export function NameTag({ text, color }: { text: string; color: string }) {
  return (
    <Billboard position-y={2.25}>
      <Text
        font={NAME_FONT}
        fontSize={0.26}
        color="#ffffff"
        outlineWidth={0.022}
        outlineColor="#05070d"
        anchorX="center"
        anchorY="bottom"
        material-toneMapped={false}
      >
        {text}
      </Text>
      <mesh position-y={-0.06}>
        <planeGeometry args={[Math.min(0.2 + text.length * 0.17, 3.2), 0.035]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </Billboard>
  );
}

interface AvatarProps {
  color: string;
  /** Read each frame to drive the walk bob; avoids re-rendering at sync rate. */
  movingRef?: RefObject<boolean>;
  name?: string;
}

/**
 * Stylized capsule avatar with a glowing visor (facing local +z) and a blob shadow
 * projected onto whatever walkable surface is below. Origin is at the feet.
 */
export function Avatar({ color, movingRef, name }: AvatarProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const walk = useRef(0);
  const world = useMemo(() => new THREE.Vector3(), []);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
  const shadowMat = useMemo(() => shadowMaterial.clone(), []);

  useFrame(({ clock }, dt) => {
    const moving = movingRef?.current ?? false;
    walk.current = THREE.MathUtils.damp(walk.current, moving ? 1 : 0, 10, dt);
    if (body.current) {
      const t = clock.elapsedTime;
      body.current.position.y = Math.abs(Math.sin(t * 9)) * 0.09 * walk.current + Math.sin(t * 2) * 0.02;
      body.current.rotation.x = 0.12 * walk.current;
    }
    if (root.current && shadow.current) {
      root.current.getWorldPosition(world);
      const ground = groundHeightAt(world.x, world.z, world.y + 0.05);
      if (ground === null || world.y - ground > 12) {
        shadow.current.visible = false;
      } else {
        const height = world.y - ground;
        shadow.current.visible = true;
        shadow.current.position.y = ground - world.y + 0.03;
        shadow.current.scale.setScalar(Math.max(0.4, 1 - height * 0.08));
        shadowMat.opacity = Math.max(0.08, 0.35 - height * 0.03);
      }
    }
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh geometry={bodyGeometry} material={bodyMaterial} position-y={0.8} />
        <mesh geometry={bandGeometry} material={glow} position-y={0.78} rotation-x={Math.PI / 2} />
        <mesh geometry={visorGeometry} material={glow} position={[0, 1.32, 0.31]} />
        {/* Thruster pack */}
        <mesh material={bodyMaterial} position={[0, 0.95, -0.36]}>
          <boxGeometry args={[0.36, 0.42, 0.16]} />
        </mesh>
        <mesh material={glow} position={[0, 0.72, -0.4]}>
          <boxGeometry args={[0.22, 0.05, 0.05]} />
        </mesh>
      </group>
      <mesh ref={shadow} geometry={shadowGeometry} material={shadowMat} rotation-x={-Math.PI / 2} />
      {name && <NameTag text={name} color={color} />}
    </group>
  );
}
