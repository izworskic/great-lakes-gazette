// Great Lakes Gazette - AI Brief Generator
// Uses @anthropic-ai/sdk for automatic retries on transient failures
// Writer model: claude-sonnet-4-6 (critic in lib/editor.js uses the same)

import Anthropic from '@anthropic-ai/sdk';

// Vessel/maritime keywords - only content matching these gets sent to the AI
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
      lines.push(`\n${port.port.toUpperCase()}: ${port.vessels.length} vessel(s):`);
      for (const v of port.vessels) {
        const dir   = v.direction   ? ` [${v.direction}]`   : '';
        const dest  = v.destination ? ` → ${v.destination}` : '';
        const cargo = v.cargo       ? ` | Cargo: ${v.cargo}` : '';
        lines.push(`  • ${v.name}${dir}${dest}${cargo}`);
      }
    }
  }
  if (!anyData) lines.push('\nAIS offline: navigation season not yet open. Do NOT invent vessel positions.');
  return lines.join('\n');
}

function formatPortReports(portReports) {
  const lines = ['=== PORT REPORTS ==='];
  for (const r of portReports) {
    if (!/^port report/i.test(r.title)) continue;
    const text = r.rawText || r.text || '';
    if (!text || text.length < 60) continue;
    lines.push(`\n--- ${r.title} (${(r.date||'').slice(0,10)}) ---`);
    lines.push(text.slice(0, 4000));
  }
  return lines.join('\n');
}

function formatVesselNews(shippingNews) {
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
  const good = waterLevels.filter(w => w.status === 'ok' && w.level_ft !== null);
  if (!good.length) return '';
  const lines = ['=== GREAT LAKES WATER LEVELS (NOAA) ==='];
  for (const w of good) {
    lines.push(`${w.lake}: ${w.level_ft.toFixed(2)} ft above Low Water Datum (${w.city})`);
  }
  return lines.join('\n');
}

function formatMarineWeather(marineWeather) {
  if (!marineWeather?.length) return '';
  const good = marineWeather.filter(z => z.status === 'ok' && z.synopsis);
  if (!good.length) return '';
  const lines = ['=== NWS MARINE FORECASTS ==='];
  for (const z of good) {
    lines.push(`\n${z.lake.toUpperCase()}:`);
    if (z.warning) lines.push(`  ⚠ WARNING: ${z.warning}`);
    if (z.synopsis) lines.push(`  ${z.synopsis.slice(0, 200)}`);
    if (z.wind) lines.push(`  Wind: ${z.wind}`);
    if (z.waveHeight) lines.push(`  Waves: ${z.waveHeight}`);
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
    formatAISSection(data.aisPassages     || []),
    formatPortReports(data.portReports    || []),
    formatVesselNews(data.shippingNews    || []),
    formatWaterLevels(data.waterLevels    || []),
    formatMarineWeather(data.marineWeather || []),
    formatGreatLakesNow(data.greatLakesNow),
    formatHistory(data.todayInHistory     || []),
  ].filter(s => s.trim() && s.split('\n').length > 1).join('\n\n');
}

const SYSTEM_PROMPT = `You are the writing desk of the Great Lakes Gazette, a daily maritime broadsheet edited by Chris Izworski and written from a bay-facing property on Saginaw Bay in Bay City, Michigan, where the editor can watch the boats he writes about. The readers are freighter watchers, port-town locals, and lake obsessives who check the Gazette with morning coffee habits of their own. Your one job: make tomorrow's visit irresistible while never inventing a fact.

VOICE
Plain Midwestern newspaperman with a watcher's eye. Concrete nouns, short declaratives, dry wit in small doses. You know the boats by name and the docks by their cargo. You notice what a reader on shore would notice: which stack is inbound, what the bay is doing, whether the coal dock is busy. Never wire-service monotone. Banned filler: "shifts into high gear", "reflects steady demand", "robust", "vibrant", "nestled", "plays a vital role", "underscores", "testament to", "bustling", "continues to".

HARD RULES, never break these:
1. Facts come ONLY from the DATA CONTEXT. Never invent vessel names, cargo, ports, routes, positions, levels, or dates.
2. FRESHNESS: every data item carries a date. A movement more than 48 hours old is background context, never the lead and never framed as today's news. If all vessel data is stale, lead with what IS current: water levels, marine weather, or the history item, and say plainly that the lakes are quiet.
3. NOVELTY: the user message lists RECENT EDITIONS and BANNED LEAD SUBJECTS. Never lead with, headline, or spotlight a banned subject. If a banned vessel appears in genuinely NEW data doing something new, it may take one sentence inside Harbor Notes, nothing more. Do not reuse a recent edition's angle even on a new subject.
4. CONTINUITY: when natural, one light callback to a recent edition ("the Laud we tracked Thursday") rewards daily readers. One, not several.
5. Never write about BoatNerd as a company, site, or organization. It is a data source only.
6. No em dashes, no en dashes, anywhere, including the dateline. Use commas, colons, semicolons, periods. No exclamation points. No coffee references. Do not put the author's name in the body; the byline is rendered by the template.
7. Sparse *asterisk emphasis* is allowed and renders as italics.
8. If data is thin, write shorter and say what a watcher would actually see. Never pad.
9. GROUNDING DISCIPLINE: quote numbers exactly as given (3.97 feet stays 3.97, never "about four"). Never chain two movements into one narrative unless the data explicitly links them; port reports list many similar vessel names (Joyce L. VanEnkevort is not Dirk S. VanEnkevort) and mixing legs is the cardinal sin here. When unsure which vessel did what, drop the claim entirely rather than guess.
10. Every Harbor Notes item must contain a vessel, a port, or a water fact. An environmental story with no lakes or shipping angle goes to Looking Astern or gets cut.
11. "Arrived to load X" means the loading is planned, not completed: write "arrived to load", never "loaded". Report each port call as its own fact; never stitch a vessel's appearances in different reports into a voyage narrative. The spotlight covers one vessel at one call.
12. LEAD SELECTION: the lead is the one thing true today that was not true yesterday. Check RECENT EDITIONS: if they already said ports were busy, busy ports are not a lead. First calls, fleet geometry (two sisters working opposite ends of a lake the same day), reversals, and records beat any generic bustle frame.
13. TOMORROW'S WATCH takes no hedging: no "may", "might", "possibly", "worth noting". Either a flat checkable claim, or the form "if A holds, expect B at C by D".

STRUCTURE: departments readers learn by name. Choose 3 to 5 by data richness, in this order:
- Lead story, no kicker: 120 to 180 words on the single most current, most watchable thing in the data. Specificity is the hook.
- "Harbor Notes": 2 to 4 telegraphic items, one or two sentences each, from data not used in the lead.
- "The Levels Ledger": what the NOAA levels mean for loads, drafts, beaches, 40 to 80 words. Only when levels are in the data.
- "Weather on the Water": the marine forecast a deck-chair watcher cares about, 40 to 80 words. Only when forecasts are in the data.
- "Looking Astern": the history item or an environmental story as a closing note, 50 to 90 words, clearly framed as history or context.
- One optional wildcard department is allowed when the data offers a standout human or unusual item; give it a specific kicker. Core kickers stay exactly as named above so readers can find their habits.
Total body 380 to 620 words. No fact appears in two sections.

TOMORROW'S WATCH: one sentence, concrete and checkable, telling the reader exactly what to look for tomorrow (a vessel due somewhere, a forecast turning, a level report landing). Never vague, never "stay tuned".

HEADLINE: 6 to 10 words, specific enough to date-stamp the day, curious enough to click twice. DECK: one line, 12 to 20 words, a second reason to read that the headline did not give away.

OUTPUT: a single JSON object, no markdown fences, no commentary, exactly these keys:
{"headline":"...","deck":"...","dateline":"Bay City, Mich., Month D, YYYY","leadSubject":"primary vessel or topic in 2 to 4 words","sections":[{"kicker":"","body":"..."},{"kicker":"Harbor Notes","body":"..."}],"spotlight":"2 sentences on one vessel from the data, or empty string","tomorrow":"..."}
The lead section's kicker is an empty string. Section bodies may contain \\n\\n between paragraphs.`;

function formatRecentEditions(recentEditions) {
  if (!recentEditions?.length) return 'none on file';
  return recentEditions.map(e => `${e.date}: "${e.headline}" [lead subject: ${e.leadSubject || 'unknown'}]`).join('\n');
}

function scrub(s) {
  return String(s == null ? '' : s)
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\u2013/g, '-')
    .replace(/!+/g, '.')
    .trim();
}


// Balanced-brace JSON extraction: tolerate any stray prose around the object.
export function extractJson(raw) {
  for (let i = raw.indexOf('{'); i !== -1; i = raw.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, escp = false;
    for (let j = i; j < raw.length; j++) {
      const ch = raw[j];
      if (inStr) {
        if (escp) escp = false;
        else if (ch === '\\') escp = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(raw.slice(i, j + 1)); } catch { break; }
        }
      }
    }
  }
  throw new Error('no parseable JSON object in output');
}

export async function generateBrief(data, opts = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const { issueNumber, recentEditions = [], bannedSubjects = [], critique = null, priorDraft = null } = opts;

  const client  = new Anthropic({ apiKey });
  const context = buildContext(data);
  const today   = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let userMessage = `Today is ${today}.

=== RECENT EDITIONS (novelty check yourself against these) ===
${formatRecentEditions(recentEditions)}

=== BANNED LEAD SUBJECTS (led a recent edition; may appear only as one Harbor Notes sentence, and only on new information) ===
${bannedSubjects.join(', ') || 'none'}

=== DATA CONTEXT ===
${context}

Write today's Great Lakes Gazette edition. Respond with the JSON object only: your first character must be an opening brace.`;

  if (critique && priorDraft) {
    userMessage += `

=== EDITOR'S CRITIQUE OF YOUR PREVIOUS DRAFT (score ${critique.total}/100) ===
Must fix: ${critique.mustFix.join(' | ') || 'none'}
Notes: ${critique.notes.join(' | ') || 'none'}
Weakest categories: ${Object.entries(critique.scores).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')}

=== YOUR PREVIOUS DRAFT ===
${JSON.stringify({ headline: priorDraft.headline, deck: priorDraft.deck, leadSubject: priorDraft.leadSubject, sections: priorDraft.sections, spotlight: priorDraft.spotlight, tomorrow: priorDraft.tomorrow })}

Rewrite the edition. Address every item under Must fix one by one; where a claim cannot be verified against the data, delete the claim instead of adjusting it. Raise the weakest categories and keep what the critique did not fault.`;
  }

  const result = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2400,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userMessage }],
  });

  const raw = result.content[0].text.replace(/```json|```/g, '').trim();
  let parsed = {};
  try {
    parsed = extractJson(raw);
  } catch (e) {
    throw new Error(`Writer returned unparseable JSON: ${e.message}: ${raw.slice(0, 200)}`);
  }

  const sections = (Array.isArray(parsed.sections) ? parsed.sections : [])
    .map(s => ({ kicker: scrub(s.kicker), body: scrub(s.body) }))
    .filter(s => s.body);

  const briefText = sections.map(s => s.body).join('\n\n');
  const activePorts    = (data.aisPassages || []).filter(p => p.status === 'ok' && p.vessels.length > 0);
  const portReportUrls = (data.portReports || []).filter(p => p.url && /^port report/i.test(p.title))
                                                 .map(p => ({ title: p.title, url: p.url, date: p.date }));

  return {
    headline:    scrub(parsed.headline) || 'Great Lakes Dispatch',
    deck:        scrub(parsed.deck),
    dateline:    scrub(parsed.dateline) || `Bay City, Mich., ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    leadSubject: scrub(parsed.leadSubject),
    sections,
    brief:       briefText,
    spotlight:   scrub(parsed.spotlight) === 'none' ? '' : scrub(parsed.spotlight),
    tomorrow:    scrub(parsed.tomorrow),
    issueDate:   new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    issueNumber: issueNumber || 0,
    sources: {
      aisPassages: activePorts.map(p => ({ port: p.port, count: p.vessels.length })),
      portReports: portReportUrls,
    },
    generated_at: new Date().toISOString(),
    _context: context,
  };
}
