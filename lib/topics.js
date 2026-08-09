export const TOPICS = [
  {
    slug: 'great-lakes-freighters',
    name: 'Great Lakes Freighters',
    title: 'Great Lakes Freighter News & Daily Ship Reports',
    description: 'Daily Great Lakes freighter news, vessel movements, port calls, and ship traffic reports from the Great Lakes Gazette archive.',
    intro: [
      'Follow Great Lakes freighters through a continuously updated record of daily vessel movements, port calls, cargo activity, and shipping conditions across the five lakes.',
      'Each report is drawn from the Great Lakes Gazette, Chris Izworski\'s daily maritime newspaper assembled from live AIS observations, port reports, NOAA water levels, and National Weather Service marine forecasts.',
    ],
    patterns: [
      /\bfreighters?\b/i, /\blakers?\b/i, /\bbulk carriers?\b/i,
      /\bore carriers?\b/i, /\bvessels?\b/i, /\bships?\b/i,
      /\btug(?:boat)?s?\b/i, /\bbarges?\b/i, /\bAIS\b/i,
    ],
  },
  {
    slug: 'soo-locks',
    name: 'Soo Locks',
    title: 'Soo Locks News: Daily Ship Traffic & Freighters',
    description: 'Latest Soo Locks news, freighter passages, and St. Marys River ship traffic reported in daily Great Lakes Gazette editions.',
    intro: [
      'Track Soo Locks news and the freighters moving between Lake Superior and the lower Great Lakes through the St. Marys River system.',
      'This archive automatically gathers Gazette editions that report activity at Sault Ste. Marie, the Soo Locks, Whitefish Bay, and the approaches used by upbound and downbound commercial traffic.',
    ],
    patterns: [
      /\bSoo Locks?\b/i, /\bSault Ste\.? Marie\b/i, /\bSt\.? Marys River\b/i,
      /\bSaint Marys River\b/i, /\bWhitefish (?:Bay|Point)\b/i, /\bGros Cap\b/i,
    ],
  },
  {
    slug: 'lake-superior-shipping',
    name: 'Lake Superior Shipping',
    title: 'Lake Superior Shipping News & Freighter Reports',
    description: 'Daily Lake Superior shipping news, freighter movements, port calls, marine weather, and cargo reports from the Great Lakes Gazette.',
    intro: [
      'Read the latest Lake Superior shipping reports, including vessel movements, cargo activity, weather, and port calls around the largest Great Lake.',
      'Relevant daily Gazette editions are collected here automatically when they cover Lake Superior or its commercial ports and approaches, including Duluth-Superior, Two Harbors, Marquette, and Thunder Bay.',
    ],
    patterns: [
      /\bLake Superior\b/i, /\bDuluth\b/i, /\bTwo Harbors\b/i,
      /\bSilver Bay\b/i, /\bThunder Bay\b/i, /\bMarquette\b/i,
      /\bPresque Isle Harbor\b/i, /\bKeweenaw\b/i,
    ],
  },
  {
    slug: 'lake-michigan-shipping',
    name: 'Lake Michigan Shipping',
    title: 'Lake Michigan Shipping News & Freighter Reports',
    description: 'Daily Lake Michigan shipping news, freighter movements, port calls, marine weather, and cargo reports from the Great Lakes Gazette.',
    intro: [
      'Follow Lake Michigan shipping through daily reports on freighter movements, port activity, cargoes, marine weather, and notable crossings.',
      'This living archive gathers Gazette editions about Lake Michigan and ports such as Chicago, Milwaukee, Green Bay, Manitowoc, Muskegon, and the industrial harbors at the lake\'s southern end.',
    ],
    patterns: [
      /\bLake Michigan\b/i, /\bChicago\b/i, /\bMilwaukee\b/i,
      /\bGreen Bay\b/i, /\bManitowoc\b/i, /\bMuskegon\b/i,
      /\bBurns Harbor\b/i, /\bIndiana Harbor\b/i, /\bSturgeon Bay\b/i,
    ],
  },
  {
    slug: 'lake-huron-shipping',
    name: 'Lake Huron Shipping',
    title: 'Lake Huron Shipping News & Freighter Reports',
    description: 'Daily Lake Huron shipping news, freighter movements, port calls, marine weather, and vessel reports from the Great Lakes Gazette.',
    intro: [
      'Follow Lake Huron vessels and port activity with daily coverage of freighter movements, cargo calls, marine weather, and the lake\'s connecting waterways.',
      'Gazette editions are added here automatically when they cover Lake Huron, Saginaw Bay, Port Huron, Alpena, the St. Clair River, or other important shipping locations in the region.',
    ],
    patterns: [
      /\bLake Huron\b/i, /\bSaginaw Bay\b/i, /\bSaginaw River\b/i,
      /\bPort Huron\b/i, /\bAlpena\b/i, /\bSt\.? Clair River\b/i,
      /\bBlue Water Bridge\b/i, /\bMackinac Bridge\b/i,
    ],
  },
  {
    slug: 'lake-erie-shipping',
    name: 'Lake Erie Shipping',
    title: 'Lake Erie Shipping News & Freighter Reports',
    description: 'Daily Lake Erie shipping news, freighter movements, port calls, marine weather, and cargo reports from the Great Lakes Gazette.',
    intro: [
      'Read current Lake Erie shipping reports covering freighter passages, port calls, cargo activity, weather, and movement through the western lake approaches.',
      'This page automatically collects Gazette editions about Lake Erie, the Detroit River, and commercial ports including Toledo, Cleveland, Sandusky, Ashtabula, and Conneaut.',
    ],
    patterns: [
      /\bLake Erie\b/i, /\bDetroit River\b/i, /\bToledo\b/i,
      /\bCleveland\b/i, /\bSandusky\b/i, /\bAshtabula\b/i,
      /\bConneaut\b/i, /\bLorain\b/i,
    ],
  },
  {
    slug: 'lake-ontario-shipping',
    name: 'Lake Ontario & Seaway Shipping',
    title: 'Lake Ontario Shipping News & Freighter Reports',
    description: 'Daily Lake Ontario and St. Lawrence Seaway shipping news, vessel movements, port calls, and reports from the Great Lakes Gazette.',
    intro: [
      'Follow Lake Ontario and St. Lawrence Seaway shipping with daily reports on vessels, locks, ports, weather, and the route connecting the Great Lakes to the Atlantic.',
      'Relevant Gazette editions appear here automatically when they cover Lake Ontario, the Seaway, the Welland Canal, or ports such as Hamilton, Toronto, Oswego, and Massena.',
    ],
    patterns: [
      /\bLake Ontario\b/i, /\bSt\.? Lawrence Seaway\b/i, /\bSaint Lawrence Seaway\b/i,
      /\bWelland Canal\b/i, /\bHamilton Harbour\b/i, /\bHamilton Harbor\b/i,
      /\bToronto\b/i, /\bOswego\b/i, /\bMassena\b/i,
    ],
  },
  {
    slug: 'water-levels-marine-weather',
    name: 'Water Levels & Marine Weather',
    title: 'Great Lakes Water Levels & Marine Weather News',
    description: 'Daily Great Lakes water levels, marine weather, wind, waves, and navigation conditions reported by the Great Lakes Gazette.',
    intro: [
      'Monitor the conditions that shape Great Lakes navigation through daily reporting on lake levels, winds, waves, marine forecasts, and weather hazards.',
      'The Gazette builds these reports from NOAA station readings and National Weather Service marine forecasts, then connects the conditions to the day\'s vessel and port activity.',
    ],
    includeRoutineConditions: true,
    patterns: [
      /\bwater levels?\b/i, /\bLevels Ledger\b/i, /\bmarine (?:weather|forecast|warning)\b/i,
      /\bWeather on (?:the )?Water\b/i, /\bsmall craft advisory\b/i,
      /\bgale warning\b/i, /\bwave heights?\b/i, /\bNOAA\b/i,
    ],
  },
];

export function topicBySlug(slug) {
  return TOPICS.find(topic => topic.slug === slug) || null;
}

export function issueSearchText(issue, { includeRoutineConditions = true } = {}) {
  const brief = issue && typeof issue.brief === 'object' ? issue.brief : {};
  const sourceSections = Array.isArray(brief.sections) ? brief.sections.filter(section => section?.body) : [];
  const sections = sourceSections
    .filter(section => includeRoutineConditions || !/levels ledger|water levels|weather on (?:the )?water|marine weather/i.test(section?.kicker || ''))
    .flatMap(section => [section?.kicker, section?.body]);
  return [
    brief.headline,
    brief.deck,
    brief.dateline,
    brief.leadSubject,
    includeRoutineConditions || !sourceSections.length ? brief.brief : null,
    brief.spotlight,
    brief.tomorrow,
    ...sections,
  ].filter(Boolean).join(' ');
}

export function topicsForIssue(issue) {
  const editorialText = issueSearchText(issue, { includeRoutineConditions: false });
  const fullText = issueSearchText(issue);
  return TOPICS.filter(topic => topic.patterns.some(pattern => pattern.test(
    topic.includeRoutineConditions ? fullText : editorialText
  )));
}

export function topicSlugsForIssue(issue) {
  return topicsForIssue(issue).map(topic => topic.slug);
}

export function topicUrl(topicOrSlug) {
  const slug = typeof topicOrSlug === 'string' ? topicOrSlug : topicOrSlug.slug;
  return `/topics/${slug}`;
}

export function issueExcerpt(issue, maxLength = 210) {
  const brief = issue && typeof issue.brief === 'object' ? issue.brief : {};
  const source = String(brief.deck || brief.brief || brief.dateline || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (source.length <= maxLength) return source;
  return source.slice(0, maxLength).replace(/\s+\S*$/, '').trim() + '...';
}
