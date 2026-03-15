// Great Lakes Gazette — Data Scraper
// Sources:
// 1. BoatNerd WP REST API — port reports & shipping news
// 2. BoatNerd AIS — live vessel passages by port
// 3. NOAA CO-OPS — Great Lakes water levels
// 4. NWS Marine Zones — lake weather forecasts
// 5. Great Lakes Now — environmental/lake news (RSS)

const BOATNERD_API = 'https://boatnerd.com/wp-json/wp/v2/posts';
const BOATNERD_AIS = 'https://ais.boatnerd.com/passage/getPassageData';
const NOAA_COOPS   = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const NWS_API      = 'https://api.weather.gov';

const AIS_PORTS = [
  { id: '12', name: 'Soo Locks' },
  { id: '3',  name: 'Port Huron / St. Clair River' },
  { id: '8',  name: 'Detroit River' },
  { id: '44', name: 'Welland Canal' },
  { id: '23', name: 'Straits of Mackinac' },
  { id: '17', name: 'Duluth / Superior' },
  { id: '51', name: 'Saginaw' },
];

const WATER_LEVEL_STATIONS = [
  { id: '9076027', lake: 'Lake Superior',  city: 'Sault Ste. Marie' },
  { id: '9087031', lake: 'Lake Michigan',  city: 'Chicago' },
  { id: '9075002', lake: 'Lake Huron',     city: 'Harbor Beach, MI' },
  { id: '9063053', lake: 'Lake Erie',      city: 'Cleveland' },
  { id: '9052030', lake: 'Lake Ontario',   city: 'Rochester, NY' },
];

// NWS GLF (Great Lakes Forecast) product codes — one per lake
// Fetched via /products/types/GLF/locations/{code} → latest product text
const GLF_LAKES = [
  { code: 'LS', lake: 'Lake Superior' },
  { code: 'LM', lake: 'Lake Michigan' },
  { code: 'LH', lake: 'Lake Huron'   },
  { code: 'LE', lake: 'Lake Erie'    },
  { code: 'LO', lake: 'Lake Ontario' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

async function fetchTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal, headers: { ...HEADERS, ...(options.headers || {}) } });
    clearTimeout(id);
    return r;
  } catch(e) { clearTimeout(id); throw e; }
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8211;/g, '–')
    .replace(/&#8220;|&#8221;/g, '"').replace(/&#8216;|&#8217;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#8220;|&#8221;/g, '"').replace(/&#8216;|&#8217;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}

// ── 1. Port Reports ───────────────────────────────────────────────────────────
// Only return posts titled "Port Report – ..." — skip BoatNerd News, History, etc.
// Also parse into per-port entries for structured rendering.
export async function scrapePortReports() {
  try {
    const url = `${BOATNERD_API}?per_page=6&orderby=date&order=desc&search=port+report`;
    const r = await fetchTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const posts = await r.json();

    return posts
      .filter(p => /^port report/i.test(p.title?.rendered || ''))
      .map(p => {
        const title = decodeHtmlEntities(p.title?.rendered || '');
        const rawText = stripHtml(p.content?.rendered || '')
          // Strip boatnerd meta lines (URLs, layup list refs, saltie page refs)
          .replace(/https?:\/\/\S+/g, '')
          .replace(/you can now visit[^.]+\./gi, '')
          .replace(/the \d{4}[-–]\d{4} winter layup list[^.]+\./gi, '')
          .replace(/port reports? done by[^.]+\./gi, '')
          .replace(/please send [^.]+\./gi, '')
          .replace(/port and vessel activity for[^.]+\./gi, '')
          .replace(/\s{2,}/g, ' ').trim();

        // Parse into per-port entries
        // Pattern: "City, ST (CODE):" or "CITY, STATE [CODE]" or "CITY, STATE –"
        const ports = parsePortEntries(rawText);

        return { title, date: p.date, url: p.link, rawText, ports };
      });
  } catch(e) {
    return [];
  }
}

// Parse port entries — handles two BoatNerd formats:
// 1. "City, ST (CODE): activity" — compact newer style
// 2. "CITY, STATE [CODE]-Reporter\n activity lines" — detailed older style
function parsePortEntries(text) {
  const entries = [];

  // Format 2: UPPERCASE port headers like "CLEVELAND, OHIO [USCLE]-Bill Kloss"
  const upperPattern = /([A-Z][A-Z\s,]+)\s*\[[A-Z]{3,6}\][^\n]*/g;
  const upperMatches = [...text.matchAll(upperPattern)];

  if (upperMatches.length >= 2) {
    // Detailed format — parse port-by-port
    for (let i = 0; i < upperMatches.length; i++) {
      const match = upperMatches[i];
      const portRaw = match[0].split('[')[0].trim().replace(/[-–,]+$/, '').trim();
      // Title-case the port name
      const portName = portRaw.replace(/\b\w+/g, w =>
        w.length > 2 ? w[0] + w.slice(1).toLowerCase() : w
      ).trim();
      const start = match.index + match[0].length;
      const end = upperMatches[i + 1] ? upperMatches[i + 1].index : text.length;
      const activity = text.slice(start, end)
        .replace(/\d+\/\d+\/\d+/g, '') // strip raw dates like 3/10/2026
        .replace(/[-–]\d+:\d+ [AP]M/g, '')
        .replace(/\s{2,}/g, ' ').trim();
      if (activity.length > 10 && portName.length > 3) {
        entries.push({ port: portName, activity });
      }
    }
  }

  // Format 1: "City, ST (CODE): activity" — compact newer style
  if (!entries.length) {
    const compactPattern = /([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s*\([A-Z]{3,6}\))?)\s*[-–:]/g;
    const compactMatches = [...text.matchAll(compactPattern)];
    for (let i = 0; i < compactMatches.length; i++) {
      const match = compactMatches[i];
      const portName = match[1].replace(/\s*\([A-Z]+\)/, '').trim();
      const start = match.index + match[0].length;
      const end = compactMatches[i + 1] ? compactMatches[i + 1].index : text.length;
      const activity = text.slice(start, end).trim();
      if (activity.length > 10) entries.push({ port: portName, activity });
    }
  }

  // Fallback: return as one block
  if (!entries.length && text.length > 20) {
    entries.push({ port: null, activity: text.slice(0, 1500) });
  }

  return entries;
}

// ── 2. Vessel News — extracted from BoatNerd posts, split by <h1>/<h2> ────────
// BoatNerd News posts have multiple sub-stories each starting with an <h1> headline.
// We split on those, score each story block, discard site-meta noise.

const META_NOISE_STRICT = [
  /boatnerd was started/i,
  /30th anniversary/i,
  /501\(c\)/i,
  /board of directors/i,
  /advertising sales/i,
  /launching sunday/i,
  /temporarily unavailable/i,
  /easier to navigate/i,
  /lecture series/i,
  /national museum of the great lakes offers/i,
  /press releases in the gallery/i,
  /donate.*tab/i,
  /mobile app.*apple/i,
];

const VESSEL_SIGNALS = [
  /\b(departed|arrived|departs|arrives|steamed|inbound|outbound|upbound|downbound|unloaded|loaded|berthed|anchored|transited|icebreaking|ice.break|shuttle)\b/i,
  /\b(steamer|freighter|laker|tanker|self.unloader|bulker|tug|carferry|ferry|saltie|cutter|icebreaker|vessel|ship)\b/i,
  /\b(USCGC|CCGS|MV |SS )\b/,
  /\b(season|cargo|cement|coal|limestone|grain|iron ore|stone|salt|ore)\b/i,
  /\b(port|harbor|lock|canal|seaway|dock|berth)\b/i,
];

function isVesselStory(headline, body) {
  const full = headline + ' ' + body;
  const noiseHits = META_NOISE_STRICT.filter(rx => rx.test(full)).length;
  const vesselHits = VESSEL_SIGNALS.filter(rx => rx.test(full)).length;
  return vesselHits >= 2 && noiseHits === 0;
}

function stripHtmlKeepText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–').replace(/&#8220;|&#8221;/g, '"').replace(/&#8216;|&#8217;/g, "'")
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ').trim();
}

export async function scrapeShippingNews() {
  try {
    const url = `${BOATNERD_API}?per_page=8&orderby=date&order=desc`;
    const r = await fetchTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const posts = await r.json();

    const vesselItems = [];

    for (const p of posts) {
      const title = decodeHtmlEntities(p.title?.rendered || '');
      if (/today in great lakes history/i.test(title)) continue;

      const html = p.content?.rendered || '';
      const isPortReport = /port report/i.test(title);
      const stories = [];

      if (isPortReport) {
        // Port reports are pure vessel data — skip noise filter entirely
        const body = stripHtmlKeepText(html).slice(0, 2500);
        if (body.length > 60) stories.push({ headline: title, body });
      } else {
        // BoatNerd News — split on <h1>/<h2>, filter each sub-story
        const blocks = html.split(/(?=<h[12][^>]*>)/i).filter(b => b.trim());
        for (const block of blocks) {
          const hm = block.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
          const headline = hm ? stripHtmlKeepText(hm[1]) : '';
          const bodyHtml = block.replace(/<h[12][^>]*>[\s\S]*?<\/h[12]>/i, '');
          const body = stripHtmlKeepText(bodyHtml).slice(0, 600);
          if (body.length > 40 && isVesselStory(headline, body)) {
            stories.push({ headline, body });
          }
        }
      }

      if (stories.length > 0) {
        vesselItems.push({ postTitle: title, date: p.date, url: p.link, stories });
      }
    }

    return vesselItems;
  } catch(e) {
    return [];
  }
}



// ── 3. AIS Live Passages ──────────────────────────────────────────────────────
async function fetchOneAISPort(port) {
  try {
    const url = `${BOATNERD_AIS}?port=${port.id}&offset=0&limit=25&sortName=destination_eta&sortOrder=desc`;
    const r = await fetchTimeout(url, {
      headers: { ...HEADERS, 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://ais.boatnerd.com/passage' }
    }, 8000);
    if (!r.ok) return { port: port.name, portId: port.id, vessels: [], status: `HTTP ${r.status}` };
    const text = await r.text();
    if (!text || text.trim() === '') return { port: port.name, portId: port.id, vessels: [], status: 'empty_response' };
    let data;
    try { data = JSON.parse(text); } catch(e) { return { port: port.name, portId: port.id, vessels: [], status: 'parse_error' }; }
    if (data.error_message) return { port: port.name, portId: port.id, vessels: [], status: data.error_message };
    const rows = Array.isArray(data) ? data : (data.rows || []);
    const vessels = rows.map(v => ({
      name: v.vessel_name || v.name || v.ship_name || '',
      direction: v.direction || v.bound || '',
      destination: v.destination || v.passage_destination || '',
      eta: v.destination_eta || v.eta || '',
      cargo: v.cargo || '',
      timestamp: v.report_timestamp || v.timestamp || '',
      port: port.name,
    })).filter(v => v.name && v.name.length > 2);
    return { port: port.name, portId: port.id, vessels, total: data.total || rows.length, status: 'ok', fetched_at: new Date().toISOString() };
  } catch(e) {
    return { port: port.name, portId: port.id, vessels: [], status: 'error', error: e.message };
  }
}

export async function scrapeAISPassages() {
  return Promise.all(AIS_PORTS.map(port => fetchOneAISPort(port)));
}

// ── 4. Today in History ───────────────────────────────────────────────────────
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
  } catch(e) { return []; }
}

// ── 5. NOAA Water Levels ──────────────────────────────────────────────────────
// Uses daily_mean product — most meaningful for Great Lakes context (not a 6-min snapshot)
// datum=LWD = Great Lakes Low Water Datum (nautical chart datum, per IGLD 1985)
// time_zone=lst required for daily_mean on Great Lakes per NOAA docs
async function fetchOneWaterLevel(station) {
  try {
    // daily_mean needs a date range — yesterday to today
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'');

    const params = new URLSearchParams({
      station:     station.id,
      product:     'daily_mean',
      datum:       'LWD',
      time_zone:   'lst',           // required for daily_mean on Great Lakes
      units:       'english',
      application: 'GreatLakesGazette',
      format:      'json',
      begin_date:  fmt(yesterday),
      end_date:    fmt(yesterday), // daily_mean for today isn't published until day is over; yesterday is always available
    });
    const r = await fetchTimeout(`${NOAA_COOPS}?${params}`, {}, 8000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'NOAA error');
    // Take the most recent data point
    const obs = data.data?.slice(-1)[0];
    if (!obs) throw new Error('No data');
    return { lake: station.lake, city: station.city, stationId: station.id, level_ft: parseFloat(obs.v), date: obs.t, status: 'ok' };
  } catch(e) {
    return { lake: station.lake, city: station.city, stationId: station.id, level_ft: null, status: 'error', error: e.message };
  }
}

export async function scrapeWaterLevels() {
  return Promise.all(WATER_LEVEL_STATIONS.map(s => fetchOneWaterLevel(s)));
}

// ── 6. NWS GLF Marine Weather (text products) ───────────────────────────────
async function fetchOneGLF(lake) {
  try {
    // Step 1: get latest product ID for this lake
    const listUrl = `${NWS_API}/products/types/GLF/locations/${lake.code}`;
    const listR = await fetchTimeout(listUrl, {
      headers: { ...HEADERS, Accept: 'application/geo+json', 'User-Agent': 'GreatLakesGazette/1.0 (freighterviewfarms.com)' }
    }, 8000);
    if (!listR.ok) throw new Error(`List HTTP ${listR.status}`);
    const listData = await listR.json();
    const latest = listData['@graph']?.[0];
    if (!latest) throw new Error('No products found');

    // Step 2: fetch the product text
    const prodR = await fetchTimeout(latest['@id'], {
      headers: { ...HEADERS, 'User-Agent': 'GreatLakesGazette/1.0 (freighterviewfarms.com)' }
    }, 8000);
    if (!prodR.ok) throw new Error(`Product HTTP ${prodR.status}`);
    const prodData = await prodR.json();
    const text = prodData.productText || '';

    // Parse synopsis
    const synMatch = text.match(/\.SYNOPSIS\.\.\.\s*([\s\S]+?)(?=\n\.[A-Z]|\n[A-Z]{2,}[0-9]|\$)/);
    const synopsis = synMatch ? synMatch[1].replace(/\s+/g, ' ').trim().slice(0, 350) : '';

    // Parse wind/wave from first zone block
    const windMatch = text.match(/WIND\.\.\.([^\n]+)/i);
    const waveMatch = text.match(/WAVES\.\.\.([^\n]+)/i) || text.match(/waves?\s+(\d+(?:\.\d+)?)\s*(?:to\s+(\d+(?:\.\d+)?))?\s*(?:ft|feet)/i);
    const wind = windMatch ? windMatch[1].trim().slice(0, 80) : '';
    let waveHeight = null;
    if (waveMatch) {
      waveHeight = waveMatch[1] ? waveMatch[1].trim().slice(0, 40) : (waveMatch[2] ? `${waveMatch[1]}–${waveMatch[2]} ft` : `${waveMatch[1]} ft`);
    }

    // Check for warnings
    const warnMatch = text.match(/\.\.\.((?:GALE|STORM|SPECIAL MARINE|SMALL CRAFT)[^.]+)\.\.\./i);
    const warning = warnMatch ? warnMatch[1].trim() : null;

    return {
      lake:      lake.lake,
      code:      lake.code,
      synopsis,
      wind,
      waveHeight,
      warning,
      issuanceTime: latest.issuanceTime || null,
      status: 'ok',
    };
  } catch(e) {
    return { lake: lake.lake, code: lake.code, synopsis: '', wind: '', waveHeight: null, warning: null, status: 'error', error: e.message };
  }
}

export async function scrapeMarineWeather() {
  return Promise.all(GLF_LAKES.map(l => fetchOneGLF(l)));
}

// ── 7. Great Lakes Now RSS ────────────────────────────────────────────────────
export async function scrapeGreatLakesNow() {
  try {
    const r = await fetchTimeout('https://greatlakesnow.org/feed/', {
      headers: { ...HEADERS, Accept: 'application/rss+xml, text/xml, */*' }
    }, 10000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
      const block = match[1];
      const title   = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1]?.trim();
      const link    = (block.match(/<link>(.*?)<\/link>/) || [])[1]?.trim();
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]?.trim();
      const desc    = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || block.match(/<description>([\s\S]*?)<\/description>/) || [])[1];
      const cat     = (block.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/) || block.match(/<category>(.*?)<\/category>/) || [])[1]?.trim();
      if (title && link) {
        items.push({
          title:    decodeHtmlEntities(title),
          url:      link,
          date:     pubDate || '',
          summary:  desc ? stripHtml(decodeHtmlEntities(desc)).slice(0, 250) : '',
          category: cat || 'Great Lakes',
        });
      }
    }
    return { items, status: 'ok', source: 'Great Lakes Now' };
  } catch(e) {
    return { items: [], status: 'error', error: e.message, source: 'Great Lakes Now' };
  }
}

// ── Master fetch — includes marine weather for AI brief context ───────────────
export async function fetchAllData() {
  const [portReports, shippingNews, aisPassages, todayInHistory, waterLevels, greatLakesNow, marineWeather] = await Promise.all([
    scrapePortReports(),
    scrapeShippingNews(),
    scrapeAISPassages(),
    scrapeTodayInHistory(),
    scrapeWaterLevels(),
    scrapeGreatLakesNow(),
    scrapeMarineWeather(),
  ]);
  return { portReports, shippingNews, aisPassages, todayInHistory, waterLevels, greatLakesNow, marineWeather, fetched_at: new Date().toISOString() };
}

