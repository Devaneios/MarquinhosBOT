import { expect, it } from 'bun:test';
import {
  bingoProgress,
  challengeParticipants,
  galleryEntries,
} from './activities';

it('counts only verified occurrences after the invite, including people who joined later', () => {
  const challenge = {
    guildId: 'a',
    patternId: 'letter_a',
    opensAt: 100,
    closesAt: 300,
  };
  const joins = [
    { userId: 'one', joinedAt: 200 },
    { userId: 'two', joinedAt: 301 },
    { userId: 'three', joinedAt: 100 },
  ];
  const occurrences = [
    {
      userId: 'one',
      guildId: 'a',
      patternId: 'letter_a',
      sourceAt: 150,
      present: true,
    },
    {
      userId: 'two',
      guildId: 'a',
      patternId: 'letter_a',
      sourceAt: 150,
      present: true,
    },
    {
      userId: 'three',
      guildId: 'a',
      patternId: 'letter_a',
      sourceAt: 99,
      present: true,
    },
    {
      userId: 'three',
      guildId: 'a',
      patternId: 'letter_a',
      sourceAt: null,
      present: true,
    },
    {
      userId: 'three',
      guildId: 'b',
      patternId: 'letter_a',
      sourceAt: 150,
      present: true,
    },
  ];
  expect(challengeParticipants(challenge, joins, occurrences)).toEqual(['one']);
});

it('selects one deterministic closed-day gallery entry per participant', () => {
  const entries = [
    {
      id: 'b',
      userId: 'one',
      guildId: 'a',
      family: 'shapes',
      date: '2026-11-01',
      sourceAt: 150,
      present: true,
    },
    {
      id: 'a',
      userId: 'one',
      guildId: 'a',
      family: 'letters',
      date: '2026-11-01',
      sourceAt: 160,
      present: true,
    },
    {
      id: 'c',
      userId: 'two',
      guildId: 'a',
      family: 'letters',
      date: '2026-11-02',
      sourceAt: 170,
      present: true,
    },
  ];
  expect(
    galleryEntries('a', '2026-11-02', 100, 200, entries).map(
      (entry) => entry.id,
    ),
  ).toEqual(['a']);
  expect(galleryEntries('a', '2026-11-01', 100, 200, entries)).toEqual([]);
});

it('fills multiple bingo cells only when the card permits it', () => {
  const cells = Array.from({ length: 9 }, (_, index) => ({
    id: String(index),
    condition: { kind: 'participation' as const, target: 1 },
  }));
  const card = {
    guildId: 'a',
    version: 1,
    startsAt: 100,
    endsAt: 200,
    allowMulti: false,
    cells,
  };
  const event = {
    id: 'event',
    guildId: 'a',
    userId: 'one',
    occurredAt: 150,
    kind: 'participation' as const,
  };
  expect(
    bingoProgress(card, [event, event]).filled.filter(Boolean),
  ).toHaveLength(1);
  expect(
    bingoProgress({ ...card, allowMulti: true }, [event]).filled.filter(
      Boolean,
    ),
  ).toHaveLength(9);
  expect(bingoProgress({ ...card, allowMulti: true }, [event]).complete).toBe(
    true,
  );
  expect(
    bingoProgress(card, [{ ...event, guildId: 'b' }]).filled.filter(Boolean),
  ).toHaveLength(0);
});
