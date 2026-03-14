// GET /api/generate — scrape data only, return structured context
// The actual Claude call happens client-side (browser has API key injection)
import { fetchAllData } from '../lib/scraper.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    console.log('[generate] Fetching shipping data...');
    const data = await fetchAllData();
    console.log('[generate] Done:', {
      portReports: data.portReports?.filter(p => p.text?.length > 50).length,
      news: data.shippingNews?.filter(n => n.text?.length > 50).length,
      aisActive: data.aisPassages?.filter(p => p.status === 'ok' && p.vessels.length > 0).length,
    });
    return res.status(200).json({ success: true, data });
  } catch(e) {
    console.error('[generate] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
