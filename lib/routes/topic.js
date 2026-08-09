import { makeRedis, getDates, getIssues } from '../store.js';
import {
  SITE, AUTHOR, AUTHOR_URL, esc, stripDashes, longDate,
  headCommon, css, headerInterior, footerHtml, topicDirectoryHtml,
} from '../layout.js';
import {
  TOPICS, topicBySlug, topicsForIssue, topicUrl, issueExcerpt,
} from '../topics.js';

const PERSON_ID = `${AUTHOR_URL}/#person`;

export function collectTopicEditions(dates, issuesMap) {
  const collections = Object.fromEntries(TOPICS.map(topic => [topic.slug, []]));
  for (const date of dates) {
    const issue = issuesMap.get(date);
    if (!issue || !issue.brief) continue;
    const headline = stripDashes(String(issue.brief.headline || 'Daily Maritime Brief').trim());
    const entry = {
      date,
      headline,
      excerpt: stripDashes(issueExcerpt(issue)),
      issue,
    };
    for (const topic of topicsForIssue(issue)) collections[topic.slug].push(entry);
  }
  return collections;
}

function personSchema() {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: AUTHOR,
    url: AUTHOR_URL,
    sameAs: [
      'https://www.wikidata.org/wiki/Q138283432',
      'https://github.com/izworskic',
      'https://www.youtube.com/@izworskic',
    ],
  };
}

export function renderTopicIndex(collections) {
  const counts = Object.fromEntries(TOPICS.map(topic => [topic.slug, collections[topic.slug]?.length || 0]));
  const latestByTopic = Object.fromEntries(TOPICS.map(topic => [topic.slug, collections[topic.slug]?.[0] || null]));
  const latestMap = new Map();
  for (const items of Object.values(collections)) {
    for (const item of items) if (!latestMap.has(item.date)) latestMap.set(item.date, item);
  }
  const latest = [...latestMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/topics#webpage`,
        url: `${SITE}/topics`,
        name: 'Great Lakes Shipping Topics',
        description: 'Daily Great Lakes freighter, ship traffic, lake shipping, water level, and marine weather archives by Chris Izworski.',
        author: { '@id': PERSON_ID },
        isPartOf: { '@type': 'WebSite', name: 'Great Lakes Gazette', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: TOPICS.length,
          itemListElement: TOPICS.map((topic, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: topic.name,
            url: `${SITE}${topicUrl(topic)}`,
          })),
        },
      },
      personSchema(),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Shipping Topics', item: `${SITE}/topics` },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en"><head>
${headCommon()}
<title>Great Lakes Shipping Topics | Great Lakes Gazette</title>
<meta name="description" content="Browse daily Great Lakes freighter, Soo Locks, lake shipping, water level, and marine weather reports written by Chris Izworski.">
<meta name="author" content="${AUTHOR}">
<link rel="canonical" href="${SITE}/topics">
<meta property="og:type" content="website">
<meta property="og:title" content="Great Lakes Shipping Topics">
<meta property="og:description" content="Eight continuously updated archives for Great Lakes freighters, shipping, locks, water levels, and marine weather.">
<meta property="og:url" content="${SITE}/topics">
<meta property="og:site_name" content="Great Lakes Gazette">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(graph)}</script>
<style>${css()}</style>
</head><body>
${headerInterior('/topics')}
<main class="wrap">
  <div class="breadcrumb"><a href="/">Great Lakes Gazette</a> &rsaquo; Shipping Topics</div>
  <div class="kicker">The Latest from the Five Lakes</div>
  <h1 class="headline">Great Lakes Shipping News</h1>
  <section class="news-lead" aria-labelledby="latest-shipping-news">
    <h2 class="section-label" id="latest-shipping-news">Latest Editions</h2>
    ${latest.map(item => `<article class="r-item">
      <span class="r-date">${esc(longDate(item.date))}</span>
      <a class="r-head" href="/issue/${item.date}">${esc(item.headline)}</a>
      ${item.excerpt ? `<p class="edition-summary">${esc(item.excerpt)}</p>` : ''}
    </article>`).join('\n    ') || '<p class="intro">Today\'s shipping report is being assembled. Previous editions remain in the <a href="/archive">Gazette archive</a>.</p>'}
  </section>
  ${topicDirectoryHtml({ counts, latestByTopic, heading: 'Browse Shipping Beats' })}
</main>
${footerHtml()}
</body></html>`;
}

export function renderTopicPage(topic, items) {
  const canonical = `${SITE}${topicUrl(topic)}`;
  const latestDate = items[0]?.date;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: topic.title,
        description: topic.description,
        author: { '@id': PERSON_ID },
        about: topic.name,
        ...(latestDate ? { dateModified: latestDate } : {}),
        isPartOf: { '@type': 'WebSite', name: 'Great Lakes Gazette', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.headline,
            url: `${SITE}/issue/${item.date}`,
          })),
        },
      },
      personSchema(),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Shipping Topics', item: `${SITE}/topics` },
          { '@type': 'ListItem', position: 3, name: topic.name, item: canonical },
        ],
      },
    ],
  };

  const rows = items.map(item => `<article class="r-item">
    <span class="r-date">${esc(longDate(item.date))}</span>
    <a class="r-head" href="/issue/${item.date}">${esc(item.headline)}</a>
    ${item.excerpt ? `<p class="edition-summary">${esc(item.excerpt)}</p>` : ''}
  </article>`).join('\n  ');

  const topicLinks = TOPICS.filter(candidate => candidate.slug !== topic.slug)
    .map(candidate => `<a class="topic-pill" href="${topicUrl(candidate)}">${esc(candidate.name)}</a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
${headCommon()}
<title>${esc(topic.title)}</title>
<meta name="description" content="${esc(topic.description)}">
<meta name="author" content="${AUTHOR}">
${items.length ? '' : '<meta name="robots" content="noindex,follow">'}
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(topic.title)}">
<meta property="og:description" content="${esc(topic.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Great Lakes Gazette">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(graph)}</script>
<style>${css()}</style>
</head><body>
${headerInterior('/topics')}
<main class="wrap-narrow">
  <div class="breadcrumb"><a href="/">Great Lakes Gazette</a> &rsaquo; <a href="/topics">Shipping Topics</a> &rsaquo; ${esc(topic.name)}</div>
  <div class="kicker">Great Lakes Gazette &nbsp;&middot;&nbsp; <a href="/chris-izworski">${AUTHOR}</a></div>
  <h1 class="headline">${esc(topic.title)}</h1>
  <div class="byline">${items.length} Gazette edition${items.length === 1 ? '' : 's'} filed under ${esc(topic.name)}</div>
  <section class="news-lead" aria-labelledby="topic-editions">
    <h2 class="section-label" id="topic-editions">Latest Reports</h2>
    ${rows || '<p class="intro">No Gazette editions are filed under this beat yet.</p>'}
  </section>
  <div class="section-label" style="margin-top:34px">More Shipping Beats</div>
  <nav class="topic-pills" aria-label="More shipping topics">${topicLinks}</nav>
</main>
${footerHtml()}
</body></html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html><html lang="en"><head>${headCommon()}<title>Topic not found | Great Lakes Gazette</title><meta name="robots" content="noindex"><style>${css()}</style></head><body>${headerInterior('/topics')}<main class="wrap-narrow" style="padding-top:40px"><h1 class="headline">Topic not found</h1><p class="intro">Browse the <a href="/topics">Great Lakes shipping topics</a> or return to <a href="/">today's edition</a>.</p></main>${footerHtml()}</body></html>`;
}

export default async function handler(req, res) {
  const slug = typeof req.query?.slug === 'string' ? req.query.slug : '';
  const topic = slug ? topicBySlug(slug) : null;
  if (slug && !topic) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send(notFoundPage());
  }

  let dates = [];
  let issuesMap = new Map();
  try {
    const r = makeRedis();
    dates = await getDates(r);
    issuesMap = await getIssues(r, dates);
  } catch (error) {
    console.error('[topics]', error.message);
  }
  const collections = collectTopicEditions(dates, issuesMap);
  const html = topic
    ? renderTopicPage(topic, collections[topic.slug] || [])
    : renderTopicIndex(collections);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=21600');
  return res.status(200).send(html);
}
