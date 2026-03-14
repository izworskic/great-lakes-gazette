// Daily cron — 8am UTC (schedule set in vercel.json)
// Scrapes BoatNerd, generates brief with Claude Haiku, publishes to FVF as draft.
// Protected by CRON_SECRET — Vercel injects this header automatically on cron calls.

import { fetchAllData }      from '../lib/scraper.js';
import { generateBrief }     from '../lib/generator.js';
import { publishToWordPress } from '../lib/publisher.js';

export default async function handler(req, res) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET> automatically
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

    const briefData = await generateBrief(data);
    log.push(`[${ts()}] Brief generated — "${briefData.headline}" (Issue ${briefData.issueNumber})`);

    const post = await publishToWordPress(briefData);
    log.push(`[${ts()}] Published to FVF — ${post.edit_url}`);

    return res.status(200).json({ success: true, log, post });

  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    console.error('[cron] Failed:', e.message);
    return res.status(500).json({ success: false, error: e.message, log });
  }
}
