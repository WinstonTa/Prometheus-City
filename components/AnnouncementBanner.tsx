"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store";

const BANNER_MS = 6500;

/** Top-of-viewport banner for admin broadcasts. Queued: one at a time. */
export default function AnnouncementBanner() {
  const banner = useGameStore((s) => s.banners[0]);
  const shiftBanner = useGameStore((s) => s.shiftBanner);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(shiftBanner, BANNER_MS);
    return () => clearTimeout(timer);
  }, [banner, shiftBanner]);

  if (!banner) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4" role="alert">
      <div key={banner.id} className="max-w-2xl animate-banner-in">
        <div className="pointer-events-auto rounded-xl border border-amber/70 bg-[rgb(30_18_4/0.82)] px-6 py-3 text-center backdrop-blur-md animate-glow">
          <p className="font-display text-[10px] font-bold tracking-[0.45em] text-amber/80">◆ GLOBAL BROADCAST ◆</p>
          <p className="mt-1 text-lg font-semibold text-amber text-glow-amber break-words">{banner.text}</p>
          {banner.from && <p className="mt-0.5 text-[11px] text-amber/60">— {banner.from}, Simulation Admin</p>}
        </div>
      </div>
    </div>
  );
}
