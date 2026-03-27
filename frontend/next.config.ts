import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.walrus.space" },
      { protocol: "https", hostname: "**.staketab.org" },
      { protocol: "https", hostname: "**.walrus-testnet.walrus.space" },
    ],
  },
};

export default nextConfig;
