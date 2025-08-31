

// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // prevents ESLint from failing production builds
  },
    env: {
    KINDE_SITE_URL: process.env.KINDE_SITE_URL ?? 'http://localhost:3000',
    KINDE_POST_LOGOUT_REDIRECT_URL: process.env.KINDE_POST_LOGOUT_REDIRECT_URL ?? 'http://localhost:3000',
    KINDE_POST_LOGIN_REDIRECT_URL: process.env.KINDE_POST_LOGIN_REDIRECT_URL ?? 'http://localhost:3000/dashboard',
  },
};// ...your existing config


export default nextConfig;