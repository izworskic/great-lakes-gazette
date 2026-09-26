// Shared JEV harness client (closed-set decisions only).
//
// JEV never writes Gazette text and never supplies a fact. It may only pick one
// id from options the deterministic fact ledger already verified. Any failure,
// low confidence, or a choice outside the set returns the deterministic
// fallback, so an unreachable harness can change which verified item leads but
// can never block, corrupt or invent an edition.
// Same contract as lib/mackinac-island/harness.js in izworskic/chrisizworski-com.

const HARNESS_URL = process.env.HARNESS_URL ||
  'https://agentbase-registry-izworski-gmailcoms-projects.vercel.app/api/harness';
const TIMEOUT_MS = 6000;

function safe(value, max = 180) {
  return String(value == null ? '' : value)
    .replace(/[<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function harnessToken() {
  if (process.env.HARNESS_ACCESS_KEY) return { token: String(process.env.HARNESS_ACCESS_KEY), source: 'shared-key' };
  try {
    const mod = await import('@vercel/oidc');
    const token = await mod.getVercelOidcToken();
    if (token) return { token: String(token), source: 'vercel-oidc' };
  } catch (error) {
    return { token: '', source: 'none', error: safe(error?.message || error) };
  }
  return { token: '', source: 'none', error: 'Vercel OIDC token unavailable' };
}

export function judgeChoice(result, allowed, minConfidence) {
  const choice = result?.result?.choice || {};
  const id = choice.choice;
  const confidence = Number(choice.confidence) || 0;
  const injection = Number(result?.result?.injection_dependency);
  const valid = allowed.has(id) && confidence >= minConfidence &&
    !(Number.isFinite(injection) && injection >= 0.45);
  return { id, confidence, injection: Number.isFinite(injection) ? injection : null, valid, model: result?.result?.model || 'jev-latest' };
}

export async function decideClosedSet({
  task, options, context = {}, constraints = [], evidence = [],
  fallbackId = null, minConfidence = 0.55, fetchImpl = fetch, tokenImpl = harnessToken,
}) {
  const ids = Object.keys(options || {});
  const fallback = fallbackId ?? ids[0] ?? null;
  if (ids.length < 2) return { mode: 'deterministic', choiceId: fallback, confidence: 0, reason: 'Fewer than two verified candidates' };
  const auth = await tokenImpl();
  if (!auth.token) return { mode: 'deterministic', choiceId: fallback, confidence: 0, reason: `JEV auth unavailable: ${auth.error || 'no token'}` };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(HARNESS_URL, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ action: 'decide', task, options, context, constraints, evidence }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.result) throw new Error(`Harness HTTP ${res.status}`);
    const judged = judgeChoice(data, new Set(ids), minConfidence);
    if (!judged.valid) {
      return { mode: 'deterministic', choiceId: fallback, confidence: judged.confidence, reason: 'JEV output failed the closed-set confidence or injection gate', model: judged.model };
    }
    return { mode: 'jev', choiceId: judged.id, confidence: judged.confidence, reason: null, model: judged.model };
  } catch (error) {
    return { mode: 'deterministic', choiceId: fallback, confidence: 0, reason: `JEV unavailable: ${safe(error?.message || error)}` };
  } finally {
    clearTimeout(timer);
  }
}
