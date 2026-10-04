import * as THREE from "three";
import { COLORS } from "@/lib/cityLayout";

// Shared materials: created once (client-only module) and reused across the city
// to keep shader programs and draw-state changes to a minimum.

export const hullMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.hull,
  metalness: 0.65,
  roughness: 0.38,
});

export const hullLightMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.hullLight,
  metalness: 0.5,
  roughness: 0.45,
});

/** Horizon islands: lighter so the fog reads them as hazy silhouettes, not black holes. */
export const distantHullMaterial = new THREE.MeshStandardMaterial({
  color: "#5d5f7d",
  metalness: 0.2,
  roughness: 0.8,
});

export const deckMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.deck,
  metalness: 0.35,
  roughness: 0.6,
});

export const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: "#9be7ff",
  metalness: 0,
  roughness: 0.05,
  transparent: true,
  opacity: 0.16,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const glowCache = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Self-lit "emissive" material. Basic materials skip lighting entirely, and with
 * toneMapped=false the color renders at full intensity, which reads as glowing.
 */
export function glowMaterial(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const key = `${color}:${opacity}`;
  let material = glowCache.get(key);
  if (!material) {
    material = new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    glowCache.set(key, material);
  }
  return material;
}
