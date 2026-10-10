import { applyArchiveCorrections } from './corrections.js';
import { assertPublishableIssue } from './source-health.js';

// Public, dated JSON on the repository's gazette-data branch replaces the
// suspended Upstash database. GitHub Actions alone performs writes; web
// functions have READ access and stage a single authorized publication in RAM.
// This prevents every page request from consuming billable Redis bandwidth.
export const INDEX_KEY = 'gazette:index';
const KEY = (d) => `gazette:daily:${d}`;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const RAW_ROOT = 'https://raw.githubusercontent.com/izworskic/great-lakes-gazette/gazette-data/data';
const memory = new Map();

async function readJson(path, ttl = 120000) {
  const stored = memory.get(path);
  if (stored && Date.now() < stored.until) return stored.data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${RAW_ROOT}/${path}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.status === 404) {
      memory.set(path, { data: null, until: Date.now() + 30000 });
      return null;
    }
    if (!response.ok) throw new Error('GitHub archive HTTP ' + response.status);
    const data = await response.json();
    memory.set(path, { data, until: Date.now() + ttl });
    return data;
  } catch (error) {
    // Serve a previously verified snapshot during transient GitHub errors,
    // but do not invent an edition or assign today's date to yesterday's issue.
    if (stored) return stored.data;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class GitHubArchive {
  constructor() {
    this.kind = 'github';
    this.pending = new Map();
  }
  async get(key) {
    if (this.pending.has(key)) return this.pending.get(key);
    const match = /^gazette:daily:(\d{4}-\d{2}-\d{2})$/.exec(String(key));
    if (match) return readJson(`issues/${match[1]}.json`, 180000);
    if (key === INDEX_KEY) return this.smembers(key);
    return null;
  }
  async mget(...keys) {
    const results = [];
    // Keep fan-out small on Vercel Hobby; shared in-instance memoization reduces
    // duplicate fetches from home, topic, feed and archive visitors.
    for (let i = 0; i < keys.length; i += 8) {
      results.push(...await Promise.all(keys.slice(i, i + 8).map(key => this.get(key))));
    }
    return results;
  }
  async smembers(key) {
    if (key !== INDEX_KEY) return [];
    const index = await readJson('index.json', 120000);
    return Array.isArray(index?.dates) ? index.dates.filter(d => ISO.test(d)) : [];
  }
  async sismember(key, date) {
    return (await this.smembers(key)).includes(String(date)) ? 1 : 0;
  }
  async scard(key) { return (await this.smembers(key)).length; }
  async sadd(key, date) { return key === INDEX_KEY && ISO.test(date) ? 1 : 0; }
  async set(key, value, options = {}) {
    if (options.nx && this.pending.has(key)) return null;
    this.pending.set(key, value);
    return 'OK';
  }
  async eval(_script, keys) {
    this.pending.delete(keys[0]);
    return 1;
  }
}

// Use this same interface throughout all public Gazette routes.
export function makeRedis() { return new GitHubArchive(); }

export function parseIssue(raw, date) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return applyArchiveCorrections(JSON.parse(raw), date); } catch { return null; }
  }
  return applyArchiveCorrections(raw, date);
}

export async function getDates(r) {
  if (!r) return [];
  try {
    const members = await r.smembers(INDEX_KEY);
    return (members || []).filter(d => ISO.test(String(d))).sort((a,b) => b.localeCompare(a));
  } catch (error) {
    console.warn('[store] GitHub archive index unavailable:', error.message);
    return [];
  }
}

export async function getIssue(r, date) {
  if (!r || !ISO.test(String(date))) return null;
  try { return parseIssue(await r.get(KEY(date)), date); }
  catch (error) {
    console.warn('[store] issue unavailable:', date, error.message);
    return null;
  }
}

export async function getIssues(r, dates) {
  const map = new Map();
  if (!r || !dates?.length) return map;
  for (let i = 0; i < dates.length; i += 20) {
    const chunk = dates.slice(i,i+20);
    try {
      const results = await r.mget(...chunk.map(KEY));
      chunk.forEach((date, index) => {
        const issue = parseIssue(results[index], date);
        if (issue) map.set(date, issue);
      });
    } catch (error) {
      console.warn('[store] issue batch unavailable:', error.message);
    }
  }
  return map;
}

export async function saveIssue(r, date, payload) {
  assertPublishableIssue(payload, date);
  if (!r) return false;
  // Stage the issue for the authenticated GitHub Actions caller. Durable
  // persistence occurs ONLY when the runner commits to gazette-data.
  await r.set(KEY(date), JSON.stringify(payload));
  await r.sadd(INDEX_KEY,date);
  return true;
}

export async function addToIndex(r, date) {
  if (r) await r.sadd(INDEX_KEY, date);
}
