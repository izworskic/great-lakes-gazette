// Great Lakes Gazette - Editorial standards desk
// Scoring matrix + AI critic + generate/score/revise loop.
// Used by api/cron.js daily and by scripts/rework-today.mjs on demand.
// The matrix is the contract: the writer is prompted against it and the
// critic scores against it, so quality is enforced, not hoped for.

import Anthropic from '@anthropic-ai/sdk';
import { generateBrief, extractJson } from './generator.js';

export const SCORING_MATRIX = {
  novelty:         { weight: 20, desc: 'Lead subject and angle unused in the last 7 editions. Movements older than 48 hours are background, never presented as fresh news. No banned lead subject leads or is spotlighted.' },
  hook:            { weight: 15, desc: 'Headline is specific and pulls (a reader who saw yesterday still clicks). Deck adds a second reason to read. First sentence earns the second.' },
  voice:           { weight: 15, desc: 'Reads like one bay-side editor, not a wire service. Concrete nouns, plain Midwestern cadence, dry wit allowed. Zero AI filler phrasing.' },
  grounding:       { weight: 15, desc: 'Every factual claim traceable to the data context. History and seasonal color clearly framed as such. Nothing invented.' },
  returnMechanics: { weight: 15, desc: 'Recurring departments present and earning their kickers. Tomorrow\'s Watch is concrete and checkable. Natural continuity callback to a prior edition when one fits.' },
  structure:       { weight: 10, desc: 'Scannable: lead then departments, varied section lengths, 380 to 620 words total, nothing repeated between sections.' },
  style:           { weight: 10, desc: 'No em or en dashes, no exclamation points, no coffee references, no byline in body, dateline format correct, headline 6 to 10 words.' },
};

const ANTI_SLOP = [
  'shifts into high gear', 'reflects steady demand', 'robust', 'vibrant',
  'nestled', 'in the heart of', 'plays a vital role', 'underscores',
  'highlights the', 'continues to', 'testament to', 'bustling', 'delve',
];

export function mechanicalChecks(ed, bannedSubjects = []) {
  const mustFix = [];
  // Scan only reader-facing text, never the scraped data context.
  const all = [ed.headline, ed.deck, ed.dateline, ed.spotlight, ed.tomorrow,
    ...(ed.sections || []).flatMap(s => [s.kicker, s.body])].filter(Boolean).join('\n');
  if (/[\u2013\u2014]/.test(all)) mustFix.push('Contains an em or en dash. Absolute ban.');
  if (/!/.test((ed.headline || '') + (ed.deck || '') + (ed.brief || '') + (ed.tomorrow || ''))) {
    mustFix.push('Contains an exclamation point. Remove all of them.');
  }
  const hw = (ed.headline || '').trim().split(/\s+/).length;
  if (hw < 5 || hw > 11) mustFix.push(`Headline is ${hw} words; target 6 to 10.`);
  const lead = (ed.leadSubject || '').toLowerCase();
  for (const b of bannedSubjects) {
    if (b && lead.includes(b.toLowerCase())) {
      mustFix.push(`Lead subject "${ed.leadSubject}" is on the banned list (led a recent edition). Choose a different lead.`);
      break;
    }
  }
  const spot = (ed.spotlight || '').toLowerCase();
  for (const b of bannedSubjects) {
    if (b && spot.startsWith(('the ' + b).toLowerCase()) || (b && spot.startsWith(b.toLowerCase()))) {
      mustFix.push(`Spotlight repeats banned subject "${b}". Spotlight a different vessel or omit the spotlight.`);
      break;
    }
  }
  const lowered = all.toLowerCase();
  const slop = ANTI_SLOP.filter(p => lowered.includes(p));
  if (slop.length) mustFix.push(`AI filler phrasing present: ${slop.join('; ')}. Rewrite those passages in plain language.`);
  const words = String(ed.brief || '').split(/\s+/).filter(Boolean).length;
  if (words < 320) mustFix.push(`Body is ${words} words; too thin. Target 380 to 620.`);
  if (words > 700) mustFix.push(`Body is ${words} words; too long. Target 380 to 620.`);
  return mustFix;
}

const CRITIC_SYSTEM = `You are the standards editor of the Great Lakes Gazette, a daily maritime broadsheet for Great Lakes freighter watchers. You score a draft edition strictly against the scoring matrix. You are the reason readers come back tomorrow, so be hard: a 90 is publishable, a 95 is a good day, 100 does not exist.

Scoring rules:
- Verify NOVELTY against the RECENT EDITIONS list and the BANNED LEAD SUBJECTS list. If the lead subject or the lead angle repeats a recent edition, novelty scores 8 or lower out of 20. If a movement dated more than 48 hours before today is presented as the day's news, novelty scores 10 or lower.
- Verify GROUNDING by checking specific claims (vessels, cargos, ports, dates, levels, forecasts) against the DATA CONTEXT. Any claim you cannot trace costs points; an invented specific caps grounding at 5.
- VOICE: penalize wire-service monotone and AI filler. Reward concrete observation and restraint.
- RETURN MECHANICS: departments must earn their kickers; Tomorrow's Watch must name something a reader can actually check tomorrow.
- Respond with JSON only, no markdown fences, exactly:
{"scores":{"novelty":n,"hook":n,"voice":n,"grounding":n,"returnMechanics":n,"structure":n,"style":n},"mustFix":["..."],"notes":["..."]}
Each score is an integer from 0 to that category's weight (novelty 20, hook 15, voice 15, grounding 15, returnMechanics 15, structure 10, style 10). mustFix lists only blocking problems. notes lists the two or three highest-leverage improvements.`;

export async function scoreEdition(ed, { dataContext, recentEditions = [], bannedSubjects = [] }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const recentBlock = recentEditions.length
    ? recentEditions.map(e => `${e.date}: "${e.headline}" [lead: ${e.leadSubject || 'unknown'}]`).join('\n')
    : 'none on file';
  const user = `Today is ${new Date().toISOString().slice(0, 10)}.

=== RECENT EDITIONS (do not let the draft repeat these) ===
${recentBlock}

=== BANNED LEAD SUBJECTS ===
${bannedSubjects.join(', ') || 'none'}

=== DATA CONTEXT the writer was given ===
${(dataContext || '').slice(0, 9000)}

=== DRAFT EDITION ===
${JSON.stringify({ headline: ed.headline, deck: ed.deck, dateline: ed.dateline, leadSubject: ed.leadSubject, sections: ed.sections, spotlight: ed.spotlight, tomorrow: ed.tomorrow }, null, 1)}

Score it against the matrix. Respond with the JSON object only: your first character must be an opening brace.`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 900,
    system: CRITIC_SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  let parsed;
  try {
    parsed = extractJson(res.content[0].text.replace(/```json|```/g, '').trim());
  } catch {
    parsed = { scores: {}, mustFix: ['Critic response unparseable; treat as failing.'], notes: [] };
  }
  const scores = {};
  for (const [k, v] of Object.entries(SCORING_MATRIX)) {
    scores[k] = Math.max(0, Math.min(v.weight, Number(parsed.scores?.[k]) || 0));
  }
  const mustFix = [...(parsed.mustFix || []), ...mechanicalChecks(ed, bannedSubjects)];
  if (mustFix.some(m => /dash|exclamation/i.test(m))) scores.style = Math.min(scores.style, 3);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { total, scores, mustFix, notes: parsed.notes || [] };
}

export function deriveBanned(recentEditions, lastN = 4) {
  const banned = new Set();
  for (const e of recentEditions.slice(0, lastN)) {
    if (e.leadSubject) banned.add(e.leadSubject);
    const m = String(e.spotlight || '').match(/^(?:The\s+)?([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+)?)/);
    if (m) banned.add(m[1]);
  }
  return [...banned].filter(s => s && s.length > 2);
}

// The loop. Generate, score, revise on the critique, keep the best.
export async function produceEdition({ data, issueNumber, recentEditions, log = [] }) {
  const bannedSubjects = deriveBanned(recentEditions);
  const stamp = () => new Date().toISOString().slice(11, 19);
  let best = null, critique = null, priorDraft = null;
  const MAX_ATTEMPTS = 4, SHIP_AT = 90;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ed = await generateBrief(data, { issueNumber, recentEditions, bannedSubjects, critique, priorDraft });
    const report = await scoreEdition(ed, { dataContext: ed._context, recentEditions, bannedSubjects });
    log.push(`[${stamp()}] Editorial loop attempt ${attempt}: ${report.total}/100 (${Object.entries(report.scores).map(([k, v]) => `${k} ${v}`).join(', ')})`);
    if (report.mustFix.length) log.push(`[${stamp()}]   mustFix: ${report.mustFix.join(' | ').slice(0, 300)}`);
    if (!best || report.total > best.report.total) best = { ed, report, attempt };
    if (report.total >= SHIP_AT && report.mustFix.length === 0) break;
    critique = report;
    priorDraft = ed;
  }

  const { ed, report, attempt } = best;
  delete ed._context;
  ed.editorial = { score: report.total, breakdown: report.scores, attempts: attempt, scoredAt: new Date().toISOString() };
  return { brief: ed, report, bannedSubjects };
}
