import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessIssueHealth } from '../api/cron.js';
import { buildContext, isFreshSourceDate } from '../lib/generator.js';
import {
  assertEditionDateIntegrity,
  formatPublicationDate,
  michiganDateKey,
  validateEditionDateIntegrity,
} from '../lib/dates.js';
import { extractBoatNerdClientConfig as extractClientConfig } from '../lib/scraper.js';

const now = Date.parse('2026-08-03T12:00:00Z');
assert.equal(isFreshSourceDate('2026-08-01T12:01:00Z', now), true);
assert.equal(isFreshSourceDate('2026-08-01T11:59:00Z', now), false);
assert.equal(isFreshSourceDate('', now), false);

const data = {
  aisPassages: [],
  portReports: [
    { title: 'Port Report August 3', date: '2026-08-03T08:00:00Z', rawText: 'Fresh vessel arrived to load stone at the dock before sailing downbound this morning.' },
    { title: 'Port Report July 31', date: '2026-07-31T08:00:00Z', rawText: 'Stale vessel movement must not reach the writer even when this report is long enough.' },
  ],
  shippingNews: [
    { date: '2026-08-03T07:00:00Z', stories: [{ headline: 'Fresh freighter arrived', body: 'The vessel arrived at the port to load ore.' }] },
    { date: '2026-07-31T07:00:00Z', stories: [{ headline: 'Stale freighter arrived', body: 'The vessel arrived at the port to load ore.' }] },
  ],
};
const context = buildContext(data, now);
assert.match(context, /Fresh vessel arrived/);
assert.match(context, /Fresh freighter arrived/);
assert.doesNotMatch(context, /Stale vessel movement/);
assert.doesNotMatch(context, /Stale freighter arrived/);
assert.match(context, /AIS source is unavailable/);

assert.equal(michiganDateKey('2026-08-10T02:30:00Z'), '2026-08-09');
assert.equal(michiganDateKey('2026-08-10T04:30:00Z'), '2026-08-10');
assert.equal(formatPublicationDate('2026-08-09', { weekday: true }), 'Sunday, August 9, 2026');

const dateValidBrief = {
  headline: 'A current edition',
  deck: 'A grounded deck',
  dateline: 'Bay City, Mich., August 3, 2026',
  issueDate: 'August 3, 2026',
  sections: [{ kicker: '', body: 'The Friday, August 7, 2026 sailing remains on the calendar.' }],
  spotlight: '',
  tomorrow: 'Check the bay tomorrow.',
};
assert.deepEqual(validateEditionDateIntegrity(dateValidBrief, '2026-08-03'), []);
assert.equal(assertEditionDateIntegrity(dateValidBrief, '2026-08-03'), dateValidBrief);

const dateInvalidBrief = {
  ...dateValidBrief,
  sections: [{ kicker: '', body: 'The Thursday, August 7, 2026 sailing remains on the calendar.' }],
};
assert.match(validateEditionDateIntegrity(dateInvalidBrief, '2026-08-03').join(' '), /is Friday/);
assert.throws(() => assertEditionDateIntegrity(dateInvalidBrief, '2026-08-03'), /date integrity failed/i);
assert.match(
  validateEditionDateIntegrity({
    ...dateValidBrief,
    sections: [{ kicker: '', body: 'The Thursday, August 7 sailing remains on the calendar.' }],
  }, '2026-08-03').join(' '),
  /is Friday/,
);

const config = extractClientConfig(
  '<script type="module" src="/assets/index.abc123.js"></script>',
  'const API_BASE_URL="/api/v1",API_KEY="public-client-value";',
);
assert.equal(config.apiBaseUrl, 'https://ais.boatnerd.com/api/v1');
assert.equal(config.assetUrl, 'https://ais.boatnerd.com/assets/index.abc123.js');
assert.equal(config.apiKey, 'public-client-value');

const healthy = assessIssueHealth({
  generated_at: '2026-08-03T10:00:00Z',
  brief: dateValidBrief,
  data: {
    aisPassages: Array.from({ length: 5 }, () => ({ status: 'ok' })),
    waterLevels: Array.from({ length: 3 }, () => ({ status: 'ok', level_ft: 2.5 })),
    marineWeather: Array.from({ length: 3 }, () => ({ status: 'ok', synopsis: 'Current forecast' })),
  },
}, '2026-08-03');
assert.equal(healthy.healthy, true);
assert.equal(assessIssueHealth({ ...healthy, brief: {} }, '2026-08-03').healthy, false);
assert.equal(assessIssueHealth({
  generated_at: '2026-08-03T10:00:00Z',
  brief: dateInvalidBrief,
  data: {
    aisPassages: Array.from({ length: 5 }, () => ({ status: 'ok' })),
    waterLevels: Array.from({ length: 3 }, () => ({ status: 'ok', level_ft: 2.5 })),
    marineWeather: Array.from({ length: 3 }, () => ({ status: 'ok', synopsis: 'Current forecast' })),
  },
}, '2026-08-03').dateIntegrity, false);

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.equal(vercel.crons.find(item => item.path === '/api/cron')?.schedule, '0 9 * * *');

const workflow = readFileSync(new URL('../.github/workflows/daily-publish.yml', import.meta.url), 'utf8');
assert.match(workflow, /timezone:\s*['"]?America\/Detroit/);
assert.match(workflow, /verify-live-edition\.mjs/);
assert.match(workflow, /concurrency:/);

const verifier = readFileSync(new URL('./verify-live-edition.mjs', import.meta.url), 'utf8');
assert.match(verifier, /validateEditionDateIntegrity/);
assert.match(verifier, /michiganDateKey/);

const editor = readFileSync(new URL('../lib/editor.js', import.meta.url), 'utf8');
assert.match(editor, /deterministic date gate failed/);
assert.match(editor, /assertEditionDateIntegrity/);

console.log('Publishing reliability checks passed.');
