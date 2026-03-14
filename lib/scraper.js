// Great Lakes Gazette — Data Scraper
// Three confirmed working sources:
// 1. BoatNerd WP REST API — port reports (JSON, rich vessel movement data)
// 2. BoatNerd WP REST API — shipping news (JSON, events, fleet news)
// 3. BoatNerd AIS JSON endpoint — live vessel passages by port (numeric IDs)
//    Port IDs: 12=Soo Locks, 3=Port Huron, 8=Detroit, 44=Welland Canal,
//              51=Saginaw, 88=Saginaw River, 23=Straits of Mackinac, 17=Duluth/Superior
//    NOTE: Returns 500 during off-season (Jan–mid-March). Handled gracefully.

const BOATNERD_API = 'https://boatnerd.com/wp-json/wp/v2/posts';
const BOATNERD_AIS  = 'https://ais.boatnerd.com/passage/getPassageData';

const AIS_PORTS = [
  { id: '12',  name: 'Soo Locks' },
  { id: '3',   name: 'Port Huron / St. Clair River' },
  { id: '8',   name: 'Detroit River' },
  { id: '44',  name: 'Welland Canal' },
  { id: '23',  name: 'Straits of Mackinac' },
  { id: '17',  name: 'Duluth / Superior' },
  { id: '51',  name: 'Saginaw' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

async function fetchTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal, headers: { ...HEADERS, ...(options.headers||{}) } });
    clearTimeout(id);
    return r;
  } catch(e) { clearTimeout(id); throw e; }
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

// ── 1. Port Reports (last 3 days) ─────────────────────────────────────────────
export async function scrapePortReports() {
  try {
    const url = `${BOATNERD_API}?per_page=4&orderby=date&order=desc&search=port+report`;
    const r = await fetchTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const posts = await r.json();

    return posts.map(p => ({
      title:  decodeHtmlEntities(p.title?.rendered || ''),
      date:   p.date,
      url:    p.link,
      text:   stripHtml(p.content?.rendered || '').slice(0, 6000),
    }));
  } catch(e) {
    return [{ title: 'Port reports unavailable', date: '', url: '', text: '', error: e.message }];
  }
}

// ── 2. Shipping News ──────────────────────────────────────────────────────────
export async function scrapeShippingNews() {
  try {
    const url = `${BOATNERD_API}?per_page=5&orderby=date&order=desc&search=boatnerd+news`;
    const r = await fetchTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const posts = await r.json();

    return posts.map(p => ({
      title: decodeHtmlEntities(p.title?.rendered || ''),
      date:  p.date,
      url:   p.link,
      text:  stripHtml(p.content?.rendered || '').slice(0, 3000),
    }));
  } catch(e) {
    return [{ title: 'News unavailable', date: '', url: '', text: '', error: e.message }];
  }
}

// ── 3. AIS Live Passages — PARALLEL fetch (was sequential, now all ports at once)
async function fetchOneAISPort(port) {
  try {
    const url = `${BOATNERD_AIS}?port=${port.id}&offset=0&limit=25&sortName=destination_eta&sortOrder=desc`;
    const r = await fetchTimeout(url, {
      headers: {
        ...HEADERS,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://ais.boatnerd.com/passage',
      }
    }, 8000);

    if (!r.ok) {
      return { port: port.name, portId: port.id, vessels: [], status: `HTTP ${r.status}` };
    }

    const text = await r.text();
    if (!text || text.trim() === '') {
      return { port: port.name, portId: port.id, vessels: [], status: 'empty_response' };
    }

    let data;
    try { data = JSON.parse(text); } catch(e) {
      return { port: port.name, portId: port.id, vessels: [], status: 'parse_error', raw: text.slice(0, 100) };
    }

    if (data.error_message) {
      return { port: port.name, portId: port.id, vessels: [], status: data.error_message };
    }

    const rows = Array.isArray(data) ? data : (data.rows || []);
    const vessels = rows.map(v => ({
      name:        v.vessel_name || v.name || v.ship_name || JSON.stringify(v).slice(0, 50),
      direction:   v.direction || v.bound || '',
      destination: v.destination || v.passage_destination || '',
      eta:         v.destination_eta || v.eta || '',
      cargo:       v.cargo || '',
      timestamp:   v.report_timestamp || v.timestamp || '',
      port:        port.name,
    })).filter(v => v.name && v.name.length > 2);

    return {
      port: port.name,
      portId: port.id,
      vessels,
      total: data.total || rows.length,
      status: 'ok',
      fetched_at: new Date().toISOString(),
    };
  } catch(e) {
    return { port: port.name, portId: port.id, vessels: [], status: 'error', error: e.message };
  }
}

export async function scrapeAISPassages() {
  // All 7 ports fetched in parallel — was sequential, reducing worst-case from ~56s to ~8s
  return Promise.all(AIS_PORTS.map(port => fetchOneAISPort(port)));
}

// ── 4. Historical / Seasonal Context ─────────────────────────────────────────
export async function scrapeTodayInHistory() {
  try {
    const url = `${BOATNERD_API}?per_page=2&orderby=date&order=desc&search=great+lakes+history`;
    const r = await fetchTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const posts = await r.json();
    return posts.map(p => ({
      title: decodeHtmlEntities(p.title?.rendered || ''),
      date:  p.date,
      text:  stripHtml(p.content?.rendered || '').slice(0, 1500),
    }));
  } catch(e) {
    return [];
  }
}

// ── Master fetch ──────────────────────────────────────────────────────────────
export async function fetchAllData() {
  const [portReports, shippingNews, aisPassages, todayInHistory] = await Promise.all([
    scrapePortReports(),
    scrapeShippingNews(),
    scrapeAISPassages(),   // already parallel internally
    scrapeTodayInHistory(),
  ]);
  return {
    portReports,
    shippingNews,
    aisPassages,
    todayInHistory,
    fetched_at: new Date().toISOString(),
  };
}
