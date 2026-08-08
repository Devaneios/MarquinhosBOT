import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, type Room } from '@colyseus/sdk';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { devinfo, devlog, devwarn } from '../../lib/devlog';
import { errorMessage, isAuthError } from '../../lib/http';
import { fetchWsSessionToken, type WsSession } from '../shared/activitySession';
import { colyseusUrl } from '../../lib/apiBase';

export type BingoSpeedSessionState =
  | { status: 'selecting-mode' }
  | { status: 'connecting' }
  | {
      status: 'playing';
      session: WsSession;
      room: Room;
      card?: any;
      drawnNumbers: number[];
      playerCount: number;
      gameStarted: boolean;
    }
  | { status: 'finished'; winner?: string }
  | { status: 'error'; error: string };

export function useBingoSpeedSession(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  const [session, setSession] = useState<BingoSpeedSessionState>({
    status: 'selecting-mode',
  });
  const roomRef = useRef<Room | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const selectMode = useCallback(
    (mode: 'multi' | 'single') => {
      devlog('[bingo-speed] selecting mode', mode);
      setSession({ status: 'connecting' });
      fetchWsSessionToken({
        game: 'bingo-speed',
        mode,
        identity,
      })
        .then((wsSession) => {
          if (cancelledRef.current) return;

          const client = new Client(colyseusUrl());

          return client.joinOrCreate('bingo_speed', {
            roomKey: wsSession.roomKey,
            token: wsSession.token,
          }).then((room: Room) => {
            if (cancelledRef.current) {
              room.leave();
              return;
            }

            roomRef.current = room;
            devinfo('[bingo-speed] room joined', mode);

            room.onMessage('init', (data: any) => {
              if (cancelledRef.current) return;
              setSession({
                status: 'playing',
                session: wsSession,
                room,
                card: data.card,
                drawnNumbers: data.state?.drawnNumbers ?? [],
                playerCount: data.state?.playerCount ?? 0,
                gameStarted: data.state?.gameStarted ?? false,
              });
            });

            room.onMessage('number_drawn', (data: any) => {
              if (cancelledRef.current) return;
              setSession((s) => {
                if (s.status !== 'playing') return s;
                return {
                  ...s,
                  drawnNumbers: [...s.drawnNumbers, data.number],
                };
              });
            });

            room.onMessage('game_end', (data: any) => {
              if (cancelledRef.current) return;
              setSession((s) => ({
                ...s,
                status: 'finished',
                winner: data.winner,
              }));
            });

            room.onError(() => {
              if (cancelledRef.current) return;
              setSession({
                status: 'error',
                error: 'Connection error',
              });
            });

            room.onLeave(() => {
              if (cancelledRef.current) return;
              setSession({ status: 'selecting-mode' });
            });
          });
        })
        .catch((err) => {
          console.error('Failed to create Bingo Speed session', JSON.stringify(err));
          if (cancelledRef.current) return;
          if (isAuthError(err)) {
            devwarn('[bingo-speed] session creation hit an auth error, reauthing');
            onAuthInvalid();
            return;
          }
          setSession({ status: 'error', error: errorMessage(err) });
        });
    },
    [identity, onAuthInvalid],
  );

  const backToMenu = useCallback(() => {
    devlog('[bingo-speed] back to mode menu');
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    setSession({ status: 'selecting-mode' });
  }, []);

  const claimBingo = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send('claim_bingo', {});
    }
  }, []);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, []);

  return { session, selectMode, backToMenu, claimBingo };
}
