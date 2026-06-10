// GET /sitemap.xml: dynamic sitemap with today's issue + all archived issues
// lastmod updates daily: signals Google to recrawl every day

import { Redis } from '@upstash/redis';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}


const escRss = (x = '') =>
  String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function renderRss(res, r) {
  let issues = [];
  if (r) {
    try {
      const candidates = [];
      const now = new Date();
      for (let i = 0; i < 45; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        candidates.push(d.toISOString().slice(0, 10));
      }
      const keys = candidates.map(d => `gazette:daily:${d}`);
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
    const rawHeadline = issue && issue.headline;
    const headline = escRss(typeof rawHeadline === 'string' && rawHeadline ? rawHeadline : `Great Lakes Gazette: ${date}`);
    const rawBrief = issue && (issue.brief != null ? issue.brief : issue.dateline);
    const briefStr = typeof rawBrief === 'string' ? rawBrief : '';
    const brief = escRss(briefStr.slice(0, 400));
    const pub = new Date(date + 'T12:00:00Z').toUTCString();
    return `    <item>\n      <title>${headline}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${pub}</pubDate>\n      <dc:creator>Chris Izworski</dc:creator>\n      <description>${brief}</description>\n    </item>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>Great Lakes Gazette</title>\n    <link>https://gazette.chrisizworski.com/</link>\n    <atom:link href="https://gazette.chrisizworski.com/feed.xml" rel="self" type="application/rss+xml" />\n    <description>Daily Great Lakes freighter and vessel-movement brief: bulk carriers, tankers, and tug-barge traffic across all five lakes, written from Bay City by Chris Izworski.</description>\n    <language>en-us</language>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n  </channel>\n</rss>`;
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}

export default async function handler(req, res) {
  if (req.query && req.query.format === 'rss') {
    return renderRss(res, makeRedis());
  }
  const today = new Date().toISOString().slice(0, 10);

  // Get all stored issue dates: probe last 90 days with mget (fast on cold start)
  let dates = [];
  const r = makeRedis();
  if (r) {
    try {
      const candidates = [];
      const now = new Date();
      for (let i = 0; i < 90; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        candidates.push(d.toISOString().slice(0, 10));
      }
      const keys    = candidates.map(d => `gazette:daily:${d}`);
      const results = await r.mget(...keys);
      dates = candidates
        .filter((_, i) => results[i] !== null)
        .sort((a, b) => b.localeCompare(a));
    } catch(e) {}
  }

  // Always include today even if not yet in Redis
  if (!dates.includes(today)) dates.unshift(today);

  // Build URL entries
  const issueUrls = dates.map(date => `
  <url>
    <loc>https://gazette.chrisizworski.com/issue/${date}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const matchmakerUrl = `
  <url>
    <loc>https://gazette.chrisizworski.com/matchmaker.html</loc>
    <lastmod>2026-06-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;

  const archivePageUrl = `
  <url>
    <loc>https://gazette.chrisizworski.com/archive</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;

  const archiveUrl = `
  <url>
    <loc>https://gazette.chrisizworski.com/chris-izworski</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://gazette.chrisizworski.com</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <news:news>
      <news:publication>
        <news:name>Great Lakes Gazette</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${today}</news:publication_date>
      <news:title>Great Lakes Gazette: Daily Maritime News from the Fleet</news:title>
    </news:news>
  </url>${archiveUrl}${archivePageUrl}${matchmakerUrl}${issueUrls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}
