import type { NextConfig } from 'next';

// The browser talks to /api on this origin; Next forwards it to the Laravel API, so there is no
// CORS to configure and the API URL stays a server setting.
const api = process.env.LEASING_API_URL ?? 'http://127.0.0.1:8000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default config;
