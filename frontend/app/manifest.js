export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Signal CRM — Cross-Border Sales Intelligence",
    short_name: "Signal CRM",
    description: "Turn competitor web changes into closed deals. B2B sales intelligence for cross-border teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#141414",
    theme_color: "#E50914",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    screenshots: [
      {
        src: "/og-image.png",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: "Signal CRM Dashboard",
      },
    ],
  };
}
