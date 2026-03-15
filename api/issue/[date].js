// GET /api/issue/[date] — fetch a specific issue by date (YYYY-MM-DD)
// Reads from Redis. Returns the full brief + data for that day.

import { Redis } from '@upstash/redis';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { date } = req.query;

  // Validate date format
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const r = makeRedis();
  if (!r) return res.status(503).json({ error: 'Redis not configured' });

  try {
    const key    = `gazette:daily:${date}`;
    const cached = await r.get(key);

    if (!cached) {
      return res.status(404).json({ error: `No issue found for ${date}` });
    }

    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).json({ success: true, date, ...parsed });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
