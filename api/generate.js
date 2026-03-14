// GET /api/generate — scrape + generate brief, serve from 6-hour cache
// Claude is called ONCE per cache cycle maximum.
// All visitors after the first hit get instant cached response.
// ?refresh=1 forces regeneration (CRON_SECRET required to prevent abuse).

import { fetchAllData }  from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache = {
  data:        null,
  brief:       null,
  generatedAt: null,
};

function isCacheFresh() {
  return cache.data !== null &&
         cache.generatedAt !== null &&
         (Date.now() - cache.generatedAt) < CACHE_TTL_MS;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Force refresh requires CRON_SECRET — prevents crawlers from burning API calls
  const forceRefresh = req.query?.refresh === '1';
  if (forceRefresh) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    if (!forceRefresh && isCacheFresh()) {
      const ageMinutes = Math.floor((Date.now() - cache.generatedAt) / 60000);
      console.log(`[generate] Cache hit — ${ageMinutes}m old`);
      return res.status(200).json({
        success: true,
        cached: true,
        cache_age_minutes: ageMinutes,
        data:  cache.data,
        brief: cache.brief,
      });
    }

    console.log('[generate] Cache miss — scraping + generating brief...');
    const data = await fetchAllData();

    // Generate AI brief — catches gracefully if API key missing or Claude unavailable
    let brief = null;
    try {
      brief = await generateBrief(data);
      console.log('[generate] Brief generated:', brief.headline);
    } catch(e) {
      console.error('[generate] Brief generation failed (non-fatal):', e.message);
    }

    // Update cache
    cache.data        = data;
    cache.brief       = brief;
    cache.generatedAt = Date.now();

    return res.status(200).json({
      success: true,
      cached:  false,
      data,
      brief,
    });

  } catch(e) {
    console.error('[generate] Fatal error:', e.message);
    // Serve stale cache on hard failure rather than blank page
    if (cache.data) {
      console.log('[generate] Serving stale cache after error');
      return res.status(200).json({
        success: true,
        cached:  true,
        stale:   true,
        data:    cache.data,
        brief:   cache.brief,
      });
    }
    return res.status(500).json({ success: false, error: e.message });
  }
}
