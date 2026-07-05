// GET /issue/:date (rewritten to this): server-rendered HTML for each daily
// edition. Pulls the brief from Redis, renders it on the shared broadsheet
// chrome, and links true previous/next editions from the permanent date
// index. The brief body is escaped and split into real paragraphs; the old
// renderer injected it raw and unsplit, which flattened every edition into
// a single block.

import { makeRedis, getDates, getIssue, getIssues } from '../../lib/store.js';
import {
  SITE, AUTHOR, AUTHOR_URL, esc, stripDashes, paragraphs, longDate, shortDate,
  articleBodyHtml, DEPT_CSS,
  headCommon, css, headerInterior, footerHtml,
} from '../../lib/layout.js';

const PAGE_CSS = `
.also-by{margin-top:32px;padding-top:24px;border-top:1px solid var(--ink-4)}
.also-by-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--lake);margin-bottom:14px}
.also-by-list{list-style:none;padding:0;display:grid;gap:12px}
.also-by-list li{padding:10px 0;border-bottom:1px solid var(--ink-4)}
.also-by-list a{font-family:'IM Fell English',Georgia,serif;font-size:17px;color:var(--ink);font-weight:700}
.also-by-desc{font-size:14px;color:var(--ink-3);font-style:italic;margin-top:3px}
.related-issues{margin-top:36px;padding-top:24px;border-top:1px solid var(--ink-4)}
`;

export function buildIssuePage(date, issue, nav) {
  const dateLong  = longDate(date);
  const dateShort = shortDate(date);

  const briefObj  = issue.brief || {};
  const briefBody = (Array.isArray(briefObj.sections) && briefObj.sections.length)
    ? articleBodyHtml(briefObj)
    : paragraphs(briefObj.brief || briefObj.html || issue.html || '');
  const headline  = stripDashes((briefObj.headline || issue.headline || `Daily Maritime Brief for ${dateShort}`).trim());
  const summary   = stripDashes((briefObj.brief || briefObj.summary || issue.summary || `The Great Lakes Gazette daily maritime brief by ${AUTHOR} for ${dateLong}.`))
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .slice(0, 200)
                      .trim();
  const spotlight = briefObj.spotlight && briefObj.spotlight !== 'none' ? stripDashes(briefObj.spotlight) : null;
  const { prevDate, nextDate, related } = nav || {};

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'NewsArticle',
      headline,
      description: summary,
      datePublished: date + 'T12:00:00Z',
      dateModified: date + 'T12:00:00Z',
      author: {
        '@type': 'Person',
        name: AUTHOR,
        url: AUTHOR_URL,
        sameAs: [
          AUTHOR_URL,
          'https://trout.chrisizworski.com',
          'https://troutdaily.chrisizworski.com',
          'https://freighterviewfarms.com',
          'https://www.wikidata.org/wiki/Q138283432',
        ]
      },
      publisher: {
        '@type': 'Organization',
        name: 'Great Lakes Gazette',
        url: SITE,
        founder: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
        logo: { '@type': 'ImageObject', url: `${SITE}/og-image.png` }
      },
      image: `${SITE}/og-image.png`,
      mainEntityOfPage: `${SITE}/issue/${date}`,
      articleSection: 'Maritime News',
      keywords: 'Great Lakes shipping, vessel movements, Soo Locks, AIS tracking, NOAA water levels, Lake Superior, Lake Michigan, Lake Huron, Lake Erie, Lake Ontario, freighters, Chris Izworski',
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: AUTHOR, item: AUTHOR_URL },
        { '@type': 'ListItem', position: 2, name: 'Great Lakes Gazette', item: SITE },
        { '@type': 'ListItem', position: 3, name: dateLong, item: `${SITE}/issue/${date}` },
      ]
    }]
  });

  return `<!DOCTYPE html>
<html lang="en"><head>
${headCommon()}
<title>${esc(headline)} | Great Lakes Gazette, ${esc(dateShort)}</title>
<meta name="description" content="${esc(summary)}">
<meta name="author" content="${AUTHOR}">
<meta name="keywords" content="Great Lakes shipping, vessel movements, Soo Locks, AIS tracking, NOAA water levels, ${esc(dateShort)}, Chris Izworski">
<link rel="canonical" href="${SITE}/issue/${date}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(headline)} | Great Lakes Gazette">
<meta property="og:description" content="${esc(summary)}">
<meta property="og:url" content="${SITE}/issue/${date}">
<meta property="og:site_name" content="Great Lakes Gazette">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:author" content="${AUTHOR_URL}">
<meta property="article:published_time" content="${date}T12:00:00Z">
<meta property="article:section" content="Maritime News">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@izworskic">
<meta name="twitter:creator" content="@izworskic">
<meta name="twitter:title" content="${esc(headline)} | Great Lakes Gazette">
<meta name="twitter:description" content="${esc(summary)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<script type="application/ld+json">${schema}</script>
<style>${css()}${DEPT_CSS}${PAGE_CSS}</style>
</head><body>
${headerInterior('')}
<div class="wrap-narrow">
  <div class="breadcrumb"><a href="${AUTHOR_URL}">${AUTHOR}</a> &rsaquo; <a href="/">Great Lakes Gazette</a> &rsaquo; ${esc(dateLong)}</div>
  <div class="kicker">Vol. I &nbsp;&middot;&nbsp; ${esc(dateLong)}</div>
  <h1 class="headline">${esc(headline)}</h1>
  <div class="byline">By <a href="/chris-izworski">${AUTHOR}</a> &nbsp;&middot;&nbsp; Founder, Great Lakes Gazette &nbsp;&middot;&nbsp; ${esc(dateShort)}</div>
  ${briefObj.deck ? `<div class="deck">${esc(stripDashes(briefObj.deck))}</div>` : ''}
  <div class="brief dropcap">${briefBody}</div>

  ${spotlight ? `<div class="spotlight">
    <div class="spotlight-label">Vessel Spotlight</div>
    <div class="spotlight-text">${esc(spotlight)}</div>
  </div>` : ''}

  <nav class="pn">
    ${prevDate ? `<a href="/issue/${prevDate}" rel="prev">&larr; Previous edition, ${esc(shortDate(prevDate))}</a>` : '<span></span>'}
    <span class="pn-spacer"></span>
    ${nextDate ? `<a href="/issue/${nextDate}" rel="next">Next edition, ${esc(shortDate(nextDate))} &rarr;</a>` : `<a href="/">Today's edition &rarr;</a>`}
  </nav>

  ${related && related.length ? `<div class="related-issues">
    <div class="section-label">Recent Editions by ${AUTHOR}</div>
    ${related.map(n => `<div class="r-item"><span class="r-date">${esc(longDate(n.date))}</span><a class="r-head" href="/issue/${n.date}">${esc(n.headline || 'Daily Maritime Brief')}</a></div>`).join('\n    ')}
  </div>` : ''}

  <div class="author-bio">
    <div class="author-bio-label">About the Author</div>
    <div class="author-bio-text"><a href="${AUTHOR_URL}">${AUTHOR}</a> is a Bay City, Michigan writer and the founder of the <a href="${SITE}">Great Lakes Gazette</a>, a daily maritime news publication. He also publishes <a href="https://troutdaily.chrisizworski.com">Michigan Trout Daily</a> and operates the <a href="https://trout.chrisizworski.com">Michigan Trout Report</a>.</div>
  </div>

  <div class="also-by">
    <div class="also-by-label">Also by ${AUTHOR}</div>
    <ul class="also-by-list">
      <li><a href="https://troutdaily.chrisizworski.com" target="_blank" rel="noopener">Michigan Trout Daily</a><div class="also-by-desc">One Michigan trout stream conditions report every morning.</div></li>
      <li><a href="https://trout.chrisizworski.com" target="_blank" rel="noopener">Michigan Trout Report</a><div class="also-by-desc">Live conditions tracker for 110+ Michigan rivers.</div></li>
      <li><a href="https://freighterviewfarms.com" target="_blank" rel="noopener">Freighter View Farms</a><div class="also-by-desc">Seed-saving and Great Lakes-themed gardening blog.</div></li>
    </ul>
  </div>
</div>
${footerHtml()}
</body></html>`;
}

function notFoundPage(date) {
  return `<!DOCTYPE html>
<html lang="en"><head>
${headCommon()}
<title>No edition for ${esc(date)} | Great Lakes Gazette</title>
<meta name="robots" content="noindex">
<style>${css()}</style>
</head><body>
${headerInterior('')}
<div class="wrap-narrow" style="padding-top:40px">
  <h1 class="headline">No edition for ${esc(date)}</h1>
  <div class="brief"><p>The Gazette has no edition stored for that date. Editions from May 20 through July 1, 2026 were lost before the archive became permanent. Everything else is in the <a href="/archive">archive</a>, and <a href="/">today's edition</a> is on the front page.</p></div>
</div>
${footerHtml()}
</body></html>`;
}

export default async function handler(req, res) {
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).send('<h1>Invalid date format</h1><p>Use YYYY-MM-DD.</p>');
  }

  const r = makeRedis();
  if (!r) return res.status(503).send('<h1>Storage unavailable</h1>');

  try {
    const issue = await getIssue(r, date);
    if (!issue) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).send(notFoundPage(date));
    }

    // True neighbors from the permanent index, plus the four nearest
    // other editions for the related list.
    let nav = { prevDate: null, nextDate: null, related: [] };
    try {
      const dates = await getDates(r); // newest first
      const idx = dates.indexOf(date);
      if (idx !== -1) {
        nav.nextDate = idx > 0 ? dates[idx - 1] : null;
        nav.prevDate = idx < dates.length - 1 ? dates[idx + 1] : null;
        const nearest = dates
          .filter(d => d !== date)
          .sort((a, b) => Math.abs(new Date(a) - new Date(date)) - Math.abs(new Date(b) - new Date(date)))
          .slice(0, 4)
          .sort((a, b) => b.localeCompare(a));
        const m = await getIssues(r, nearest);
        nav.related = nearest.map(d => {
          const it = m.get(d);
          return { date: d, headline: it && it.brief ? stripDashes(it.brief.headline || '') : '' };
        });
      }
    } catch (e) { console.warn('[issue-page] nav failed:', e.message); }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).send(buildIssuePage(date, issue, nav));
  } catch (e) {
    console.error('[issue-page]', e.message);
    return res.status(500).send('<h1>Error rendering issue</h1>');
  }
}
