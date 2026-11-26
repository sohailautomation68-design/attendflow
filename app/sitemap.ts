import type { MetadataRoute } from "next";

/** Only public pages are listed. The dashboard and all private data are never indexed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.PUBLIC_SITE_URL || "http://localhost:3000";
  const pages = ["/", "/features", "/pricing", "/faq", "/about", "/contact", "/privacy", "/terms"];
  return pages.map((p) => ({ url: `${base}${p}`, lastModified: new Date(), changeFrequency: "monthly", priority: p === "/" ? 1 : 0.6 }));
}
