// GET /api/latest: the most recent stored edition, straight from Redis via
// the permanent index. This endpoint is read-only by design. The previous
// version scraped sources and made an Anthropic call on every request,
// which meant anyone could burn API credit by refreshing it; generation now
// happens only in the cron and the secret-guarded /api/generate.

import { makeRedis, getDates, getIssue } from '../store.js';
import { michiganDateKey } from '../dates.js';

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
    // This feed powers every Gazette card, including Soo Locks. A recovered
    // edition must not stay hidden behind an hour of stale CDN responses.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({
      success: true, ...issue, date: dates[0],
      freshness: { current: dates[0] === michiganDateKey(), expectedDate: michiganDateKey() },
    });
  } catch (e) {
    console.error('[latest]', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
