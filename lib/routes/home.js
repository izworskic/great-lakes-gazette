// GET / (rewritten to /api/gateway?route=home): the server-rendered front
// page. The entire day's edition is in the HTML that leaves the server:
// headline, dateline, full brief, spotlight, marine forecast, water levels,
// history, wire headlines, recent editions. No client JavaScript at all,
// which means every word is crawlable and the page is as fast as static.
// Renders a graceful shell if Redis is unreachable; never throws a 500.

import { makeRedis, getDates, getIssues } from '../store.js';
import {
  SITE, AUTHOR, esc, stripDashes, paragraphs, longDate, shortDate,
  headCommon, css, mastheadHome, followBox, resourcesBox, aboutStrip, footerHtml,
} from '../layout.js';
import { HOME_GRAPH } from '../schema-home.js';

const TITLE = 'Great Lakes Gazette: Daily Maritime News by Chris Izworski';
const DESC  = 'Daily Great Lakes shipping news: live vessel movements, port reports, NOAA water levels, and NWS marine forecasts. Written and published every morning by Chris Izworski.';

function firstSentence(s, cap = 170) {
  const t = stripDashes(String(s || '')).trim();
  const i = t.indexOf('. ');
  const out = i > 20 ? t.slice(0, i + 1) : t;
  return out.length > cap ? out.slice(0, cap).replace(/\s+\S*$/, '') + '...' : out;
}

function marineWidget(items) {
  const rows = (items || []).filter(x => x && x.lake && x.synopsis).slice(0, 5);
  if (!rows.length) return '';
  return `<div class="widget">
  <div class="widget-label">On the Water</div>
  ${rows.map(x => `<div class="w-row"><b>${esc(x.lake)}</b><span class="w-sub">${esc(firstSentence(x.synopsis))}</span></div>`).join('\n  ')}
  <div class="w-note">NWS marine synopses, this morning</div>
</div>`;
}

function levelsWidget(items) {
  const rows = (items || []).filter(x => x && x.lake && x.status === 'ok' && typeof x.level_ft === 'number').slice(0, 5);
  if (!rows.length) return '';
  return `<div class="widget">
  <div class="widget-label">Water Levels</div>
  ${rows.map(x => `<div class="w-row"><b>${esc(x.lake)}</b><span class="w-sub">${x.level_ft.toFixed(2)} ft · ${esc(x.city)}</span></div>`).join('\n  ')}
  <div class="w-note">NOAA CO-OPS station readings</div>
</div>`;
}

function historyWidget(items) {
  const rows = (items || []).filter(x => x && (x.title || x.text)).slice(0, 2);
  if (!rows.length) return '';
  return `<div class="widget">
  <div class="widget-label">From the Log</div>
  ${rows.map(x => `<div class="w-row"><b>${esc(stripDashes(x.title || 'Maritime note'))}</b><span class="w-sub">${esc(firstSentence(x.text, 190))}</span></div>`).join('\n  ')}
</div>`;
}

function wireWidget(gln) {
  const rows = ((gln && gln.items) || []).filter(x => x && x.title && x.url).slice(0, 5);
  if (!rows.length) return '';
  return `<div class="widget">
  <div class="widget-label">Around the Lakes</div>
  ${rows.map(x => `<div class="w-row"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(stripDashes(x.title))}</a></div>`).join('\n  ')}
  <div class="w-note">Via Great Lakes Now</div>
</div>`;
}

function recentEditions(recent, total) {
  if (!recent.length) return '';
  return `<section class="recent">
  <div class="section-label">Recent Editions</div>
  ${recent.map(({ date, headline }) => `<div class="r-item"><span class="r-date">${esc(longDate(date))}</span><a class="r-head" href="/issue/${date}">${esc(headline || 'Daily Maritime Brief')}</a></div>`).join('\n  ')}
  <p style="margin-top:18px;font-family:'Josefin Sans',sans-serif;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase"><a href="/archive">Browse all ${total} editions in the archive</a></p>
</section>`;
}

// Pure renderer: testable without Redis or a request.
export function renderHome({ dates, issuesMap }) {
  const total   = dates.length;
  const today   = dates[0] || null;
  const issue   = today ? issuesMap.get(today) : null;
  const brief   = (issue && issue.brief) || null;
  const data    = (issue && issue.data) || {};
  const dateStr = today ? longDate(today) : longDate(new Date().toISOString().slice(0, 10));

  const graph = JSON.parse(JSON.stringify(HOME_GRAPH));
  for (const node of (graph['@graph'] || [])) {
    if (node['@type'] === 'WebPage' || node['@type'] === 'Dataset') {
      node.dateModified = today || new Date().toISOString().slice(0, 10);
    }
  }

  let article;
  if (brief) {
    const headline  = stripDashes(brief.headline || 'Daily Maritime Brief');
    const dateline  = stripDashes(brief.dateline || `Bay City, Mich., ${dateStr}`);
    const spotlight = brief.spotlight && brief.spotlight !== 'none' ? stripDashes(brief.spotlight) : null;
    const prev      = dates[1] || null;
    article = `<article>
  <div class="kicker">${esc(dateline)}</div>
  <h2 class="headline"><a href="/issue/${today}">${esc(headline)}</a></h2>
  <div class="byline">By <a href="/chris-izworski">${AUTHOR}</a> &nbsp;&middot;&nbsp; Founder, Great Lakes Gazette &nbsp;&middot;&nbsp; ${esc(shortDate(today))}</div>
  <div class="brief dropcap">
${paragraphs(brief.brief)}
  </div>
  ${spotlight ? `<div class="spotlight"><div class="spotlight-label">Vessel Spotlight</div><div class="spotlight-text">${esc(spotlight)}</div></div>` : ''}
  <div class="pn"><a href="/issue/${today}">Permanent link to this edition</a><span class="pn-spacer"></span>${prev ? `<a href="/issue/${prev}">Yesterday's edition</a>` : ''}</div>
</article>`;
  } else {
    article = `<article>
  <div class="kicker">Bay City, Mich.</div>
  <h2 class="headline">This morning's edition is being assembled</h2>
  <div class="brief"><p>The Gazette publishes a new brief every morning from live vessel tracking, port reports, and NOAA data. Today's edition will be on this page shortly. In the meantime, the full back catalog is in the <a href="/archive">archive</a>.</p></div>
</article>`;
  }

  const recent = dates.slice(1, 15).map(d => {
    const it = issuesMap.get(d);
    return { date: d, headline: it && it.brief ? stripDashes(it.brief.headline || '') : '' };
  });

  return `<!DOCTYPE html>
<html lang="en"><head>
${headCommon()}
<title>${TITLE}</title>
<meta name="description" content="${esc(DESC)}">
<meta name="author" content="${AUTHOR}">
<meta name="keywords" content="Great Lakes shipping, freighter tracking, vessel movements, Soo Locks, AIS tracking, Great Lakes news, maritime news, Lake Superior, Lake Michigan, Lake Huron, Lake Erie, Lake Ontario, Chris Izworski">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:url" content="${SITE}/">
<meta property="og:site_name" content="Great Lakes Gazette">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@izworskic">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${esc(DESC)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<script type="application/ld+json">${JSON.stringify(graph)}</script>
<style>${css()}</style>
</head><body>
${mastheadHome({ dateLong: dateStr, editionNo: total || 1 })}
<div class="wrap">
  <div class="front">
    ${article}
    <aside class="rail">
      ${followBox()}
      ${marineWidget(data.marineWeather)}
      ${levelsWidget(data.waterLevels)}
      ${historyWidget(data.todayInHistory)}
      ${wireWidget(data.greatLakesNow)}
      ${resourcesBox()}
    </aside>
  </div>
  ${recentEditions(recent, total)}
  ${aboutStrip()}
</div>
${footerHtml()}
</body></html>`;
}

export default async function handler(req, res) {
  let dates = [], issuesMap = new Map();
  try {
    const r = makeRedis();
    dates = await getDates(r);
    issuesMap = await getIssues(r, dates.slice(0, 15));
  } catch (e) {
    console.error('[home]', e.message);
  }
  const html = renderHome({ dates, issuesMap });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  return res.status(200).send(html);
}
