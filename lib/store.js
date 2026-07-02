// Shared Redis access for the Gazette, built around the permanent date
// index at gazette:index (a Redis SET of YYYY-MM-DD strings). Every route
// that needs to enumerate issues reads the index instead of probing date
// windows, so the archive can never silently truncate again. Issue payloads
// themselves live at gazette:daily:{date} with no TTL.

import { Redis } from '@upstash/redis';

export const INDEX_KEY = 'gazette:index';
const KEY = (d) => `gazette:daily:${d}`;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function parseIssue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

// All issue dates, newest first. Falls back to a 120-day key probe if the
// index is somehow empty, so one missed SADD can never blank the site.
export async function getDates(r) {
  if (!r) return [];
  try {
    const members = await r.smembers(INDEX_KEY);
    const dates = (members || []).filter(d => ISO.test(String(d)));
    if (dates.length) return dates.sort((a, b) => b.localeCompare(a));
  } catch (e) { console.warn('[store] index read failed:', e.message); }
  try {
    const now = new Date();
    const candidates = [];
    for (let i = 0; i < 120; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      candidates.push(d.toISOString().slice(0, 10));
    }
    const results = await r.mget(...candidates.map(KEY));
    return candidates.filter((_, i) => results[i] !== null);
  } catch { return []; }
}

export async function getIssue(r, date) {
  if (!r || !ISO.test(String(date))) return null;
  try { return parseIssue(await r.get(KEY(date))); } catch { return null; }
}

// Batched mget for many dates. Returns Map(date -> parsed issue).
export async function getIssues(r, dates) {
  const map = new Map();
  if (!r || !dates || !dates.length) return map;
  for (let i = 0; i < dates.length; i += 100) {
    const chunk = dates.slice(i, i + 100);
    try {
      const results = await r.mget(...chunk.map(KEY));
      chunk.forEach((d, j) => {
        const it = parseIssue(results[j]);
        if (it) map.set(d, it);
      });
    } catch (e) { console.warn('[store] mget chunk failed:', e.message); }
  }
  return map;
}

export async function saveIssue(r, date, payload) {
  if (!r) return false;
  await r.set(KEY(date), JSON.stringify(payload)); // no TTL: issues persist forever
  try { await r.sadd(INDEX_KEY, date); } catch (e) { console.warn('[store] sadd failed:', e.message); }
  return true;
}

export async function addToIndex(r, date) {
  if (!r) return;
  try { await r.sadd(INDEX_KEY, date); } catch {}
}
