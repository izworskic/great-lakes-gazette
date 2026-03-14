// Builds prompt context from scraped data and calls Claude

function formatAISSection(aisPassages) {
  const lines = ['=== LIVE AIS VESSEL PASSAGES (BoatNerd AIS, real-time) ==='];
  let anyData = false;
  for (const port of aisPassages) {
    if (port.status === 'ok' && port.vessels.length > 0) {
      anyData = true;
      lines.push(`\n${port.port.toUpperCase()} — ${port.vessels.length} vessel(s):`);
      for (const v of port.vessels) {
        const dir   = v.direction ? ` [${v.direction}]` : '';
        const dest  = v.destination ? ` → ${v.destination}` : '';
        const cargo = v.cargo ? ` | Cargo: ${v.cargo}` : '';
        const time  = v.timestamp ? ` | Reported: ${v.timestamp}` : '';
        lines.push(`  • ${v.name}${dir}${dest}${cargo}${time}`);
      }
    } else {
      lines.push(`\n${port.port}: [${port.status || 'no data'}]`);
    }
  }
  if (!anyData) {
    lines.push('\nNote: AIS live passage data is not available — either the navigation season has not yet opened or the database is temporarily offline. Do NOT invent vessel positions.');
  }
  return lines.join('\n');
}

function formatPortReports(portReports) {
  const lines = ['=== BOATNERD PORT REPORTS (vessel movements by port) ==='];
  for (const r of portReports) {
    if (r.text) {
      lines.push(`\n--- ${r.title} (${r.date.slice(0,10)}) ---`);
      lines.push(r.text);
    }
  }
  return lines.join('\n');
}

function formatNews(shippingNews) {
  const lines = ['=== GREAT LAKES SHIPPING NEWS ==='];
  for (const n of shippingNews) {
    if (n.text) {
      lines.push(`\n--- ${n.title} (${n.date.slice(0,10)}) ---`);
      lines.push(n.text);
    }
  }
  return lines.join('\n');
}

function formatHistory(history) {
  if (!history || history.length === 0) return '';
  const lines = ['=== TODAY IN GREAT LAKES HISTORY ==='];
  for (const h of history) {
    if (h.text) {
      lines.push(`\n--- ${h.title} ---`);
      lines.push(h.text);
    }
  }
  return lines.join('\n');
}

function buildContext(data) {
  const sections = [
    formatAISSection(data.aisPassages || []),
    formatPortReports(data.portReports || []),
    formatNews(data.shippingNews || []),
    formatHistory(data.todayInHistory || []),
  ];
  return sections.filter(s => s.trim()).join('\n\n');
}

const SYSTEM_PROMPT = `You are the editor of the Great Lakes Gazette, a weekly shipping newsletter for maritime enthusiasts, freighter watchers, and people who love the Great Lakes. Your voice is warm, knowledgeable, and specific — like a lifelong lake watcher writing for fellow enthusiasts from Bay City, Michigan.

CRITICAL RULES — NON-NEGOTIABLE:
1. You may ONLY report on vessels, ports, cargo, companies, and events explicitly present in the data provided to you.
2. NEVER invent or assume vessel names, cargo types, ports, companies, routes, or dates not in the data.
3. If a vessel's cargo is not stated in the data, say "cargo not reported" or simply omit it — do not speculate.
4. If the AIS live data shows no active passages (off-season), say so honestly and focus on the port report narrative. The navigation season typically opens late March.
5. You MAY add nautical color, brief historical context, and editorial voice — but every factual claim must trace to the provided data.
6. If the data is thin, write a shorter brief. Never pad with invented detail.
7. You may reference named vessels' well-known histories (e.g., the Paul R. Tregurtha being the longest ship on the lakes) only if the vessel appears in the provided data.

FORMAT:
- Lead paragraph (2–3 sentences): set the scene, time of year, general activity level
- Port-by-port highlights: include only ports with actual data; use subheads like "Soo Locks" or "Port Huron"  
- Fleet & Industry News: anything from the news posts beyond vessel movements
- Historical Note (if available): brief, drawn from the Today in History data
- Closing line in your editorial voice
- Word count: 400–550 words total

TONE: Authoritative, warm, and specific. Think a longtime BoatNerd contributor writing for the same crowd that drives to Port Huron in November just to watch the last lakers of the season.`;

export async function generateBrief(data) {
  const context = buildContext(data);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const userMessage = `Today is ${today}. Here is this week's Great Lakes shipping data scraped from live sources. Write the Great Lakes Gazette weekly brief using ONLY facts present in this data. If a section has no data, acknowledge it honestly and move on.

${context}

Write the weekly brief now.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err.slice(0, 200)}`);
  }

  const result = await response.json();
  const brief = result.content[0].text;

  const issueNumber = getIssueNumber();
  const issueDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // Build source summary
  const activePorts = (data.aisPassages || []).filter(p => p.status === 'ok' && p.vessels.length > 0);
  const portReportUrls = (data.portReports || []).filter(p => p.url).map(p => ({ title: p.title, url: p.url, date: p.date }));

  return {
    brief,
    issueDate,
    issueNumber,
    sources: {
      aisPassages: activePorts.map(p => ({ port: p.port, count: p.vessels.length })),
      portReports: portReportUrls,
      newsItems: (data.shippingNews || []).filter(n => n.url).map(n => ({ title: n.title, url: n.url })),
    },
    data_summary: {
      ais_ports_with_data: activePorts.length,
      port_reports_found: (data.portReports || []).filter(p => p.text).length,
      news_items_found: (data.shippingNews || []).filter(n => n.text).length,
    },
    generated_at: new Date().toISOString(),
  };
}

function getIssueNumber() {
  const start = new Date('2026-03-16');
  const now = new Date();
  return Math.max(1, Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}
