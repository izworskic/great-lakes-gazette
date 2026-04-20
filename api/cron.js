// Daily cron — 8am UTC (schedule set in vercel.json)
// Scrapes BoatNerd, generates brief with Claude Haiku, publishes to FVF as draft.
// Also writes result to Redis so /api/generate returns instantly all day (no duplicate API calls).
// Protected by CRON_SECRET — Vercel injects this header automatically on cron calls.

import { Redis }             from '@upstash/redis';
import { fetchAllData }      from '../lib/scraper.js';
import { generateBrief }     from '../lib/generator.js';
import { publishToWordPress } from '../lib/publisher.js';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function todayUTC() { return new Date().toISOString().slice(0, 10); }
function secondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor((midnight - now) / 1000);
}

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const ts  = () => new Date().toISOString();

  try {
    log.push(`[${ts()}] Cron starting — Great Lakes Gazette daily run`);

    const data = await fetchAllData();
    log.push(`[${ts()}] Data fetched — ${data.portReports.length} port reports, ${data.shippingNews.length} news items`);

    const aisActive = (data.aisPassages || []).filter(p => p.status === 'ok' && p.vessels.length > 0).length;
    log.push(`[${ts()}] AIS: ${aisActive} active ports`);

    const brief = await generateBrief(data);
    log.push(`[${ts()}] Brief generated — "${brief.headline}" (Issue ${brief.issueNumber})`);

    // Write to Redis so /api/generate returns this instantly — no duplicate Anthropic call
    const r = makeRedis();
    if (r) {
      const today    = todayUTC();
      const ttl      = 30 * 24 * 60 * 60; // 30 days — keeps issues alive for permalinks
      const redisKey = `gazette:daily:${today}`;
      const payload  = { data, brief, generated_at: new Date().toISOString() };
      try {
        await r.set(redisKey, JSON.stringify(payload), { ex: ttl });
        log.push(`[${ts()}] Redis cache primed for ${today} (TTL 30 days)`);
      } catch(e) {
        log.push(`[${ts()}] Redis write failed (non-fatal): ${e.message}`);
      }
    } else {
      log.push(`[${ts()}] Redis not configured — skipping cache prime`);
    }

    const post = await publishToWordPress(brief);
    log.push(`[${ts()}] Published to FVF — ${post.edit_url}`);

    // Submit new issue URL to IndexNow (Bing, Yandex, Seznam)
    try {
      const issueUrl = `https://gazette.chrisizworski.com/issue/${today}`;
      const inResp = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host:        'gazette.chrisizworski.com',
          key:         '0476a3c706866ff2744d876891a8d782',
          keyLocation: 'https://gazette.chrisizworski.com/0476a3c706866ff2744d876891a8d782.txt',
          urlList:     ['https://gazette.chrisizworski.com', issueUrl],
        })
      });
      log.push(`[${ts()}] IndexNow submitted — HTTP ${inResp.status}`);
    } catch(e) {
      log.push(`[${ts()}] IndexNow failed (non-fatal): ${e.message}`);
    }

    return res.status(200).json({ success: true, log, post });

  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    console.error('[cron] Failed:', e.message);
    return res.status(500).json({ success: false, error: e.message, log });
  }
}


