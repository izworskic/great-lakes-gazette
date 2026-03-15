// GET /api/generate — scrape + generate brief, cached until midnight UTC.
// First visitor after midnight triggers a fresh generate.
// All subsequent visitors get the CDN-cached response until midnight.
// ?refresh=1 forces regeneration (CRON_SECRET required).

import { fetchAllData }  from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';

// In-memory fallback cache (secondary — CDN is the primary cache layer)
let memCache = {
  data:        null,
  brief:       null,
  generatedAt: null,
  dateKey:     null,   // YYYY-MM-DD — if date changes, cache is stale
};

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // "2026-03-14"
}

function secondsUntilMidnightUTC() {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,  // next day
    0, 0, 0, 0
  ));
  return Math.floor((midnight - now) / 1000);
}

function memCacheFresh() {
  return memCache.data !== null &&
         memCache.dateKey === todayUTC();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Force refresh requires CRON_SECRET
  const forceRefresh = req.query?.refresh === '1';
  if (forceRefresh) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // Serve from in-memory cache if same day and not forced
    if (!forceRefresh && memCacheFresh()) {
      const ageMinutes = Math.floor((Date.now() - memCache.generatedAt) / 60000);
      console.log(`[generate] Memory cache hit — ${ageMinutes}m old, date: ${memCache.dateKey}`);

      const ttl = secondsUntilMidnightUTC();
      res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=60`);
      res.setHeader('X-Cache', 'HIT-MEMORY');
      res.setHeader('X-Cache-Until', new Date(Date.now() + ttl * 1000).toUTCString());

      return res.status(200).json({
        success: true,
        cached: true,
        cache_age_minutes: ageMinutes,
        cache_until: new Date(Date.now() + ttl * 1000).toISOString(),
        data:  memCache.data,
        brief: memCache.brief,
      });
    }

    console.log('[generate] Cache miss — scraping + generating...');
    const today = todayUTC();
    const data = await fetchAllData();

    let brief = null;
    try {
      brief = await generateBrief(data);
      console.log('[generate] Brief generated:', brief?.headline);
    } catch(e) {
      console.error('[generate] Brief generation failed (non-fatal):', e.message);
    }

    // Update in-memory cache
    memCache = {
      data,
      brief,
      generatedAt: Date.now(),
      dateKey: today,
    };

    // Set CDN cache until midnight UTC — this is the key line
    // Vercel's edge will serve this response to all visitors until midnight
    const ttl = secondsUntilMidnightUTC();
    res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=60`);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Until', new Date(Date.now() + ttl * 1000).toUTCString());
    res.setHeader('X-Cache-Date', today);

    return res.status(200).json({
      success: true,
      cached: false,
      cache_until: new Date(Date.now() + ttl * 1000).toISOString(),
      data,
      brief,
    });

  } catch(e) {
    console.error('[generate] Fatal error:', e.message);
    // Serve stale memory cache on hard failure
    if (memCache.data) {
      console.log('[generate] Serving stale memory cache after error');
      return res.status(200).json({
        success: true,
        cached: true,
        stale: true,
        data:  memCache.data,
        brief: memCache.brief,
      });
    }
    return res.status(500).json({ success: false, error: e.message });
  }
}
