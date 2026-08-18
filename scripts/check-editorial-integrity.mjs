import assert from 'node:assert/strict';
import { mechanicalChecks } from '../lib/editor.js';
import { articleBodyHtml } from '../lib/layout.js';

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
