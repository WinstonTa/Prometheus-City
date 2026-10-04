"use client";

import { Cloud, Clouds, Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Sky as SkyImpl } from "three-stdlib";

/** Seconds for one full dusk → golden hour → dusk cycle. */
const DAY_CYCLE_SECONDS = 300;
const MIN_ELEVATION = THREE.MathUtils.degToRad(1.5);
const MAX_ELEVATION = THREE.MathUtils.degToRad(16);
/** The physical sky shader is calibrated for a low exposure; emissives (toneMapped=false) are unaffected. */
const EXPOSURE = 0.5;

const DUSK_FOG = new THREE.Color("#e9a98f");
const DAY_FOG = new THREE.Color("#b4c8ea");
const DUSK_SUN = new THREE.Color("#ff9a5c");
const DAY_SUN = new THREE.Color("#fff0dc");
const INITIAL_SUN = new THREE.Vector3(0, 0.05, -1);

/**
 * Animated physical sky with matching sun light and fog. The sun sits low over the
 * Forge Terrace (−z) and slowly rises and sets, so the emissive city reads well.
 */
export function Atmosphere() {
  const sky = useRef<SkyImpl>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const gl = useThree((s) => s.gl);
  const fog = useMemo(() => new THREE.Fog(DUSK_FOG.clone(), 140, 820), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const previous = gl.toneMappingExposure;
    gl.toneMappingExposure = EXPOSURE;
    return () => {
      gl.toneMappingExposure = previous;
    };
  }, [gl]);

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
      sun.current.intensity = 3.2 + day * 2.4;
    }
    if (hemi.current) hemi.current.intensity = 1.8 + day * 1.2;
    fog.color.lerpColors(DUSK_FOG, DAY_FOG, day);
  });

  return (
    <>
      <primitive object={fog} attach="fog" />
      <Sky ref={sky} distance={2500} sunPosition={INITIAL_SUN} turbidity={8} rayleigh={3} mieCoefficient={0.005} mieDirectionalG={0.75} />
      <hemisphereLight ref={hemi} args={["#b9cbff", "#5a3a52", 1.8]} />
      <directionalLight ref={sun} position={[0, 30, -200]} intensity={3.2} />
      <ambientLight intensity={0.35} />
    </>
  );
}

/** Soft, lumpy cloud sprite generated on a canvas, so no texture is fetched from a CDN. */
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
  // Broad soft base, then many small lumps for texture; everything fades out well before the edge.
  const blob = (x: number, y: number, r: number, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.45})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
  blob(size / 2, size / 2, size * 0.48, 0.35);
  for (let i = 0; i < 70; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.pow(rand(), 0.8) * size * 0.3;
    blob(size / 2 + Math.cos(angle) * dist, size / 2 + Math.sin(angle) * dist * 0.7, size * (0.05 + rand() * 0.1), 0.14);
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
  { y: -28, color: "#ffffff", count: 14, spread: 240, segments: 18, volume: 22, opacity: 0.9 },
  { y: -42, color: "#ffd9d0", count: 12, spread: 360, segments: 16, volume: 36, opacity: 0.85 },
  { y: -58, color: "#d9c3e8", count: 10, spread: 520, segments: 14, volume: 55, opacity: 0.9 },
];

/** Three drifting cloud layers over a continuous cloud floor that dissolves into the horizon fog. */
export function CloudSea() {
  const texture = useMemo(() => createCloudTexture(), []);
  const group = useRef<THREE.Group>(null);

  const clouds = useMemo(
    () =>
      LAYERS.flatMap((layer, li) =>
        Array.from({ length: layer.count }, (_, i) => {
          // Golden-angle spiral: even coverage without a visible ring pattern.
          const angle = i * 2.39996 + li * 0.9;
          const dist = layer.spread * Math.sqrt((i + 0.5) / layer.count);
          return {
            key: `${li}-${i}`,
            seed: li * 100 + i + 1,
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
      {/* Cloud floor: an endless soft surface that the fog blends into the sky. */}
      <mesh position-y={-66} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2400, 48]} />
        <meshBasicMaterial color="#e8c9d6" />
      </mesh>
      <Clouds texture={texture} limit={limit} material={THREE.MeshBasicMaterial} frustumCulled={false}>
        {clouds.map(({ key, seed, position, layer }) => (
          <Cloud
            key={key}
            seed={seed}
            position={position}
            segments={layer.segments}
            bounds={[layer.volume * 1.6, layer.volume * 0.15, layer.volume * 1.6]}
            volume={layer.volume}
            smallestVolume={0.5}
            growth={3}
            speed={0.06}
            fade={30}
            opacity={layer.opacity}
            color={layer.color}
          />
        ))}
      </Clouds>
    </group>
  );
}
