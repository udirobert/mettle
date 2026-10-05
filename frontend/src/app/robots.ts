import type { MetadataRoute } from 'next';

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    ...(productionHost
      ? { sitemap: `https://${productionHost}/sitemap.xml` }
      : {}),
  };
}
