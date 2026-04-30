import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/", "/proposal/"],
    },
    sitemap: "https://competitor-discovery-chi.vercel.app/sitemap.xml",
  };
}
