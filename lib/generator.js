// Great Lakes Gazette — AI Brief Generator
// Model: claude-haiku-4-5-20251001 (~$0.006/call)

function formatAISSection(aisPassages) {
  const lines = ['=== LIVE AIS VESSEL PASSAGES ==='];
  let anyData = false;
  for (const port of aisPassages) {
    if (port.status === 'ok' && port.vessels.length > 0) {
      anyData = true;
      lines.push(`\n${port.port.toUpperCase()} — ${port.vessels.length} vessel(s):`);
      for (const v of port.vessels) {
        const dir   = v.direction   ? ` [${v.direction}]`        : '';
        const dest  = v.destination ? ` → ${v.destination}`      : '';
        const cargo = v.cargo       ? ` | Cargo: ${v.cargo}`     : '';
        lines.push(`  • ${v.name}${dir}${dest}${cargo}`);
      }
    } else {
      lines.push(`\n${port.port}: [${port.status || 'no data'}]`);
    }
  }
  if (!anyData) lines.push('\nNote: AIS offline — off-season or database unavailable. Do NOT invent vessel data.');
  return lines.join('\n');
}

function formatPortReports(portReports) {
  const lines = ['=== PORT REPORTS (BoatNerd) ==='];
  for (const r of portReports) {
    if (r.text && r.text.length > 60) {
      lines.push(`\n--- ${r.title} (${(r.date||'').slice(0,10)}) ---`);
      lines.push(r.text.slice(0, 4000));
    }
  }
  return lines.join('\n');
}

function formatNews(shippingNews) {
  const lines = ['=== SHIPPING NEWS (BoatNerd) ==='];
  for (const n of shippingNews) {
    if (n.text && n.text.length > 60) {
      lines.push(`\n--- ${n.title} (${(n.date||'').slice(0,10)}) ---`);
      lines.push(n.text.slice(0, 2000));
    }
  }
  return lines.join('\n');
}

function formatHistory(history) {
  if (!history?.length) return '';
  const lines = ['=== TODAY IN GREAT LAKES HISTORY ==='];
  for (const h of history) {
    if (h.text) { lines.push(`\n--- ${h.title} ---`); lines.push(h.text.slice(0, 1000)); }
  }
  return lines.join('\n');
}

function formatWaterLevels(waterLevels) {
  if (!waterLevels?.length) return '';
  const lines = ['=== GREAT LAKES WATER LEVELS (NOAA) ==='];
  for (const w of waterLevels) {
    if (w.status === 'ok' && w.level_ft !== null) {
      lines.push(`${w.lake}: ${w.level_ft.toFixed(2)} ft above Low Water Datum (station: ${w.city})`);
    }
  }
  return lines.join('\n');
}

function formatMarineWeather(marineWeather) {
  if (!marineWeather?.length) return '';
  const lines = ['=== MARINE WEATHER FORECASTS (NWS) ==='];
  for (const z of marineWeather) {
    if (z.status === 'ok' && z.shortForecast) {
      lines.push(`${z.lake}: ${z.shortForecast}. Wind ${z.windDir} ${z.windSpeed}.${z.waveHeight ? ` Waves ${z.waveHeight}.` : ''}`);
      if (z.detail) lines.push(`  ${z.detail.slice(0, 200)}`);
    }
  }
  return lines.join('\n');
}

function formatGreatLakesNow(gln) {
  if (!gln?.items?.length) return '';
  const lines = ['=== GREAT LAKES NOW (Environmental/Lake News) ==='];
  for (const item of gln.items.slice(0, 4)) {
    lines.push(`\n"${item.title}" [${item.category}]`);
    if (item.summary) lines.push(item.summary);
  }
  return lines.join('\n');
}

function buildContext(data) {
  return [
    formatAISSection(data.aisPassages   || []),
    formatPortReports(data.portReports  || []),
    formatNews(data.shippingNews        || []),
    formatWaterLevels(data.waterLevels  || []),
    formatMarineWeather(data.marineWeather || []),
    formatGreatLakesNow(data.greatLakesNow),
    formatHistory(data.todayInHistory   || []),
  ].filter(s => s.trim()).join('\n\n');
}

const SYSTEM_PROMPT = `You are the editor of the Great Lakes Gazette, a maritime newsletter for freighter watchers, lake enthusiasts, and anyone who grew up near the water in the Upper Midwest. Your voice comes from Bay City, Michigan — warm, specific, knowledgeable, and quietly poetic about the lakes without being precious about it.

HARD RULES:
1. Only report on vessels, ports, cargo, and events explicitly in the data given to you.
2. Never invent vessel names, cargo, ports, routes, or dates.
3. You now have water level data, marine weather, and Great Lakes Now environmental news — weave these in naturally.
4. If AIS data is unavailable (off-season), lean on port reports, water levels, and weather.
5. Named vessel histories are fair game only if that vessel appears in the data.
6. If data is thin, write shorter. Never pad.

OUTPUT FORMAT — return exactly this structure:

HEADLINE: [punchy 6-10 word headline]

DATELINE: [e.g. "Bay City, Mich. — March 15, 2026"]

BRIEF:
[3–4 paragraphs, 350–500 words]
- Para 1: Lede — most newsworthy movement, water condition, or story
- Para 2–3: Port highlights, water levels, or weather conditions worth noting
- Para 4: Environmental angle (Great Lakes Now), history, or editorial close

VESSEL_SPOTLIGHT: [If any vessel in AIS data: 2 sentences — what it is, what it's doing. Otherwise: "none"]`;

export async function generateBrief(data) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const context = buildContext(data);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const userMessage = `Today is ${today}. Write the Great Lakes Gazette brief using ONLY the facts in this data.\n\n${context}\n\nWrite the brief now.`;

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

  const headline       = (raw.match(/^HEADLINE:\s*(.+)$/m)       || [])[1]?.trim() || 'Great Lakes Dispatch';
  const dateline       = (raw.match(/^DATELINE:\s*(.+)$/m)        || [])[1]?.trim() || '';
  const briefMatch     = raw.match(/BRIEF:\s*([\s\S]+?)(?=VESSEL_SPOTLIGHT:|$)/);
  const brief          = briefMatch ? briefMatch[1].trim() : raw;
  const spotlightMatch = raw.match(/VESSEL_SPOTLIGHT:\s*([\s\S]+?)$/);
  const spotlight      = spotlightMatch ? spotlightMatch[1].trim() : '';

  const activePorts    = (data.aisPassages  || []).filter(p => p.status === 'ok' && p.vessels.length > 0);
  const portReportUrls = (data.portReports  || []).filter(p => p.url).map(p => ({ title: p.title, url: p.url, date: p.date }));

  return {
    headline, dateline, brief,
    spotlight: spotlight !== 'none' ? spotlight : '',
    issueDate:   new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    issueNumber: getIssueNumber(),
    sources: {
      aisPassages: activePorts.map(p => ({ port: p.port, count: p.vessels.length })),
      portReports: portReportUrls,
      newsItems:   (data.shippingNews || []).filter(n => n.url).map(n => ({ title: n.title, url: n.url })),
    },
    generated_at: new Date().toISOString(),
  };
}

function getIssueNumber() {
  const start = new Date('2026-03-16');
  return Math.max(1, Math.floor((new Date() - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}
