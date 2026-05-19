import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, context) => {
    // Fix rate-limiter-flexible
    if (!context.isServer) {
      if (!config.externals) config.externals = [];
      if (Array.isArray(config.externals)) {
        config.externals.push("rate-limiter-flexible");
      }
    }

    // Fix OpenTelemetry warnings
    config.ignoreWarnings = [
      { module: /require-in-the-middle/ },
      { module: /@opentelemetry/ },
    ];

    // Ignore .d.ts files
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: "ignore-loader",
    });

    return config;
  },
};

export default nextConfig;