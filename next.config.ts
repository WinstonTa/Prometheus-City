import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev-tools badge (it overlaps the chat HUD).
  // Build/runtime error overlays still appear in development.
  devIndicators: false,
};

export default nextConfig;
