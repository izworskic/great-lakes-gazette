import assert from 'node:assert/strict';
import { assertEditorialReady, mechanicalChecks, scoreEdition } from '../lib/editor.js';
import { articleBodyHtml, aboutStrip, publishingNote, footerHtml } from '../lib/layout.js';

assert.match(aboutStrip(), /uses AI/);
assert.match(aboutStrip(), /Published by/);
assert.doesNotMatch(aboutStrip(), /nothing is invented|Written and edited by/);
assert.match(publishingNote(), /AI-generated briefing/);
assert.match(publishingNote(), /Report a correction/);
for (const path of ['privacy', 'terms', 'connect']) {
  assert.ok(footerHtml().includes('https://chrisizworski.com/' + path + '/'));
}

const rendered = articleBodyHtml({
  sections: [{ kicker: '', body: 'A sourced lead sentence.' }],
  tomorrow: 'If the front holds, check Lake Huron conditions Tuesday morning.',
});
assert.ok(rendered.includes("<b>Tomorrow's Watch</b> If the front holds"), 'Tomorrow\'s Watch must have a text boundary before its sentence');
assert.ok(!rendered.includes("Tomorrow's Watch</b>If"), 'Tomorrow\'s Watch must never concatenate with its sentence');

const placeholderDraft = {
  headline: 'Five Ships Move Through the Lakes Today',
  deck: 'A grounded test deck for the deterministic editorial gate.',
  dateline: 'Bay City, Mich., August 18, 2026',
  leadSubject: 'test subject',
  sections: [{ kicker: 'Weather on the Water', body: 'Lake Huron has 6-something in the forecast text.' }],
  brief: Array(330).fill('word').join(' '),
  spotlight: '',
  tomorrow: 'Check the sourced forecast tomorrow morning.',
};
const problems = mechanicalChecks(placeholderDraft);
assert.ok(problems.some(problem => problem.includes('placeholder wording')), 'placeholder language must fail deterministically');

const groundedDraft = {
  ...placeholderDraft,
  sections: [{ kicker: 'Weather on the Water', body: 'Lake Huron has a 1-foot wave reading in the supplied forecast.' }],
};
const groundedProblems = mechanicalChecks(groundedDraft);
assert.ok(!groundedProblems.some(problem => problem.includes('placeholder wording')), 'specific sourced language must pass the placeholder gate');

console.log('Editorial rendering integrity: PASS');

const acceptable = { total: 93, scores: { grounding: 14 }, mustFix: [] };
assert.doesNotThrow(() => assertEditorialReady(acceptable));
assert.throws(() => assertEditorialReady({ ...acceptable, total: 76 }));
assert.throws(() => assertEditorialReady({ ...acceptable, mustFix: ['Invented distance'] }));
assert.throws(() => assertEditorialReady({ ...acceptable, scores: { grounding: 8 } }));
assert.throws(() => assertEditorialReady({ total: 100, scores: { grounding: 15 } }));

// Reproduce the publishing outage: supporting evidence occurs after the old
// 9,000-character cutoff. Inspect the actual request sent to the critic.
const context = 'AIS observations\n'.repeat(700) + '\nELBEBORG at Cleveland; NOAA station reading 2.50 ft; NWS forecast.';
let criticRequest;
const client = { messages: { async create(request) {
  criticRequest = request;
  return { content: [{ text: JSON.stringify({
    scores: { novelty: 19, hook: 14, voice: 14, grounding: 15, returnMechanics: 14, structure: 9, style: 9 },
    mustFix: [], notes: [],
  }) }] };
} } };
await scoreEdition(groundedDraft, { dataContext: context, client });
assert.ok(context.indexOf('ELBEBORG') > 9000);
assert.ok(criticRequest.messages[0].content.includes(context), 'Critic must receive the complete, unchanged writer evidence');
await assert.rejects(scoreEdition(groundedDraft, { dataContext: '', client }), /without its source context/);
console.log('Complete writer/critic evidence parity: PASS');

const { renderHome } = await import('../lib/routes/home.js');
const staleHome = renderHome({ dates: ['2026-01-01'], issuesMap: new Map([['2026-01-01', {
  brief: { headline: 'An archived headline', brief: 'Archived body.', sections: [{ kicker: '', body: 'Archived body.' }] },
  data: { marineWeather: [{ lake: 'Huron', synopsis: 'An archived forecast.' }] },
}]]) });
assert.match(staleHome, /Today's edition is delayed/);
assert.match(staleHome, /NWS marine synopses from the Thursday, January 1, 2026 edition/);
assert.doesNotMatch(staleHome, /NWS marine synopses, this morning/);
assert.match(staleHome, /href="https:\/\/chrisizworski.com\/soo-locks\/"/);
console.log('Stale homepage disclosure: PASS');
