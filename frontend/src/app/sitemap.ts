import type { MetadataRoute } from 'next';

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = productionHost
    ? `https://${productionHost}`
    : 'http://localhost:3000';
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/plans`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/webmcp`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
