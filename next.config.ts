import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.bathroomtakeaway.com",
      },
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
      // Plaid institution logos
      {
        protocol: "https",
        hostname: "plaid-merchant-logos.plaid.com",
      },
      {
        protocol: "https",
        hostname: "plaid-institution-logos.plaid.com",
      },
      // Additional domains that might be used for bank logos
      {
        protocol: "https",
        hostname: "cdn.plaid.com",
      },
    ],
  },
};

export default nextConfig;
