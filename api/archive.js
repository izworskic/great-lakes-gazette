// GET /archive (rewritten to this): server-rendered index of every Gazette issue.
// Emits real <a href="/issue/{date}"> links so crawlers get a path to all issues,
// fixing the orphaned issue pages (homepage list was client-rendered only).

import { Redis } from '@upstash/redis';

const SITE   = 'https://gazette.chrisizworski.com';
const AUTHOR = 'Chris Izworski';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function longDate(d) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default async function handler(req, res) {
  const r = makeRedis();
  let items = [];
  if (r) {
    try {
      const now = new Date();
      const candidates = [];
      for (let i = 0; i < 120; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        candidates.push(d.toISOString().slice(0, 10));
      }
      const keys    = candidates.map(d => `gazette:daily:${d}`);
      const results = await r.mget(...keys);
      items = candidates
        .map((date, i) => ({ date, raw: results[i] }))
        .filter(x => x.raw != null)
        .map(x => {
          let obj = x.raw;
          if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch (e) { obj = {}; } }
          const headline = (obj && (obj.headline || (obj.brief && obj.brief.headline))) || 'Daily Maritime Brief';
          return { date: x.date, headline: String(headline).trim() };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch (e) {}
  }

  const rows = items.map(it => `      <li class="issue">
        <a href="/issue/${it.date}">${escapeHtml(it.headline)}</a>
        <span class="issue-date">${escapeHtml(longDate(it.date))}</span>
      </li>`).join('\n');

  const intro = `The complete archive of the Great Lakes Gazette, the daily maritime brief written by ${AUTHOR} in Bay City, Michigan. Every issue covers vessel traffic, water levels, weather, and shipping news across the Great Lakes and the St. Lawrence Seaway. Browse all ${items.length} issues below.`;

  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${SITE}/archive#webpage`, url: `${SITE}/archive`,
        name: 'Great Lakes Gazette Archive',
        isPartOf: { '@type': 'WebSite', name: 'Great Lakes Gazette', url: SITE },
        about: { '@type': 'Person', name: AUTHOR }, description: intro.slice(0, 155) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Archive', item: `${SITE}/archive` } ] },
      { '@type': 'Person', name: AUTHOR, url: 'https://chrisizworski.com',
        sameAs: ['https://chrisizworski.com', 'https://github.com/izworskic'] }
    ]
  });

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Great Lakes Gazette Archive: Every Daily Issue by ${AUTHOR}</title>
<meta name="description" content="The full archive of the Great Lakes Gazette daily maritime brief by Chris Izworski. Vessel traffic, water levels, and shipping news across the Great Lakes.">
<link rel="canonical" href="${SITE}/archive">
<meta property="og:title" content="Great Lakes Gazette Archive">
<meta property="og:description" content="Every daily issue of the Great Lakes Gazette by Chris Izworski.">
<meta property="og:url" content="${SITE}/archive">
<script type="application/ld+json">${ld}</script>
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root{--ink:#1a1813;--paper:#f4efe4;--rule:#cabfa6;--accent:#5a3a1a}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:'Source Sans 3',Georgia,serif;line-height:1.5}
  .wrap{max-width:820px;margin:0 auto;padding:24px 18px 56px}
  .brand{font-family:'IM Fell English',Georgia,serif;font-size:14px;letter-spacing:.5px;text-transform:uppercase;color:var(--accent)}
  .brand a{color:inherit;text-decoration:none}
  h1{font-family:'IM Fell English',Georgia,serif;font-size:30px;margin:.2em 0 .3em;border-bottom:2px solid var(--ink);padding-bottom:.25em}
  .intro{font-size:15px;max-width:640px;margin-bottom:1.6em}
  .intro a{color:var(--accent);font-weight:600}
  ul{list-style:none;padding:0;margin:0}
  .issue{padding:11px 0;border-bottom:1px solid var(--rule)}
  .issue a{font-family:'IM Fell English',Georgia,serif;font-size:18px;color:var(--ink);text-decoration:none}
  .issue a:hover{color:var(--accent);text-decoration:underline}
  .issue-date{display:block;font-size:12.5px;color:#6b6253;margin-top:2px;text-transform:uppercase;letter-spacing:.04em}
  footer{margin-top:32px;font-size:13px;color:#6b6253}
  footer a{color:var(--accent)}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><a href="/">Great Lakes Gazette</a></div>
  <h1>Gazette Archive</h1>
  <p class="intro">${intro.replace(AUTHOR, `<a href="/chris-izworski">${AUTHOR}</a>`)}</p>
  <ul>
${rows}
  </ul>
  <footer>Edited by <a href="/chris-izworski">${AUTHOR}</a> in Bay City, Michigan. Return to the <a href="/">latest issue</a>.</footer>
</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  return res.status(200).send(html);
}
