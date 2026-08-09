import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPICS, topicSlugsForIssue, topicUrl } from '../lib/topics.js';
import { collectTopicEditions, renderTopicIndex, renderTopicPage } from '../lib/routes/topic.js';
import {
  renderGoogleNewsSitemap, renderJsonFeed, renderRssFeed, renderStandardSitemap,
} from '../lib/routes/sitemap.js';
import { renderHome } from '../lib/routes/home.js';
import { buildIssuePage, issueSearchTitle } from '../api/issue-page/[date].js';
import { buildIndexNowUrls } from '../api/cron.js';
import { buildPage as buildAuthorPage } from '../lib/routes/chris-izworski.js';

const benchmark = JSON.parse(readFileSync(new URL('../benchmarks/gazette-growth.json', import.meta.url), 'utf8'));
const makeIssue = (headline, body) => ({
  generated_at: '2026-08-09T10:00:00Z',
  brief: {
    headline,
    deck: body.slice(0, 145),
    dateline: 'Bay City, Mich., August 9, 2026',
    leadSubject: headline,
    brief: body,
    sections: [{ kicker: '', body }],
    spotlight: 'A Great Lakes vessel remains under observation.',
  },
});

const broadIssue = makeIssue(
  'Soo Locks Freighters Connect All Five Great Lakes',
  'A freighter cleared the Soo Locks and St. Marys River after a Lake Superior call at Duluth. Reports also covered Lake Michigan at Manitowoc, Lake Huron at Port Huron and the Mackinac Bridge, Lake Erie at Toledo, and Lake Ontario through the St. Lawrence Seaway. The Levels Ledger carried Great Lakes water levels and a marine weather forecast from NOAA.',
);
const freighterIssue = makeIssue(
  'Manitowoc Freighter Turns for Lake Michigan',
  'A Great Lakes freighter departed Manitowoc on Lake Michigan after its port call.',
);
const oldIssue = makeIssue(
  'Port Huron Vessel Crosses Lake Huron',
  'A vessel passed Port Huron and entered Lake Huron near the Blue Water Bridge.',
);
const dates = ['2026-08-09', '2026-08-08', '2026-08-05'];
const issuesMap = new Map([
  [dates[0], broadIssue],
  [dates[1], freighterIssue],
  [dates[2], oldIssue],
]);

assert.equal(TOPICS.length, benchmark.launchGate.durableTopicHubs);
assert.equal(benchmark.launchGate.newsFirstTopicPages, true);
assert.equal(new Set(TOPICS.map(topic => topic.slug)).size, TOPICS.length);
assert.equal(new Set(TOPICS.map(topic => topic.title)).size, TOPICS.length);
assert.equal(new Set(TOPICS.map(topic => topic.description)).size, TOPICS.length);
for (const topic of TOPICS) {
  assert.ok(topic.title.length <= 60, `${topic.slug} title is longer than 60 characters`);
  assert.ok(topic.description.length >= 100 && topic.description.length <= 160,
    `${topic.slug} description must be 100-160 characters`);
}
assert.deepEqual(new Set(topicSlugsForIssue(broadIssue)), new Set(TOPICS.map(topic => topic.slug)));
const routineConditionsIssue = {
  brief: {
    headline: 'Toledo Freighter Clears the Detroit River',
    deck: 'A Lake Erie cargo movement led the morning report.',
    sections: [
      { kicker: '', body: 'A freighter cleared Toledo on Lake Erie and entered the Detroit River.' },
      { kicker: 'The Levels Ledger', body: 'Lake Superior, Lake Michigan, Lake Huron, Lake Erie, and Lake Ontario all reported routine water levels.' },
      { kicker: 'Weather on the Water', body: 'Marine weather forecasts covered all five lakes.' },
    ],
  },
};
const routineSlugs = topicSlugsForIssue(routineConditionsIssue);
assert.ok(routineSlugs.includes('lake-erie-shipping'));
assert.ok(routineSlugs.includes('water-levels-marine-weather'));
assert.ok(!routineSlugs.includes('lake-superior-shipping'));
assert.ok(!routineSlugs.includes('lake-michigan-shipping'));
assert.ok(!routineSlugs.includes('lake-huron-shipping'));
assert.ok(!routineSlugs.includes('lake-ontario-shipping'));

const collections = collectTopicEditions(dates, issuesMap);
const indexHtml = renderTopicIndex(collections);
assert.match(indexHtml, /<link rel="canonical" href="https:\/\/gazette\.chrisizworski\.com\/topics">/);
assert.match(indexHtml, /_vercel\/insights\/script\.js/);
assert.match(indexHtml, /window\.va=window\.va\|\|function/);
assert.match(indexHtml, /https:\/\/chrisizworski\.com\/#person/);
assert.match(indexHtml, /<h1 class="headline">Great Lakes Shipping News<\/h1>/);
assert.ok(indexHtml.indexOf(broadIssue.brief.headline) < indexHtml.indexOf('Browse Shipping Beats'));
assert.doesNotMatch(indexHtml, /Continuously Updated Maritime Archives|Filed Edition Links|New editions are filed automatically/);
for (const topic of TOPICS) assert.match(indexHtml, new RegExp(topicUrl(topic).replaceAll('/', '\\/')));

const soo = TOPICS.find(topic => topic.slug === 'soo-locks');
const topicHtml = renderTopicPage(soo, collections[soo.slug]);
assert.match(topicHtml, /<h1 class="headline">Soo Locks News/);
assert.match(topicHtml, /<link rel="canonical" href="https:\/\/gazette\.chrisizworski\.com\/topics\/soo-locks">/);
assert.match(topicHtml, /Soo Locks Freighters Connect All Five Great Lakes/);
assert.match(topicHtml, /<h2 class="section-label" id="topic-editions">Latest Reports<\/h2>/);
assert.doesNotMatch(topicHtml, /useful discovery paths|Updated with each daily Gazette/);
assert.doesNotMatch(topicHtml, /name="robots" content="noindex/);

const homeHtml = renderHome({ dates, issuesMap });
assert.match(homeHtml, /Browse Shipping Beats/);
assert.match(homeHtml, /\/topics\/soo-locks/);
assert.match(homeHtml, /_vercel\/insights\/script\.js/);
assert.ok(homeHtml.indexOf('<div class="brief dropcap">') < homeHtml.indexOf('Browse Shipping Beats'));

const issueHtml = buildIssuePage(dates[0], broadIssue, {
  prevDate: dates[1],
  nextDate: null,
  related: [{ date: dates[1], headline: freighterIssue.brief.headline }],
});
assert.match(issueHtml, /Topics in this edition/);
assert.match(issueHtml, /Related Great Lakes Shipping Editions/);
assert.match(issueHtml, /https:\/\/chrisizworski\.com\/#person/);
const issueTitle = issueHtml.match(/<title>([^<]+)<\/title>/)?.[1] || '';
const issueDescription = issueHtml.match(/<meta name="description" content="([^"]+)">/)?.[1] || '';
assert.ok(issueTitle.length <= 60);
assert.ok(issueDescription.length <= 160);
assert.ok(issueSearchTitle('A short report').endsWith('Great Lakes Gazette'));
assert.ok(issueSearchTitle('A very long Great Lakes maritime headline that needs to retain its useful search words before branding').length <= 60);

const authorHtml = buildAuthorPage([{ date: dates[0], headline: broadIssue.brief.headline }]);
assert.match(authorHtml, /<title>Chris Izworski \| Great Lakes Gazette Author<\/title>/);
assert.match(authorHtml, /https:\/\/chrisizworski\.com\/#person/);

const standard = renderStandardSitemap({ dates, issuesMap, today: dates[0] });
assert.doesNotMatch(standard, /xmlns:news/);
assert.match(standard, /<loc>https:\/\/gazette\.chrisizworski\.com\/topics<\/loc>/);
for (const topic of TOPICS) {
  assert.match(standard, new RegExp(`<loc>https:\\/\\/gazette\\.chrisizworski\\.com${topicUrl(topic).replaceAll('/', '\\/')}<\\/loc>`));
}

const news = renderGoogleNewsSitemap({ dates, issuesMap, today: dates[0] });
assert.match(news, /xmlns:news=/);
assert.match(news, /issue\/2026-08-09/);
assert.match(news, /issue\/2026-08-08/);
assert.doesNotMatch(news, /issue\/2026-08-05/);

const entries = dates.map(date => ({ date, issue: issuesMap.get(date) }));
const rss = renderRssFeed(entries, new Date('2026-08-09T12:00:00Z'));
assert.match(rss, /application\/feed\+json/);
assert.match(rss, /<category>Soo Locks<\/category>/);
assert.match(rss, /<content:encoded>/);
const jsonFeed = JSON.parse(renderJsonFeed(entries));
assert.equal(jsonFeed.version, 'https://jsonfeed.org/version/1.1');
assert.equal(jsonFeed.items.length, entries.length);
assert.ok(jsonFeed.items[0].tags.includes('Soo Locks'));

const indexNowUrls = buildIndexNowUrls(dates[0], broadIssue);
assert.ok(indexNowUrls.length > benchmark.baseline.indexNowUrlsPerEdition);
assert.ok(indexNowUrls.includes('https://gazette.chrisizworski.com/topics'));
for (const topic of TOPICS) {
  assert.ok(indexNowUrls.includes(`https://gazette.chrisizworski.com${topicUrl(topic)}`));
}

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrites = new Map(vercel.rewrites.map(rewrite => [rewrite.source, rewrite.destination]));
assert.equal(rewrites.get('/feed.json'), '/api/gateway?route=sitemap&format=json');
assert.equal(rewrites.get('/news-sitemap.xml'), '/api/gateway?route=sitemap&format=news');
assert.equal(rewrites.get('/topics/:slug'), '/api/gateway?route=topic&slug=:slug');
assert.equal(vercel.crons.length, 1);
assert.equal(benchmark.launchGate.additionalDailyAiCalls, 0);
assert.equal(benchmark.launchGate.additionalScheduledJobs, 0);

const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
assert.match(robots, /Sitemap: https:\/\/gazette\.chrisizworski\.com\/news-sitemap\.xml/);

console.log('Automated growth benchmark passed.');
