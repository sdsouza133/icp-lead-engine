import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@icp/core", "@icp/pipeline"],
};

export default nextConfig;
