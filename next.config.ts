import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@planflow/shared", "@planflow/scheduler"]
};

export default nextConfig;
