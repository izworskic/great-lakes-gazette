import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync('lib/layout.js', 'utf8');
const authorRoute = readFileSync('lib/routes/chris-izworski.js', 'utf8');
const profile = 'https://chrisizworski.com/chris-izworski/';
const person = 'https://chrisizworski.com/#person';

assert.ok(layout.includes(`export const AUTHOR_URL = '${profile}';`), 'Gazette AUTHOR_URL must resolve to canonical profile');
assert.ok(layout.includes('<link rel="author" href="${AUTHOR_URL}">'), 'Gazette shared head must emit rel=author');
assert.ok(authorRoute.includes(person), 'Gazette author archive must use canonical Person ID');
const topicRoute = readFileSync('lib/routes/topic.js', 'utf8');
const issueRoute = readFileSync('api/issue-page/[date].js', 'utf8');
assert.ok(topicRoute.includes(`const PERSON_ID = '${person}';`), 'topic routes must use canonical Person ID independently of profile URL');
assert.ok(issueRoute.includes(`'@id': '${person}'`), 'issue pages must use canonical Person ID independently of profile URL');
assert.ok(!issueRoute.includes('`${AUTHOR_URL}/#person`'), 'issue pages must not derive Person ID from profile URL');
assert.ok(!authorRoute.includes('https://gazette.chrisizworski.com/#person'), 'Gazette must not mint a local Person ID');

console.log('Gazette creator entity checks passed.');
