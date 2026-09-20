// A separate, deterministic publication format. Rejected AI prose is never used.
import { formatPublicationDate, michiganDateKey, assertEditionDateIntegrity } from './dates.js';
import { assertPublishableIssue } from './source-health.js';

const text = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
function sourceDate(value) {
  const s = text(value);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const local = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s/);
  return local ? `${local[3]}-${local[1].padStart(2, '0')}-${local[2].padStart(2, '0')}` : '';
}
function recentDate(value, publicationDate) {
  const date = sourceDate(value);
  const age = Date.parse(publicationDate) - Date.parse(date);
  return Number.isFinite(age) && age >= 0 && age <= 86400000;
}
function recentInstant(value, now, hours) {
  const age = now.getTime() - Date.parse(value || '');
  return Number.isFinite(age) && age >= -300000 && age <= hours * 3600000;
}

export function buildSourceBulletin(data, { issueNumber = 0, publicationDate = michiganDateKey(), now = new Date(), reason = 'Narrative unavailable' } = {}) {
  if (michiganDateKey(now) !== publicationDate) throw new Error('Source bulletin must use the current Michigan date');
  const ports = (data.aisPassages || []).filter(p => p.status === 'ok' && recentInstant(p.fetched_at, now, 1));
  const water = (data.waterLevels || []).filter(w => w.status === 'ok' && Number.isFinite(w.level_ft) && w.stationId && recentDate(w.date, publicationDate));
  const weather = (data.marineWeather || []).filter(w => w.status === 'ok' && w.synopsis && recentInstant(w.issuanceTime, now, 36));
  if (ports.length < 5 || water.length < 3 || weather.length < 3) throw new Error('Fresh-source gate failed for source bulletin');

  const sections = [{ kicker: '', body: `This is the ${formatPublicationDate(publicationDate)} source bulletin. The narrative edition did not pass its checks. These dated observations are assembled directly from source fields. Vessel positions may have changed since the listed report time; ETAs are estimates, not confirmed arrivals or lock transits.` }];
  for (const port of ports) {
    const rows = (port.vessels || []).filter(v => text(v.name) && recentDate(v.timestamp, publicationDate))
      .sort((a, b) => sourceDate(b.timestamp).localeCompare(sourceDate(a.timestamp))).slice(0, 2);
    sections.push({ kicker: text(port.port), body: rows.length ? rows.map(v => [
      text(v.name), `Report: ${text(v.timestamp)} (source time)`,
      v.location ? `Reported location: ${text(v.location)}` : '',
      v.direction ? `Reported direction: ${text(v.direction)}` : '',
      v.eta ? `Estimated arrival: ${text(v.eta)} (source time; unconfirmed)` : '',
    ].filter(Boolean).join('. ') + '.').join('\n\n') : 'No dated vessel reports from today or yesterday were returned. This does not establish that the waterway is empty.' });
  }
  sections.push({ kicker: 'The Levels Ledger', body: water.map(w => `${text(w.city)}, ${text(w.lake)}: ${w.level_ft} ft above local Low Water Datum. NOAA station ${text(w.stationId)}; observed ${text(w.date)} local standard time.`).join('\n\n') + '\n\nStation levels do not establish channel depth, vessel clearance or cargo capacity.' });
  sections.push({ kicker: 'Weather on the Water', body: weather.map(w => `${text(w.lake)}, NWS issued ${text(w.issuanceTime)}. Source excerpt: ${text(w.synopsis)}${w.warning ? ` Warning: ${text(w.warning)}.` : ''}`).join('\n\n') });
  const brief = {
    headline: `${formatPublicationDate(publicationDate).replace(/, \d{4}$/, '')}: Great Lakes Vessel and Weather Bulletin`,
    deck: 'Dated vessel reports, NOAA station readings and NWS forecast excerpts, with source times and uncertainty preserved.',
    dateline: `Bay City, Mich., ${formatPublicationDate(publicationDate)}`,
    issueDate: formatPublicationDate(publicationDate), issueNumber, leadSubject: 'Source bulletin',
    sections, brief: sections.map(s => s.body).join('\n\n'), spotlight: '',
    tomorrow: 'Check the next dated vessel reports and updated NWS forecasts before making a trip.',
    sources: { aisPassages: ports.map(p => ({ port: p.port, count: (p.vessels || []).filter(v => recentDate(v.timestamp, publicationDate)).length })), portReports: [] },
    generated_at: now.toISOString(),
    editorial: { mode: 'source-bulletin', attempts: 0, reason, verifiedAt: now.toISOString() },
  };
  assertEditionDateIntegrity(brief, publicationDate);
  assertPublishableIssue({ brief, data, generated_at: now.toISOString() }, publicationDate);
  return brief;
}
