// GET /feed.xml: RSS 2.0 feed of the last 30 daily issues
// Same Redis probe as sitemap.js; headline and brief come from the stored issue.

import { Redis } from '@upstash/redis';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default async function handler(req, res) {
  let issues = [];
  const r = makeRedis();
  if (r) {
    try {
      const candidates = [];
      const now = new Date();
      for (let i = 0; i < 45; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        candidates.push(d.toISOString().slice(0, 10));
      }
      const keys    = candidates.map(d => `gazette:daily:${d}`);
      const results = await r.mget(...keys);
      issues = candidates
        .map((date, i) => ({ date, data: results[i] }))
        .filter(x => x.data !== null)
        .slice(0, 30);
    } catch (e) {}
  }

  const items = issues.map(({ date, data }) => {
    let issue = data;
    if (typeof issue === 'string') { try { issue = JSON.parse(issue); } catch (e) { issue = {}; } }
    const url = `https://gazette.chrisizworski.com/issue/${date}`;
    const headline = esc(issue.headline || `Great Lakes Gazette: ${date}`);
    const brief = esc((issue.brief || issue.dateline || '').slice(0, 400));
    const pub = new Date(date + 'T12:00:00Z').toUTCString();
    return `    <item>
      <title>${headline}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <dc:creator>Chris Izworski</dc:creator>
      <description>${brief}</description>
    </item>`;
  }).join('\n');

  const today = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Great Lakes Gazette</title>
    <link>https://gazette.chrisizworski.com/</link>
    <atom:link href="https://gazette.chrisizworski.com/feed.xml" rel="self" type="application/rss+xml" />
    <description>Daily Great Lakes freighter and vessel-movement brief: bulk carriers, tankers, and tug-barge traffic across all five lakes, written from Bay City by Chris Izworski.</description>
    <language>en-us</language>
    <lastBuildDate>${today}</lastBuildDate>
${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}
