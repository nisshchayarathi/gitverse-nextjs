/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'gitlab.com', 'bitbucket.org', 'api.dicebear.com'],
  },
  // Next.js 14: prevent bundling native Node packages through webpack.
  // ws, pg, and the Neon/Prisma adapters rely on native Node.js APIs
  // that break when bundled — they must be required from node_modules at runtime.
  experimental: {
    serverComponentsExternalPackages: [
      'ws',
      'pg',
      '@neondatabase/serverless',
      '@prisma/adapter-neon',
      '@prisma/adapter-pg',
      '@prisma/client',
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false
    // Belt-and-suspenders: also mark these as webpack externals for server builds.
    // This ensures ws and neon packages are never bundled even for API routes
    // that may not go through the RSC pipeline.
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        'ws',
        'pg',
        '@neondatabase/serverless',
        '@prisma/adapter-neon',
        '@prisma/adapter-pg',
        '@prisma/client',
      ];
    }
    return config
  },
}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
