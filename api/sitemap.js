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

  // Get all stored issue dates — probe last 90 days with mget (fast on cold start)
  let dates = [];
  const r = makeRedis();
  if (r) {
    try {
      const candidates = [];
      const now = new Date();
      for (let i = 0; i < 90; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        candidates.push(d.toISOString().slice(0, 10));
      }
      const keys    = candidates.map(d => `gazette:daily:${d}`);
      const results = await r.mget(...keys);
      dates = candidates
        .filter((_, i) => results[i] !== null)
        .sort((a, b) => b.localeCompare(a));
    } catch(e) {}
  }

  // Always include today even if not yet in Redis
  if (!dates.includes(today)) dates.unshift(today);

  // Build URL entries
  const issueUrls = dates.map(date => `
  <url>
    <loc>https://gazette.chrisizworski.com/issue/${date}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const archiveUrl = `
  <url>
    <loc>https://gazette.chrisizworski.com/chris-izworski</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://gazette.chrisizworski.com</loc>
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
  </url>${archiveUrl}${issueUrls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}
