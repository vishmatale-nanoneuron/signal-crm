export const dynamic = "force-static";

const SITE_URL = "https://signal.nanoneuron.ai";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/dashboard"],
        disallow: ["/api/", "/_next/"],
      },
      {
        // Block AI scrapers that don't respect copyright
        userAgent: ["GPTBot", "CCBot", "ChatGPT-User", "Google-Extended"],
        disallow: ["/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
