// GET /chris-izworski (rewritten via vercel.json): the author archive page.
// The schema graph (ProfilePage + CollectionPage/ItemList + Breadcrumb) and
// the name-forward copy are preserved exactly from the previous version;
// what changed is the data source (the permanent gazette:index instead of a
// 90-day probe) and the chrome (the shared broadsheet layout).

import { makeRedis, getDates, getIssues } from '../store.js';
import {
  SITE, AUTHOR, AUTHOR_URL, esc, stripDashes, longDate,
  headCommon, css, headerInterior, footerHtml,
} from '../layout.js';

const PAGE_CSS = `
.lede{font-style:italic;color:var(--ink-2);font-size:18px;margin-bottom:22px}
.author-intro{font-size:15px;color:var(--ink-2);line-height:1.7;padding-bottom:24px;border-bottom:2px solid var(--ink);margin-bottom:30px}
.author-intro a{color:var(--lake);font-weight:600}
.issue-row{padding:18px 0;border-bottom:1px solid var(--ink-4)}
.issue-date{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}
.issue-title{font-family:'IM Fell English',Georgia,serif;font-size:20px;font-weight:700;line-height:1.3}
.issue-title a{color:var(--ink)}
.issue-title a:hover{color:var(--lake);text-decoration:none}
`;

export function buildPage(issues) {
  const items = issues.map(({ date, headline }) => {
    const dateLong = longDate(date);
    return `<li class="issue-row">
      <div class="issue-date">${esc(dateLong)}</div>
      <h2 class="issue-title"><a href="/issue/${date}">${AUTHOR}: ${esc(headline || 'Daily Maritime Brief')}</a></h2>
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
            'https://birding.chrisizworski.com',
            'https://birdingdaily.chrisizworski.com',
            SITE,
            'https://lawn.chrisizworski.com',
            'https://freighterviewfarms.com',
            'https://www.wikidata.org/wiki/Q138283432',
          ],
        },
      },
      {
        '@type': 'CollectionPage',
        url: `${SITE}/chris-izworski`,
        name: `${AUTHOR}: Daily Great Lakes Maritime News Archive`,
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
${headCommon()}
<title>${AUTHOR}: Daily Great Lakes Maritime News Archive | Great Lakes Gazette</title>
<meta name="description" content="Complete archive of daily Great Lakes Gazette issues by ${AUTHOR}. ${issues.length} daily maritime briefs covering vessel movements, port reports, water levels, and Great Lakes shipping.">
<meta name="author" content="${AUTHOR}">
<meta name="keywords" content="Chris Izworski, Great Lakes Gazette, Great Lakes shipping news, daily maritime brief, Great Lakes Bay Region, Bay City Michigan">
<link rel="canonical" href="${SITE}/chris-izworski">
<meta property="og:type" content="profile">
<meta property="og:title" content="${AUTHOR}: Great Lakes Gazette Archive">
<meta property="og:description" content="${issues.length} daily maritime briefs by ${AUTHOR}.">
<meta property="og:url" content="${SITE}/chris-izworski">
<meta property="og:site_name" content="Great Lakes Gazette">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${schema}</script>
<style>${css()}${PAGE_CSS}</style>
</head><body>
${headerInterior('/chris-izworski')}
<div class="wrap-narrow">
  <div class="breadcrumb"><a href="${AUTHOR_URL}">${AUTHOR}</a> &rsaquo; <a href="/">Great Lakes Gazette</a> &rsaquo; Archive</div>
  <h1 class="headline">${AUTHOR}</h1>
  <p class="lede">Daily Great Lakes Gazette archive of ${issues.length} daily maritime briefs.</p>
  <div class="author-intro">
    <a href="${AUTHOR_URL}">${AUTHOR}</a> is a Bay City, Michigan writer and the founder of the <a href="${SITE}">Great Lakes Gazette</a>. Each daily issue is published every morning from real data: vessel movements, port reports, NOAA water levels, and NWS marine forecasts. This page is the complete archive.
  </div>
  <ul>${items}</ul>
</div>
${footerHtml()}
</body></html>`;
}

export default async function handler(req, res) {
  const r = makeRedis();
  if (!r) return res.status(503).send('<h1>Storage unavailable</h1>');

  try {
    const dates = await getDates(r);
    const m = await getIssues(r, dates);
    const issues = dates.map(d => {
      const it = m.get(d);
      return { date: d, headline: it && it.brief ? stripDashes(String(it.brief.headline || '').trim()) : '' };
    });

    const html = buildPage(issues);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    return res.send(html);
  } catch (e) {
    console.error('[chris-izworski archive]', e.message);
    return res.status(500).send(`<h1>Error</h1><p>${esc(e.message)}</p>`);
  }
}
