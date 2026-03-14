// GET /api/generate — scrape all sources, return structured data for display
// Module-level 6-hour cache — serves cached response to most visitors,
// only re-scrapes when content is actually stale. Keeps costs near zero.

import { fetchAllData } from '../lib/scraper.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache = {
  data: null,
  generatedAt: null,
};

function isCacheFresh() {
  return cache.data !== null &&
         cache.generatedAt !== null &&
         (Date.now() - cache.generatedAt) < CACHE_TTL_MS;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Allow forced refresh via ?refresh=1 (useful for cron / admin trigger)
  const forceRefresh = req.query?.refresh === '1';

  try {
    if (!forceRefresh && isCacheFresh()) {
      const ageMinutes = Math.floor((Date.now() - cache.generatedAt) / 60000);
      console.log(`[generate] Cache hit — ${ageMinutes}m old, serving cached data`);
      return res.status(200).json({
        success: true,
        cached: true,
        cache_age_minutes: ageMinutes,
        data: cache.data,
      });
    }

    console.log('[generate] Cache miss — fetching fresh data...');
    const data = await fetchAllData();

    // Store in module cache
    cache.data = data;
    cache.generatedAt = Date.now();

    return res.status(200).json({
      success: true,
      cached: false,
      data,
    });
  } catch(e) {
    console.error('[generate] Error:', e.message);
    // On error, return stale cache if available rather than a hard failure
    if (cache.data) {
      console.log('[generate] Returning stale cache after error');
      return res.status(200).json({
        success: true,
        cached: true,
        stale: true,
        data: cache.data,
      });
    }
    return res.status(500).json({ success: false, error: e.message });
  }
}
