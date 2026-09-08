import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscordIdentity } from '../discordAuth.ts';
import { GAME_REGISTRY } from '../games/registry';
import { fetchDeepLinkIntent } from '../games/shared/activitySession';
import { devlog } from '../lib/devlog';

// Runs once per Activity session, right after Discord auth resolves: asks
// the API whether the bot recorded a deep-link intent (e.g. the "Jogar na
// atividade" button on a Wordle win) before launching this Activity, and if
// so, jumps straight into that game instead of leaving the player on the Hub.
export function useDeepLinkIntent(identity: DiscordIdentity): void {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    fetchDeepLinkIntent(identity)
      .then(({ game }) => {
        if (cancelled || !game) return;
        if (!GAME_REGISTRY.some((descriptor) => descriptor.id === game)) return;
        devlog('[deep-link] navigating to', game);
        navigate(`/games/${game}`, { replace: true });
      })
      .catch((err) => {
        // Non-fatal: worst case the player stays on the Hub.
        devlog('[deep-link] failed to claim intent', err);
      });

    return () => {
      cancelled = true;
    };
    // Only re-run if the identity's userId/guildId actually changes (i.e. a
    // reauth), not on every re-render of the consuming component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.userId, identity.guildId]);
}
