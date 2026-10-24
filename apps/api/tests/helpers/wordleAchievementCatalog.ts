import { db } from '@marquinhos/database/client';
import { achievements } from '@marquinhos/database/schema';
import { inArray } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';

export async function installWordleAchievementCatalog() {
  const existing = new Set(
    (await db.select().from(achievements)).map((row) => row.id),
  );
  await new AchievementService(new LevelingService()).initializeDefaults();
  const genericIds = (await db.select().from(achievements))
    .filter((row) => row.category !== 'wordle' && !existing.has(row.id))
    .map((row) => row.id);
  return async () => {
    if (genericIds.length > 0) {
      await db.delete(achievements).where(inArray(achievements.id, genericIds));
    }
  };
}
