import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseIssue } from '../lib/store.js';
import { publishingNote } from '../lib/layout.js';
const original = {
 generated_at: '2026-09-17T09:03:13Z', data: { waterLevels: [{ level_ft: 1.496 }] },
 brief: { headline: 'Original headline', spotlight: 'Joyce would clear Port Huron well before either of them.', sections: [] },
};
const copy = JSON.stringify(original);
const corrected = parseIssue(original, '2026-09-17');
assert.equal(JSON.stringify(original), copy, 'stored source must remain intact');
assert.match(corrected.brief.spotlight, /do not confirm passage order/);
assert.equal(corrected.brief.headline, original.brief.headline);
assert.equal(corrected.data, original.data);
assert.match(publishingNote(corrected.brief), /Correction:/);
assert.deepEqual(parseIssue(corrected, '2026-09-17'), corrected, 'correction must be idempotent');
assert.deepEqual(parseIssue(copy, '2026-09-18'), original, 'do not rewrite future editions');
const manifest = JSON.parse(readFileSync(new URL('../lib/archive-corrections.json', import.meta.url)));
assert.equal(Object.keys(manifest).length, 71);
for (const entry of Object.values(manifest)) for (const body of Object.values(entry.paragraphs || {})) {
 assert.match(body, /NOAA station/);
 assert.match(body, /local standard time/);
 assert.match(body, /not lake-wide averages or channel depths/);
}
console.log('Archive corrections: PASS (71 dated editions; exact paragraph matching, preserved source, idempotence)');
