/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'gitlab.com',
      },
      {
        protocol: 'https',
        hostname: 'bitbucket.org',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
    // NOTE: dangerouslyAllowSVG removed — SVG files are not processed through
    // Next.js image optimization. DiceBear avatar URLs use unoptimized={true} instead.
    // This prevents XSS via malicious SVG payloads in avatar/image fields.
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
