/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'gitlab.com', 'bitbucket.org'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
  turbopack: {},
}

module.exports = nextConfig
