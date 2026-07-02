// The Gazette's shared broadsheet chrome. One design system for every
// server-rendered page: the antique-paper palette and type stack that the
// issue pages established (IM Fell English display, Source Serif 4 text,
// Josefin Sans labels), generalized into a masthead, interior header,
// widgets, and footer that home, issues, archive, and the author page all
// import. No em dashes anywhere; separators are middots and commas.

export const SITE       = 'https://gazette.chrisizworski.com';
export const AUTHOR     = 'Chris Izworski';
export const AUTHOR_URL = 'https://chrisizworski.com';

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Scraped upstream text (history items, wire headlines) can carry dashes.
// The Gazette never prints them.
export function stripDashes(s) {
  return String(s == null ? '' : s)
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\s*\u2013\s*/g, '-');
}

// Escape then split double newlines into paragraphs.
export function paragraphs(text) {
  return String(text == null ? '' : text)
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${esc(stripDashes(p)).replace(/\*([^*\n]{1,90}?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export function longDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function shortDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US',
    { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Josefin+Sans:wght@300;400;600&display=swap" rel="stylesheet">`;

export const FAVICON = `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚓</text></svg>">`;

export const FEED_LINK = `<link rel="alternate" type="application/rss+xml" title="Great Lakes Gazette" href="${SITE}/feed.xml">`;

export const REL_ME = `<link rel="me" href="https://chrisizworski.com">
<link rel="me" href="https://daily.michigantroutreport.com">
<link rel="me" href="https://michigantroutreport.com">
<link rel="me" href="https://michiganbirdingreport.com">
<link rel="me" href="https://daily.michiganbirdingreport.com">
<link rel="me" href="https://lawn.chrisizworski.com">
<link rel="me" href="https://freighterviewfarms.com">
<link rel="me" href="https://www.wikidata.org/wiki/Q138283432">`;

// Everything a <head> needs besides title, description, canonical, og, and schema.
export function headCommon() {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${REL_ME}
${FEED_LINK}
<link rel="author" href="${AUTHOR_URL}">
${FAVICON}
${FONTS}`;
}

export function css() {
  return `
:root{--paper:#f0e8d5;--ink:#110c02;--ink-2:#3d3020;--ink-3:#6b5a42;--ink-4:#9a876c;--lake:#1b3a56;--gold:#8a6500;--rust:#782000}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Source Serif 4',Georgia,serif;background:var(--paper);color:var(--ink);line-height:1.65;font-size:17px}
a{color:var(--lake);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px 70px}
.wrap-narrow{max-width:780px;margin:0 auto;padding:0 24px 70px}
/* Front-page masthead */
.masthead{padding:20px 24px 0;text-align:center}
.folio{font-family:'Josefin Sans',sans-serif;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);display:flex;flex-wrap:wrap;justify-content:center;gap:4px 18px;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink-4);padding:7px 2px;max-width:1120px;margin:0 auto}
@media(min-width:640px){.folio{justify-content:space-between}}
.folio span{white-space:nowrap}
.flag{font-family:'IM Fell English',Georgia,serif;font-weight:700;font-size:clamp(42px,7.4vw,82px);line-height:1;margin:22px 0 6px;color:var(--ink)}
.flag a{color:inherit}
.tagline{font-style:italic;font-size:16px;color:var(--ink-3);margin-bottom:16px}
.rule-double{max-width:1120px;margin:0 auto;border-top:1px solid var(--ink);border-bottom:3px double var(--ink);height:6px}
/* Interior compact header */
.site-header{border-bottom:3px double var(--ink);padding:16px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px}
.site-brand{font-family:'IM Fell English',Georgia,serif;font-size:27px;font-weight:700;color:var(--ink)}
/* Shared nav */
.nav{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;display:flex;justify-content:center;gap:26px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--ink-4)}
.nav a{color:var(--ink-3)}
.nav a.active{color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:2px}
.site-header .nav{border:0;padding:0;justify-content:flex-end}
/* Article */
.front{display:grid;gap:46px;padding-top:34px}
@media(min-width:960px){.front{grid-template-columns:minmax(0,1fr) 330px}}
.kicker{font-family:'Josefin Sans',sans-serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--lake);margin-bottom:14px}
.headline{font-family:'IM Fell English',Georgia,serif;font-size:clamp(30px,4.6vw,50px);font-weight:700;line-height:1.06;margin-bottom:14px}
.headline a{color:inherit}
.byline{font-family:'Josefin Sans',sans-serif;font-size:12px;letter-spacing:.08em;color:var(--ink-3);margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--ink-4)}
.byline a{color:var(--lake);font-weight:600}
.brief{font-size:17.5px;line-height:1.78;color:var(--ink-2)}
.brief p{margin-bottom:18px}
.dropcap p:first-of-type::first-letter{font-family:'IM Fell English',Georgia,serif;font-size:3.6em;line-height:.8;float:left;padding:6px 10px 0 2px;color:var(--lake)}
.spotlight{background:rgba(120,32,0,.06);padding:22px;margin:32px 0;border-left:4px solid var(--rust)}
.spotlight-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--rust);margin-bottom:10px}
.spotlight-text{font-style:italic;color:var(--ink-2);font-size:16px;line-height:1.7}
.pn{display:flex;justify-content:space-between;gap:18px;margin-top:32px;padding-top:18px;border-top:1px solid var(--ink-4);font-family:'Josefin Sans',sans-serif;font-size:11.5px;letter-spacing:.12em;text-transform:uppercase}
.pn a{color:var(--lake)}
.pn .pn-spacer{flex:1}
/* Rail widgets */
.rail{display:grid;gap:24px;align-content:start}
.widget{border:1px solid var(--ink-4);background:rgba(255,255,255,.35);padding:18px 18px 12px}
.widget-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--lake);margin-bottom:10px;border-bottom:1px solid var(--ink-4);padding-bottom:8px}
.w-row{padding:9px 0;border-bottom:1px dotted var(--ink-4);font-size:14.5px;color:var(--ink-2);line-height:1.55}
.w-row:last-child{border-bottom:0}
.w-row b{color:var(--ink);font-weight:600}
.w-sub{display:block;font-size:13px;color:var(--ink-3);margin-top:2px}
.w-note{font-size:12.5px;color:var(--ink-3);font-style:italic;padding:8px 0 4px}
.follow p{font-size:14px;color:var(--ink-2);margin:0 0 12px;line-height:1.6}
.btn-rss{display:inline-block;border:1px solid var(--ink);padding:9px 16px;font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin-bottom:10px}
.btn-rss:hover{background:var(--ink);color:var(--paper);text-decoration:none}
/* Recent editions + archive rows */
.section-label{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--lake);margin-bottom:16px}
.recent{margin-top:56px;border-top:3px double var(--ink);padding-top:26px}
.r-item{padding:13px 0;border-bottom:1px solid var(--ink-4)}
.r-date{font-family:'Josefin Sans',sans-serif;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
.r-head{font-family:'IM Fell English',Georgia,serif;font-size:19px;line-height:1.28;color:var(--ink);display:block;margin-top:3px}
.r-head:hover{color:var(--lake)}
.archive-month{font-family:'IM Fell English',Georgia,serif;font-size:23px;margin:36px 0 6px;border-bottom:1px solid var(--ink-4);padding-bottom:6px}
/* About strip, author box */
.about-strip{margin-top:52px;border:1px solid var(--ink-4);background:rgba(27,58,86,.05);padding:22px;font-size:15px;color:var(--ink-2);line-height:1.7}
.author-bio{background:rgba(27,58,86,.06);padding:22px;margin-top:40px;border-left:4px solid var(--lake)}
.author-bio-label{font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--lake);margin-bottom:10px}
.author-bio-text{font-size:15px;color:var(--ink-2);line-height:1.7}
.author-bio-text a{color:var(--lake);font-weight:600}
.breadcrumb{font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.12em;color:var(--ink-3);text-transform:uppercase;padding:20px 0}
.breadcrumb a{color:var(--ink-3)}
.intro{font-size:16.5px;color:var(--ink-2);max-width:660px;margin-bottom:8px;line-height:1.7}
/* Footer */
.site-footer{border-top:3px double var(--ink);margin-top:70px;padding:26px 24px 34px;text-align:center;font-family:'Josefin Sans',sans-serif;font-size:11px;letter-spacing:.08em;color:var(--ink-3)}
.site-footer a{color:var(--lake)}
.f-line{margin-top:8px;line-height:2}
`;
}

const NAV_ITEMS = [
  ['/', 'Today'],
  ['/archive', 'Archive'],
  ['/feed.xml', 'Feed'],
  ['/chris-izworski', 'The Author'],
];

export function navHtml(activePath) {
  return `<nav class="nav">` + NAV_ITEMS.map(([href, label]) =>
    `<a href="${href}"${href === activePath ? ' class="active"' : ''}>${label}</a>`
  ).join('') + `</nav>`;
}

// Big front-page flag with folio line.
export function mastheadHome({ dateLong, editionNo }) {
  return `<header class="masthead">
  <div class="folio"><span>Bay City, Michigan</span><span>${esc(dateLong)}</span><span>No. ${esc(editionNo)}</span></div>
  <h1 class="flag"><a href="/">Great Lakes Gazette</a></h1>
  <div class="tagline">A daily brief of freighters, weather, and water across the five lakes</div>
  <div class="rule-double"></div>
</header>
${navHtml('/')}`;
}

// Compact header for interior pages.
export function headerInterior(activePath) {
  return `<header class="site-header">
  <a href="/" class="site-brand">Great Lakes Gazette</a>
  ${navHtml(activePath)}
</header>`;
}

export function followBox() {
  return `<div class="widget follow">
  <div class="widget-label">Follow the Gazette</div>
  <p>A new edition every morning. Subscribe once and never miss a day on the water.</p>
  <a class="btn-rss" href="/feed.xml">Subscribe by RSS</a>
  <p style="font-size:12.5px;color:var(--ink-3);margin-bottom:0">Full-text feed. Works with Feedly, NetNewsWire, Inoreader, or any reader. Also: <a href="https://www.youtube.com/@izworskic" rel="me">YouTube</a> and <a href="/chris-izworski">the author page</a>.</p>
</div>`;
}

export function resourcesBox() {
  const links = [
    ['https://chrisizworski.com/great-lakes-buoys/', 'Great Lakes Buoy Dashboard'],
    ['https://ais.boatnerd.com', 'BoatNerd AIS Live Map'],
    ['https://boatnerd.com', 'BoatNerd.com'],
    ['https://greatlakes-seaway.com', 'St. Lawrence Seaway'],
    ['https://freighterviewfarms.com', 'Freighter View Farms'],
  ];
  return `<div class="widget">
  <div class="widget-label">Chart Room</div>
  ${links.map(([u, t]) => `<div class="w-row"><a href="${u}" target="_blank" rel="noopener">${t}</a></div>`).join('\n  ')}
</div>`;
}

export function aboutStrip() {
  return `<div class="about-strip">The Great Lakes Gazette is assembled every morning from live vessel tracking (AIS), BoatNerd port reports, NOAA water levels, and National Weather Service marine forecasts. Every vessel movement is sourced from live data; nothing is invented. Written and edited by <a href="/chris-izworski">${AUTHOR}</a> in Bay City, Michigan, where the Saginaw River meets the bay.</div>`;
}

export function footerHtml() {
  return `<footer class="site-footer">
  <div>Great Lakes Gazette · Edited by <a href="${AUTHOR_URL}">${AUTHOR}</a> in Bay City, Michigan · Founded 2026</div>
  <div class="f-line"><a href="/">Today's Edition</a> · <a href="/archive">Archive</a> · <a href="/feed.xml">RSS Feed</a> · <a href="/chris-izworski">About the Author</a></div>
  <div class="f-line">Also by ${AUTHOR}: <a href="https://michigantroutreport.com" target="_blank" rel="noopener">Michigan Trout Report</a> · <a href="https://michiganbirdingreport.com" target="_blank" rel="noopener">Michigan Birding Report</a> · <a href="https://greatlakeslevels.org" target="_blank" rel="noopener">Great Lakes Levels</a> · <a href="https://freighterviewfarms.com" target="_blank" rel="noopener">Freighter View Farms</a> · <a href="https://www.youtube.com/@izworskic" target="_blank" rel="noopener">YouTube</a></div>
  <div class="f-line">Data with thanks to <a href="https://boatnerd.com" target="_blank" rel="noopener">BoatNerd.com</a>, <a href="https://tidesandcurrents.noaa.gov" target="_blank" rel="noopener">NOAA CO-OPS</a>, <a href="https://weather.gov" target="_blank" rel="noopener">NWS</a>, and <a href="https://greatlakesnow.org" target="_blank" rel="noopener">Great Lakes Now</a></div>
</footer>`;
}
