/**
 * Measures response latency for the non-AI read endpoints (NFR-006).
 *
 * Deliberately small: a sequential sample per endpoint plus one concurrent burst, against
 * whichever base URL is given. This is a demonstration-load measurement, not a load test —
 * the point is to replace an unverified 2-second claim with numbers that were actually
 * observed, and to say plainly what they do and do not cover.
 *
 *   node scripts/measure-latency.mjs [baseUrl] [samples]
 */

const baseUrl = (process.argv[2] ?? 'http://localhost:4000').replace(/\/$/, '');
const samples = Number(process.argv[3] ?? 30);

async function timed(path) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`);
  await response.arrayBuffer();
  return { ms: performance.now() - started, status: response.status };
}

function percentile(sorted, fraction) {
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function summarise(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  const round = (value) => Math.round(value * 10) / 10;
  return {
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted[sorted.length - 1]),
  };
}

const lawyers = await fetch(`${baseUrl}/api/v1/lawyers?limit=20`).then((response) =>
  response.ok ? response.json() : null,
);
const firstLawyerId = lawyers?.results?.[0]?.id;

const paths = [
  ['health', '/api/health'],
  ['categories', '/api/v1/categories'],
  ['lawyer directory, 20 per page', '/api/v1/lawyers?limit=20'],
  ['directory search', '/api/v1/lawyers?q=land&limit=20'],
  ...(firstLawyerId ? [['lawyer detail', `/api/v1/lawyers/${firstLawyerId}`]] : []),
];

console.log(`base ${baseUrl} · ${samples} sequential samples per endpoint\n`);
console.log('| Endpoint | Status | p50 ms | p95 ms | max ms |');
console.log('| --- | --- | --- | --- | --- |');

for (const [label, path] of paths) {
  const durations = [];
  let status = 0;
  for (let index = 0; index < samples; index += 1) {
    const result = await timed(path);
    durations.push(result.ms);
    status = result.status;
  }
  const { p50, p95, max } = summarise(durations);
  console.log(`| ${label} | ${status} | ${p50} | ${p95} | ${max} |`);
}

const burstSize = 20;
const burstPath = '/api/v1/lawyers?limit=20';
const burstStarted = performance.now();
const burst = await Promise.all(Array.from({ length: burstSize }, () => timed(burstPath)));
const burstWall = Math.round(performance.now() - burstStarted);
const { p50, p95, max } = summarise(burst.map((result) => result.ms));
const failed = burst.filter((result) => result.status !== 200).length;

console.log(
  `\nBurst: ${burstSize} concurrent requests to ${burstPath} — wall ${burstWall} ms, p50 ${p50} ms, p95 ${p95} ms, max ${max} ms, non-200 ${failed}`,
);
