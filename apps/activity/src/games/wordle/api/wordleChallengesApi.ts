import { apiBase } from '@/platform/api/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import type { z } from 'zod';

export type WordleChallenge = z.output<
  typeof wordle.listChallenges.response
>['data'][number];
export async function listWordleChallenges(
  token: string,
  guildId: string,
): Promise<WordleChallenge[]> {
  return (
    await fetchContract(
      apiBase(),
      wordle.listChallenges,
      { params: { guildId } },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data;
}
export async function createWordleChallenge(
  token: string,
  guildId: string,
  patternId: string,
  closesAt: number,
): Promise<WordleChallenge> {
  return (
    await fetchContract(
      apiBase(),
      wordle.createChallenge,
      { params: { guildId }, body: { patternId, closesAt } },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data;
}
export async function joinWordleChallenge(
  token: string,
  guildId: string,
  challengeId: string,
): Promise<void> {
  await fetchContract(
    apiBase(),
    wordle.joinChallenge,
    { params: { guildId, challengeId } },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
