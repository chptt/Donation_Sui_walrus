import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow images served from Walrus aggregator gateway
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aggregator.walrus-testnet.walrus.space",
      },
      {
        protocol: "https",
        hostname: "*.walrus.space",
      },
    ],
  },
};

export default nextConfig;
