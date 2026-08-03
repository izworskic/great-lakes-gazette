const endpoint = process.argv[2] || 'https://gazette.chrisizworski.com/api/latest';
const today = new Date().toISOString().slice(0, 10);
const attempts = 20;

function inspect(payload) {
  const generatedAt = payload?.generated_at || payload?.brief?.generated_at || '';
  const ais = Array.isArray(payload?.data?.aisPassages) ? payload.data.aisPassages : [];
  const water = Array.isArray(payload?.data?.waterLevels) ? payload.data.waterLevels : [];
  const weather = Array.isArray(payload?.data?.marineWeather) ? payload.data.marineWeather : [];
  const result = {
    date: payload?.date || generatedAt.slice(0, 10),
    generatedAt,
    headline: payload?.brief?.headline || '',
    aisHealthyPorts: ais.filter(item => item?.status === 'ok').length,
    waterLevelStations: water.filter(item => item?.status === 'ok' && Number.isFinite(item?.level_ft)).length,
    marineForecasts: weather.filter(item => item?.status === 'ok' && item?.synopsis).length,
  };
  result.healthy = result.date === today && result.generatedAt.startsWith(today) && Boolean(result.headline) &&
    result.aisHealthyPorts >= 5 && result.waterLevelStations >= 3 && result.marineForecasts >= 3;
  return result;
}

let last = null;
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    const response = await fetch(`${endpoint}?verify=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    last = inspect(await response.json());
    console.log(`Verification ${attempt}/${attempts}: ${JSON.stringify(last)}`);
    if (last.healthy) process.exit(0);
  } catch (error) {
    last = { error: error.message };
    console.error(`Verification ${attempt}/${attempts}: ${error.message}`);
  }
  if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 15_000));
}

console.error(`Today's Gazette did not pass source-health verification: ${JSON.stringify(last)}`);
process.exit(1);
