// GET /api/generate — scrape all sources, return structured data for display
// No Claude call needed — the page renders scraped content directly
import { fetchAllData } from '../lib/scraper.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    console.log('[generate] Fetching shipping data...');
    const data = await fetchAllData();
    return res.status(200).json({ success: true, data });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
