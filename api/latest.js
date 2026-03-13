// GET /api/latest — returns the most recently generated brief from KV store
// Falls back to generating fresh if none cached
// For now: just triggers a fresh generate and returns it
import { fetchAllData } from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const data = await fetchAllData();
    const briefData = await generateBrief(data);
    return res.status(200).json({ success: true, ...briefData });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
