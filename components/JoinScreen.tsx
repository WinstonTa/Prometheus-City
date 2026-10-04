"use client";

import { useState, type FormEvent } from "react";
import { loadSavedUsername, useGameStore } from "@/lib/store";
import { MAX_PLAYERS, MAX_USERNAME_LENGTH, sanitizeUsername } from "@/shared/protocol";

/** Title card over the city flyover: pick a callsign, or see the "room full" state. */
export default function JoinScreen() {
  const status = useGameStore((s) => s.status);
  const join = useGameStore((s) => s.join);
  const leave = useGameStore((s) => s.leave);
  const [name, setName] = useState(loadSavedUsername);
  const full = status === "full";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    join(sanitizeUsername(name));
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-void/40 via-transparent to-void/70 p-4">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-[11px] tracking-[0.6em] text-cyan/80">SIMULATION 01</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-[0.12em] text-white text-glow-cyan sm:text-5xl">
          PROMETHEUS
          <span className="block text-flame [text-shadow:0_0_24px_rgb(255_122_47/0.7)]">CITY</span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm text-ink/75">
          A city held aloft above an endless sea of clouds. Up to {MAX_PLAYERS} travelers may walk its plazas at once.
        </p>

        {full ? (
          <div className="mt-8 rounded-xl hud-panel p-5">
            <p className="font-display text-sm font-bold tracking-[0.2em] text-amber">SIMULATION AT CAPACITY</p>
            <p className="mt-2 text-sm text-muted">All {MAX_PLAYERS} slots are occupied. Try again in a moment.</p>
            <button
              type="button"
              onClick={leave}
              className="mt-4 rounded-md border border-cyan/50 bg-cyan/15 px-4 py-2 text-sm font-semibold text-cyan hover:bg-cyan/25"
            >
              Back
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 rounded-xl hud-panel p-5 text-left">
            <label htmlFor="callsign" className="font-display text-[10px] font-bold tracking-[0.3em] text-cyan/80">
              CALLSIGN
            </label>
            <input
              id="callsign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_USERNAME_LENGTH}
              placeholder="Wanderer"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-edge bg-black/30 px-3 py-2.5 text-base text-ink placeholder:text-muted/50 focus:border-cyan/60 focus:outline-none"
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-md bg-gradient-to-r from-flame to-amber px-4 py-2.5 font-display text-sm font-bold tracking-[0.25em] text-void shadow-[0_0_24px_rgb(255_122_47/0.45)] transition hover:brightness-110"
            >
              ENTER SIMULATION
            </button>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
              WASD move · Space jump · Shift sprint · Drag or click to look · Enter to chat
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
