// GET /api/issues: every stored issue date, newest first, straight from
// the permanent gazette:index set (with the store's built-in probe fallback).

import { makeRedis, getDates } from '../store.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const r = makeRedis();
  if (!r) return res.status(503).json({ error: 'Redis not configured' });
  try {
    const dates = await getDates(r);
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300');
    return res.status(200).json({ success: true, dates, count: dates.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
