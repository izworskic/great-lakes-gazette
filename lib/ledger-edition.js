// Great Lakes Gazette fact-ledger edition.
//
// The publication path. Every sentence is a ledger fact's own text or a fixed
// template around ledger values, and verifyLedgerEdition() re-derives that from
// the stored facts before the edition may publish. JEV (lib/jev.js) may only
// choose which already-verified candidate leads; it never writes text.

import { formatPublicationDate, michiganDateKey, assertEditionDateIntegrity } from './dates.js';
import { assertPublishableIssue } from './source-health.js';
import { buildLedger, whenText } from './fact-ledger.js';
import { decideClosedSet } from './jev.js';

const HOME_PORT = /saginaw/i;
const LOCK_AND_STRAITS = /soo locks|straits of mackinac|port huron|st\. clair|detroit river/i;
const ESTIMATE_NOTE = 'That time is a BoatNerd estimate, not a confirmed arrival or lock transit.';
const POSITION_NOTE = 'Positions come from AIS reports relayed by BoatNerd and change as the ship moves.';
const LEVELS_NOTE = 'Each reading is one gauge above that lake\'s chart datum; it does not establish channel depth or vessel clearance.';

// ── Lead candidates (deterministic) ──────────────────────────────────────────
export function leadCandidates(ledger, { now, recentLeadSubjects = [] }) {
  const recent = recentLeadSubjects.map(s => String(s || '').toUpperCase()).filter(Boolean);
  const stale = name => recent.some(r => r.includes(String(name).toUpperCase()));
  const out = [];
  for (const w of ledger.weather.filter(f => f.kind === 'warning')) {
    out.push({ id: w.id, score: 100, fact: w, subject: `${w.lake} ${w.warningType}` });
  }
  for (const v of ledger.vessels) {
    const bonus = (HOME_PORT.test(v.port) ? 30 : 0) + (LOCK_AND_STRAITS.test(v.port) ? 10 : 0);
    const hoursOld = (now - v.reportedAt) / 3600000;
    let score = v.kind === 'vessel-estimate' ? 60 : (hoursOld <= 3 ? 40 : 20);
    score += bonus - Math.min(15, Math.round(hoursOld * 2));
    if (stale(v.vessel)) score -= 50;
    out.push({ id: v.id, score, fact: v, subject: v.vessel });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

async function chooseLead(candidates, ledger, { publicationDate, decide }) {
  if (!candidates.length) return { lead: null, decision: { mode: 'deterministic', choiceId: null, confidence: 0, reason: 'No lead candidates' } };
  const top = candidates.slice(0, 5);
  const options = Object.fromEntries(top.map(c => [c.id, { statement: c.fact.text, kind: c.fact.kind, place: c.fact.port || c.fact.lake }]));
  const decision = await decide({
    task: 'Choose which already-verified item should lead a Great Lakes shipping brief read by freighter watchers on shore this morning. Choose exactly one supplied id.',
    options,
    context: { publicationDate, homePort: 'Saginaw River and Saginaw Bay', timeLabel: ledger.timeLabel },
    constraints: [
      'Choose only a supplied id. You cannot add, merge or edit statements.',
      'A safety warning outranks routine traffic when one is supplied.',
      'Prefer an item a reader could still watch today over one that has already happened.',
      'BoatNerd times after "estimates" are estimates, not confirmed arrivals.',
    ],
    evidence: [{ source: 'BoatNerd AIS passages', available: ledger.vessels.length > 0 },
      { source: 'NWS open lakes forecasts', available: ledger.weather.length > 0 }],
    fallbackId: top[0].id,
  });
  const lead = top.find(c => c.id === decision.choiceId) || top[0];
  return { lead, decision: { ...decision, candidates: top.map(c => ({ id: c.id, score: c.score, subject: c.subject })) } };
}

// ── Templates ────────────────────────────────────────────────────────────────
function headlineFor(lead, ledger, publicationDate) {
  const f = lead.fact;
  if (f.kind === 'warning') return `NWS Posts ${f.warningType} for ${f.lake}`;
  if (f.kind === 'vessel-estimate') return `${f.vessel} Estimated at ${f.port} Around ${whenText(f.etaAt, publicationDate, ledger.timeLabel)}`;
  return `${f.vessel} Reported at ${f.location}`;
}

function leadBody(lead, ledger) {
  const f = lead.fact;
  const parts = [f.text];
  if (f.kind === 'vessel-estimate') parts.push(ESTIMATE_NOTE);
  else if (f.kind === 'vessel-report') parts.push(POSITION_NOTE);
  else if (f.kind === 'warning') {
    const synopsis = ledger.weather.find(w => w.kind === 'forecast' && w.lake === f.lake);
    if (synopsis) parts.push(synopsis.text);
  }
  // Each watch point returns one page of BoatNerd's passage list, so this is a
  // count of what was fetched, never a claim about total traffic.
  parts.push(`The latest BoatNerd passage lists for ${ledger.watchPoints.length} watch points held ${ledger.vessels.length} distinct ${ledger.vessels.length === 1 ? 'vessel' : 'vessels'} with reports from the last 24 hours.`);
  return parts.join(' ');
}

function watchPointsBody(ledger, usedIds, publicationDate) {
  const paras = [];
  for (const port of ledger.watchPoints) {
    const rows = ledger.vessels.filter(v => v.port === port && !usedIds.has(v.id)).slice(0, 3);
    rows.forEach(v => usedIds.add(v.id));
    paras.push(rows.length
      ? `${port}: ${rows.map(v => v.text).join(' ')}`
      : `${port}: no vessel reports from the last 24 hours were returned. That does not mean the waterway is empty.`);
  }
  return paras.join('\n\n');
}

function tomorrowFor(ledger, usedLeadId, now, publicationDate) {
  const next = ledger.vessels
    .filter(v => v.kind === 'vessel-estimate' && v.id !== usedLeadId && v.etaAt > now)
    .sort((a, b) => a.etaAt - b.etaAt)[0];
  if (next) return `Still ahead in BoatNerd's estimates: ${next.vessel} at ${next.watchPoint} around ${whenText(next.etaAt, publicationDate, ledger.timeLabel)}. ${ESTIMATE_NOTE}`;
  return 'The next edition will carry the next BoatNerd reports, NOAA gauge readings and NWS forecasts.';
}

// ── Assembly ─────────────────────────────────────────────────────────────────
export async function buildLedgerEdition(data, {
  issueNumber = 0,
  publicationDate = michiganDateKey(),
  now = new Date(),
  recentEditions = [],
  decide = decideClosedSet,
  log = [],
} = {}) {
  if (michiganDateKey(now) !== publicationDate) throw new Error('Edition must use the current Michigan date');
  const nowMs = now.getTime();
  const ledger = buildLedger(data, { now: nowMs, publicationDate });
  const forecasts = ledger.weather.filter(w => w.kind === 'forecast');
  if (ledger.watchPoints.length < 5 || ledger.levels.length < 3 || forecasts.length < 3) {
    throw new Error(`Fresh-source gate failed: ${ledger.watchPoints.length} watch points, ${ledger.levels.length} gauges, ${forecasts.length} forecasts`);
  }
  if (!ledger.aisClock.verified) log.push(`AIS clock unverified (${ledger.aisClock.reason}); times labeled as BoatNerd time`);

  const candidates = leadCandidates(ledger, { now: nowMs, recentLeadSubjects: recentEditions.slice(0, 4).map(e => e.leadSubject) });
  const { lead, decision } = await chooseLead(candidates, ledger, { publicationDate, decide });
  if (!lead) throw new Error('No verified lead candidate');
  log.push(`Lead chosen by ${decision.mode}: ${lead.subject} (${lead.id})${decision.reason ? `; ${decision.reason}` : ''}`);

  const used = new Set([lead.id]);
  const sections = [{ kicker: '', body: leadBody(lead, ledger) }];
  sections.push({ kicker: 'At the Watch Points', body: watchPointsBody(ledger, used, publicationDate) });
  sections.push({ kicker: 'The Levels Ledger', body: `${ledger.levels.map(l => l.text).join('\n\n')}\n\n${LEVELS_NOTE}` });
  sections.push({ kicker: 'Weather on the Water', body: forecasts.map(w => w.text).join('\n\n') });

  const issueDate = formatPublicationDate(publicationDate);
  const brief = {
    headline: headlineFor(lead, ledger, publicationDate),
    deck: `${ledger.vessels.length} vessels from BoatNerd's latest passage lists, ${ledger.levels.length} NOAA gauges and ${forecasts.length} NWS lake forecasts, each with its source time.`,
    dateline: `Bay City, Mich., ${issueDate}`,
    issueDate,
    issueNumber,
    leadSubject: lead.subject,
    sections,
    brief: sections.map(s => s.body).join('\n\n'),
    spotlight: '',
    tomorrow: tomorrowFor(ledger, lead.id, nowMs, publicationDate),
    sources: {
      aisPassages: ledger.watchPoints.map(port => ({ port, count: ledger.vessels.filter(v => v.port === port).length })),
      portReports: [],
    },
    ledger,
    generated_at: now.toISOString(),
    editorial: {
      mode: 'fact-ledger',
      lead: { id: lead.id, subject: lead.subject, chosenBy: decision.mode, confidence: decision.confidence, reason: decision.reason || null, candidates: decision.candidates },
      verifiedAt: now.toISOString(),
    },
  };
  verifyLedgerEdition(brief);
  assertEditionDateIntegrity(brief, publicationDate);
  assertPublishableIssue({ brief, data, generated_at: now.toISOString() }, publicationDate);
  return brief;
}

// ── Verification ─────────────────────────────────────────────────────────────
// Independent of assembly: every number, time and all-caps name printed in the
// edition must appear in the stored ledger, and every vessel sentence printed
// must be a ledger fact's exact text. A failure blocks publication.
export function verifyLedgerEdition(brief) {
  const ledger = brief?.ledger;
  if (!ledger) throw new Error('Edition has no fact ledger');
  const facts = [...ledger.vessels, ...ledger.levels, ...ledger.weather];
  const factText = facts.map(f => f.text).join('\n');
  const counts = [ledger.vessels.length, ledger.levels.length, ledger.watchPoints.length,
    ledger.weather.filter(w => w.kind === 'forecast').length].map(String);
  const allowedNumbers = new Set([...factText.matchAll(/\d+(?:[.:]\d+)?/g)].map(m => m[0]).concat(counts)
    .concat(String(brief.issueNumber), ...[...String(brief.issueDate).matchAll(/\d+/g)].map(m => m[0]), '24'));
  const reader = [brief.headline, brief.deck, brief.tomorrow, ...brief.sections.map(s => s.body)].join('\n');
  const problems = [];
  for (const m of reader.matchAll(/\d+(?:[.:]\d+)?/g)) {
    if (!allowedNumbers.has(m[0])) problems.push(`Number "${m[0]}" is not in the ledger`);
  }
  const names = new Set(ledger.vessels.map(v => v.vessel.toUpperCase()));
  const upperFacts = factText.toUpperCase();
  const LABELS = /^(NWS|NOAA|AIS|ET|A\.M\.|P\.M\.)$/;
  const known = part => LABELS.test(part) || upperFacts.includes(part.toUpperCase()) || [...names].some(n => n.includes(part));
  for (const m of reader.matchAll(/\b[A-Z][A-Z.'&]*(?:\s+[A-Z][A-Z.'&]*){1,4}\b/g)) {
    const phrase = m[0].trim();
    if (known(phrase)) continue;
    // Two all-caps names can meet across a sentence boundary ("SAULT STE MARIE.
    // DOROTHY ANN"); then each part must be in the ledger on its own.
    const parts = phrase.split(/\.\s+/).map(p => p.replace(/\.$/, '').trim()).filter(Boolean);
    if (parts.length < 2 || !parts.every(known)) problems.push(`Name "${phrase}" is not in the ledger`);
  }
  for (const v of ledger.vessels) {
    if (reader.includes(v.vessel) && !reader.includes(v.text)) problems.push(`${v.vessel} appears without its ledger sentence`);
  }
  if (/[\u2013\u2014!]/.test(reader)) problems.push('Dash or exclamation point in reader text');
  if (problems.length) throw new Error(`Fact-ledger verification failed: ${problems.slice(0, 6).join('; ')}`);
  return true;
}
