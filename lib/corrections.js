import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('./archive-corrections.json', import.meta.url), 'utf8'));

// Reviewed, exact-paragraph corrections. Redis originals and source snapshots
// stay intact; all public readers use this same corrected representation.
export function applyArchiveCorrections(issue, date) {
  if (!issue?.brief) return issue;
  const key = date || String(issue.generated_at || issue.brief.generated_at || '').slice(0, 10);
  const correction = manifest[key];
  if (!correction) return issue;
  let changed = false;
  function revise(value) {
    if (typeof value !== 'string') return value;
    let result = value.split('\n\n').map(paragraph => {
      const replacement = correction.paragraphs?.[createHash('sha256').update(paragraph).digest('hex')];
      if (replacement) changed = true;
      return replacement || paragraph;
    }).join('\n\n');
    for (const [before, after] of Object.entries(correction.text || {})) {
      if (result.includes(before)) { result = result.split(before).join(after); changed = true; }
    }
    return result;
  }
  const brief = { ...issue.brief };
  for (const field of ['brief', 'html', 'spotlight', 'tomorrow', 'headline', 'deck']) {
    if (field in brief) brief[field] = revise(brief[field]);
  }
  if (Array.isArray(brief.sections)) brief.sections = brief.sections.map(s => ({ ...s, body: revise(s.body) }));
  if (!changed) return issue;
  brief.correctionNote = correction.legacy ? 'Corrected September 17, 2026: the water-level paragraph was withdrawn because this imported legacy edition does not retain its underlying gauge snapshot. Its numerical readings and navigation implications are unverified.' : 'Corrected September 17, 2026: the water-level paragraph now reports the archived NOAA station observations and their limits. Unsupported navigation implications were withdrawn.' + (key === '2026-09-17' ? ' The vessel spotlight, report date and ETA wording were also corrected; the unsupported distance was removed.' : '');
  return { ...issue, brief, corrected_at: '2026-09-17T15:00:00Z' };
}
