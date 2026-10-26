import { db } from '@marquinhos/database/client';
import { wordleDays, wordleUsedWords } from '@marquinhos/database/schema';
import { expect, it } from 'bun:test';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

it('initializes a missing day without exhausting a single-connection pool', async () => {
  const guildId = randomUUID();
  // A separate process reads DATABASE_POOL_MAX before importing the DB client.
  const child = Bun.spawn(
    [
      process.execPath,
      '--eval',
      `import { closeDefaultDb } from '@marquinhos/database/client';
       import { WordleService } from './src/services/wordle';
       try {
         await new WordleService().submitGuess('single-connection', ${JSON.stringify(guildId)}, 'termo');
       } finally {
         await closeDefaultDb();
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
