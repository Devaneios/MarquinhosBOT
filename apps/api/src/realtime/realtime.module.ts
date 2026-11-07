import { Module } from '@nestjs/common';
import { ActivityModule } from 'modules/activity/activity.module';
import { BoggleWordBankService } from 'modules/activity/games/boggle/boggle-word-bank.service';
import { PongCompetitionService } from 'modules/activity/games/pong/pong-competition.service';
import { GamificationModule } from 'modules/gamification/gamification.module';
import { GamificationService } from 'modules/gamification/gamification.service';
import { WordBankService } from 'modules/wordle/services/word-bank.service';
import { WordleModule } from 'modules/wordle/wordle.module';
import { WordleService } from 'modules/wordle/wordle.service';
import { GameServer } from 'realtime/game-server.service';
import { ROOM_DEPENDENCIES } from 'realtime/room-dependencies';

@Module({
  imports: [ActivityModule, GamificationModule, WordleModule],
  providers: [
    GameServer,
    {
      provide: ROOM_DEPENDENCIES,
      useFactory: (
        gamification: GamificationService,
        wordle: WordleService,
        wordBank: WordBankService,
        boggleWordBank: BoggleWordBankService,
        pongCompetition: PongCompetitionService,
      ) => ({
        gamification,
        wordle,
        wordBank,
        boggleWordBank,
        pongCompetition,
      }),
      inject: [
        GamificationService,
        WordleService,
        WordBankService,
        BoggleWordBankService,
        PongCompetitionService,
      ],
    },
  ],
  exports: [GameServer],
})
export class RealtimeModule {}
