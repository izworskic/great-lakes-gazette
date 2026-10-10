// Read-only compatibility route. The public Gazette must not trigger paid
// generation, and all durable publishing now runs via the GitHub Actions job.
import { makeRedis, getIssue } from '../store.js';
import { michiganDateKey } from '../dates.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error:'GET only' });
  const today = michiganDateKey();
  const issue = await getIssue(makeRedis(), today);
  if (!issue) {
    res.setHeader('Cache-Control','no-store');
    return res.status(425).json({
      success:false,
      error:"Today's edition is not yet published. The scheduled GitHub Actions publisher prepares one vetted daily edition.",
    });
  }
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=120');
  return res.status(200).json({ success:true, cached:true, cache_source:'github', date:today, ...issue });
}
