"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense } from "react";
import { Atmosphere, CloudSea } from "@/components/city/Atmosphere";
import { City } from "@/components/city/City";
import PlayerController from "@/components/PlayerController";
import RemotePlayers from "@/components/RemotePlayers";
import type { PlayerState } from "@/shared/protocol";

/** Slow cinematic orbit shown behind the join screen. */
function FlyoverCamera() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.045;
    camera.position.set(Math.sin(t) * 125, 30 + Math.sin(t * 2.3) * 6, Math.cos(t) * 125);
    camera.lookAt(0, 8, 0);
  });
  return null;
}

export interface WorldCanvasProps {
  /** False renders the city as a backdrop (join screen); true spawns the local player. */
  playing: boolean;
  onLocalState: (state: PlayerState) => void;
}

/**
 * Scene root: renderer, sky, cloud sea, floating city, and players.
 * Must only be loaded client-side (see components/ClientApp.tsx).
 */
export default function WorldCanvas({ playing, onLocalState }: WorldCanvasProps) {
  return (
    <Canvas
      className="!fixed inset-0"
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.1, far: 5000, position: [0, 30, 125] }}
    >
      <Atmosphere />
      <City />
      {/* Separate boundaries so a loading texture/font never blanks the whole scene. */}
      <Suspense fallback={null}>
        <CloudSea />
      </Suspense>
      {playing ? (
        <>
          <PlayerController onState={onLocalState} />
          <Suspense fallback={null}>
            <RemotePlayers />
          </Suspense>
        </>
      ) : (
        <FlyoverCamera />
      )}
    </Canvas>
  );
}
