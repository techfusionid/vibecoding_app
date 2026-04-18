import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, context) => {
    // Ignore semua file .d.ts agar tidak di-parse webpack
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: "ignore-loader",
    });

    if (!context.isServer) {
      if (!config.externals) {
        config.externals = [];
      }
      if (Array.isArray(config.externals)) {
        config.externals.push("rate-limiter-flexible");
      }
    }

    return config;
  },
};

export default nextConfig;