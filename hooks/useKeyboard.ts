"use client";

import { useEffect, useRef } from "react";
import { isGameInputBlocked, useGameStore } from "@/lib/store";

/**
 * Tracks held keys (by `KeyboardEvent.code`) in a ref, so reading them in `useFrame`
 * never triggers re-renders. Keys are ignored while chat or a modal owns the keyboard.
 */
export function useKeyboard() {
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const held = keys.current;
    const onDown = (e: KeyboardEvent) => {
      if (isGameInputBlocked() || e.ctrlKey || e.metaKey || e.altKey) return;
      held.add(e.code);
      if (e.code === "Space") e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => held.delete(e.code);
    const clear = () => held.clear();

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    // Drop held keys the moment chat or the admin panel takes focus.
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if ((s.chatFocused && !prev.chatFocused) || (s.adminOpen && !prev.adminOpen)) clear();
    });

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      unsubscribe();
    };
  }, []);

  return keys;
}
