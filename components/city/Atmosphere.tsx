"use client";

import { Cloud, Clouds, Sky } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Sky as SkyImpl } from "three-stdlib";

/** Seconds for one full dusk → golden hour → dusk cycle. */
const DAY_CYCLE_SECONDS = 300;
const MIN_ELEVATION = THREE.MathUtils.degToRad(2.5);
const MAX_ELEVATION = THREE.MathUtils.degToRad(20);

const DUSK_FOG = new THREE.Color("#c08a86");
const DAY_FOG = new THREE.Color("#93abd4");
const DUSK_SUN = new THREE.Color("#ff9a66");
const DAY_SUN = new THREE.Color("#fff0dc");
const INITIAL_SUN = new THREE.Vector3(0, 0.1, -1);

/**
 * Animated physical sky with matching sun light and fog. The sun sits low over the
 * Forge Terrace (−z) and slowly rises and sets, so the emissive city reads well.
 */
export function Atmosphere() {
  const sky = useRef<SkyImpl>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fog = useMemo(() => new THREE.Fog(DUSK_FOG.clone(), 120, 680), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // 0 at dusk, 1 at the highest point of the cycle.
    const day = 0.5 - 0.5 * Math.cos((t / DAY_CYCLE_SECONDS) * Math.PI * 2);
    const elevation = THREE.MathUtils.lerp(MIN_ELEVATION, MAX_ELEVATION, day);
    const azimuth = Math.sin(t / (DAY_CYCLE_SECONDS * 1.7)) * 0.5;
    sunDir.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation));

    if (sky.current) {
      (sky.current.material as THREE.ShaderMaterial).uniforms.sunPosition.value.copy(sunDir);
    }
    if (sun.current) {
      sun.current.position.copy(sunDir).multiplyScalar(200);
      sun.current.color.lerpColors(DUSK_SUN, DAY_SUN, day);
      sun.current.intensity = 1.4 + day * 1.4;
    }
    if (hemi.current) hemi.current.intensity = 0.7 + day * 0.6;
    fog.color.lerpColors(DUSK_FOG, DAY_FOG, day);
  });

  return (
    <>
      <primitive object={fog} attach="fog" />
      <Sky ref={sky} distance={2000} sunPosition={INITIAL_SUN} turbidity={7} rayleigh={2.4} mieCoefficient={0.006} mieDirectionalG={0.86} />
      <hemisphereLight ref={hemi} args={["#a9c1ff", "#3b2a44", 0.9]} />
      <directionalLight ref={sun} position={[0, 30, -200]} intensity={1.6} />
      <ambientLight intensity={0.15} />
    </>
  );
}

/** Soft cloud puff sprite generated on a canvas, so no texture is fetched from a CDN. */
function createCloudTexture(): string {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 40; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.pow(rand(), 1.5) * size * 0.22;
    const x = size / 2 + Math.cos(angle) * dist;
    const y = size / 2 + Math.sin(angle) * dist;
    const r = size * (0.12 + rand() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.28)");
    g.addColorStop(0.6, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas.toDataURL("image/png");
}

interface CloudLayer {
  y: number;
  color: string;
  count: number;
  spread: number;
  segments: number;
  volume: number;
  opacity: number;
}

const LAYERS: CloudLayer[] = [
  { y: -30, color: "#fff4ee", count: 12, spread: 260, segments: 22, volume: 26, opacity: 0.85 },
  { y: -48, color: "#f3c4c8", count: 9, spread: 320, segments: 18, volume: 34, opacity: 0.8 },
  { y: -72, color: "#8f86b8", count: 7, spread: 420, segments: 16, volume: 48, opacity: 0.9 },
];

/** Three drifting cloud layers forming the sea beneath the city. */
export function CloudSea() {
  const texture = useMemo(() => createCloudTexture(), []);
  const group = useRef<THREE.Group>(null);

  const clouds = useMemo(
    () =>
      LAYERS.flatMap((layer, li) =>
        Array.from({ length: layer.count }, (_, i) => {
          const angle = (i / layer.count) * Math.PI * 2 + li * 0.7;
          const dist = layer.spread * (0.15 + ((i * 7 + li * 3) % 10) / 12);
          return {
            key: `${li}-${i}`,
            seed: li * 100 + i,
            position: [Math.sin(angle) * dist, layer.y, Math.cos(angle) * dist] as [number, number, number],
            layer,
          };
        }),
      ),
    [],
  );
  const limit = LAYERS.reduce((sum, l) => sum + l.count * l.segments, 0);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.004;
  });

  return (
    <group ref={group}>
      <Clouds texture={texture} limit={limit} material={THREE.MeshBasicMaterial} frustumCulled={false}>
        {clouds.map(({ key, seed, position, layer }) => (
          <Cloud
            key={key}
            seed={seed}
            position={position}
            segments={layer.segments}
            bounds={[layer.volume * 2.2, layer.volume * 0.18, layer.volume * 2.2]}
            volume={layer.volume}
            smallestVolume={0.4}
            growth={4}
            speed={0.08}
            fade={40}
            opacity={layer.opacity}
            color={layer.color}
          />
        ))}
      </Clouds>
    </group>
  );
}
