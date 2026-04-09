import { Inter } from "next/font/google";
import "./globals.css";

// ── Inter font — loaded via next/font (zero layout shift, self-hosted) ────────
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800", "900"],
  preload: true,
});

// ── Site constants ────────────────────────────────────────────────────────────
const SITE_URL  = "https://signal.nanoneuron.ai";
const SITE_NAME = "Signal CRM";
const DEFAULT_TITLE = "Signal CRM — Cross-Border Sales Intelligence";
const DEFAULT_DESC  =
  "Turn competitor web changes into closed deals. Signal CRM monitors hiring spikes, market expansions, pricing shifts, and leadership changes so B2B sales teams act first.";

// ── JSON-LD structured data ───────────────────────────────────────────────────
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      "name": SITE_NAME,
      "url": SITE_URL,
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": DEFAULT_DESC,
      "featureList": [
        "Web Signal Intelligence",
        "Global Buyer Map — 195 countries",
        "Compliance Engine — 44 frameworks",
        "AI Action Recommendations",
        "Deal Pipeline Tracker",
        "Daily Digest Email",
      ],
      "offers": [
        {
          "@type": "Offer",
          "name": "Starter",
          "price": "4999",
          "priceCurrency": "INR",
          "billingDuration": "P1M",
        },
        {
          "@type": "Offer",
          "name": "Pro",
          "price": "8000",
          "priceCurrency": "INR",
          "billingDuration": "P1M",
        },
        {
          "@type": "Offer",
          "name": "Enterprise",
          "price": "19999",
          "priceCurrency": "INR",
          "billingDuration": "P1M",
        },
      ],
      "creator": {
        "@type": "Organization",
        "name": "Nanoneuron Services",
        "url": "https://nanoneuron.ai",
        "sameAs": ["https://twitter.com/nanoneuron_ai"],
      },
    },
    {
      "@type": "Organization",
      "@id": "https://nanoneuron.ai/#org",
      "name": "Nanoneuron Services",
      "url": "https://nanoneuron.ai",
      "logo": {
        "@type": "ImageObject",
        "url": "https://nanoneuron.ai/logo.svg",
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "sales@nanoneuron.ai",
        "contactType": "sales",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      "url": SITE_URL,
      "name": SITE_NAME,
      "description": DEFAULT_DESC,
      "publisher": { "@id": "https://nanoneuron.ai/#org" },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${SITE_URL}/dashboard/leads?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

// ── Next.js Metadata API ──────────────────────────────────────────────────────
export const metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:  DEFAULT_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DEFAULT_DESC,

  keywords: [
    "cross-border CRM", "B2B sales intelligence", "web signal CRM",
    "competitor monitoring CRM", "international sales CRM", "export sales software",
    "sales intelligence platform India", "signal based selling", "hiring spike alerts",
    "B2B lead generation", "cross-border sales tool", "market expansion CRM",
    "competitor tracking software", "B2B SaaS India", "global CRM tool",
    "sales automation India", "GDPR compliance checker", "global compliance CRM",
  ],

  authors:   [{ name: "Nanoneuron Services", url: "https://nanoneuron.ai" }],
  creator:   "Nanoneuron Services",
  publisher: "Nanoneuron Services",

  robots: {
    index:   true,
    follow:  true,
    googleBot: {
      index:              true,
      follow:             true,
      "max-image-preview": "large",
      "max-snippet":       -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         SITE_URL,
    siteName:    SITE_NAME,
    title:       DEFAULT_TITLE,
    description: DEFAULT_DESC,
    images: [
      {
        url:    `${SITE_URL}/og-image.png`,
        width:  1200,
        height: 630,
        alt:    "Signal CRM — Cross-Border Sales Intelligence",
        type:   "image/png",
      },
    ],
  },

  twitter: {
    card:        "summary_large_image",
    site:        "@nanoneuron_ai",
    creator:     "@nanoneuron_ai",
    title:       DEFAULT_TITLE,
    description: DEFAULT_DESC,
    images:      [`${SITE_URL}/og-image.png`],
  },

  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-US": SITE_URL,
    },
  },

  verification: {
    // Add these when available:
    // google: "YOUR_GOOGLE_SEARCH_CONSOLE_TOKEN",
    // yandex: "YOUR_YANDEX_TOKEN",
  },

  category:       "technology",
  classification: "Business Software",

  other: {
    "application-name":   SITE_NAME,
    "apple-mobile-web-app-title": SITE_NAME,
    "msapplication-TileColor": "#141414",
    "theme-color": "#141414",
  },
};

export const viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor:   [
    { media: "(prefers-color-scheme: dark)",  color: "#141414" },
    { media: "(prefers-color-scheme: light)", color: "#141414" },
  ],
};

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" className={inter.variable}>
      <head>
        {/* Favicon */}
        <link rel="icon"             href="/favicon.ico"        sizes="any" />
        <link rel="icon"             href="/icon.svg"           type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest"         href="/manifest.webmanifest" />

        {/* Browser hints */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="color-scheme"     content="dark" />

        {/* DNS prefetch for API */}
        <link rel="dns-prefetch"   href="https://signal-crm-api-production.up.railway.app" />
        <link rel="preconnect"     href="https://signal-crm-api-production.up.railway.app" />
        <link rel="dns-prefetch"   href="https://checkout.razorpay.com" />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>

      <body>
        {children}
      </body>
    </html>
  );
}
