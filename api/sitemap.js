// GET /sitemap.xml — dynamic sitemap with today's issue + all archived issues
// lastmod updates daily — signals Google to recrawl every day

import { Redis } from '@upstash/redis';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  // Get all stored issue dates
  let dates = [];
  const r = makeRedis();
  if (r) {
    try {
      let cursor = 0;
      const keys = [];
      do {
        const result = await r.scan(cursor, { match: 'gazette:daily:*', count: 100 });
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== 0);
      dates = keys
        .map(k => k.replace('gazette:daily:', ''))
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort((a, b) => b.localeCompare(a));
    } catch(e) {}
  }

  // Always include today even if not yet in Redis
  if (!dates.includes(today)) dates.unshift(today);

  // Build URL entries
  const issueUrls = dates.map(date => `
  <url>
    <loc>https://great-lakes-gazette.vercel.app/issue/${date}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://great-lakes-gazette.vercel.app</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <news:news>
      <news:publication>
        <news:name>Great Lakes Gazette</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${today}</news:publication_date>
      <news:title>Great Lakes Gazette — Daily Maritime News from the Fleet</news:title>
    </news:news>
  </url>${issueUrls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}
