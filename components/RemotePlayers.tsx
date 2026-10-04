"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Avatar } from "@/components/Avatar";
import { damp } from "@/lib/physics";
import { colorFromId, remoteTargets } from "@/lib/remoteState";
import { useGameStore } from "@/lib/store";

/** Above this distance (e.g. respawn/teleport) avatars snap instead of gliding across the map. */
const SNAP_DISTANCE_SQ = 10 * 10;
const POSITION_SMOOTHING = 12;
const ROTATION_SMOOTHING = 14;
const UP = new THREE.Vector3(0, 1, 0);

function RemoteAvatar({ id, username }: { id: string; username: string }) {
  const root = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const initialized = useRef(false);
  const target = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, dt) => {
    const sample = remoteTargets.get(id);
    const group = root.current;
    if (!sample || !group) return;

    target.set(sample.x, sample.y, sample.z);
    targetQuat.setFromAxisAngle(UP, sample.rotY);

    if (!initialized.current || group.position.distanceToSquared(target) > SNAP_DISTANCE_SQ) {
      group.position.copy(target);
      group.quaternion.copy(targetQuat);
      initialized.current = true;
    } else {
      // Frame-rate independent exponential smoothing toward the latest 30 Hz sample.
      group.position.lerp(target, damp(POSITION_SMOOTHING, dt));
      group.quaternion.slerp(targetQuat, damp(ROTATION_SMOOTHING, dt));
    }
    group.visible = true;
    moving.current = sample.isMoving;
  });

  const color = useMemo(() => colorFromId(id), [id]);

  return (
    <group ref={root} visible={false}>
      <Avatar color={color} movingRef={moving} name={username} />
    </group>
  );
}

/** Renders every remote player in the roster. Re-renders only on join/leave. */
export default function RemotePlayers() {
  const players = useGameStore((s) => s.players);
  return (
    <>
      {Object.values(players).map((p) => (
        <RemoteAvatar key={p.id} id={p.id} username={p.username} />
      ))}
    </>
  );
}
