export const MICHIGAN_TIME_ZONE = 'America/Detroit';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_PATTERN = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const WEEKDAY_DATE = new RegExp(
  `\\b(${WEEKDAYS.join('|')})\\s*,?\\s+(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`,
  'gi',
);

function calendarParts(dateKey) {
  const match = String(dateKey || '').match(ISO_DATE);
  if (!match) throw new Error(`Invalid publication date: ${dateKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid publication date: ${dateKey}`);
  }
  return { year, month, day, date };
}

export function michiganDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date value: ${value}`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MICHIGAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatPublicationDate(dateKey, { weekday = false } = {}) {
  const { date } = calendarParts(dateKey);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    ...(weekday ? { weekday: 'long' } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function expectedWeekday(year, month, day) {
  const key = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const { date } = calendarParts(key);
  return WEEKDAYS[date.getUTCDay()];
}

function readerFacingText(edition) {
  const sections = Array.isArray(edition?.sections) ? edition.sections : [];
  return [
    edition?.headline,
    edition?.deck,
    edition?.dateline,
    edition?.spotlight,
    edition?.tomorrow,
    ...sections.flatMap(section => [section?.kicker, section?.body]),
  ].filter(Boolean).join('\n');
}

export function validateEditionDateIntegrity(edition, publicationDate = michiganDateKey()) {
  const { year: publicationYear } = calendarParts(publicationDate);
  const longDate = formatPublicationDate(publicationDate);
  const problems = [];

  const expectedDateline = `Bay City, Mich., ${longDate}`;
  if (edition?.dateline !== expectedDateline) {
    problems.push(`Dateline must be exactly "${expectedDateline}".`);
  }
  if (edition?.issueDate !== longDate) {
    problems.push(`issueDate must be exactly "${longDate}".`);
  }

  const text = readerFacingText(edition);
  for (const match of text.matchAll(WEEKDAY_DATE)) {
    const statedWeekday = WEEKDAYS.find(day => day.toLowerCase() === match[1].toLowerCase());
    const month = MONTHS.findIndex(name => name.slice(0, 3).toLowerCase() === match[2].slice(0, 3).toLowerCase()) + 1;
    const day = Number(match[3]);
    const year = match[4] ? Number(match[4]) : publicationYear;
    let actualWeekday;
    try {
      actualWeekday = expectedWeekday(year, month, day);
    } catch {
      problems.push(`Invalid calendar date in "${match[0]}".`);
      continue;
    }
    if (statedWeekday !== actualWeekday) {
      problems.push(`Weekday/date mismatch in "${match[0]}": ${MONTHS[month - 1]} ${day}, ${year} is ${actualWeekday}.`);
    }
  }

  return [...new Set(problems)];
}

export function assertEditionDateIntegrity(edition, publicationDate = michiganDateKey()) {
  const problems = validateEditionDateIntegrity(edition, publicationDate);
  if (problems.length) throw new Error(`Edition date integrity failed: ${problems.join(' ')}`);
  return edition;
}
