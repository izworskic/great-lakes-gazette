// GET /issue/:date (rewritten to this) — server-rendered HTML for each daily issue
// Pulls brief from Redis and returns full SEO-optimized HTML.

import { Redis } from '@upstash/redis';

const SITE       = 'https://great-lakes-gazette.vercel.app';
const AUTHOR     = 'Chris Izworski';
const AUTHOR_URL = 'https://chrisizworski.com';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function buildIssuePage(date, issue, neighbors) {
  const dateObj   = new Date(date + 'T12:00:00Z');
  const dateLong  = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dateShort = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // The brief object lives at issue.brief and contains the actual rendered text + metadata
  const briefObj  = issue.brief || {};
  const briefHtml = (briefObj.brief || briefObj.html || issue.html || '').toString();
  const headline  = (briefObj.headline || issue.headline || `Daily Maritime Brief for ${dateShort}`).trim();
  const summary   = (briefObj.brief || briefObj.summary || issue.summary || `${AUTHOR}'s Great Lakes Gazette daily maritime brief for ${dateLong}.`)
                      .replace(/<[^>]+>/g, '')
                      .replace(/\s+/g, ' ')
                      .slice(0, 200)
                      .trim();
  const spotlight = briefObj.spotlight && briefObj.spotlight !== 'none' ? briefObj.spotlight : null;

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
<meta charset="UTF-8">
<link rel="me" href="https://chrisizworski.com">
<link rel="me" href="https://troutdaily.chrisizworski.com">
<link rel="me" href="https://trout.chrisizworski.com">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(AUTHOR)}: ${escapeHtml(headline)} — Great Lakes Gazette ${escapeHtml(dateShort)}</title>
<meta name="description" content="${escapeHtml(summary)}">
<meta name="author" content="${escapeHtml(AUTHOR)}">
<meta name="keywords" content="Great Lakes shipping, vessel movements, Soo Locks, AIS tracking, NOAA water levels, ${escapeHtml(dateShort)}, Chris Izworski">
<link rel="canonical" href="${SITE}/issue/${date}">
<link rel="author" href="${AUTHOR_URL}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(AUTHOR)}: ${escapeHtml(headline)}">
<meta property="og:description" content="${escapeHtml(summary)}">
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
<meta name="twitter:title" content="${escapeHtml(AUTHOR)}: ${escapeHtml(headline)}">
<meta name="twitter:description" content="${escapeHtml(summary)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚓</text></svg>">
<script type="application/ld+json">${schema}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Josefin+Sans:wght@300;400;600&display=swap" rel="stylesheet">
<style>
:root{--paper:#f0e8d5;--ink:#110c02;--ink-2:#3d3020;--ink-3:#6b5a42;--ink-4:#9a876c;--lake:#1b3a56;--gold:#8a6500;--rust:#782000}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Source Serif 4',Georgia,serif;background:var(--paper);color:var(--ink);line-height:1.65;font-size:17px}
a{color:var(--lake);text-decoration:none}a:hover{text-decoration:underline}
.site-header{border-bottom:3px double var(--ink);padding:18px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.site-brand{font-family:'IM Fell English',Georgia,serif;font-size:28px;font-weight:700;color:var(--ink)}
.site-nav{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;display:flex;gap:24px}
.site-nav a{color:var(--ink-3)}
.wrap{max-width:780px;margin:0 auto;padding:0 24px 80px}
.breadcrumb{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.12em;color:var(--ink-3);text-transform:uppercase;padding:20px 0}
.breadcrumb a{color:var(--ink-3)}
.dateline{font-family:'Josefin Sans',sans-serif;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;color:var(--lake);margin:14px 0 22px}
h1{font-family:'IM Fell English',Georgia,serif;font-size:clamp(32px,5.5vw,52px);font-weight:700;line-height:1.05;color:var(--ink);margin-bottom:14px}
.lede{font-style:italic;color:var(--ink-2);font-size:19px;margin-bottom:30px;padding-bottom:24px;border-bottom:1px solid var(--ink-4)}
.byline{font-family:'Josefin Sans',sans-serif;font-size:12px;letter-spacing:.08em;color:var(--ink-3);margin-bottom:24px}
.byline a{color:var(--lake);font-weight:600}
.brief{font-size:17px;line-height:1.78;color:var(--ink-2)}
.brief h2{font-family:'IM Fell English',Georgia,serif;font-size:24px;color:var(--ink);margin:32px 0 14px;border-bottom:1px solid var(--ink-4);padding-bottom:6px}
.brief h3{font-family:'IM Fell English',Georgia,serif;font-size:19px;color:var(--ink);margin:24px 0 10px}
.brief p{margin-bottom:18px}
.brief ul,.brief ol{margin:18px 0 18px 28px}
.brief li{margin-bottom:8px}
.brief a{color:var(--lake);text-decoration:underline}
.author-bio{background:rgba(27,58,86,.06);padding:22px;margin-top:40px;border-left:4px solid var(--lake)}
.author-bio-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--lake);margin-bottom:10px}
.author-bio-text{font-size:15px;color:var(--ink-2);line-height:1.7}
.author-bio-text a{color:var(--lake);font-weight:600}
.also-by{margin-top:32px;padding-top:24px;border-top:1px solid var(--ink-4)}
.also-by-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--lake);margin-bottom:14px}
.also-by-list{list-style:none;padding:0;display:grid;gap:12px}
.also-by-list li{padding:10px 0;border-bottom:1px solid var(--ink-4)}
.also-by-list a{font-family:'IM Fell English',Georgia,serif;font-size:17px;color:var(--ink);font-weight:700}
.also-by-desc{font-size:14px;color:var(--ink-3);font-style:italic;margin-top:3px}
.spotlight{background:rgba(122,32,0,.06);padding:22px;margin:34px 0;border-left:4px solid var(--rust)}
.spotlight-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--rust);margin-bottom:10px}
.spotlight-text{font-style:italic;color:var(--ink-2);font-size:16px;line-height:1.7}
.related-issues{margin-top:36px;padding-top:24px;border-top:1px solid var(--ink-4)}
.related-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--lake);margin-bottom:14px}
.related-list{list-style:none;padding:0;display:grid;gap:14px}
.related-list li{padding:10px 0;border-bottom:1px solid var(--ink-4)}
.related-list a{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.12em;color:var(--lake);text-transform:uppercase}
.related-headline{font-family:'IM Fell English',Georgia,serif;font-size:16px;color:var(--ink);margin-top:4px;line-height:1.3}
.footer{border-top:3px double var(--ink);padding:24px;text-align:center;font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.08em;color:var(--ink-3);margin-top:60px}
.footer a{color:var(--lake)}
</style></head><body>
<header class="site-header">
  <a href="/" class="site-brand">Great Lakes Gazette</a>
  <nav class="site-nav"><a href="/">Today</a><a href="/issue/">Archive</a><a href="${AUTHOR_URL}" target="_blank">${escapeHtml(AUTHOR)}</a></nav>
</header>
<div class="wrap">
  <div class="breadcrumb"><a href="${AUTHOR_URL}">${escapeHtml(AUTHOR)}</a> &rsaquo; <a href="/">Great Lakes Gazette</a> &rsaquo; ${escapeHtml(dateLong)}</div>
  <div class="dateline">Vol. I &nbsp;·&nbsp; ${escapeHtml(dateLong)}</div>
  <h1>${escapeHtml(headline)}</h1>
  <p class="lede">${escapeHtml(summary)}</p>
  <div class="byline">By <a href="${AUTHOR_URL}">${escapeHtml(AUTHOR)}</a> &nbsp;&middot;&nbsp; Founder, Great Lakes Gazette &nbsp;&middot;&nbsp; ${escapeHtml(dateShort)}</div>
  <div class="brief">${briefHtml}</div>

  ${spotlight ? `<div class="spotlight">
    <div class="spotlight-label">Vessel Spotlight</div>
    <div class="spotlight-text">${escapeHtml(spotlight)}</div>
  </div>` : ''}

  ${neighbors && neighbors.length > 0 ? `<div class="related-issues">
    <div class="related-label">Recent Issues by ${escapeHtml(AUTHOR)}</div>
    <ul class="related-list">
      ${neighbors.map(n => `<li><a href="/issue/${n.date}">${n.label}</a><div class="related-headline">${escapeHtml(n.headline || 'Daily Maritime Brief')}</div></li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="author-bio">
    <div class="author-bio-label">About the Author</div>
    <div class="author-bio-text"><a href="${AUTHOR_URL}">${escapeHtml(AUTHOR)}</a> is a Bay City, Michigan writer and the founder of the <a href="${SITE}">Great Lakes Gazette</a>, a daily maritime news publication. He also publishes <a href="https://troutdaily.chrisizworski.com">Michigan Trout Daily</a> and operates the <a href="https://trout.chrisizworski.com">Michigan Trout Report</a>.</div>
  </div>

  <div class="also-by">
    <div class="also-by-label">Also by ${escapeHtml(AUTHOR)}</div>
    <ul class="also-by-list">
      <li><a href="https://troutdaily.chrisizworski.com" target="_blank">Michigan Trout Daily</a><div class="also-by-desc">One Michigan trout stream conditions report every morning.</div></li>
      <li><a href="https://trout.chrisizworski.com" target="_blank">Michigan Trout Report</a><div class="also-by-desc">Live conditions tracker for 110+ Michigan rivers.</div></li>
      <li><a href="https://freighterviewfarms.com" target="_blank">Freighter View Farms</a><div class="also-by-desc">Seed-saving and Great Lakes-themed gardening blog.</div></li>
    </ul>
  </div>
</div>
<footer class="footer">
  Great Lakes Gazette &nbsp;·&nbsp; By <a href="${AUTHOR_URL}">${escapeHtml(AUTHOR)}</a> &nbsp;·&nbsp; <a href="/">Today's Issue</a>
</footer>
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
    const cached = await r.get(`gazette:daily:${date}`);
    if (!cached) {
      return res.status(404).send(`<h1>No issue for ${date}</h1><p><a href="/">Return to today's Gazette &rarr;</a></p>`);
    }

    const issue = typeof cached === 'string' ? JSON.parse(cached) : cached;

    // Fetch the last 60 candidate dates and pick 4 nearest neighbors that exist
    const now = new Date();
    const candidates = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      if (ds !== date) candidates.push(ds);
    }
    let neighbors = [];
    try {
      const keys     = candidates.map(d => `gazette:daily:${d}`);
      const results  = await r.mget(...keys);
      const existing = candidates.filter((_, i) => results[i] !== null);
      neighbors      = existing.slice(0, 4).map((nd, idx) => {
        const raw      = typeof results[candidates.indexOf(nd)] === 'string'
                         ? JSON.parse(results[candidates.indexOf(nd)])
                         : results[candidates.indexOf(nd)];
        const headline = raw?.brief?.headline || null;
        const dateObj  = new Date(nd + 'T12:00:00Z');
        return {
          date: nd,
          label: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          headline,
        };
      });
    } catch(e) { /* non-fatal */ }

    const html = buildIssuePage(date, issue, neighbors);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return res.send(html);
  } catch(e) {
    console.error(`[issue-page/${date}]`, e.message);
    return res.status(500).send(`<h1>Error</h1><p>${escapeHtml(e.message)}</p>`);
  }
}
