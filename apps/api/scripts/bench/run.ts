import type { Request, Result } from 'autocannon';
import autocannon from 'autocannon';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BENCH_URL ?? 'http://localhost:3000';
const GUILD_ID = process.env.BENCH_GUILD_ID ?? '';
const API_KEY = process.env.MARQUINHOS_API_KEY ?? '';

const authHeaders: Record<string, string> = API_KEY
  ? { authorization: `Bearer ${API_KEY}` }
  : {};

const WORDLIST_PATH = join(__dirname, '../../wordlist.txt');
const wordlist = readFileSync(WORDLIST_PATH, 'utf-8')
  .split('\n')
  .map((w) => w.trim().toLowerCase())
  .filter((w) => w.length >= 5 && w.length <= 6);

// Round-robins through the wordlist so each request exercises a different
// word instead of hammering the same cache entry.
function makeWordCycler(): () => string {
  let i = 0;
  return () => {
    const word = wordlist[i++ % wordlist.length];
    if (word === undefined) throw new Error('Wordlist is empty');
    return word;
  };
}

interface Target {
  name: string;
  path: string | (() => string);
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** Called once per request when the body needs to vary (e.g. distinct users). */
  body?: () => string;
}

const nextValidateWord = makeWordCycler();
const nextGuessWord = makeWordCycler();

const targets: Target[] = [
  {
    name: 'wordle validate (word check, hot path)',
    path: () => `/api/wordle/validate/${GUILD_ID}?guess=${nextValidateWord()}`,
    headers: authHeaders,
  },
  {
    name: 'wordle guess (submit, hot path)',
    path: '/api/wordle/guess',
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    // Distinct userId per request — mirrors real traffic (many different
    // players guessing) instead of hammering a single session row.
    body: () =>
      JSON.stringify({
        userId: randomUUID(),
        guildId: GUILD_ID,
        guess: nextGuessWord(),
      }),
  },
];

function runTarget(target: Target): Promise<Result> {
  return new Promise((resolve, reject) => {
    const staticPath =
      typeof target.path === 'string' ? target.path : target.path();
    const opts: autocannon.Options = {
      url: `${BASE_URL}${staticPath}`,
      method: target.method ?? 'GET',
      headers: target.headers,
      duration: 30,
    };
    if (target.body || typeof target.path === 'function') {
      opts.requests = [
        {
          setupRequest: (request: Request) => {
            if (typeof target.path === 'function') {
              request.path = target.path();
            }
            if (target.body) {
              request.body = target.body();
            }
            return request;
          },
        },
      ];
    }
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function main() {
  if (!GUILD_ID) {
    console.warn(
      'BENCH_GUILD_ID not set — leaderboard endpoints will hit an empty/missing guild id.',
    );
  }
  if (!API_KEY) {
    console.warn(
      'MARQUINHOS_API_KEY not set — bot-token-gated endpoints will get 401s.',
    );
  }

  for (const target of targets) {
    const pathLabel =
      typeof target.path === 'string' ? target.path : target.path();
    console.log(`\n=== ${target.name} (${pathLabel}) ===`);
    const result = await runTarget(target);
    printResult(result);
  }
}

function printResult(result: Result) {
  const { requests, latency, throughput } = result;
  console.log(
    `requests/sec: avg ${requests.average.toFixed(1)}  ` +
      `min ${requests.min}  max ${requests.max}  stddev ${requests.stddev.toFixed(1)}  ` +
      `total ${requests.total}`,
  );
  console.log(
    `latency (ms): mean ${latency.mean.toFixed(1)}  stddev ${latency.stddev.toFixed(1)}  ` +
      `min ${latency.min}  max ${latency.max}`,
  );
  console.log(
    `latency percentiles (ms): p50 ${latency.p50}  p75 ${latency.p75}  ` +
      `p90 ${latency.p90}  p97.5 ${latency.p97_5}  p99 ${latency.p99}  ` +
      `p99.9 ${latency.p99_9}`,
  );
  console.log(
    `throughput: avg ${formatBytes(throughput.average)}/s  ` +
      `min ${formatBytes(throughput.min)}/s  max ${formatBytes(throughput.max)}/s`,
  );
  console.log(
    `status codes: 1xx ${result['1xx']}  2xx ${result['2xx']}  ` +
      `3xx ${result['3xx']}  4xx ${result['4xx']}  5xx ${result['5xx']}  ` +
      `non2xx ${result.non2xx}`,
  );
  console.log(
    `duration: ${result.duration}s  connections: ${result.connections}  ` +
      `errors: ${result.errors}  timeouts: ${result.timeouts}  ` +
      `mismatches: ${result.mismatches}  resets: ${result.resets}`,
  );
}

function formatBytes(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(2)} KB`;
  }
  return `${bytesPerSec.toFixed(0)} B`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
