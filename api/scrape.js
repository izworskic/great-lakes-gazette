// GET /api/scrape — fetch raw data from all sources
// Returns the raw scraped data so you can inspect it
import { fetchAllData } from '../lib/scraper.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const data = await fetchAllData();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
