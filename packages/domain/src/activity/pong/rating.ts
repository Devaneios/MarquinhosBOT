import type { PongRating } from '@marquinhos/contracts/http/routes/activity';

export interface PongRankedResult {
  userId: string;
  position: number;
}

interface OpponentResult {
  opponent: PongRating;
  score: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectation(mu: number, opponentMu: number, opponentPhi: number) {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function nextVolatility(
  phi: number,
  sigma: number,
  delta: number,
  variance: number,
): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const numerator = ex * (delta * delta - phi * phi - variance - ex);
    const denominator = 2 * (phi * phi + variance + ex) ** 2;
    return numerator / denominator - (x - a) / (TAU * TAU);
  };
  let lower = a;
  let upper: number;
  if (delta * delta > phi * phi + variance) {
    upper = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    upper = a - k * TAU;
  }
  let fLower = f(lower);
  let fUpper = f(upper);
  while (Math.abs(upper - lower) > EPSILON) {
    const next = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fNext = f(next);
    if (fNext * fUpper <= 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = next;
    fUpper = fNext;
  }
  return Math.exp(lower / 2);
}

export function calculateGlicko2(
  player: PongRating,
  results: OpponentResult[],
): Pick<PongRating, 'rating' | 'deviation' | 'volatility'> {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.deviation / SCALE;
  if (results.length === 0) {
    return {
      rating: player.rating,
      deviation: Math.min(
        350,
        Math.sqrt(phi * phi + player.volatility ** 2) * SCALE,
      ),
      volatility: player.volatility,
    };
  }
  const converted = results.map(({ opponent, score }) => ({
    mu: (opponent.rating - 1500) / SCALE,
    phi: opponent.deviation / SCALE,
    score,
  }));
  const variance =
    1 /
    converted.reduce((sum, result) => {
      const expected = expectation(mu, result.mu, result.phi);
      return sum + g(result.phi) ** 2 * expected * (1 - expected);
    }, 0);
  const improvement = converted.reduce((sum, result) => {
    const expected = expectation(mu, result.mu, result.phi);
    return sum + g(result.phi) * (result.score - expected);
  }, 0);
  const delta = variance * improvement;
  const volatility = nextVolatility(phi, player.volatility, delta, variance);
  const preDeviation = Math.sqrt(phi * phi + volatility * volatility);
  const nextPhi =
    1 / Math.sqrt(1 / (preDeviation * preDeviation) + 1 / variance);
  const nextMu = mu + nextPhi * nextPhi * improvement;
  return {
    rating: nextMu * SCALE + 1500,
    deviation: nextPhi * SCALE,
    volatility,
  };
}
