// GET /api/scrape — returns raw scraped data for inspection
import { fetchAllData } from '../lib/scraper.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const data = await fetchAllData();

    // Return a readable summary + raw data
    const summary = {
      fetched_at: data.fetched_at,
      port_reports: data.portReports.map(p => ({
        title: p.title, date: p.date?.slice(0,10), chars: p.text?.length || 0, url: p.url, error: p.error
      })),
      shipping_news: data.shippingNews.map(n => ({
        title: n.title, date: n.date?.slice(0,10), chars: n.text?.length || 0, error: n.error
      })),
      ais_passages: data.aisPassages.map(p => ({
        port: p.port, status: p.status, vessel_count: p.vessels?.length || 0,
        vessels: p.vessels?.slice(0, 3).map(v => v.name) || [],
      })),
      history_items: data.todayInHistory?.length || 0,
    };

    return res.status(200).json({ summary, raw: data });
  } catch(e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 500) });
  }
}
