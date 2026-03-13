// Calls Claude with strict grounding — only facts from the scraped data

function buildContext(data) {
  const lines = [];

  // AIS passage data
  lines.push('=== REAL-TIME AIS PASSAGE DATA (from BoatNerd AIS) ===');
  lines.push(`Fetched: ${data.fetched_at}`);
  for (const port of (data.passages || [])) {
    if (port.error || !port.vessels?.length) {
      lines.push(`\n${port.port}: [no data available]`);
      continue;
    }
    lines.push(`\n${port.port.toUpperCase()} — ${port.vessels.length} vessels:`);
    for (const v of port.vessels) {
      lines.push(`  - ${v.name} (${v.direction || 'direction unknown'})${v.timestamp ? ' at ' + v.timestamp : ''}`);
    }
  }

  // Port report narrative
  lines.push('\n\n=== BOATNERD WEEKLY PORT REPORT ===');
  if (data.portReport?.text) {
    lines.push(`Title: ${data.portReport.title}`);
    lines.push(`Source: ${data.portReport.url}`);
    lines.push(data.portReport.text);
  } else {
    lines.push('[Port report not available this week]');
  }

  // Seaway stats
  lines.push('\n\n=== US SEAWAY NEWS / STATS ===');
  if (data.seawayStats?.text) {
    lines.push(data.seawayStats.text);
  } else {
    lines.push('[Seaway stats not available]');
  }

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are the editor of the Great Lakes Gazette, a weekly shipping newsletter written for enthusiasts, maritime historians, and people who love watching freighters on the Great Lakes.

CRITICAL RULES — READ CAREFULLY:
1. You may ONLY write about vessels, ports, cargo, and events that appear in the provided data below.
2. Do NOT invent vessel names, cargo types, ports, companies, or dates that are not in the data.
3. If a vessel's cargo is not mentioned in the data, do not speculate — simply omit it or say "cargo not reported."
4. If data is thin or unavailable, write a shorter brief and say so. Do not pad with invented detail.
5. You may add nautical color, historical context about named vessels you recognize, and narrative style — but all facts must come from the data.

FORMAT:
- Lead paragraph: 2-3 sentences setting the scene for the week
- Port-by-port highlights: Soo Locks, Port Huron, Detroit River, Welland Canal (only ports with actual data)
- Notable movements: any interesting patterns, first-of-season, unusual cargo, etc.
- Closing line in your editorial voice
- Word count: 350-500 words

TONE: Warm, knowledgeable, like a longtime lake watcher writing for fellow enthusiasts. Bay City, Michigan perspective where natural.`;

export async function generateBrief(data) {
  const context = buildContext(data);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const userMessage = `Today is ${today}. Here is this week's real AIS passage data and port report content. Write the Great Lakes Gazette weekly brief using ONLY the facts present in this data.

${context}

Now write the weekly Gazette brief. Remember: only facts from the data above. If a section has no data, skip it gracefully.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const result = await response.json();
  const brief = result.content[0].text;
  const issueNumber = getIssueNumber();
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return {
    brief,
    issueDate,
    issueNumber,
    sources: {
      passages: (data.passages || []).map(p => ({ port: p.port, count: p.vessels?.length || 0, url: p.url })),
      portReport: data.portReport?.url,
      seaway: data.seawayStats?.url
    },
    generated_at: new Date().toISOString()
  };
}

// Simple week-number based issue counter
function getIssueNumber() {
  const start = new Date('2026-03-16'); // first Monday
  const now = new Date();
  const weeks = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, weeks);
}
