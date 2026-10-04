import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // R3F scene code mutates three.js objects (vectors, materials, meshes) inside
    // useFrame by design; that is the intended render-loop pattern, not React state.
    files: ["components/city/**/*.tsx", "components/Avatar.tsx", "components/PlayerController.tsx", "components/RemotePlayers.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
