import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // passkit-generator reads files and uses node-forge; keep it out of the bundle.
  serverExternalPackages: ["passkit-generator"],
  // Pass images are read from disk at runtime.
  outputFileTracingIncludes: { "/api/wallet/**": ["./public/pass/**"] },
};

export default nextConfig;
