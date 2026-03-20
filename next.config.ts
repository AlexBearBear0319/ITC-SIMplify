import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // @supabase/ssr ships a CJS-only build with no "exports" field.
  // transpilePackages forces Turbopack to bundle it for the Edge runtime
  // (middleware), which resolves the "Cannot find the middleware module" error.
  transpilePackages: ["@supabase/ssr"],
};

export default nextConfig;
