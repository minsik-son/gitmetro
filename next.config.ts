import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: here,
};

export default nextConfig;
