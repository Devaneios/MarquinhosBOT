console.error(
  'This guild-scoped backfill was retired with guild gameplay. Use scripts/reconcileGlobalWordleAchievements.ts --user-id ID --guild-id ID for global reconciliation.',
);
process.exitCode = 1;
