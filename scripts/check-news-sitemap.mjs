import assert from 'node:assert/strict';
import { renderNewsMetadata } from '../lib/news-sitemap.js';
import { HOME_GRAPH } from '../lib/schema-home.js';

const issue = { brief: { headline: 'Fleet & Port — Morning Report' } };
const today = '2026-07-18';

const current = renderNewsMetadata('2026-07-18', issue, today);
assert.match(current, /<news:publication_date>2026-07-18<\/news:publication_date>/);
assert.match(current, /<news:title>Fleet &amp; Port, Morning Report<\/news:title>/);

const yesterday = renderNewsMetadata('2026-07-17', issue, today);
assert.match(yesterday, /<news:news>/);

assert.equal(renderNewsMetadata('2026-07-16', issue, today), '');
assert.equal(renderNewsMetadata('2026-07-19', issue, today), '');
assert.equal(renderNewsMetadata('2026-07-18', null, today), '');

const dataset = HOME_GRAPH['@graph'].find(node => node['@type'] === 'Dataset');
assert.equal(dataset.distribution.contentUrl, 'https://gazette.chrisizworski.com/api/latest');
assert.ok(!JSON.stringify(HOME_GRAPH).includes('/api/generate'));

console.log('News sitemap checks passed.');
