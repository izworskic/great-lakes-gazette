// One-off and on-demand: regenerate today's edition through the editorial
// loop, print the scoring, and overwrite the stored payload.
// Usage: node scripts/rework-today.mjs  (env vars must be set)

import { fetchAllData } from '../lib/scraper.js';
import { produceEdition } from '../lib/editor.js';
import { makeRedis, getDates, getIssues, getIssue, saveIssue, INDEX_KEY } from '../lib/store.js';
import { scoreEdition } from '../lib/editor.js';
import { updateWordPressPost } from '../lib/publisher.js';
import { writeFileSync } from 'node:fs';

const today = new Date().toISOString().slice(0, 10);
const log = [];

const r = makeRedis();
if (!r) { console.error('Redis env missing'); process.exit(1); }

console.log(`Reworking edition for ${today}`);
const data = await fetchAllData(log);

const already = await r.sismember(INDEX_KEY, today);
const count = await r.scard(INDEX_KEY);
const issueNumber = already ? count : count + 1;

const dates = (await getDates(r)).filter(d => d !== today).slice(0, 7);
const map = await getIssues(r, dates);
const recentEditions = dates.map(d => {
  const it = map.get(d);
  const b = it && it.brief ? it.brief : {};
  return { date: d, headline: b.headline || '', leadSubject: b.leadSubject || '', spotlight: b.spotlight || '' };
}).filter(e => e.headline);

// The edition being replaced counts as a recent edition, so its lead and
// spotlight vessel land on the banned list and cannot simply come back.
const existing = await getIssue(r, today);
const oldBrief = existing && existing.brief ? existing.brief : null;
if (oldBrief && oldBrief.headline) {
  recentEditions.unshift({
    date: `${today} (retracted draft)`,
    headline: oldBrief.headline,
    leadSubject: oldBrief.leadSubject || '',
    spotlight: oldBrief.spotlight || '',
  });
  console.log(`Retracted draft banned from leading again: "${oldBrief.headline}" [lead: ${oldBrief.leadSubject || '?'}]`);
}

console.log(`Issue ${issueNumber}. Recent editions in context: ${recentEditions.length}`);

if (oldBrief) {
  try {
    const base = await scoreEdition(oldBrief, { dataContext: '(baseline scoring: data context unavailable for the retracted draft; judge grounding on internal consistency only)', recentEditions: recentEditions.slice(1), bannedSubjects: [] });
    console.log(`BASELINE: retracted draft scores ${base.total}/100 (${Object.entries(base.scores).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  } catch (e) { console.log(`Baseline scoring skipped: ${e.message}`); }
}

const { brief, report, bannedSubjects } = await produceEdition({ data, issueNumber, recentEditions, log });

for (const l of log) console.log(l);
console.log(`\nBanned lead subjects were: ${bannedSubjects.join(', ') || 'none'}`);
console.log(`\nFINAL: ${report.total}/100 after ${brief.editorial.attempts} attempt(s)`);
for (const [k, v] of Object.entries(report.scores)) console.log(`  ${k}: ${v}`);
if (report.notes.length) console.log(`  notes: ${report.notes.join(' | ')}`);
console.log(`\nHEADLINE: ${brief.headline}`);
console.log(`DECK: ${brief.deck}`);
console.log(`LEAD SUBJECT: ${brief.leadSubject}`);
console.log(`SECTIONS: ${brief.sections.map(s => s.kicker || 'LEAD').join(' | ')}`);
console.log(`TOMORROW: ${brief.tomorrow}`);

const payload = { data, brief, generated_at: new Date().toISOString() };
await saveIssue(r, today, payload);
console.log(`\nSaved to Redis for ${today}`);

const wpPostId = process.env.GAZETTE_WP_POST_ID;
if (wpPostId) {
  try {
    const wp = await updateWordPressPost(wpPostId, brief);
    console.log(`WP draft ${wpPostId} updated in place: ${wp.title || brief.headline}`);
  } catch (e) {
    console.log(`WP draft update failed (non-fatal): ${e.message}`);
  }
} else {
  console.log('No GAZETTE_WP_POST_ID set; WP draft untouched.');
}
writeFileSync('/tmp/edition.json', JSON.stringify(brief, null, 2));
console.log('Edition JSON written to /tmp/edition.json');
