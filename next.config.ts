import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the OG card font with the image route's serverless bundle — it's read
  // at runtime via readFile, which tracing won't detect on its own.
  outputFileTracingIncludes: {
    "/api/og": ["./assets/**"],
  },
};

export default nextConfig;
