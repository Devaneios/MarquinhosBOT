import { AdminCommand } from '@marquinhos/commands/admin/admin';
import { ChaosCommand } from '@marquinhos/commands/admin/chaos';
import { ApiStatusCommand } from '@marquinhos/commands/dev/apistatus';
import { GamesCommand } from '@marquinhos/commands/games/games';
import { TermoCommand } from '@marquinhos/commands/games/termo';
import { AnomCommand } from '@marquinhos/commands/general/anom';
import { AvatarCommand } from '@marquinhos/commands/general/avatar';
import { CoinCommand } from '@marquinhos/commands/general/coin';
import { EsrohCommand } from '@marquinhos/commands/general/esroh';
import { HorseCommand } from '@marquinhos/commands/general/horse';
import { PingCommand } from '@marquinhos/commands/general/ping';
import { TimeCommand } from '@marquinhos/commands/general/time';
import { AudioCommand } from '@marquinhos/commands/music/audio';
import { ClearQueueCommand } from '@marquinhos/commands/music/clearQueue';
import { DisconnectCommand } from '@marquinhos/commands/music/disconnect';
import { DisconnectAllCommand } from '@marquinhos/commands/music/disconnectAll';
import { LastfmCommand } from '@marquinhos/commands/music/lastfm';
import { MoveAllCommand } from '@marquinhos/commands/music/moveAll';
import { PlayCommand } from '@marquinhos/commands/music/play';
import { PlayNextCommand } from '@marquinhos/commands/music/playNext';
import { PlaylistCommand } from '@marquinhos/commands/music/playlist';
import { QueueCommand } from '@marquinhos/commands/music/queue';
import { RecommendCommand } from '@marquinhos/commands/music/recommend';
import { SkipCommand } from '@marquinhos/commands/music/skip';
import { AchievementsCommand } from '@marquinhos/commands/social/achievements';
import { CheckInCommand } from '@marquinhos/commands/social/checkIn';
import { ImportunateCommand } from '@marquinhos/commands/social/importunate';
import { LeaderboardCommand } from '@marquinhos/commands/social/leaderboard';
import { LevelCommand } from '@marquinhos/commands/social/level';
import { GameButtonsHandler } from '@marquinhos/interaction-handlers/gameButtons';
import { GameModalsHandler } from '@marquinhos/interaction-handlers/gameModals';
import { GuildMemberAddListener } from '@marquinhos/listeners/guildMemberAdd';
import { MessageCreateListener } from '@marquinhos/listeners/messageCreate';
import { ReadyListener } from '@marquinhos/listeners/ready';
import { VoiceStateUpdateListener } from '@marquinhos/listeners/voiceStateUpdate';
import { BotNotInOtherChannelPrecondition } from '@marquinhos/preconditions/BotNotInOtherChannel';
import { CanJoinPrecondition } from '@marquinhos/preconditions/CanJoin';
import { CanSpeakPrecondition } from '@marquinhos/preconditions/CanSpeak';
import { UserInVoiceChannelPrecondition } from '@marquinhos/preconditions/UserInVoiceChannel';
import { container } from '@sapphire/framework';

const commands = [
  ['admin', AdminCommand],
  ['chaos', ChaosCommand],
  ['apistatus', ApiStatusCommand],
  ['games', GamesCommand],
  ['termo', TermoCommand],
  ['anom', AnomCommand],
  ['avatar', AvatarCommand],
  ['moeda', CoinCommand],
  ['olavac', EsrohCommand],
  ['cavalo', HorseCommand],
  ['ping', PingCommand],
  ['horario', TimeCommand],
  ['audio', AudioCommand],
  ['limpar-fila', ClearQueueCommand],
  ['desconectar', DisconnectCommand],
  ['encerrar-chamada', DisconnectAllCommand],
  ['lastfm', LastfmCommand],
  ['mover-todos', MoveAllCommand],
  ['play', PlayCommand],
  ['adicionar-a-fila', PlayNextCommand],
  ['playlist', PlaylistCommand],
  ['fila', QueueCommand],
  ['recommend', RecommendCommand],
  ['pular', SkipCommand],
  ['achievements', AchievementsCommand],
  ['check-in', CheckInCommand],
  ['importunar', ImportunateCommand],
  ['leaderboard', LeaderboardCommand],
  ['level', LevelCommand],
] as const;

const interactionHandlers = [
  ['gameButtons', GameButtonsHandler],
  ['gameModals', GameModalsHandler],
] as const;

const listeners = [
  ['guildMemberAdd', GuildMemberAddListener],
  ['messageCreate', MessageCreateListener],
  ['ready', ReadyListener],
  ['voiceStateUpdate', VoiceStateUpdateListener],
] as const;

const preconditions = [
  ['BotNotInOtherChannel', BotNotInOtherChannelPrecondition],
  ['CanJoin', CanJoinPrecondition],
  ['CanSpeak', CanSpeakPrecondition],
  ['UserInVoiceChannel', UserInVoiceChannelPrecondition],
] as const;

export function registerSapphireCommands() {
  for (const [name, piece] of commands) {
    container.stores.loadPiece({ name, piece, store: 'commands' });
  }
}

export function registerSapphireInteractionHandlers() {
  for (const [name, piece] of interactionHandlers) {
    container.stores.loadPiece({ name, piece, store: 'interaction-handlers' });
  }
}

export function registerSapphireListeners() {
  for (const [name, piece] of listeners) {
    container.stores.loadPiece({ name, piece, store: 'listeners' });
  }
}

export function registerSapphirePreconditions() {
  for (const [name, piece] of preconditions) {
    container.stores.loadPiece({ name, piece, store: 'preconditions' });
  }
}

export function registerSapphirePieces() {
  registerSapphireCommands();
  registerSapphireInteractionHandlers();
  registerSapphireListeners();
  registerSapphirePreconditions();
}
