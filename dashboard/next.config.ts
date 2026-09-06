import { readFileSync } from "node:fs";

import type { NextConfig } from "next";

// The dashboard needs the same LiveKit credentials as the phone agent. Rather
// than keeping a second copy, fall back to reading LIVEKIT_* straight out of
// ../phone-agent/.env when they aren't already set. dashboard/.env.local (if you
// make one) still wins — Next loads it before this file runs.
try {
  const shared = readFileSync(
    new URL("../phone-agent/.env", import.meta.url),
    "utf8",
  );
  for (const line of shared.split("\n")) {
    const m = line.match(/^\s*(LIVEKIT_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // ../phone-agent/.env not present — rely on dashboard/.env.local instead.
}

const nextConfig: NextConfig = {};

export default nextConfig;
