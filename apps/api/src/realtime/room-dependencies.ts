import { BoggleWordBankService } from 'modules/activity/games/boggle/boggle-word-bank.service';
import { PongCompetitionService } from 'modules/activity/games/pong/pong-competition.service';
import { WsSessionTokenService } from 'modules/activity/ws-session-token';
import { GamificationService } from 'modules/gamification/gamification.service';
import { WordBankService } from 'modules/wordle/services/word-bank.service';
import { WordleService } from 'modules/wordle/wordle.service';

export const ROOM_DEPENDENCIES = Symbol('ROOM_DEPENDENCIES');

export interface RoomDependencies {
  gamification: GamificationService;
  wordle: WordleService;
  wordBank: WordBankService;
  boggleWordBank: BoggleWordBankService;
  pongCompetition: PongCompetitionService;
  wsSessionTokens: WsSessionTokenService;
}
