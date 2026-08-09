// Daily cron - early Michigan morning (schedules set in vercel.json and GitHub Actions).
// Scrapes current maritime sources, generates the edition, and writes it to Redis.
// Duplicate-safe retries repair an unhealthy issue in place instead of publishing a second one.
// Protected by CRON_SECRET - Vercel injects this header automatically on cron calls.

import { Redis }             from '@upstash/redis';
import { fetchAllData } from '../lib/scraper.js';
import { publishToWordPress, updateWordPressPost } from '../lib/publisher.js';
import { saveIssue, INDEX_KEY, getDates, getIssue, getIssues } from '../lib/store.js';
import { produceEdition } from '../lib/editor.js';
import { michiganDateKey, validateEditionDateIntegrity } from '../lib/dates.js';
import { topicSlugsForIssue } from '../lib/topics.js';

const SITE = 'https://gazette.chrisizworski.com';

export function buildIndexNowUrls(date, payload) {
  return Array.from(new Set([
    `${SITE}/`,
    `${SITE}/issue/${date}`,
    `${SITE}/archive`,
    `${SITE}/topics`,
    ...topicSlugsForIssue(payload).map(slug => `${SITE}/topics/${slug}`),
  ]));
}

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function assessIssueHealth(payload, date = michiganDateKey()) {
  const data = payload?.data || {};
  const generatedAt = payload?.generated_at || payload?.brief?.generated_at || '';
  const ais = Array.isArray(data.aisPassages) ? data.aisPassages : [];
  const water = Array.isArray(data.waterLevels) ? data.waterLevels : [];
  const weather = Array.isArray(data.marineWeather) ? data.marineWeather : [];
  const dateProblems = validateEditionDateIntegrity(payload?.brief, date);
  let generatedToday = false;
  try {
    generatedToday = Boolean(generatedAt) && michiganDateKey(generatedAt) === date;
  } catch {}
  const details = {
    date,
    generatedAt,
    hasHeadline: Boolean(payload?.brief?.headline),
    generatedToday,
    dateIntegrity: dateProblems.length === 0,
    dateProblems,
    aisHealthyPorts: ais.filter(item => item?.status === 'ok').length,
    waterLevelStations: water.filter(item => item?.status === 'ok' && Number.isFinite(item?.level_ft)).length,
    marineForecasts: weather.filter(item => item?.status === 'ok' && item?.synopsis).length,
  };
  return {
    healthy: details.hasHeadline && details.generatedToday && details.dateIntegrity && details.aisHealthyPorts >= 5 &&
      details.waterLevelStations >= 3 && details.marineForecasts >= 3,
    ...details,
  };
}

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const ts  = () => new Date().toISOString();
  const today = michiganDateKey();
  const r = makeRedis();
  const lockKey = `gazette:publish-lock:${today}`;
  const lockToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let lockAcquired = false;

  try {
    log.push(`[${ts()}] Cron starting - Great Lakes Gazette daily run (${today})`);
    if (!r) throw new Error('Redis is required to publish the Gazette');

    const existing = await getIssue(r, today);
    const existingHealth = assessIssueHealth(existing, today);
    if (existing && existingHealth.healthy) {
      log.push(`[${ts()}] Healthy issue already exists for ${today}; duplicate run skipped`);
      return res.status(200).json({
        success: true,
        alreadyPublished: true,
        issueUrl: `https://gazette.chrisizworski.com/issue/${today}`,
        health: existingHealth,
        log,
      });
    }

    lockAcquired = Boolean(await r.set(lockKey, lockToken, { nx: true, ex: 10 * 60 }));
    if (!lockAcquired) {
      log.push(`[${ts()}] Another publisher owns today's lock; this trigger is a no-op`);
      return res.status(200).json({ success: true, inProgress: true, log });
    }
    if (existing) {
      log.push(`[${ts()}] Existing issue is unhealthy; repairing it in place (${JSON.stringify(existingHealth)})`);
    }

    const data = await fetchAllData();
    log.push(`[${ts()}] Data fetched: ${data.portReports.length} port reports, ${data.shippingNews.length} news items`);

    const aisHealthy = (data.aisPassages || []).filter(p => p.status === 'ok').length;
    const aisActive = (data.aisPassages || []).filter(p => p.status === 'ok' && p.vessels.length > 0).length;
    log.push(`[${ts()}] AIS: ${aisHealthy}/7 source checks healthy, ${aisActive} ports with named passages`);

    // Edition number is the issue's position in the permanent archive, and the
    // last week of editions feeds the writer so no lead subject repeats.
    let issueNumber = 0;
    let recentEditions = [];
    try {
      const already = await r.sismember(INDEX_KEY, today);
      const count   = await r.scard(INDEX_KEY);
      issueNumber   = already ? count : count + 1;
      const dates   = (await getDates(r)).filter(d => d !== today).slice(0, 7);
      const map     = await getIssues(r, dates);
      recentEditions = dates.map(d => {
        const it = map.get(d);
        const b  = it && it.brief ? it.brief : {};
        return { date: d, headline: b.headline || '', leadSubject: b.leadSubject || '', spotlight: b.spotlight || '' };
      }).filter(e => e.headline);
    } catch (e) {
      log.push(`[${ts()}] Recent-edition lookup failed (writing without novelty context): ${e.message}`);
    }

    const { brief, report } = await produceEdition({
      data,
      issueNumber,
      recentEditions,
      log,
      publicationDate: today,
    });
    log.push(`[${ts()}] Edition accepted at ${report.total}/100 after ${brief.editorial.attempts} attempt(s): "${brief.headline}" (Issue ${brief.issueNumber})`);

    // Redis is the public Gazette's source of truth. Save before optional
    // distribution work so an FVF draft failure can never erase the edition.
    const payload = { data, brief, generated_at: new Date().toISOString() };
    await saveIssue(r, today, payload);
    log.push(`[${ts()}] Issue stored permanently for ${today}; gazette:index updated`);

    const health = assessIssueHealth(payload, today);
    let post = null;
    if (health.healthy) {
      try {
        const existingPostId = existing?.publication?.wordpress?.post_id;
        if (existingPostId) {
          post = await updateWordPressPost(existingPostId, brief);
          log.push(`[${ts()}] Updated existing FVF draft ${existingPostId}`);
        } else if (!existing) {
          post = await publishToWordPress(brief);
          log.push(`[${ts()}] Published FVF draft - ${post.edit_url}`);
        } else {
          log.push(`[${ts()}] Repaired public issue; skipped a new FVF draft to prevent duplication`);
        }
      } catch (error) {
        log.push(`[${ts()}] FVF draft failed (non-fatal): ${error.message}`);
      }
    } else {
      log.push(`[${ts()}] Source-health gate failed; public issue saved for continuity but distribution held`);
    }

    if (post?.post_id || existing?.publication) {
      payload.publication = post?.post_id
        ? { wordpress: { post_id: post.post_id, edit_url: post.edit_url, status: post.status } }
        : existing.publication;
      await saveIssue(r, today, payload);
    }

    // Submit every public discovery surface changed by this edition. Topic
    // classification is deterministic and adds no AI call or scheduled job.
    try {
      const urlList = buildIndexNowUrls(today, payload);
      const inResp = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host:        'gazette.chrisizworski.com',
          key:         '0476a3c706866ff2744d876891a8d782',
          keyLocation: 'https://gazette.chrisizworski.com/0476a3c706866ff2744d876891a8d782.txt',
          urlList,
        })
      });
      log.push(`[${ts()}] IndexNow submitted ${urlList.length} affected URLs - HTTP ${inResp.status}`);
    } catch(e) {
      log.push(`[${ts()}] IndexNow failed (non-fatal): ${e.message}`);
    }

    const status = health.healthy ? 200 : 503;
    return res.status(status).json({
      success: health.healthy,
      issueUrl: `https://gazette.chrisizworski.com/issue/${today}`,
      health,
      log,
      post,
    });

  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    console.error('[cron] Failed:', e.message);
    return res.status(500).json({ success: false, error: e.message, log });
  } finally {
    if (r && lockAcquired) {
      try {
        if (await r.get(lockKey) === lockToken) await r.del(lockKey);
      } catch (error) {
        console.warn('[cron] Publish lock cleanup failed:', error.message);
      }
    }
  }
}
