import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  turbopack: {
    rules: {
      "*.md": {
        loaders: [require.resolve("./loader/matter.ts")],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
