import "./globals.css";

const SITE_URL = "https://signal.nanoneuron.ai";
const SITE_NAME = "Signal CRM";
const DEFAULT_TITLE = "Signal CRM — Cross-Border Sales Intelligence";
const DEFAULT_DESC = "Turn competitor web changes into closed deals. Signal CRM monitors hiring spikes, expansions, pricing shifts, and leadership changes so B2B sales teams act first.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DEFAULT_DESC,
  keywords: [
    "cross-border CRM", "B2B sales intelligence", "web signal CRM",
    "competitor monitoring CRM", "international sales CRM", "export sales software",
    "sales intelligence platform India", "signal based selling", "hiring spike alerts",
    "B2B lead generation", "cross-border sales tool", "market expansion CRM",
  ],
  authors: [{ name: "Nanoneuron Services", url: "https://nanoneuron.ai" }],
  creator: "Nanoneuron Services",
  publisher: "Nanoneuron Services",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Signal CRM — Cross-Border Sales Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@nanoneuron_ai",
    creator: "@nanoneuron_ai",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
    images: [`${SITE_URL}/og-image.png`],
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    // Add Google Search Console verification token here when available
    // google: "YOUR_GOOGLE_VERIFICATION_TOKEN",
  },
  category: "technology",
  classification: "Business Software",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E50914",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="format-detection" content="telephone=no" />
        {/* Preconnect to API for faster first load */}
        <link rel="preconnect" href="https://signal-crm-api-production.up.railway.app" />
      </head>
      <body>{children}</body>
    </html>
  );
}
