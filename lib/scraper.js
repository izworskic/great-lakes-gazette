// Scrapes three real data sources — all free, no key required:
// 1. BoatNerd AIS passage data (per-port vessel list with direction)
// 2. BoatNerd Port Reports (latest weekly narrative)
// 3. US Seaway DOT — seasonal stats page

const PORTS = [
  { name: 'Soo Locks',    slug: 'soo-locks' },
  { name: 'Port Huron',   slug: 'port-huron' },
  { name: 'Detroit River',slug: 'detroit-river' },
  { name: 'Welland Canal',slug: 'welland-canal' },
];

async function fetchWithTimeout(url, ms = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GreatLakesGazette/1.0)' }
    });
    clearTimeout(id);
    return r;
  } catch(e) {
    clearTimeout(id);
    throw e;
  }
}

// ── 1. BoatNerd AIS passage pages ─────────────────────────────────────────────
// ais.boatnerd.com/passage/port/{slug} returns HTML with a table of
// vessel name, direction (upbound/downbound), and timestamp
export async function scrapeBoatnerdPassages() {
  const results = [];
  for (const port of PORTS) {
    try {
      const url = `https://ais.boatnerd.com/passage/port/${port.slug}`;
      const r = await fetchWithTimeout(url, 8000);
      if (!r.ok) continue;
      const html = await r.text();
      const vessels = parsePassageHTML(html, port.name);
      results.push({ port: port.name, vessels, url, scraped_at: new Date().toISOString() });
    } catch(e) {
      results.push({ port: port.name, vessels: [], error: e.message });
    }
  }
  return results;
}

function parsePassageHTML(html, portName) {
  const vessels = [];
  // Table rows: vessel name | direction | timestamp
  // Pattern: <tr ...><td>VESSEL NAME</td><td>upbound|downbound</td><td>datetime</td>
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const direction = match[2].trim().toLowerCase();
    const timestamp = match[3].trim();
    if (name && name.length > 2) {
      vessels.push({ name, direction, timestamp, port: portName });
    }
  }
  // Fallback: grab any text that looks like vessel names (all-caps words 3+ chars)
  if (vessels.length === 0) {
    const vesselNames = [...html.matchAll(/([A-Z][A-Z\s\.\-]{4,40})\s+(upbound|downbound)/gi)];
    vesselNames.slice(0, 20).forEach(m => {
      vessels.push({ name: m[1].trim(), direction: m[2].toLowerCase(), timestamp: '', port: portName });
    });
  }
  return vessels;
}

// ── 2. BoatNerd Port Reports (weekly narrative) ────────────────────────────────
// boatnerd.com/port-reports/ lists dated weekly report pages
// We grab the most recent and extract the text
export async function scrapeBoatnerdPortReport() {
  try {
    // Get the index to find latest report slug
    const indexUrl = 'https://boatnerd.com/port-reports/';
    const r = await fetchWithTimeout(indexUrl, 10000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // Find most recent port report link
    const linkMatch = html.match(/href="(\/port-reports-[^"]+)"/i);
    if (!linkMatch) throw new Error('No port report link found');

    const reportUrl = `https://boatnerd.com${linkMatch[1]}`;
    const r2 = await fetchWithTimeout(reportUrl, 10000);
    if (!r2.ok) throw new Error(`Report HTTP ${r2.status}`);
    const reportHtml = await r2.text();

    const text = extractTextFromHTML(reportHtml);
    const title = (reportHtml.match(/<title>([^<]+)<\/title>/i) || [])[1] || 'Port Report';

    return {
      title: title.trim(),
      url: reportUrl,
      text: text.slice(0, 8000), // cap at ~8k chars
      scraped_at: new Date().toISOString()
    };
  } catch(e) {
    return { title: 'Port Report unavailable', url: '', text: '', error: e.message };
  }
}

function extractTextFromHTML(html) {
  // Strip scripts, styles, nav, headers
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text;
}

// ── 3. US Seaway seasonal stats ────────────────────────────────────────────────
// seaway.dot.gov publishes press releases and traffic stats
export async function scrapeSeawayStats() {
  try {
    const url = 'https://www.seaway.dot.gov/latest-news';
    const r = await fetchWithTimeout(url, 8000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const text = extractTextFromHTML(html).slice(0, 3000);
    return { url, text, scraped_at: new Date().toISOString() };
  } catch(e) {
    return { url: '', text: '', error: e.message };
  }
}

// ── Master fetch: all three sources ───────────────────────────────────────────
export async function fetchAllData() {
  const [passages, portReport, seawayStats] = await Promise.all([
    scrapeBoatnerdPassages(),
    scrapeBoatnerdPortReport(),
    scrapeSeawayStats(),
  ]);
  return { passages, portReport, seawayStats, fetched_at: new Date().toISOString() };
}
