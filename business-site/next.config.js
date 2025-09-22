/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: ['localhost', 'proofvault.net'],
  },
  env: {
    API_URL: process.env.API_URL,
    BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL,
  },
}

module.exports = nextConfig