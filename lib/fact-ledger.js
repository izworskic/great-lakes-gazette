// Great Lakes Gazette fact ledger.
//
// Every statement the edition prints is rendered from one of these facts, and
// every fact is copied from a dated source field. Nothing here infers a cargo,
// a voyage, a distance, a depth or a cause. Field meanings were checked against
// the raw BoatNerd passages feed on 2026-09-26:
//   gps_time              the AIS position report (Eastern time; verified at runtime below)
//   location_name         where that report placed the ship
//   destination_port_name the BoatNerd WATCH POINT this list tracks, not the ship's destination
//   destination_eta       BoatNerd's estimate for reaching the watch point. When it equals
//                         gps_time the feed carries no forward estimate at all, only the report.
//   destination           the crew-entered AIS destination field

import { MICHIGAN_TIME_ZONE, michiganDateKey } from './dates.js';

const MONTH_ABBR = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const HOUR = 3600000;

const clean = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

// ── Time ─────────────────────────────────────────────────────────────────────
function zoneOffsetMs(instant, timeZone = MICHIGAN_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(instant));
  const get = type => Number(parts.find(p => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - instant;
}

// "9-26-2026 04:24" read as Eastern wall-clock time -> UTC epoch ms.
export function parseBoatNerdTime(value) {
  const m = clean(value).match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, mo, d, y, h, mi] = m.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let instant = wall - zoneOffsetMs(wall);
  instant = wall - zoneOffsetMs(instant);
  return Number.isFinite(instant) ? instant : null;
}

export function easternClock(instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MICHIGAN_TIME_ZONE, hourCycle: 'h23', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).formatToParts(new Date(instant));
  const get = type => Number(parts.find(p => p.type === type)?.value);
  const hour = get('hour'), minute = get('minute');
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    dateKey: michiganDateKey(new Date(instant)),
    time: `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a.m.' : 'p.m.'}`,
    monthDay: `${MONTH_ABBR[get('month') - 1]} ${get('day')}`,
  };
}

// "4:24 a.m. ET" on the publication date, otherwise "10:12 p.m. ET Sept. 25".
export function whenText(instant, publicationDate, label = 'ET') {
  const c = easternClock(instant);
  return c.dateKey === publicationDate ? `${c.time} ${label}` : `${c.time} ${label} ${c.monthDay}`;
}

// BoatNerd does not label its time zone. Treat gps_time as Eastern only when the
// newest report across every watch point reads as recent under that assumption;
// read as UTC the same reports would all be hours old at once.
export function verifyAisClock(ports, now) {
  let newest = null;
  for (const port of ports) for (const v of port.vessels || []) {
    const t = parseBoatNerdTime(v.timestamp);
    if (t != null && (newest == null || t > newest)) newest = t;
  }
  if (newest == null) return { verified: false, reason: 'No parseable AIS report times' };
  const ageMinutes = Math.round((now - newest) / 60000);
  const verified = ageMinutes >= -15 && ageMinutes <= 180;
  return { verified, newestAgeMinutes: ageMinutes, reason: verified ? null : `Newest report is ${ageMinutes} minutes old if read as Eastern time` };
}

// ── Vessels ──────────────────────────────────────────────────────────────────
const nameKey = name => clean(name).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const plausibleDestination = dest => /^[A-Za-z][A-Za-z .'&]{2,39}$/.test(clean(dest));

function vesselSentence(f, publicationDate, label) {
  const dir = f.direction ? `, ${f.direction.toLowerCase()},` : '';
  let s = `${f.vessel}${dir} was reported at ${f.location} at ${whenText(f.reportedAt, publicationDate, label)}`;
  if (f.kind === 'vessel-estimate') s += `; BoatNerd estimates it at ${f.watchPoint} around ${whenText(f.etaAt, publicationDate, label)}`;
  s += '.';
  if (f.aisDestination) s += ` Its AIS destination field reads ${f.aisDestination}.`;
  return s;
}

export function vesselFacts(aisPassages, { now, publicationDate }) {
  const ports = (aisPassages || []).filter(p => p?.status === 'ok');
  const clock = verifyAisClock(ports, now);
  const label = clock.verified ? 'ET' : 'BoatNerd time';
  const byVessel = new Map();
  for (const port of ports) {
    for (const v of port.vessels || []) {
      const vessel = clean(v.name);
      const location = clean(v.location);
      const reportedAt = parseBoatNerdTime(v.timestamp);
      if (!vessel || !location || reportedAt == null) continue;
      const age = now - reportedAt;
      if (age < -15 * 60000 || age > 24 * HOUR) continue;
      const etaAt = parseBoatNerdTime(v.eta);
      const watchPoint = clean(v.watchPoint);
      const hasEstimate = etaAt != null && watchPoint && etaAt - reportedAt > 5 * 60000 && etaAt > now;
      const dest = clean(v.destination);
      const fact = {
        kind: hasEstimate ? 'vessel-estimate' : 'vessel-report',
        port: clean(port.port),
        vessel,
        direction: clean(v.direction),
        location,
        reportedAt,
        reportedRaw: clean(v.timestamp),
        ...(hasEstimate ? { watchPoint, etaAt, etaRaw: clean(v.eta) } : {}),
        aisDestination: plausibleDestination(dest) && nameKey(dest) !== nameKey(location) && nameKey(dest) !== nameKey(watchPoint) ? dest.toUpperCase() : '',
        source: 'BoatNerd AIS passages',
      };
      // One row per ship across the edition: its newest report wins, and at equal
      // times a row that carries a forward estimate wins.
      const key = nameKey(vessel);
      const prior = byVessel.get(key);
      if (!prior || fact.reportedAt > prior.reportedAt ||
          (fact.reportedAt === prior.reportedAt && fact.kind === 'vessel-estimate' && prior.kind !== 'vessel-estimate')) {
        byVessel.set(key, fact);
      }
    }
  }
  const facts = [...byVessel.values()]
    .sort((a, b) => b.reportedAt - a.reportedAt)
    .map((f, i) => ({ ...f, id: `v${i + 1}`, text: vesselSentence(f, publicationDate, label) }));
  return { facts, clock, label, ports: ports.map(p => clean(p.port)) };
}

// ── Water levels ─────────────────────────────────────────────────────────────
export function levelFacts(waterLevels, { now, publicationDate }) {
  return (waterLevels || [])
    .filter(w => w?.status === 'ok' && Number.isFinite(w.level_ft) && clean(w.stationName) && clean(w.valueText))
    .map(w => ({ ...w, observed: Date.parse(w.observedAt) }))
    .filter(w => Number.isFinite(w.observed) && now - w.observed <= 36 * HOUR && now - w.observed >= -15 * 60000)
    .map((w, i) => ({
      id: `l${i + 1}`,
      kind: 'water-level',
      station: clean(w.stationName),
      stationId: clean(w.stationId),
      lake: clean(w.lake),
      value: clean(w.valueText),
      observedAt: w.observed,
      preliminary: Boolean(w.preliminary),
      source: 'NOAA CO-OPS',
      text: `${clean(w.stationName)} (${clean(w.lake)}), NOAA station ${clean(w.stationId)}: ${clean(w.valueText)} ft above Low Water Datum at ${whenText(w.observed, publicationDate)}${w.preliminary ? ', preliminary data' : ''}.`,
    }));
}

// ── Marine weather ───────────────────────────────────────────────────────────
// Whole sentences only. A cut mid-word ("30.1 inche") misstates the forecast.
// A period ends a sentence only before whitespace and a capital letter, or at the
// end of the text, so "30.3 inch high" stays in one piece. A trailing fragment
// with no closing period is dropped rather than printed.
export function wholeSentences(text, maxSentences = 2) {
  const sentences = [];
  const body = clean(text);
  let start = 0;
  for (const m of body.matchAll(/\.(?=\s+[A-Z]|\s*$)/g)) {
    sentences.push(body.slice(start, m.index + 1).trim());
    start = m.index + 1;
    if (sentences.length >= maxSentences) break;
  }
  return sentences.filter(Boolean).join(' ');
}

const WARNING_TYPES = [
  [/STORM WARNING/i, 'Storm Warning'],
  [/GALE WARNING/i, 'Gale Warning'],
  [/GALE WATCH/i, 'Gale Watch'],
  [/SPECIAL MARINE WARNING/i, 'Special Marine Warning'],
  [/SMALL CRAFT ADVISORY/i, 'Small Craft Advisory'],
];

export function weatherFacts(marineWeather, { now, publicationDate }) {
  const facts = [];
  for (const w of marineWeather || []) {
    if (w?.status !== 'ok') continue;
    const issued = Date.parse(w.issuanceTime || '');
    if (!Number.isFinite(issued) || now - issued > 36 * HOUR || now - issued < -15 * 60000) continue;
    const lake = clean(w.lake);
    const issuedText = whenText(issued, publicationDate);
    const synopsis = wholeSentences(w.synopsis);
    if (synopsis) facts.push({ kind: 'forecast', lake, issuedAt: issued, excerpt: synopsis, source: 'NWS open lakes forecast',
      text: `${lake}, NWS forecast issued ${issuedText}: "${synopsis}"` });
    const type = WARNING_TYPES.find(([rx]) => rx.test(w.warning || ''))?.[1];
    if (type) facts.push({ kind: 'warning', lake, issuedAt: issued, warningType: type, source: 'NWS open lakes forecast',
      text: `The NWS forecast for ${lake} issued ${issuedText} carries a ${type}.` });
  }
  return facts.map((f, i) => ({ ...f, id: `w${i + 1}` }));
}

export function buildLedger(data, { now = Date.now(), publicationDate = michiganDateKey(new Date(now)) } = {}) {
  const vessels = vesselFacts(data?.aisPassages, { now, publicationDate });
  return {
    publicationDate,
    builtAt: new Date(now).toISOString(),
    aisClock: vessels.clock,
    timeLabel: vessels.label,
    watchPoints: vessels.ports,
    vessels: vessels.facts,
    levels: levelFacts(data?.waterLevels, { now, publicationDate }),
    weather: weatherFacts(data?.marineWeather, { now, publicationDate }),
  };
}
