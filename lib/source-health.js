import { michiganDateKey, validateEditionDateIntegrity } from './dates.js';

export function assessIssueHealth(payload, date = michiganDateKey()) {
  const data = payload?.data || {};
  const generatedAt = payload?.generated_at || payload?.brief?.generated_at || '';
  const ais = Array.isArray(data.aisPassages) ? data.aisPassages : [];
  const water = Array.isArray(data.waterLevels) ? data.waterLevels : [];
  const weather = Array.isArray(data.marineWeather) ? data.marineWeather : [];
  const dateProblems = validateEditionDateIntegrity(payload?.brief, date);
  let generatedToday = false;
  try {
    generatedToday = Boolean(generatedAt) && michiganDateKey(generatedAt) === date;
  } catch {}
  const details = {
    date,
    generatedAt,
    hasHeadline: Boolean(payload?.brief?.headline),
    generatedToday,
    dateIntegrity: dateProblems.length === 0,
    dateProblems,
    aisHealthyPorts: ais.filter(item => item?.status === 'ok').length,
    waterLevelStations: water.filter(item => item?.status === 'ok' && Number.isFinite(item?.level_ft)).length,
    marineForecasts: weather.filter(item => item?.status === 'ok' && item?.synopsis).length,
  };
  return {
    healthy: details.hasHeadline && details.generatedToday && details.dateIntegrity && details.aisHealthyPorts >= 5 &&
      details.waterLevelStations >= 3 && details.marineForecasts >= 3,
    ...details,
  };
}

export function assertPublishableIssue(payload, date) {
  const health = assessIssueHealth(payload, date);
  if (!health.healthy) throw new Error('Source-health gate failed; edition was not published: ' + JSON.stringify(health));
  return health;
}
