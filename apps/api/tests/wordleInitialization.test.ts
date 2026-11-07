import { db } from '@marquinhos/database/client';
import { wordleDays, wordleUsedWords } from '@marquinhos/database/schema';
import { expect, it } from 'bun:test';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { createWordleTestService } from './helpers/wordleServices';

it('initializes the global word using the existing word banks', async () => {
  const service = createWordleTestService();
  const date = '2035-08-21';
  const [a, b] = await Promise.all([
    service.getGlobalDailyWord(date),
    service.getGlobalDailyWord(date),
  ]);
  expect(a).toEqual(b);
  expect(a.word.length).toBeGreaterThanOrEqual(5);
  expect(a.word.length).toBeLessThanOrEqual(6);
});

it('initializes a missing day without exhausting a single-connection pool', async () => {
  const guildId = randomUUID();
  // A separate process reads DATABASE_POOL_MAX before importing the DB client.
  const child = Bun.spawn(
    [
      process.execPath,
      '--eval',
      `import 'reflect-metadata';
       import { Test } from '@nestjs/testing';
       import { WordleModule } from './src/modules/wordle/wordle.module';
       import { WordleService } from './src/modules/wordle/wordle.service';
       const moduleRef = await Test.createTestingModule({ imports: [WordleModule] }).compile();
       const service = moduleRef.get(WordleService);
       try {
         await service.submitGuess('single-connection', ${JSON.stringify(guildId)}, 'termo');
       } finally {
         await moduleRef.close();
       }`,
    ],
    {
      cwd: `${import.meta.dir}/..`,
      env: { ...process.env, DATABASE_POOL_MAX: '1' },
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 3000,
    },
  );
  const stderr = await new Response(child.stderr).text();
  expect(await child.exited, stderr).toBe(0);

  const [day] = await db
    .select()
    .from(wordleDays)
    .where(eq(wordleDays.guild_id, guildId));
  expect(day?.word).toBeString();
  if (!day?.word) throw new Error('The first guess did not initialize a word');
  const used = await db
    .select()
    .from(wordleUsedWords)
    .where(eq(wordleUsedWords.word, day.word));
  expect(used).toHaveLength(1);
});
