import type { TowerState } from 'services/activity/towerUnstable/TowerEngine';

// Sentinel seat id for the bot — never a real Discord snowflake, so it
// can't collide with an actual player.
export const TOWER_BOT_USER_ID = '__tower_bot__';

export class TowerBot {
  // Picks uniformly among every still-present block in an unprotected
  // level — no strategy beyond "don't touch the top two levels", same as
  // any legal human pull.
  choosePull(state: TowerState): { level: number; position: number } | null {
    const eligibleLevels: number[] = [];
    for (let i = 0; i < state.eligibleLevelCount; i++) {
      const level = state.levels[i];
      if (level && level.present.some((present) => present)) {
        eligibleLevels.push(i);
      }
    }
    if (eligibleLevels.length === 0) return null;

    const level =
      eligibleLevels[Math.floor(Math.random() * eligibleLevels.length)]!;
    const positions = state.levels[level]!.present.map((present, idx) =>
      present ? idx : -1,
    ).filter((idx) => idx !== -1);
    const position = positions[Math.floor(Math.random() * positions.length)]!;

    return { level, position };
  }
}
