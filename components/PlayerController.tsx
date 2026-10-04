"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Avatar } from "@/components/Avatar";
import { useKeyboard } from "@/hooks/useKeyboard";
import {
  AIR_ACCEL,
  GRAVITY,
  GROUND_ACCEL,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  SPRINT_SPEED,
  VOID_Y,
  WALK_SPEED,
  angleDelta,
  damp,
  groundHeightAt,
  pointInsideObstacle,
  resolveObstacles,
} from "@/lib/physics";
import { colorFromId, localPlayer } from "@/lib/remoteState";
import { isGameInputBlocked, useGameStore } from "@/lib/store";
import { SPAWN_POINT, type PlayerState } from "@/shared/protocol";

const SYNC_INTERVAL = 1 / 30; // 30 Hz cap
const KEEPALIVE_MS = 1000;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.12;
/** When grounded, stick to surfaces up to this far below (walking down ramps). */
const SNAP_DOWN = 0.35;

const HEAD_HEIGHT = 1.55;
const MIN_PITCH = -0.35;
const MAX_PITCH = 1.25;
const MIN_DISTANCE = 3;
const MAX_DISTANCE = 16;
const DRAG_SENSITIVITY = 0.0042;
const LOCK_SENSITIVITY = 0.0028;
const CLICK_MAX_TRAVEL = 5;

interface Sim {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  grounded: boolean;
  coyote: number;
  jumpBuffer: number;
  jumpWasHeld: boolean;
  rotY: number;
  isMoving: boolean;
  yaw: number;
  pitch: number;
  distance: number;
  /** Smoothed actual camera distance (pulled in by occluders). */
  camDistance: number;
}

function round(n: number, digits = 100) {
  return Math.round(n * digits) / digits;
}

export default function PlayerController({ onState }: { onState: (state: PlayerState) => void }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const keys = useKeyboard();
  const avatar = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const selfId = useGameStore((s) => s.selfId);
  const color = useMemo(() => colorFromId(selfId), [selfId]);

  const sim = useRef<Sim>({
    pos: new THREE.Vector3(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z),
    vel: new THREE.Vector3(),
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    jumpWasHeld: false,
    rotY: Math.PI,
    isMoving: false,
    yaw: 0,
    pitch: 0.32,
    distance: 8,
    camDistance: 8,
  });
  const sync = useRef({ acc: 0, lastSentAt: 0, last: null as PlayerState | null });
  const lastTeleport = useRef(useGameStore.getState().teleport?.nonce ?? 0);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  // Mouse: drag to orbit, click to lock the pointer, wheel to zoom.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let travel = 0;

    const locked = () => document.pointerLockElement === el;
    const rotate = (dx: number, dy: number, sensitivity: number) => {
      const s = sim.current;
      s.yaw -= dx * sensitivity;
      s.pitch = THREE.MathUtils.clamp(s.pitch + dy * sensitivity, MIN_PITCH, MAX_PITCH);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      dragging = true;
      travel = 0;
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (locked()) {
        rotate(e.movementX, e.movementY, LOCK_SENSITIVITY);
      } else if (dragging) {
        travel += Math.abs(e.movementX) + Math.abs(e.movementY);
        rotate(e.movementX, e.movementY, DRAG_SENSITIVITY);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      // A click (not a drag) captures the mouse for FPS-style looking. Esc releases it.
      if (e.button === 0 && travel < CLICK_MAX_TRAVEL && !locked() && !isGameInputBlocked()) {
        Promise.resolve(el.requestPointerLock()).catch(() => {});
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = sim.current;
      s.distance = THREE.MathUtils.clamp(s.distance * (1 + Math.sign(e.deltaY) * 0.1), MIN_DISTANCE, MAX_DISTANCE);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl]);

  const scratch = useMemo(
    () => ({ head: new THREE.Vector3(), offset: new THREE.Vector3(), probe: new THREE.Vector3(), move: { x: 0, z: 0 } }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = sim.current;
    const held = keys.current;

    // --- Respawn / admin teleport
    const teleport = useGameStore.getState().teleport;
    if (teleport && teleport.nonce !== lastTeleport.current) {
      lastTeleport.current = teleport.nonce;
      s.pos.set(teleport.x, teleport.y, teleport.z);
      s.vel.set(0, 0, 0);
    }
    if (s.pos.y < VOID_Y) {
      s.pos.set(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z);
      s.vel.set(0, 0, 0);
    }

    // --- Input (camera-relative)
    const blocked = isGameInputBlocked();
    let ix = 0;
    let iz = 0;
    if (!blocked) {
      if (held.has("KeyW") || held.has("ArrowUp")) iz += 1;
      if (held.has("KeyS") || held.has("ArrowDown")) iz -= 1;
      if (held.has("KeyD") || held.has("ArrowRight")) ix += 1;
      if (held.has("KeyA") || held.has("ArrowLeft")) ix -= 1;
    }
    const forwardX = -Math.sin(s.yaw);
    const forwardZ = -Math.cos(s.yaw);
    let wishX = forwardX * iz + Math.cos(s.yaw) * ix;
    let wishZ = forwardZ * iz - Math.sin(s.yaw) * ix;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }
    const sprint = !blocked && (held.has("ShiftLeft") || held.has("ShiftRight"));
    const speed = sprint ? SPRINT_SPEED : WALK_SPEED;

    // --- Horizontal velocity: accelerate toward the wish velocity
    const accel = (s.grounded ? GROUND_ACCEL : AIR_ACCEL) * dt;
    const dvx = wishX * speed - s.vel.x;
    const dvz = wishZ * speed - s.vel.z;
    const dvLen = Math.hypot(dvx, dvz);
    const k = dvLen > accel ? accel / dvLen : 1;
    s.vel.x += dvx * k;
    s.vel.z += dvz * k;

    // --- Jump (edge-triggered, with coyote time and input buffering)
    const jumpHeld = !blocked && held.has("Space");
    if (jumpHeld && !s.jumpWasHeld) s.jumpBuffer = JUMP_BUFFER;
    s.jumpWasHeld = jumpHeld;
    s.coyote = s.grounded ? COYOTE_TIME : Math.max(0, s.coyote - dt);
    s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);
    if (s.jumpBuffer > 0 && s.coyote > 0) {
      s.vel.y = JUMP_VELOCITY;
      s.grounded = false;
      s.coyote = 0;
      s.jumpBuffer = 0;
    }

    // --- Integrate
    s.vel.y = Math.max(s.vel.y - GRAVITY * dt, -MAX_FALL_SPEED);
    const prevY = s.pos.y;
    scratch.move.x = s.pos.x + s.vel.x * dt;
    scratch.move.z = s.pos.z + s.vel.z * dt;
    resolveObstacles(scratch.move, prevY);
    s.pos.x = scratch.move.x;
    s.pos.z = scratch.move.z;
    s.pos.y += s.vel.y * dt;

    const wasGrounded = s.grounded;
    const ground = groundHeightAt(s.pos.x, s.pos.z, prevY);
    if (ground !== null && s.vel.y <= 0 && s.pos.y <= ground + (wasGrounded ? SNAP_DOWN : 0)) {
      s.pos.y = ground;
      s.vel.y = 0;
      s.grounded = true;
    } else {
      s.grounded = false;
    }

    // --- Facing + animation state
    const horizontalSpeed = Math.hypot(s.vel.x, s.vel.z);
    s.isMoving = horizontalSpeed > 0.6;
    if (wishLen > 0) s.rotY += angleDelta(s.rotY, Math.atan2(wishX, wishZ)) * damp(14, dt);
    moving.current = s.isMoving && s.grounded;

    if (avatar.current) {
      avatar.current.position.copy(s.pos);
      avatar.current.rotation.y = s.rotY;
    }

    // --- Third-person camera with occlusion pull-in
    scratch.head.set(s.pos.x, s.pos.y + HEAD_HEIGHT, s.pos.z);
    const cosPitch = Math.cos(s.pitch);
    scratch.offset.set(Math.sin(s.yaw) * cosPitch, Math.sin(s.pitch), Math.cos(s.yaw) * cosPitch);
    let allowed = s.distance;
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const d = (s.distance * i) / steps;
      scratch.probe.copy(scratch.head).addScaledVector(scratch.offset, d);
      if (pointInsideObstacle(scratch.probe.x, scratch.probe.y, scratch.probe.z, 0.4)) {
        allowed = Math.max(MIN_DISTANCE * 0.5, (s.distance * (i - 1)) / steps);
        break;
      }
    }
    // Pull in fast, ease back out slowly.
    s.camDistance += (allowed - s.camDistance) * damp(allowed < s.camDistance ? 25 : 4, dt);
    camera.position.copy(scratch.head).addScaledVector(scratch.offset, s.camDistance);
    camera.lookAt(scratch.head);

    // --- Publish local state (for the admin roster) and sync at ≤30 Hz
    localPlayer.x = round(s.pos.x);
    localPlayer.y = round(s.pos.y);
    localPlayer.z = round(s.pos.z);
    localPlayer.rotY = round(Math.atan2(Math.sin(s.rotY), Math.cos(s.rotY)), 1000);
    localPlayer.isMoving = s.isMoving;

    const sy = sync.current;
    sy.acc += rawDt;
    if (sy.acc >= SYNC_INTERVAL) {
      sy.acc = 0;
      const now = performance.now();
      const last = sy.last;
      const changed =
        !last ||
        Math.abs(last.x - localPlayer.x) > 0.01 ||
        Math.abs(last.y - localPlayer.y) > 0.01 ||
        Math.abs(last.z - localPlayer.z) > 0.01 ||
        Math.abs(angleDelta(last.rotY, localPlayer.rotY)) > 0.01 ||
        last.isMoving !== localPlayer.isMoving;
      if (changed || now - sy.lastSentAt > KEEPALIVE_MS) {
        sy.last = { ...localPlayer };
        sy.lastSentAt = now;
        onStateRef.current(sy.last);
      }
    }
  });

  return (
    <group ref={avatar}>
      <Avatar color={color} movingRef={moving} />
    </group>
  );
}
