#!/usr/bin/env node
/**
 * Sonda rate limit / Cloudflare na API components/search.
 * Uso: node tools/easyeda-lib-sync/probe-rate-limit.mjs [--burst N] [--sustained N]
 */
const SEARCH_URL = 'https://easyeda.com/api/components/search';
const VERSION = '6.5.61';

function bodyFor(wd, page = 1) {
  const p = new URLSearchParams({
    type: '3',
    returnListStyle: 'classifyarr',
    wd,
    version: VERSION,
    page: String(page),
    limit: '100',
  });
  p.append('doctype[]', '2');
  return p.toString();
}

const headers = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  Origin: 'https://easyeda.com',
  Referer: 'https://easyeda.com/editor',
  'User-Agent': 'easyeda-analysis-probe/1.0',
};

async function oneRequest(label, wd = 'a', page = 1) {
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(SEARCH_URL, { method: 'POST', headers, body: bodyFor(wd, page) });
  } catch (e) {
    return { label, ok: false, error: e.message, ms: Math.round(performance.now() - t0) };
  }
  const ms = Math.round(performance.now() - t0);
  const ct = res.headers.get('content-type') ?? '';
  const text = await res.text();
  const cfRay = res.headers.get('cf-ray');
  const cfMitigated = res.headers.get('cf-mitigated');
  const retryAfter = res.headers.get('retry-after');
  const rl = [
    'retry-after',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'ratelimit-limit',
    'ratelimit-remaining',
  ]
    .map((h) => (res.headers.get(h) ? `${h}: ${res.headers.get(h)}` : null))
    .filter(Boolean);

  let json = null;
  let apiCode = null;
  let success = null;
  let message = null;
  let isHtml = ct.includes('text/html') || text.trimStart().startsWith('<!');

  if (!isHtml) {
    try {
      json = JSON.parse(text);
      success = json.success;
      apiCode = json.code;
      message = json.message ?? json.code;
    } catch {
      message = text.slice(0, 120);
    }
  } else {
    message = text.includes('challenge') || text.includes('cf-chl') ? 'HTML challenge' : 'HTML body';
  }

  return {
    label,
    status: res.status,
    ok: res.ok && success !== false && !isHtml,
    ms,
    ct: ct.split(';')[0],
    cfRay,
    cfMitigated,
    retryAfter,
    rl,
    success,
    apiCode,
    message: typeof message === 'string' ? message.slice(0, 80) : message,
    isHtml,
    bodyLen: text.length,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const out = { burst: 30, sustained: 0, delay: 0 };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--burst') out.burst = Number(process.argv[++i]);
    else if (process.argv[i] === '--sustained') out.sustained = Number(process.argv[++i]);
    else if (process.argv[i] === '--delay') out.delay = Number(process.argv[++i]);
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  console.log('=== EasyEDA API probe (components/search) ===\n');

  const baseline = await oneRequest('baseline');
  console.log('Baseline:', JSON.stringify(baseline, null, 2));

  console.log(`\n--- Burst paralelo: ${opts.burst} pedidos ---`);
  const burst = await Promise.all(
    Array.from({ length: opts.burst }, (_, i) => oneRequest(`burst-${i + 1}`, 'a', (i % 5) + 1)),
  );
  const byStatus = {};
  for (const r of burst) {
    const k = `${r.status ?? 'err'}:${r.isHtml ? 'html' : r.success === false ? 'api-fail' : 'ok'}`;
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }
  console.log('Resumo burst:', byStatus);
  const fails = burst.filter((r) => !r.ok || r.isHtml || r.status === 429 || r.status === 403);
  if (fails.length) {
    console.log('Amostra falhas:', fails.slice(0, 5));
  } else {
    console.log('Burst: todos OK (JSON success) nos', opts.burst, 'pedidos');
  }
  const ms = burst.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`Latência burst ms: p50=${ms[Math.floor(ms.length / 2)]} p95=${ms[Math.floor(ms.length * 0.95)]}`);

  const sustainedN = opts.sustained || 25;
  console.log(`\n--- Sustentado: ${sustainedN} pedidos sequenciais delay=${opts.delay}ms ---`);
  const seq = [];
  for (let i = 0; i < sustainedN; i++) {
    seq.push(await oneRequest(`seq-${i + 1}`, String.fromCharCode(97 + (i % 26)), 1));
    if (opts.delay) await sleep(opts.delay);
  }
  const seqFail = seq.filter((r) => r.status === 429 || r.isHtml || r.success === false);
  console.log(
    'Sequencial:',
    seqFail.length ? `${seqFail.length} anomalias` : 'sem 429/HTML/challenge',
    seqFail[0] ?? '',
  );
  const api429 = seq.find((r) => r.message === 429 || r.apiCode === 429);
  if (api429) console.log('API message 429:', api429);

  console.log('\n--- Conclusão heurística ---');
  const anyCfChallenge = [...burst, ...seq].some((r) => r.isHtml || r.cfMitigated);
  const any429 = [...burst, ...seq].some((r) => r.status === 429);
  const any403 = [...burst, ...seq].some((r) => r.status === 403);
  console.log({
    cloudflare_html_challenge: anyCfChallenge,
    http_429: any429,
    http_403: any403,
    cf_ray_present: !!baseline.cfRay,
    recommendation_delay_ms: any429 || anyCfChallenge ? 500 : any403 ? 800 : 300,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
