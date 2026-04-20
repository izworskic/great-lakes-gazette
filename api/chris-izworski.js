// GET /chris-izworski (rewritten via vercel.json) — Author archive listing all Gazette issues
// Server-rendered, refreshes from Redis every request.

import { Redis } from '@upstash/redis';

const SITE       = 'https://gazette.chrisizworski.com';
const AUTHOR     = 'Chris Izworski';
const AUTHOR_URL = 'https://chrisizworski.com';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildPage(issues) {
  const items = issues.map(({date, headline}) => {
    const dateObj  = new Date(date + 'T12:00:00Z');
    const dateLong = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const dateShort = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `<li class="issue-row">
      <div class="issue-date">${dateLong}</div>
      <h2 class="issue-title"><a href="/issue/${date}">${escapeHtml(AUTHOR)}: ${escapeHtml(headline || 'Daily Maritime Brief')}</a></h2>
    </li>`;
  }).join('\n');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          '@id': 'https://chrisizworski.com/#person',
          name: AUTHOR,
          url: AUTHOR_URL,
          sameAs: [
            AUTHOR_URL,
            'https://trout.chrisizworski.com',
            'https://troutdaily.chrisizworski.com',
            SITE,
            'https://freighterviewfarms.com',
            'https://www.wikidata.org/wiki/Q138283432',
          ],
        },
      },
      {
        '@type': 'CollectionPage',
        url: `${SITE}/chris-izworski`,
        name: `${AUTHOR} — Daily Great Lakes Maritime News Archive`,
        description: `Complete archive of daily Great Lakes Gazette issues by ${AUTHOR}. ${issues.length} daily maritime briefs.`,
        author: { '@id': 'https://chrisizworski.com/#person' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: issues.length,
          itemListElement: issues.map((iss, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE}/issue/${iss.date}`,
            name: `${AUTHOR}: ${iss.headline || 'Daily Maritime Brief'}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: AUTHOR, item: AUTHOR_URL },
          { '@type': 'ListItem', position: 2, name: 'Great Lakes Gazette', item: SITE },
          { '@type': 'ListItem', position: 3, name: 'Daily Issues Archive', item: `${SITE}/chris-izworski` },
        ],
      },
    ],
  });

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(AUTHOR)} — Daily Great Lakes Maritime News Archive | Great Lakes Gazette</title>
<meta name="description" content="Complete archive of daily Great Lakes Gazette issues by ${escapeHtml(AUTHOR)}. ${issues.length} daily maritime briefs covering vessel movements, port reports, water levels, and Great Lakes shipping.">
<meta name="author" content="${escapeHtml(AUTHOR)}">
<meta name="keywords" content="Chris Izworski, Great Lakes Gazette, Great Lakes shipping news, daily maritime brief, Great Lakes Bay Region, Bay City Michigan">
<link rel="canonical" href="${SITE}/chris-izworski">
<link rel="author" href="${AUTHOR_URL}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(AUTHOR)} — Great Lakes Gazette Archive">
<meta property="og:description" content="${issues.length} daily maritime briefs by ${escapeHtml(AUTHOR)}.">
<meta property="og:url" content="${SITE}/chris-izworski">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
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
.wrap{max-width:780px;margin:0 auto;padding:24px 24px 80px}
.breadcrumb{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.12em;color:var(--ink-3);text-transform:uppercase;padding:16px 0}
h1{font-family:'IM Fell English',Georgia,serif;font-size:42px;font-weight:700;color:var(--ink);margin-bottom:14px;line-height:1.1}
.lede{font-style:italic;color:var(--ink-2);font-size:18px;margin-bottom:22px}
.author-intro{font-size:15px;color:var(--ink-2);line-height:1.7;padding-bottom:24px;border-bottom:2px solid var(--ink);margin-bottom:30px}
.author-intro a{color:var(--lake);font-weight:600}
ul{list-style:none;padding:0}
.issue-row{padding:18px 0;border-bottom:1px solid var(--ink-4)}
.issue-date{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}
.issue-title{font-family:'IM Fell English',Georgia,serif;font-size:20px;font-weight:700;line-height:1.3}
.issue-title a{color:var(--ink)}
.issue-title a:hover{color:var(--lake);text-decoration:none}
.footer{border-top:3px double var(--ink);padding:24px;text-align:center;font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.08em;color:var(--ink-3);margin-top:60px}
.footer a{color:var(--lake)}
</style></head><body>
<header class="site-header">
  <a href="/" class="site-brand">Great Lakes Gazette</a>
  <nav class="site-nav"><a href="/">Today</a><a href="/chris-izworski">Archive</a><a href="${AUTHOR_URL}" target="_blank">${escapeHtml(AUTHOR)}</a></nav>
</header>
<div class="wrap">
  <div class="breadcrumb"><a href="${AUTHOR_URL}">${escapeHtml(AUTHOR)}</a> &rsaquo; <a href="/">Great Lakes Gazette</a> &rsaquo; Archive</div>
  <h1>${escapeHtml(AUTHOR)}</h1>
  <p class="lede">Daily Great Lakes Gazette archive — ${issues.length} daily maritime briefs.</p>
  <div class="author-intro">
    <a href="${AUTHOR_URL}">${escapeHtml(AUTHOR)}</a> is a Bay City, Michigan writer and the founder of the <a href="${SITE}">Great Lakes Gazette</a>. Each daily issue is published every morning from real data: vessel movements, port reports, NOAA water levels, and NWS marine forecasts. This page is the complete archive.
  </div>
  <ul>${items}</ul>
</div>
<footer class="footer">
  Great Lakes Gazette &nbsp;·&nbsp; By <a href="${AUTHOR_URL}">${escapeHtml(AUTHOR)}</a> &nbsp;·&nbsp; <a href="/">Today's Issue</a>
</footer>
</body></html>`;
}

export default async function handler(req, res) {
  const r = makeRedis();
  if (!r) return res.status(503).send('<h1>Storage unavailable</h1>');

  try {
    // Probe last 90 days with mget
    const candidates = [];
    const now = new Date();
    for (let i = 0; i < 90; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      candidates.push(d.toISOString().slice(0, 10));
    }
    const keys    = candidates.map(d => `gazette:daily:${d}`);
    const results = await r.mget(...keys);

    const issues = [];
    for (let i = 0; i < candidates.length; i++) {
      const raw = results[i];
      if (raw === null) continue;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      issues.push({ date: candidates[i], headline: parsed?.brief?.headline });
    }
    issues.sort((a, b) => b.date.localeCompare(a.date));

    const html = buildPage(issues);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    return res.send(html);
  } catch(e) {
    console.error('[chris-izworski archive]', e.message);
    return res.status(500).send(`<h1>Error</h1><p>${escapeHtml(e.message)}</p>`);
  }
}
