// GET /api/issues — returns all stored issue dates from Redis
// Used by sitemap and archive page

import { Redis } from '@upstash/redis';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = makeRedis();
  if (!r) return res.status(503).json({ error: 'Redis not configured' });

  try {
    // Scan for all gazette:daily:* keys
    let cursor = 0;
    const keys = [];
    do {
      const result = await r.scan(cursor, { match: 'gazette:daily:*', count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0);

    // Extract dates, sort descending
    const dates = keys
      .map(k => k.replace('gazette:daily:', ''))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort((a, b) => b.localeCompare(a));

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ success: true, dates, count: dates.length });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
