import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/features", "/pricing", "/faq", "/about", "/contact", "/privacy", "/terms"], disallow: ["/dashboard", "/attendance/", "/classes/", "/reports/", "/students/", "/alerts", "/notifications", "/corrections", "/platform", "/teachers", "/audit", "/me", "/api/", "/login", "/signup"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
