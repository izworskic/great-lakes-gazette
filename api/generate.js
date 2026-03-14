// GET /api/generate
// Scrapes all data AND generates the brief server-side using ANTHROPIC_API_KEY env var.
// Returns { success, brief, issueNumber, issueDate, sources, data_summary }
import { fetchAllData } from '../lib/scraper.js';

const SYSTEM = `You are the editor of the Great Lakes Gazette, a weekly shipping newsletter for maritime enthusiasts and freighter watchers in the Great Lakes region. Your editorial voice is warm, specific, and knowledgeable — like a lifelong lake watcher writing from Bay City, Michigan.

ABSOLUTE RULES:
1. Only report on vessels, ports, cargo, and events that appear verbatim in the provided data.
2. Never invent vessel names, routes, cargo types, companies, or dates not in the data.
3. If AIS shows no live passages (season not yet open), acknowledge this clearly and focus on port report content.
4. If data for a section is missing, skip it — do not pad with invented detail.
5. You may add maritime color and editorial voice, but every fact must trace to the provided data.

FORMAT: Lead paragraph → Port highlights (only ports with actual data) → Fleet/Industry news → Historical note if available → Closing line. Target 400–500 words.`;

function buildPrompt(data) {
  const today = new Date().toLocaleDateString('en-US', {weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const lines = [`Today is ${today}. Write the Great Lakes Gazette weekly brief from ONLY the facts in this data.\n`];

  const active = (data.aisPassages||[]).filter(p => p.status==='ok' && p.vessels?.length > 0);
  lines.push('=== LIVE AIS PASSAGES ===');
  if (active.length) {
    active.forEach(p => {
      lines.push(`\n${p.port.toUpperCase()} — ${p.vessels.length} vessel(s):`);
      p.vessels.forEach(v => lines.push(
        `  • ${v.name}${v.direction?' ['+v.direction+']':''}${v.destination?' → '+v.destination:''}${v.cargo?' | Cargo: '+v.cargo:''}`
      ));
    });
  } else {
    lines.push('AIS database offline — season not yet open (opens March 25, 2026). Do NOT invent vessel positions.');
  }

  lines.push('\n=== PORT REPORTS ===');
  (data.portReports||[]).filter(p=>p.text?.length>80).forEach(r =>
    lines.push(`\n--- ${r.title} (${r.date?.slice(0,10)}) ---\n${r.text.slice(0,5000)}`)
  );

  lines.push('\n=== SHIPPING NEWS ===');
  (data.shippingNews||[]).filter(n=>n.text?.length>80).forEach(n =>
    lines.push(`\n--- ${n.title} (${n.date?.slice(0,10)}) ---\n${n.text.slice(0,2500)}`)
  );

  if (data.todayInHistory?.length) {
    lines.push('\n=== TODAY IN GREAT LAKES HISTORY ===');
    data.todayInHistory.forEach(h => lines.push(`\n--- ${h.title} ---\n${h.text.slice(0,1200)}`));
  }

  return lines.join('\n');
}

function getIssueNumber() {
  const start = new Date('2026-03-16');
  return Math.max(1, Math.floor((new Date() - start) / (7*24*60*60*1000)) + 1);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY not configured',
      hint: 'Add ANTHROPIC_API_KEY to Vercel environment variables',
      setup_url: 'https://vercel.com/izworski-gmailcoms-projects/great-lakes-gazette/settings/environment-variables'
    });
  }

  try {
    // Step 1: scrape
    console.log('[generate] Fetching shipping data...');
    const data = await fetchAllData();

    const prCount = data.portReports?.filter(p => p.text?.length > 80).length || 0;
    const nsCount = data.shippingNews?.filter(n => n.text?.length > 80).length || 0;
    console.log(`[generate] Scraped: ${prCount} port reports, ${nsCount} news items`);

    // Step 2: call Claude server-side
    console.log('[generate] Calling Claude...');
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: 'user', content: buildPrompt(data) }],
      })
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.text();
      throw new Error(`Claude API ${claudeResp.status}: ${err.slice(0,200)}`);
    }

    const claudeResult = await claudeResp.json();
    const brief = claudeResult.content[0].text;
    const issueNumber = getIssueNumber();
    const issueDate = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});

    const activePorts = (data.aisPassages||[]).filter(p => p.status==='ok' && p.vessels?.length > 0);
    return res.status(200).json({
      success: true,
      brief,
      issueNumber,
      issueDate,
      sources: {
        portReports: (data.portReports||[]).filter(p=>p.url).map(p=>({title:p.title,url:p.url})),
        newsItems: (data.shippingNews||[]).filter(n=>n.url).map(n=>({title:n.title,url:n.url})),
        aisPassages: activePorts.map(p=>({port:p.port,count:p.vessels.length})),
      },
      data_summary: {
        port_reports_found: prCount,
        news_items_found: nsCount,
        ais_ports_active: activePorts.length,
      },
      // Also return raw data for sidebar
      data,
    });

  } catch(e) {
    console.error('[generate] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
