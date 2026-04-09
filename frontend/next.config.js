/** @type {import('next').NextConfig} */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseHostname = SUPABASE_URL.replace("https://", "").split(".")[0];

/** Security headers — applied on every response (works with Node.js / Vercel) */
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // XSS filter (legacy browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // HSTS — force HTTPS for 1 year, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not needed
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()" },
  // DNS prefetch control
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://signal-crm-api-production.up.railway.app https://api.razorpay.com wss://*.supabase.co https://*.supabase.co",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  // ── Deployment ──────────────────────────────────────────────
  // Remove output:"export" → enables full Next.js features:
  // Server Components, middleware, image optimisation, API routes
  // Deploy to Vercel (recommended) or any Node.js host
  trailingSlash: true,

  // ── Security Headers ────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Extra cache headers for static assets
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // ── Images ──────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Supabase storage
      {
        protocol: "https",
        hostname: `${supabaseHostname}.supabase.co`,
        pathname: "/storage/v1/object/public/**",
      },
      // Company logos via Clearbit
      { protocol: "https", hostname: "logo.clearbit.com" },
      // Flag CDN
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },

  // ── Redirects ───────────────────────────────────────────────
  async redirects() {
    return [
      // Legacy routes → canonical
      { source: "/home",     destination: "/",          permanent: true },
      { source: "/signin",   destination: "/login",     permanent: true },
      { source: "/register", destination: "/login",     permanent: true },
      { source: "/app",      destination: "/dashboard", permanent: true },
    ];
  },

  // ── Environment Variables (exposed to browser) ───────────────
  env: {
    NEXT_PUBLIC_APP_VERSION: "3.2.0",
    NEXT_PUBLIC_APP_NAME: "Signal CRM",
    NEXT_PUBLIC_SITE_URL: "https://signal.nanoneuron.ai",
  },

  // ── Compiler ────────────────────────────────────────────────
  compiler: {
    // Remove console.log in production (keep console.error/warn)
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  // ── Bundle ──────────────────────────────────────────────────
  poweredByHeader: false,          // Remove X-Powered-By: Next.js header
  reactStrictMode: true,           // Enable React strict mode for better dev warnings
  compress: true,                  // Enable gzip compression

  // ── Logging ─────────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // ── Experimental ────────────────────────────────────────────
  experimental: {
    optimizePackageImports: ["react", "react-dom"],
    // Server Actions enabled by default in Next.js 15
  },
};

module.exports = nextConfig;
