// POST /api/publish — scrape + generate + publish to WordPress as draft
import { fetchAllData } from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';
import { publishToWordPress } from '../lib/publisher.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    console.log('[publish] Fetching data...');
    const data = await fetchAllData();

    console.log('[publish] Generating brief...');
    const briefData = await generateBrief(data);

    console.log('[publish] Publishing to WordPress...');
    const post = await publishToWordPress(briefData);

    return res.status(200).json({
      success: true,
      brief_preview: briefData.brief.slice(0, 300) + '...',
      issue: briefData.issueNumber,
      date: briefData.issueDate,
      wordpress: post
    });
  } catch(e) {
    console.error('[publish] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
