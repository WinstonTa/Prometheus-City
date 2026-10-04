"use client";

import dynamic from "next/dynamic";

// `ssr: false` must live in a client component (App Router). This keeps three.js / R3F
// entirely out of the server render, so there is nothing for WebGL to mismatch on hydration.
const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-void">
      <p className="font-display text-sm tracking-[0.4em] text-cyan/80 uppercase animate-pulse">Initializing simulation</p>
    </div>
  ),
});

export default function ClientApp() {
  return <Game />;
}
