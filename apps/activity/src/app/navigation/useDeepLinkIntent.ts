import { GAME_REGISTRY } from '@/games/registry';
import type { DiscordIdentity } from '@/platform/discord/auth';
import { devlog } from '@/shared/logging/devlog';
import { useEffect, useState } from 'react';
import { fetchDeepLinkIntent } from './deepLinkIntent';

const DEEP_LINK_TIMEOUT_MS = 3_000;

// Runs once per auth attempt, right after Discord auth resolves: asks the
// API whether the bot recorded a deep-link intent (e.g. the "Jogar na
// atividade" button on a Wordle win) before launching this Activity, and
// resolves the route the router should first mount on — so the player lands
// straight in that game instead of flashing the Hub first.
export function useDeepLinkIntent(
  identity: DiscordIdentity | null,
): string | null {
  const [resolved, setResolved] = useState<{
    identity: DiscordIdentity;
    path: string;
  } | null>(null);

  useEffect(() => {
    if (!identity) return;
    let settled = false;

    const settle = (path: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      setResolved({ identity, path });
    };

    // Non-fatal: worst case the player lands on the Hub.
    const timeoutId = setTimeout(() => {
      devlog('[deep-link] claim timed out');
      settle('/');
    }, DEEP_LINK_TIMEOUT_MS);

    fetchDeepLinkIntent(identity)
      .then(({ game }) => {
        if (
          !game ||
          !GAME_REGISTRY.some((descriptor) => descriptor.id === game)
        ) {
          settle('/');
          return;
        }
        devlog('[deep-link] navigating to', game);
        settle(`/games/${game}`);
      })
      .catch((err) => {
        devlog('[deep-link] failed to claim intent', err);
        settle('/');
      });

    return () => {
      settled = true;
      clearTimeout(timeoutId);
    };
  }, [identity]);

  return resolved && resolved.identity === identity ? resolved.path : null;
}
