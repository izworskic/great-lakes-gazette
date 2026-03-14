// GET or POST /api/generate — scrape + generate brief, return as JSON
import { fetchAllData } from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    console.log('[generate] Fetching data...');
    const data = await fetchAllData();

    console.log('[generate] Data summary:', {
      portReports: data.portReports?.filter(p => p.text).length,
      news: data.shippingNews?.filter(n => n.text).length,
      aisPortsActive: data.aisPassages?.filter(p => p.status === 'ok' && p.vessels.length > 0).length,
    });

    console.log('[generate] Generating brief...');
    const brief = await generateBrief(data);

    return res.status(200).json({ success: true, ...brief });
  } catch(e) {
    console.error('[generate] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
