// GET /archive: the complete permanent archive, grouped by month, on the
// shared broadsheet chrome. Enumerates from the gazette:index set, so every
// edition ever stored appears, forever.

import { makeRedis, getDates, getIssues } from '../store.js';
import {
  SITE, AUTHOR, AUTHOR_URL, esc, stripDashes, longDate,
  headCommon, css, headerInterior, footerHtml,
} from '../layout.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function renderArchive(items) {
  const intro = `The complete archive of the Great Lakes Gazette, the daily maritime brief written by ${AUTHOR} in Bay City, Michigan. Every edition covers vessel traffic, water levels, weather, and shipping news across the Great Lakes and the St. Lawrence Seaway. All ${items.length} editions are below, newest first.`;

  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${SITE}/archive#webpage`, url: `${SITE}/archive`,
        name: 'Great Lakes Gazette Archive',
        isPartOf: { '@type': 'WebSite', name: 'Great Lakes Gazette', url: SITE },
        about: { '@type': 'Person', name: AUTHOR }, description: intro.slice(0, 155),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE}/issue/${it.date}`,
            name: it.headline || 'Daily Maritime Brief',
          })),
        } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Archive', item: `${SITE}/archive` } ] },
      { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL,
        sameAs: [AUTHOR_URL, 'https://github.com/izworskic'] }
    ]
  });

  let rows = '';
  let currentMonth = '';
  for (const it of items) {
    const [y, m] = it.date.split('-');
    const label = `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
    if (label !== currentMonth) {
      currentMonth = label;
      rows += `\n  <h2 class="archive-month">${label}</h2>`;
    }
    rows += `\n  <div class="r-item"><span class="r-date">${esc(longDate(it.date))}</span><a class="r-head" href="/issue/${it.date}">${esc(it.headline || 'Daily Maritime Brief')}</a></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head>
${headCommon()}
<title>Great Lakes Gazette Archive: Every Daily Edition by ${AUTHOR}</title>
<meta name="description" content="The full archive of the Great Lakes Gazette daily maritime brief by Chris Izworski. Vessel traffic, water levels, and shipping news across the Great Lakes.">
<link rel="canonical" href="${SITE}/archive">
<meta property="og:type" content="website">
<meta property="og:title" content="Great Lakes Gazette Archive">
<meta property="og:description" content="Every daily edition of the Great Lakes Gazette by Chris Izworski.">
<meta property="og:url" content="${SITE}/archive">
<meta property="og:site_name" content="Great Lakes Gazette">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${ld}</script>
<style>${css()}</style>
</head><body>
${headerInterior('/archive')}
<div class="wrap-narrow">
  <div class="breadcrumb"><a href="/">Great Lakes Gazette</a> &rsaquo; Archive</div>
  <h1 class="headline">The Gazette Archive</h1>
  <p class="intro">${intro.replace(AUTHOR, `<a href="/chris-izworski">${AUTHOR}</a>`)}</p>
  ${rows}
</div>
${footerHtml()}
</body></html>`;
}

export default async function handler(req, res) {
  const r = makeRedis();
  let items = [];
  try {
    const dates = await getDates(r);
    const m = await getIssues(r, dates);
    items = dates.map(d => {
      const it = m.get(d);
      return { date: d, headline: it && it.brief ? stripDashes(String(it.brief.headline || '').trim()) : '' };
    });
  } catch (e) { console.error('[archive]', e.message); }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).send(renderArchive(items));
}
