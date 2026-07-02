// GET /api/latest: the most recent stored edition, straight from Redis via
// the permanent index. This endpoint is read-only by design. The previous
// version scraped sources and made an Anthropic call on every request,
// which meant anyone could burn API credit by refreshing it; generation now
// happens only in the cron and the secret-guarded /api/generate.

import { makeRedis, getDates, getIssue } from '../store.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = makeRedis();
  if (!r) return res.status(503).json({ success: false, error: 'Redis not configured' });

  try {
    const dates = await getDates(r);
    if (!dates.length) {
      return res.status(404).json({ success: false, error: 'No editions stored yet.' });
    }
    const issue = await getIssue(r, dates[0]);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Latest edition could not be read.' });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ success: true, date: dates[0], ...issue });
  } catch (e) {
    console.error('[latest]', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
