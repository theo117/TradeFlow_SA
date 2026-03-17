import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com"
      },
      {
        protocol: "https",
        hostname: "**.blob.vercel-storage.com"
      }
    ]
  }
};

export default nextConfig;
