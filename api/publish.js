// POST /api/publish — scrape + generate + publish to WordPress as draft
import { fetchAllData } from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';
import { publishToWordPress } from '../lib/publisher.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const data = await fetchAllData();
    const briefData = await generateBrief(data);
    const post = await publishToWordPress(briefData);
    return res.status(200).json({
      success: true,
      issue: briefData.issueNumber,
      date: briefData.issueDate,
      brief_preview: briefData.brief.slice(0, 400) + '...',
      wordpress: post,
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
