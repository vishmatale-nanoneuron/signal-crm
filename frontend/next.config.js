/** @type {import('next').NextConfig} */

/**
 * Signal CRM — Next.js Config
 * Deployment target: Cloudflare Pages (static export)
 *
 * Why static export for Cloudflare Pages?
 * - All pages are "use client" — no server-side rendering needed
 * - Auth is handled client-side (localStorage + API calls to Railway)
 * - Static export = ultra-fast global CDN via Cloudflare
 * - Security headers set in public/_headers (Cloudflare Pages native)
 * - Zero cold starts, zero compute cost
 */

const nextConfig = {
  // ── Cloudflare Pages: static export ─────────────────────────
  output:        "export",
  trailingSlash: true,       // /dashboard → /dashboard/index.html
  distDir:       "out",      // Cloudflare Pages build output directory

  // ── Images — must be unoptimized for static export ───────────
  // next/image optimization requires a Node.js server.
  // For static export, use <img> or set unoptimized:true.
  // Cloudflare Images / Cloudflare Resize can handle this in prod.
  images: {
    unoptimized: true,
  },

  // ── Environment Variables (baked into static build) ──────────
  env: {
    NEXT_PUBLIC_APP_VERSION: "3.2.0",
    NEXT_PUBLIC_APP_NAME:    "Signal CRM",
    NEXT_PUBLIC_SITE_URL:    "https://signal.nanoneuron.ai",
  },

  // ── Compiler ─────────────────────────────────────────────────
  compiler: {
    // Strip console.log in prod builds (keep error/warn)
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  // ── Bundle ───────────────────────────────────────────────────
  poweredByHeader: false,   // Don't leak server info
  reactStrictMode: true,
  compress:        true,

  // ── ESLint ───────────────────────────────────────────────────
  // Skip ESLint during build on CI/Cloudflare (lint separately in dev)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ── TypeScript ───────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: false,
  },

  // ── Experimental ─────────────────────────────────────────────
  experimental: {
    optimizePackageImports: ["react", "react-dom"],
  },
};

module.exports = nextConfig;
