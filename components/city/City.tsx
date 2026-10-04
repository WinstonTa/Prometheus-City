"use client";

import { BRIDGES, PLAZA, SATELLITES, TOWERS } from "@/lib/cityLayout";
import { Beacon } from "./Beacon";
import { Bridge } from "./Bridge";
import { DistantSkyline } from "./DistantSkyline";
import { Landmarks } from "./Landmarks";
import { Platform } from "./Platform";
import { Towers } from "./Towers";

/** All static city geometry. Everything walkable comes from lib/cityLayout.ts. */
export function City() {
  return (
    <group>
      <Platform def={PLAZA} spokes={12} />
      {SATELLITES.map((p) => (
        <Platform key={p.id} def={p} />
      ))}
      {BRIDGES.map((b) => (
        <Bridge key={b.id} def={b} />
      ))}
      <Towers towers={TOWERS} />
      <Beacon />
      <Landmarks />
      <DistantSkyline />
    </group>
  );
}
