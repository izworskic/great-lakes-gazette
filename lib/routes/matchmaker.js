// GET/POST /api/matchmaker (rewritten via vercel.json to the gateway)
// Server-side Anthropic proxy for the Heirloom Variety Matchmaker quiz.
// The browser cannot call Anthropic directly (no key), so this route holds the
// key server-side, checks the request origin, and rate-limits by IP so the
// public endpoint cannot be used as an open LLM credit drain. Reuses the
// ANTHROPIC_API_KEY and Upstash Redis already configured for the daily cron.

import Anthropic from '@anthropic-ai/sdk';
import { Redis } from '@upstash/redis';

const ALLOWED_HOSTS = ['gazette.chrisizworski.com', 'freighterviewfarms.com', 'localhost'];
const RATE_MAX = 15;      // requests per window, per IP
const RATE_WINDOW = 3600; // seconds

function makeRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

// Soft origin gate: blocks casual cross-site embedding. Requests with no Origin
// or Referer (same-origin fetch, non-browser) are allowed through to the rate
// limiter, which is the real backstop against volume abuse.
function originAllowed(req) {
  const src = req.headers.origin || req.headers.referer || '';
  if (!src) return true;
  try {
    const host = new URL(src).hostname;
    return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!originAllowed(req)) return res.status(403).json({ error: 'Forbidden origin' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Advisor not configured' });

  const r = makeRedis();
  if (r) {
    try {
      const key = `mm:rl:${clientIp(req)}`;
      const n = await r.incr(key);
      if (n === 1) await r.expire(key, RATE_WINDOW);
      if (n > RATE_MAX) {
        return res.status(429).json({ error: 'Too many requests. Please try again in a little while.' });
      }
    } catch (e) {
      console.warn('[matchmaker] rate limit skipped:', e.message);
    }
  }

  const { zone, sun, space, experience, goal } = req.body || {};
  const answers = [zone, sun, space, experience, goal];
  if (answers.some(a => typeof a !== 'string' || !a.trim())) {
    return res.status(400).json({ error: 'All five answers are required.' });
  }
  if (answers.some(a => a.length > 400)) {
    return res.status(400).json({ error: 'Answer too long.' });
  }

  const prompt = `You are an expert heirloom seed advisor for the Great Lakes region of the United States. A gardener has answered five questions:

1. Growing zone: ${zone}
2. Sun conditions: ${sun}
3. Garden space: ${space}
4. Experience level: ${experience}
5. Primary goal: ${goal}

Recommend exactly 3 heirloom varieties that are the strongest possible match for this specific combination of conditions. Respond ONLY with a valid JSON array, no text before or after, no markdown fences:

[
  {
    "name": "Full variety name",
    "type": "Tomato, Bean, Squash, Pepper, Cucumber, or similar",
    "why": "2 to 3 sentences explaining why this variety is ideal for this gardener's specific conditions and goals.",
    "seed_saving": "2 to 3 sentences of specific, accurate seed saving instructions for this variety: isolation distance, how to harvest seed, fermentation if needed, drying method, storage conditions."
  }
]

Rules you must follow:
- Only recommend real, historically documented heirloom varieties that actually exist.
- Match the zone, sun, space, and experience level carefully. Do not recommend vining plants for container growers, or difficult varieties for beginners.
- For seed saving goals, favor self-pollinating varieties that are easy to isolate, such as tomatoes, beans, and lettuce.
- For flavor goals, recommend varieties specifically celebrated for exceptional taste.
- Seed saving instructions must be botanically accurate and specific to the variety's pollination type.
- Vary the types. Do not recommend three tomatoes unless the gardener specifically indicated a preference for tomatoes.
- Do not use em dashes or en dashes anywhere in your response. Use commas, periods, or hyphens.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (msg.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    let varieties = null;
    try {
      varieties = JSON.parse(text);
    } catch {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) { try { varieties = JSON.parse(m[0]); } catch {} }
    }
    if (!Array.isArray(varieties) || varieties.length === 0) {
      return res.status(502).json({ error: 'The advisor returned an unexpected response. Please try again.' });
    }
    return res.status(200).json({ varieties });
  } catch (e) {
    console.error('[matchmaker]', e.message);
    return res.status(502).json({ error: 'Could not reach the seed advisor. Please try again in a moment.' });
  }
}
