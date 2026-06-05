/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'gitlab.com', 'bitbucket.org'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

let withBundleAnalyzer;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch {
  withBundleAnalyzer = (config) => config;
}

module.exports = withBundleAnalyzer(nextConfig)
