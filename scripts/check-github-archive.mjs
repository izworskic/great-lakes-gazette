import assert from 'node:assert/strict';
import { makeRedis, getDates, getIssue } from '../lib/store.js';

const originalFetch = globalThis.fetch;
const requests = [];
const day = '2026-10-10';
globalThis.fetch = async url => {
  requests.push(String(url));
  if (String(url).endsWith('/index.json')) return {
    ok:true, status:200, json:async () => ({dates:[day]})
  };
  if (String(url).endsWith('/issues/' + day + '.json')) return {
    ok:true,status:200,json:async () => ({brief:{headline:'Verified maritime ledger', brief:'Source-backed daily note'},data:{},generated_at:day+'T12:00:00Z'})
  };
  return {ok:false,status:404};
};

try {
  const r = makeRedis();
  assert.equal(r.kind,'github');
  assert.deepEqual(await getDates(r),[day]);
  assert.equal((await getIssue(r,day)).brief.headline,'Verified maritime ledger');
  assert.equal((await r.scard('gazette:index')),1);
  assert.equal((await r.sismember('gazette:index',day)),1);
  assert.equal(await getIssue(r,'2026-10-09'),null);
  const reads = requests.length;
  assert.equal((await getIssue(r,day)).brief.headline,'Verified maritime ledger');
  assert.equal(requests.length,reads,'In-function memoization must avoid another network GET');
  assert(requests.every(x=>x.startsWith('https://raw.githubusercontent.com/izworskic/great-lakes-gazette/gazette-data/data/')));
  console.log('GitHub Gazette archive read-only smoke: passed.');
} finally {
  globalThis.fetch=originalFetch;
}
