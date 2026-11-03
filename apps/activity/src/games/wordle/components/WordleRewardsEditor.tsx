import { WORDLE_PERSONAL_REWARDS } from '@marquinhos/domain/games/wordle/community/rewards';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WordleRewardsState } from '../api/wordleRewardsApi';

export function WordleRewardsEditor({
  load,
  equip,
}: {
  load: () => Promise<WordleRewardsState>;
  equip: (
    kind: 'title' | 'frame',
    id: string | null,
  ) => Promise<WordleRewardsState>;
}) {
  const { t } = useTranslation('wordle');
  const [state, setState] = useState<WordleRewardsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    load().then(
      (value) => {
        if (active) setState(value);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [load, retry]);
  async function select(kind: 'title' | 'frame', id: string | null) {
    setBusy(true);
    setError(false);
    try {
      setState(await equip(kind, id));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const owned = WORDLE_PERSONAL_REWARDS.filter((reward) =>
    state?.owned.includes(reward.id),
  );
  return (
    <section
      className={`notch-4 border bg-white/5 p-4 ${state?.frame ? 'border-marquinhos-accent' : 'border-marquinhos-border'}`}
      aria-label={t('rewardsTitle')}
    >
      <h2 className="font-semibold">{t('rewardsTitle')}</h2>
      {error && (
        <p role="alert">
          {t('rewardsError')}{' '}
          {!state && (
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t('showcaseRetry')}
            </button>
          )}
        </p>
      )}
      {!state && !error && <p role="status">{t('rewardsLoading')}</p>}
      {state && owned.length === 0 && <p>{t('rewardsEmpty')}</p>}
      {owned.map((reward) => {
        const equipped = state?.[reward.kind] === reward.id;
        return (
          <div
            key={reward.id}
            className="mt-2 flex items-center justify-between gap-2"
          >
            <span>
              {reward.name} · {t(`rewardKind.${reward.kind}`)}
            </span>
            <button
              type="button"
              className="border border-marquinhos-border px-2 py-1"
              disabled={busy}
              onClick={() => select(reward.kind, equipped ? null : reward.id)}
            >
              {t(equipped ? 'rewardRemove' : 'rewardEquip', {
                name: reward.name,
              })}
            </button>
          </div>
        );
      })}
      {state && state.badges.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold">{t('goalBadgesTitle')}</h3>
          <ul>
            {state.badges.map((badge) => (
              <li key={badge.goalId}>
                {t('goalBadgeOrigin', { guildId: badge.guildId })} ·{' '}
                {new Date(badge.grantedAt).toLocaleDateString('pt-BR', {
                  timeZone: 'America/Recife',
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
