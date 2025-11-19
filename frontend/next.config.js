/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for Docker
  async rewrites() {
    // Use Docker service name when running in container, localhost otherwise
    const apiHost = process.env.API_HOST || 'localhost';
    return [
      {
        source: '/api/:path*',
        destination: `http://${apiHost}:4000/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;