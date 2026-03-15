// GET /api/weather — NWS GLF marine forecasts, separate from main generate
// Called independently by the frontend so slow NWS responses don't block the page

import { scrapeMarineWeather } from '../lib/scraper.js';

let cache = { data: null, at: null, dateKey: null };

function todayUTC() { return new Date().toISOString().slice(0, 10); }

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache for 3 hours — GLF updates ~4x/day
  const fresh = cache.data && cache.dateKey === todayUTC() &&
                (Date.now() - cache.at) < 3 * 60 * 60 * 1000;

  if (fresh) {
    res.setHeader('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=300');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ success: true, cached: true, weather: cache.data });
  }

  try {
    const weather = await scrapeMarineWeather();
    cache = { data: weather, at: Date.now(), dateKey: todayUTC() };
    res.setHeader('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=300');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, weather });
  } catch(e) {
    if (cache.data) return res.status(200).json({ success: true, cached: true, stale: true, weather: cache.data });
    return res.status(500).json({ success: false, error: e.message });
  }
}
