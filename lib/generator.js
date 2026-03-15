// Great Lakes Gazette — AI Brief Generator
// Model: claude-haiku-4-5-20251001 (~$0.006/call)

// Vessel/maritime keywords — only content matching these gets sent to the AI
const VESSEL_CONTENT_SIGNALS = [
  /\b(departed|arrived|inbound|outbound|upbound|downbound|unloaded|loaded|berthed|transited|icebreaking|shuttle)\b/i,
  /\b(steamer|freighter|laker|tanker|tug|carferry|ferry|saltie|cutter|icebreaker|vessel)\b/i,
  /\b(USCGC|CCGS|MV |SS )\b/,
  /\b(cargo|cement|coal|limestone|grain|iron ore|stone|salt|ore)\b/i,
];

function hasVesselContent(text) {
  return VESSEL_CONTENT_SIGNALS.some(rx => rx.test(text));
}

function formatAISSection(aisPassages) {
  const lines = ['=== LIVE AIS VESSEL PASSAGES ==='];
  let anyData = false;
  for (const port of aisPassages) {
    if (port.status === 'ok' && port.vessels.length > 0) {
      anyData = true;
      lines.push(`\n${port.port.toUpperCase()} — ${port.vessels.length} vessel(s):`);
      for (const v of port.vessels) {
        const dir   = v.direction   ? ` [${v.direction}]`   : '';
        const dest  = v.destination ? ` → ${v.destination}` : '';
        const cargo = v.cargo       ? ` | Cargo: ${v.cargo}` : '';
        lines.push(`  • ${v.name}${dir}${dest}${cargo}`);
      }
    }
  }
  if (!anyData) lines.push('\nAIS offline — navigation season not yet open. Do NOT invent vessel positions.');
  return lines.join('\n');
}

function formatPortReports(portReports) {
  const lines = ['=== PORT REPORTS ==='];
  for (const r of portReports) {
    // Only include actual port reports — skip BoatNerd News and History posts
    if (!/^port report/i.test(r.title)) continue;
    if (!r.text || r.text.length < 60) continue;
    lines.push(`\n--- ${r.title} (${(r.date||'').slice(0,10)}) ---`);
    lines.push(r.text.slice(0, 4000));
  }
  return lines.join('\n');
}

function formatVesselNews(shippingNews) {
  // shippingNews is now [{postTitle, date, url, stories:[{headline, body}]}]
  const lines = ['=== VESSEL MOVEMENTS & MARITIME NEWS ==='];
  for (const post of (shippingNews || [])) {
    for (const story of (post.stories || [])) {
      const text = (story.headline || '') + ' ' + (story.body || '');
      if (!hasVesselContent(text)) continue;
      lines.push(`\n--- ${story.headline} (${(post.date||'').slice(0,10)}) ---`);
      lines.push((story.body || '').slice(0, 600));
    }
  }
  return lines.join('\n');
}

function formatHistory(history) {
  if (!history?.length) return '';
  const lines = ['=== TODAY IN GREAT LAKES HISTORY ==='];
  for (const h of history) {
    if (h.text) {
      lines.push(`\n--- ${h.title} ---`);
      lines.push(h.text.slice(0, 1000));
    }
  }
  return lines.join('\n');
}

function formatWaterLevels(waterLevels) {
  if (!waterLevels?.length) return '';
  const lines = ['=== GREAT LAKES WATER LEVELS (NOAA) ==='];
  for (const w of waterLevels) {
    if (w.status === 'ok' && w.level_ft !== null) {
      lines.push(`${w.lake}: ${w.level_ft.toFixed(2)} ft above Low Water Datum (${w.city})`);
    }
  }
  return lines.join('\n');
}

function formatGreatLakesNow(gln) {
  if (!gln?.items?.length) return '';
  const lines = ['=== GREAT LAKES NOW (Environmental News) ==='];
  for (const item of gln.items.slice(0, 4)) {
    lines.push(`\n"${item.title}" [${item.category}]`);
    if (item.summary) lines.push(item.summary.slice(0, 200));
  }
  return lines.join('\n');
}

function buildContext(data) {
  return [
    formatAISSection(data.aisPassages    || []),
    formatPortReports(data.portReports   || []),
    formatVesselNews(data.shippingNews   || []),
    formatWaterLevels(data.waterLevels   || []),
    formatGreatLakesNow(data.greatLakesNow),
    formatHistory(data.todayInHistory    || []),
  ].filter(s => s.trim() && s.split('\n').length > 1).join('\n\n');
}

const SYSTEM_PROMPT = `You are the editor of the Great Lakes Gazette, a maritime newsletter for freighter watchers and lake enthusiasts. Your voice is from Bay City, Michigan — warm, specific, knowledgeable about the lakes.

HARD RULES — never break these:
1. Write ONLY about vessels, their movements, cargo, ports, water conditions, and Great Lakes environment.
2. NEVER write about BoatNerd.com as a company, website, or organization. Not their anniversary, redesign, apps, or anything about their business. They are just a data source.
3. Never invent vessel names, cargo, ports, routes, or dates.
4. If a vessel movement is in the data, lead with that. Always prefer ships over institutions.
5. If AIS data is unavailable (off-season), lean on port reports and vessel movements.
6. Water levels and marine weather are fair game for supporting paragraphs.
7. Great Lakes Now environmental stories can anchor the closing paragraph.
8. Never pad with invented detail — if data is thin, write shorter.

OUTPUT FORMAT:
HEADLINE: [6-10 words about vessel or lake conditions, never about BoatNerd]
DATELINE: [e.g. "Bay City, Mich. — March 15, 2026"]
BRIEF:
[3–4 paragraphs, 300–450 words]
- Para 1: A specific vessel movement or maritime event from the data
- Para 2–3: Port activity, water levels, or ice conditions
- Para 4: Environmental news or historical close
VESSEL_SPOTLIGHT: [One vessel from the data: 2 sentences on what it is and what it's doing. "none" if no vessel data]`;

export async function generateBrief(data) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const context = buildContext(data);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const userMessage = `Today is ${today}. Write the Great Lakes Gazette brief using ONLY the vessel movements and lake conditions in this data. Do not write about BoatNerd as a company.\n\n${context}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err.slice(0, 200)}`);
  }

  const result = await response.json();
  const raw = result.content[0].text;

  const headline       = (raw.match(/^HEADLINE:\s*(.+)$/m)    || [])[1]?.trim() || 'Great Lakes Dispatch';
  const dateline       = (raw.match(/^DATELINE:\s*(.+)$/m)    || [])[1]?.trim() || '';
  const briefMatch     = raw.match(/BRIEF:\s*([\s\S]+?)(?=VESSEL_SPOTLIGHT:|$)/);
  const brief          = briefMatch ? briefMatch[1].trim() : raw;
  const spotlightMatch = raw.match(/VESSEL_SPOTLIGHT:\s*([\s\S]+?)$/);
  const spotlight      = spotlightMatch ? spotlightMatch[1].trim() : '';

  const activePorts    = (data.aisPassages  || []).filter(p => p.status === 'ok' && p.vessels.length > 0);
  const portReportUrls = (data.portReports  || []).filter(p => p.url && /^port report/i.test(p.title))
                                                   .map(p => ({ title: p.title, url: p.url, date: p.date }));

  return {
    headline, dateline, brief,
    spotlight: spotlight !== 'none' ? spotlight : '',
    issueDate:   new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    issueNumber: getIssueNumber(),
    sources: {
      aisPassages: activePorts.map(p => ({ port: p.port, count: p.vessels.length })),
      portReports: portReportUrls,
    },
    generated_at: new Date().toISOString(),
  };
}

function getIssueNumber() {
  const start = new Date('2026-03-16');
  return Math.max(1, Math.floor((new Date() - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}
