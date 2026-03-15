// GET /api/generate
// Cache strategy:
//   1. Upstash Redis (UPSTASH_REDIS_REST_URL + TOKEN) — persistent, keyed by UTC date
//      → ONE Anthropic API call per day, survives cold starts & redeployments
//   2. In-memory fallback — if Redis not configured (local dev / no env vars)

import { Redis } from '@upstash/redis';
import { fetchAllData }  from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';

// ── Redis client — null if env vars missing ───────────────────────────────────
function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ── In-memory fallback ────────────────────────────────────────────────────────
let memCache = { data: null, brief: null, generatedAt: null, dateKey: null };

function todayUTC() { return new Date().toISOString().slice(0, 10); }
function secondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor((midnight - now) / 1000);
}

async function redisGet(r, key) {
  if (!r) return null;
  try { return await r.get(key); } catch(e) { console.warn('[redis] get:', e.message); return null; }
}
async function redisSet(r, key, value, ttl) {
  if (!r) return;
  try { await r.set(key, JSON.stringify(value), { ex: ttl }); } catch(e) { console.warn('[redis] set:', e.message); }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const forceRefresh = req.query?.refresh === '1';
  if (forceRefresh) {
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const today = todayUTC();
  const redisKey = `gazette:daily:${today}`;
  const ttl = secondsUntilMidnight();
  const r = makeRedis();

  try {
    if (!forceRefresh) {
      // 1. Try Redis
      const cached = await redisGet(r, redisKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        console.log('[generate] Redis HIT for', today);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Cache', 'HIT-REDIS');
        return res.status(200).json({ success: true, cached: true, cache_source: 'redis', ...parsed });
      }

      // 2. Try in-memory
      if (memCache.data && memCache.dateKey === today) {
        console.log('[generate] Memory HIT');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Cache', 'HIT-MEMORY');
        return res.status(200).json({
          success: true, cached: true, cache_source: 'memory',
          cache_age_minutes: Math.floor((Date.now() - memCache.generatedAt) / 60000),
          data: memCache.data, brief: memCache.brief,
        });
      }
    }

    // 3. Cache miss — scrape + generate (one Anthropic call)
    console.log('[generate] MISS — generating for', today, r ? '(Redis available)' : '(no Redis)');
    const data = await fetchAllData();

    let brief = null;
    try {
      brief = await generateBrief(data);
      console.log('[generate] Brief:', brief?.headline);
    } catch(e) {
      console.error('[generate] Brief failed (non-fatal):', e.message);
    }

    const payload = { data, brief, generated_at: new Date().toISOString() };

    // 4. Persist to Redis (survives cold starts until midnight)
    await redisSet(r, redisKey, payload, ttl + 120);
    if (r) console.log('[generate] Saved to Redis, TTL:', ttl, 's');

    memCache = { data, brief, generatedAt: Date.now(), dateKey: today };

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, cache_source: 'fresh', ...payload });

  } catch(e) {
    console.error('[generate] Fatal:', e.message);
    if (memCache.data) {
      return res.status(200).json({ success: true, cached: true, stale: true, data: memCache.data, brief: memCache.brief });
    }
    return res.status(500).json({ success: false, error: e.message });
  }
}
