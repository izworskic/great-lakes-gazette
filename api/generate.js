// POST /api/generate — scrape + generate brief (no publish)
// GET  /api/generate — same, using GET for easy testing
import { fetchAllData } from '../lib/scraper.js';
import { generateBrief } from '../lib/generator.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    console.log('Fetching shipping data...');
    const data = await fetchAllData();

    console.log('Generating brief...');
    const brief = await generateBrief(data);

    return res.status(200).json({ success: true, ...brief, raw_data_summary: {
      passage_ports: data.passages?.map(p => ({ port: p.port, vessels: p.vessels?.length || 0 })),
      port_report_available: !!data.portReport?.text,
      seaway_available: !!data.seawayStats?.text,
    }});
  } catch(e) {
    console.error('Generate error:', e);
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
