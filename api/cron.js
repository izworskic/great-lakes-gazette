// Weekly cron — fires every Monday at 8am UTC (set in vercel.json)
// Runs the full pipeline: scrape → generate → publish to WordPress draft
import { fetchAllData } from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';
import { publishToWordPress } from '../lib/publisher.js';

export default async function handler(req, res) {
  // Vercel cron sends GET with authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[cron] Great Lakes Gazette weekly run starting...');
    const data = await fetchAllData();
    const briefData = await generateBrief(data);
    const post = await publishToWordPress(briefData);
    console.log('[cron] Done. Post:', post.edit_url);
    return res.status(200).json({ success: true, post });
  } catch(e) {
    console.error('[cron] Failed:', e);
    return res.status(500).json({ error: e.message });
  }
}
