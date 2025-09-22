import { withSentryConfig } from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.bathroomtakeaway.com',
      },
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
      },
      // Plaid institution logos
      {
        protocol: 'https',
        hostname: 'plaid-merchant-logos.plaid.com',
      },
      {
        protocol: 'https',
        hostname: 'plaid-institution-logos.plaid.com',
      },
      // Additional domains that might be used for bank logos
      {
        protocol: 'https',
        hostname: 'cdn.plaid.com',
      },
    ],
  },
};

// Temporary guard: allow disabling Sentry plugin wrapper to avoid
// Next 15/Turbopack _document build errors when necessary.
const disableSentry =
  process.env.DISABLE_SENTRY_PLUGIN === '1' || process.env.NODE_ENV !== 'production';

const configToExport = disableSentry
  ? nextConfig
  : withSentryConfig(nextConfig, {
      // For all available options, see:
      // https://www.npmjs.com/package/@sentry/webpack-plugin#options

      org: 'vectr-personal-finance',

      project: 'vectr-nextjs-frontend',

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      // This can increase your server load as well as your hosting bill.
      // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
      // side errors will fail.
      tunnelRoute: '/monitoring',

      // Automatically tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,

      // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      automaticVercelMonitors: true,
    });

export default withBundleAnalyzer(configToExport);
