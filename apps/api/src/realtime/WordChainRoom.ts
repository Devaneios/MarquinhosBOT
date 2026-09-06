import { Room, type Client } from 'colyseus';
import { roomKey } from 'services/activity/roomKey';
import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import { WordChainSession } from 'services/activity/word-chain/WordChainSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const WORD_RATE_LIMIT_WINDOW_MS = 1000;
const WORD_RATE_LIMIT_MAX = 3;

export class WordChainRoom extends Room {
  private session!: WordChainSession;
  private wordRateLimiter = new RateLimiter({
    windowMs: WORD_RATE_LIMIT_WINDOW_MS,
    max: WORD_RATE_LIMIT_MAX,
  });

  override async onAuth(
    _client: Client,
    options: { token?: string; roomKey?: string },
  ): Promise<WsSessionPayload> {
    const session = options.token ? verifyWsSessionToken(options.token) : null;
    if (!session) throw new Error('Invalid or expired session token');
    if (roomKey(session) !== options.roomKey) {
      throw new Error('Room key does not match session identity');
    }
    return session;
  }

  override onCreate(options: { roomKey: string; token?: string }) {
    void this.setMetadata({ roomKey: options.roomKey });

    const initialSession = options.token
      ? verifyWsSessionToken(options.token)
      : null;

    const broadcaster = {
      broadcast: (
        _key: string,
        message: { type: string; payload?: unknown },
      ) => {
        this.broadcast(message.type, message.payload);
      },
    };

    this.session = new WordChainSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      broadcaster,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage('word', (client, payload: { word?: string }) => {
      if (this.wordRateLimiter.isOverLimit(client)) return;

      const auth = client.auth as WsSessionPayload;
      const result = this.session.handleWordSubmission(
        auth.userId,
        payload?.word ?? '',
      );
      if (!result.ok) {
        client.send(ACTION_REJECTED, { error: result.error });
      }
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    this.session.addPlayer(auth.userId, client);
    if (auth.mode === 'single') {
      this.session.enableBot();
    }
    const state = this.session.state;
    client.send('init', {
      currentWord: state.currentWord,
      currentTurn: state.currentTurn,
      usedWords: Array.from(state.usedWords),
      players: state.players,
      gameOver: state.gameOver,
      winner: state.winner,
    });
  }

  override onLeave(client: Client) {
    this.wordRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
