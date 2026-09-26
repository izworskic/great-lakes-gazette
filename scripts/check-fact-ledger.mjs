// Fact-ledger edition: every printed claim traces to a source field.
// Fixtures are copies of real BoatNerd rows and NOAA/NWS responses from 2026-09-26.
import assert from 'node:assert/strict';
import { buildLedger, parseBoatNerdTime, wholeSentences, verifyAisClock } from '../lib/fact-ledger.js';
import { buildLedgerEdition, verifyLedgerEdition, leadCandidates } from '../lib/ledger-edition.js';
import { decideClosedSet } from '../lib/jev.js';
import { publishingNote, aboutStrip } from '../lib/layout.js';

const now = new Date('2026-09-26T11:40:00Z'); // 7:40 a.m. EDT
const pub = '2026-09-26';
const port = (name, vessels) => ({ port: name, status: 'ok', fetched_at: now.toISOString(), vessels });
const row = (name, timestamp, location, watchPoint, eta, extra = {}) => ({ name, timestamp, location, watchPoint, eta, direction: 'Downbound', ...extra });

const data = {
  aisPassages: [
    port('Soo Locks', [row('FEDERAL YUKINA', '9-26-2026 04:24', 'Downbound Keweenaw', 'Soo Locks', '9-26-2026 16:12'),
      row('SHIRLEY ANN', '9-26-2026 07:02', 'Soo Locks', 'Soo Locks', '9-26-2026 07:12', { destination: 'SAULT STE MARIE' })]),
    // Real row: eta equals gps_time, so the feed has no forward estimate.
    port('Port Huron / St. Clair River', [row('AMERICAN CENTURY', '9-26-2026 04:00', 'Vantage Point / Port Huron', 'Vantage Point / Port Huron', '9-26-2026 04:00', { destination: 'CONNEAUT' })]),
    port('Detroit River', [row('AMERICAN CENTURY', '9-26-2026 06:08', 'Algonac', 'Dossin Museum / Detroit', '9-26-2026 08:58', { destination: 'CONNEAUT' }),
      row('Old Laker', '9-24-2026 06:00', 'Belle Isle', 'Dossin Museum / Detroit', '')]),
    port('Straits of Mackinac', [row('DIRK S. VANENKEVORT', '9-26-2026 03:49', 'Straits of Mackinac', 'Straits of Mackinac', '9-26-2026 03:49', { direction: 'Eastbound', destination: 'STONEPORT' })]),
    port('Duluth / Superior', [row('STEWART J CORT', '9-26-2026 01:09', 'Superior Entry', 'Duluth / Superior', '9-26-2026 01:09', { direction: 'Outbound' })]),
    port('Saginaw', []),
  ],
  waterLevels: [
    { status: 'ok', stationId: '9099018', stationName: 'Marquette C.G.', city: 'Marquette C.G.', lake: 'Lake Superior', level_ft: 0.951, valueText: '0.951', observedAt: '2026-09-26T11:24:00Z', preliminary: false },
    { status: 'ok', stationId: '9087031', stationName: 'Holland', city: 'Holland', lake: 'Lake Michigan', level_ft: 1.722, valueText: '1.722', observedAt: '2026-09-26T11:30:00Z', preliminary: true },
    { status: 'ok', stationId: '9075035', stationName: 'Essexville', city: 'Essexville', lake: 'Saginaw Bay, Lake Huron', level_ft: 1.962, valueText: '1.962', observedAt: '2026-09-26T11:30:00Z', preliminary: true },
    { status: 'ok', stationId: '9052030', stationName: 'Oswego', city: 'Oswego', lake: 'Lake Ontario', level_ft: 2.4, valueText: '2.4', observedAt: '2026-09-23T11:30:00Z' },
  ],
  marineWeather: ['Lake Superior', 'Lake Huron', 'Lake Erie'].map((lake, i) => ({ status: 'ok', lake, issuanceTime: '2026-09-26T08:01:00Z',
    synopsis: 'A broad area of 30.3 inch high pressure over the Great Lakes basin today shifts northeast. Sunday through Monday, the high weakens to 30.1 inches. This gradually weakens ridging over Lake Superior from 30.1 inche',
    warning: i === 0 ? 'GALE WARNING IN EFFECT' : null })),
};

// Time: BoatNerd wall clock is Eastern.
assert.equal(new Date(parseBoatNerdTime('9-26-2026 04:24')).toISOString(), '2026-09-26T08:24:00.000Z');
assert.equal(verifyAisClock(data.aisPassages, now.getTime()).verified, true);
assert.equal(verifyAisClock([port('X', [row('A B', '9-26-2026 01:00', 'x', 'x', '')])], now.getTime() + 8 * 3600000).verified, false,
  'Reports hours old everywhere at once must not be labeled ET');

// Whole sentences: decimals kept, a trailing fragment dropped, never cut mid-word.
const syn = wholeSentences(data.marineWeather[0].synopsis, 3);
assert.match(syn, /30\.3 inch high/);
assert.doesNotMatch(syn, /inche$/);
assert.ok(syn.endsWith('30.1 inches.'));

const ledger = buildLedger(data, { now: now.getTime(), publicationDate: pub });
const byName = n => ledger.vessels.find(v => v.vessel === n);
// A passage record (eta == report time) carries no estimate.
assert.equal(byName('DIRK S. VANENKEVORT').kind, 'vessel-report');
assert.doesNotMatch(byName('DIRK S. VANENKEVORT').text, /estimate/i);
assert.doesNotMatch(byName('STEWART J CORT').text, /estimate/i);
// A real forward ETA is printed as an estimate at the feed's own watch point.
assert.equal(byName('FEDERAL YUKINA').kind, 'vessel-estimate');
assert.match(byName('FEDERAL YUKINA').text, /BoatNerd estimates it at Soo Locks around 4:12 p\.m\. ET/);
// An ETA already in the past is not presented as still ahead.
assert.equal(byName('SHIRLEY ANN').kind, 'vessel-report');
// One row per ship, the newest report wins; the AIS destination field is kept.
assert.equal(ledger.vessels.filter(v => v.vessel === 'AMERICAN CENTURY').length, 1);
assert.match(byName('AMERICAN CENTURY').text, /reported at Algonac at 6:08 a\.m\. ET; BoatNerd estimates it at Dossin Museum \/ Detroit around 8:58 a\.m\. ET\. Its AIS destination field reads CONNEAUT\./);
// Stale reports are dropped.
assert.equal(byName('Old Laker'), undefined);
// NOAA station names and times, preliminary flag, stale reading dropped.
assert.match(ledger.levels[0].text, /^Marquette C\.G\. \(Lake Superior\), NOAA station 9099018: 0\.951 ft above Low Water Datum at 7:24 a\.m\. ET\.$/);
assert.match(ledger.levels[1].text, /preliminary data/);
assert.ok(!ledger.levels.some(l => l.station === 'Oswego'), 'A three-day-old gauge reading is not current');
assert.ok(ledger.weather.some(w => w.kind === 'warning' && w.warningType === 'Gale Warning'));
console.log('Fact ledger field semantics (passage vs estimate, NOAA names, whole sentences): PASS');

// Lead: a warning outranks traffic; JEV cannot pick outside the verified set.
const cands = leadCandidates(ledger, { now: now.getTime() });
assert.equal(cands[0].fact.kind, 'warning');
const ids = cands.map(c => c.id);
const fakeHarness = choice => async () => ({ ok: true, status: 200, json: async () => ({ result: { choice: { choice, confidence: 0.9 }, injection_dependency: 0.01 } }) });
const token = async () => ({ token: 't', source: 'test' });
const opts = Object.fromEntries(ids.slice(0, 3).map(id => [id, { statement: id }]));
assert.equal((await decideClosedSet({ task: 't', options: opts, fallbackId: ids[0], fetchImpl: fakeHarness(ids[1]), tokenImpl: token })).choiceId, ids[1]);
const outOfSet = await decideClosedSet({ task: 't', options: opts, fallbackId: ids[0], fetchImpl: fakeHarness('invented-id'), tokenImpl: token });
assert.equal(outOfSet.mode, 'deterministic'); assert.equal(outOfSet.choiceId, ids[0]);
const noAuth = await decideClosedSet({ task: 't', options: opts, fallbackId: ids[0], tokenImpl: async () => ({ token: '', error: 'none' }) });
assert.equal(noAuth.mode, 'deterministic'); assert.equal(noAuth.choiceId, ids[0]);
const injected = await decideClosedSet({ task: 't', options: opts, fallbackId: ids[0], tokenImpl: token,
  fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ result: { choice: { choice: ids[1], confidence: 0.9 }, injection_dependency: 0.8 } }) }) });
assert.equal(injected.choiceId, ids[0], 'An injection-dependent choice falls back');
console.log('JEV closed-set, auth and injection gates: PASS');

// Full edition, JEV choosing the second candidate.
const decide = async ({ options }) => ({ mode: 'jev', choiceId: Object.keys(options)[1], confidence: 0.8 });
const log = [];
const ed = await buildLedgerEdition(data, { now, publicationDate: pub, issueNumber: 145, decide, log });
assert.equal(ed.editorial.mode, 'fact-ledger');
assert.equal(ed.editorial.lead.chosenBy, 'jev');
assert.equal(ed.dateline, 'Bay City, Mich., September 26, 2026');
assert.match(ed.brief, /Saginaw: no vessel reports from the last 24 hours were returned\. That does not mean the waterway is empty\./);
assert.match(ed.brief, /latest BoatNerd passage lists for 6 watch points held 5 distinct vessels/);
assert.doesNotMatch(ed.brief, /Sault Ste\. Marie, Lake Superior|Chicago|Cleveland|Rochester/);
assert.doesNotMatch(ed.brief + ed.headline + ed.deck + ed.tomorrow, /[\u2013\u2014!]/);
for (const v of ledger.vessels) assert.equal((ed.brief.match(new RegExp(v.vessel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length <= 2, true);
assert.match(publishingNote(ed), /An AI model chose which verified item leads; it wrote none of the text/);
assert.match(publishingNote({ editorial: { mode: 'fact-ledger', lead: { chosenBy: 'deterministic' } } }), /chosen by fixed rules/);
assert.match(aboutStrip(), /only chooses which verified item leads/);
assert.match(aboutStrip(), /Earlier editions were AI-written/);
console.log('Fact-ledger edition assembly and disclosure: PASS');

// The verifier rejects anything not in the ledger.
const tamper = (mutate) => { const copy = structuredClone(ed); mutate(copy); return () => verifyLedgerEdition(copy); };
assert.throws(tamper(e => { e.sections[0].body += ' The ship carried 24,500 tons.'; }), /Number "24,500"|Number "24"|Number "500"/);
assert.throws(tamper(e => { e.sections[1].body += ' EDMUND FITZGERALD passed Whitefish Point.'; }), /Name "EDMUND FITZGERALD"/);
assert.throws(tamper(e => { e.headline = 'Busy Morning on the Lakes!'; }), /exclamation/);
assert.throws(tamper(e => {
  const s = e.sections.find(x => x.body.includes('at 6:08 a.m. ET'));
  assert.ok(s, 'fixture sentence must be present for the tamper test to mean anything');
  s.body = s.body.replace('at 6:08 a.m. ET', 'at 6:48 a.m. ET');
}), /Number "6:48"|without its ledger sentence/);
assert.throws(tamper(e => { delete e.ledger; }), /no fact ledger/);
console.log('Mechanical verifier rejects invented numbers, names and altered facts: PASS');

// Fresh-source gate still blocks a thin edition, and the date must be today.
await assert.rejects(buildLedgerEdition({ ...data, waterLevels: [] }, { now, publicationDate: pub, decide }), /Fresh-source gate failed/);
await assert.rejects(buildLedgerEdition(data, { now, publicationDate: '2026-09-25', decide }), /current Michigan date/);
console.log('Fresh-source and publication-date gates: PASS');
