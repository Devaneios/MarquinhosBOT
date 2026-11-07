import { Test } from '@nestjs/testing';
import { describe, it } from 'bun:test';
import 'reflect-metadata';

describe('Nest dependency graph', () => {
  it('compiles the app and the Phase 4 feature modules independently', async () => {
    const { AppModule } = await import('app.module');
    const { GamificationModule } =
      await import('modules/gamification/gamification.module');
    const { MazeModule } = await import('modules/maze/maze.module');

    await Test.createTestingModule({ imports: [AppModule] }).compile();
    await Test.createTestingModule({ imports: [GamificationModule] }).compile();
    await Test.createTestingModule({ imports: [MazeModule] }).compile();
  });
});
