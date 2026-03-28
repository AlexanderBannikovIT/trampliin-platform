/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Proxy all /api/* requests to the backend.
  // In Docker the backend service is reachable at http://backend:8000.
  // BACKEND_URL is injected via docker-compose environment.
  // Falls back to http://localhost:8000 for running outside Docker.
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
