// Weekly cron — every Monday 8am UTC (set in vercel.json)
import { fetchAllData } from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';
import { publishToWordPress } from '../lib/publisher.js';

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    console.log('[cron] Great Lakes Gazette weekly run starting...');
    const data = await fetchAllData();
    const briefData = await generateBrief(data);
    const post = await publishToWordPress(briefData);
    console.log('[cron] Published:', post.edit_url);
    return res.status(200).json({ success: true, post });
  } catch(e) {
    console.error('[cron] Failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
