// GET /api/issues — returns all stored issue dates from Redis
// Checks last 60 days by probing keys directly — faster than SCAN on cold start

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
    // Generate last 60 days of possible keys and check which exist
    const candidates = [];
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      candidates.push(d.toISOString().slice(0, 10));
    }

    // Batch existence check using mget — much faster than scan
    const keys = candidates.map(d => `gazette:daily:${d}`);
    const results = await r.mget(...keys);

    const dates = candidates.filter((_, i) => results[i] !== null);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ success: true, dates, count: dates.length });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
