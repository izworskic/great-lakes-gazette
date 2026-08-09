import { makeRedis, getDates, getIssues } from '../store.js';
import { michiganDateKey } from '../dates.js';
import { SITE, AUTHOR, esc, stripDashes, articleBodyHtml } from '../layout.js';
import { renderNewsMetadata } from '../news-sitemap.js';
import { TOPICS, topicsForIssue, topicUrl, issueExcerpt } from '../topics.js';

function cdata(html) {
  return '<![CDATA[' + String(html).replace(/\]\]>/g, ']]&gt;') + ']]>';
}

function issueEntries(dates, issuesMap) {
  return dates
    .map(date => ({ date, issue: issuesMap.get(date) }))
    .filter(entry => entry.issue?.brief);
}

function fullEditionHtml(date, issue) {
  const brief = issue.brief || {};
  const url = `${SITE}/issue/${date}`;
  return articleBodyHtml(brief) +
    (brief.spotlight && brief.spotlight !== 'none'
      ? `<p><em>Vessel Spotlight: ${esc(stripDashes(brief.spotlight))}</em></p>`
      : '') +
    `<p><a href="${url}">Read this edition on the Great Lakes Gazette</a></p>`;
}

export function renderRssFeed(entries, buildDate = new Date()) {
  const items = entries.map(({ date, issue }) => {
    const brief = issue.brief || {};
    const url = `${SITE}/issue/${date}`;
    const headline = esc(stripDashes(brief.headline || `Great Lakes Gazette: ${date}`));
    const excerpt = esc(stripDashes(issueExcerpt(issue, 400)));
    const categories = topicsForIssue(issue)
      .map(topic => `\n      <category>${esc(topic.name)}</category>`)
      .join('');
    return `    <item>
      <title>${headline}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(`${date}T12:00:00Z`).toUTCString()}</pubDate>
      <dc:creator>${AUTHOR}</dc:creator>${categories}
      <description>${excerpt}</description>
      <content:encoded>${cdata(fullEditionHtml(date, issue))}</content:encoded>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Great Lakes Gazette</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <atom:link href="${SITE}/feed.json" rel="alternate" type="application/feed+json" />
    <description>Daily Great Lakes freighter and vessel-movement brief: bulk carriers, tankers, and tug-barge traffic across all five lakes, written from Bay City by ${AUTHOR}.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

export function renderJsonFeed(entries) {
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Great Lakes Gazette',
    home_page_url: `${SITE}/`,
    feed_url: `${SITE}/feed.json`,
    description: 'Daily Great Lakes freighter, vessel movement, port, water level, and marine weather reports by Chris Izworski.',
    language: 'en-US',
    authors: [{ name: AUTHOR, url: 'https://chrisizworski.com' }],
    items: entries.map(({ date, issue }) => {
      const brief = issue.brief || {};
      const url = `${SITE}/issue/${date}`;
      return {
        id: url,
        url,
        title: stripDashes(brief.headline || `Great Lakes Gazette: ${date}`),
        summary: stripDashes(issueExcerpt(issue, 400)),
        content_html: fullEditionHtml(date, issue),
        date_published: `${date}T12:00:00Z`,
        authors: [{ name: AUTHOR, url: 'https://chrisizworski.com' }],
        tags: topicsForIssue(issue).map(topic => topic.name),
      };
    }),
  }, null, 2);
}

export function renderStandardSitemap({ dates, issuesMap, today = michiganDateKey() }) {
  const latestDate = dates[0] || today;
  const activeTopicSlugs = new Set();
  for (const issue of issuesMap.values()) {
    for (const topic of topicsForIssue(issue)) activeTopicSlugs.add(topic.slug);
  }
  const topicUrls = TOPICS
    .filter(topic => activeTopicSlugs.has(topic.slug))
    .map(topic => `
  <url>
    <loc>${SITE}${topicUrl(topic)}</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('');
  const issueUrls = dates.map(date => `
  <url>
    <loc>${SITE}/issue/${date}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
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
    <loc>${SITE}/topics</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>${topicUrls}
  <url>
    <loc>${SITE}/archive</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>${issueUrls}
</urlset>`;
}

export function renderGoogleNewsSitemap({ dates, issuesMap, today = michiganDateKey() }) {
  const issueUrls = dates.map(date => {
    const metadata = renderNewsMetadata(date, issuesMap.get(date), today);
    if (!metadata) return '';
    return `
  <url>
    <loc>${SITE}/issue/${date}</loc>${metadata}
  </url>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${issueUrls}
</urlset>`;
}

export default async function handler(req, res) {
  const format = req.query?.format || 'sitemap';
  const r = makeRedis();
  let dates = [];
  let issuesMap = new Map();
  try {
    dates = await getDates(r);
    const requestedDates = format === 'rss' || format === 'json' ? dates.slice(0, 30) : dates;
    issuesMap = await getIssues(r, requestedDates);
  } catch (error) {
    console.warn(`[${format}]`, error.message);
  }

  if (format === 'rss') {
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).send(renderRssFeed(issueEntries(dates.slice(0, 30), issuesMap)));
  }
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/feed+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).send(renderJsonFeed(issueEntries(dates.slice(0, 30), issuesMap)));
  }
  if (format === 'news') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
    return res.status(200).send(renderGoogleNewsSitemap({ dates, issuesMap }));
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
  return res.status(200).send(renderStandardSitemap({ dates, issuesMap }));
}
