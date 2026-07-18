// GET /sitemap.xml and /feed.xml (rewritten here): both now enumerate from
// the permanent gazette:index, so every stored edition appears. The RSS feed
// carries the 30 most recent editions with the full brief in content:encoded,
// which is what makes subscribing worthwhile: readers get the whole edition
// in their reader, not a stub. The matchmaker entry is gone; that tool lives
// at chrisizworski.com now.

import { makeRedis, getDates, getIssues } from '../store.js';
import { SITE, AUTHOR, esc, stripDashes, paragraphs } from '../layout.js';
import { renderNewsMetadata } from '../news-sitemap.js';

function cdata(html) {
  return '<![CDATA[' + String(html).replace(/\]\]>/g, ']]&gt;') + ']]>';
}

async function renderRss(res, r) {
  let entries = [];
  try {
    const dates = (await getDates(r)).slice(0, 30);
    const m = await getIssues(r, dates);
    entries = dates
      .map(date => ({ date, issue: m.get(date) }))
      .filter(x => x.issue);
  } catch (e) { console.warn('[rss]', e.message); }

  const items = entries.map(({ date, issue }) => {
    const b = (issue.brief && typeof issue.brief === 'object') ? issue.brief : {};
    const url = `${SITE}/issue/${date}`;
    const headline = esc(stripDashes(typeof b.headline === 'string' && b.headline ? b.headline : `Great Lakes Gazette: ${date}`));
    const briefStr = typeof b.brief === 'string' ? b.brief : (typeof b.dateline === 'string' ? b.dateline : '');
    const excerpt = esc(stripDashes(briefStr).slice(0, 400));
    const fullHtml = paragraphs(briefStr) +
      (b.spotlight && b.spotlight !== 'none' ? `<p><em>Vessel Spotlight: ${esc(stripDashes(b.spotlight))}</em></p>` : '') +
      `<p><a href="${url}">Read this edition on the Great Lakes Gazette</a></p>`;
    const pub = new Date(date + 'T12:00:00Z').toUTCString();
    return `    <item>
      <title>${headline}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <dc:creator>${AUTHOR}</dc:creator>
      <description>${excerpt}</description>
      <content:encoded>${cdata(fullHtml)}</content:encoded>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Great Lakes Gazette</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Daily Great Lakes freighter and vessel-movement brief: bulk carriers, tankers, and tug-barge traffic across all five lakes, written from Bay City by ${AUTHOR}.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}

export default async function handler(req, res) {
  const r = makeRedis();
  if (req.query && req.query.format === 'rss') {
    return renderRss(res, r);
  }

  const today = new Date().toISOString().slice(0, 10);
  let dates = [];
  let recentIssues = new Map();
  try {
    dates = await getDates(r);
    recentIssues = await getIssues(r, dates.slice(0, 2));
  } catch (e) { console.warn('[sitemap]', e.message); }

  const latestDate = dates[0] || today;

  const issueUrls = dates.map(date => `
  <url>
    <loc>${SITE}/issue/${date}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
    ${renderNewsMetadata(date, recentIssues.get(date), today)}
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>${SITE}</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE}/chris-izworski</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE}/archive</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>${issueUrls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(xml);
}
