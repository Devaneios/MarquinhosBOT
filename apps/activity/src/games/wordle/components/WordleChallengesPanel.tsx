import type { WordleAchievementStatus } from '@marquinhos/contracts/wordle';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WordleChallenge } from '../api/wordleChallengesApi';

export function WordleChallengesPanel({
  achievements,
  load,
  create,
  join,
}: {
  achievements: WordleAchievementStatus[];
  load: () => Promise<WordleChallenge[]>;
  create: (patternId: string, closesAt: number) => Promise<WordleChallenge>;
  join: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation('wordle');
  const [items, setItems] = useState<WordleChallenge[] | null>(null);
  const [pattern, setPattern] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const owned = achievements.filter(
    (item) => item.unlockedAt !== null && item.patternPreview,
  );
  useEffect(() => {
    let active = true;
    setError(false);
    load().then(
      (value) => {
        if (active) setItems(value);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [load, retry]);
  async function createChallenge() {
    const closesAt = Date.parse(deadline);
    if (!pattern || !Number.isFinite(closesAt) || closesAt <= Date.now()) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const created = await create(pattern, closesAt);
      setItems((current) => [...(current ?? []), created]);
      setDeadline('');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function joinChallenge(id: string) {
    setBusy(true);
    setError(false);
    try {
      await join(id);
      setItems(await load());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="border border-marquinhos-border p-3"
      aria-label={t('challengesTitle')}
    >
      <h2 className="font-semibold">{t('challengesTitle')}</h2>
      <p className="text-sm text-marquinhos-text-dim">
        {t('challengesDescription')}
      </p>
      {error && (
        <p role="alert">
          {t('challengesError')}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t('showcaseRetry')}
          </button>
        </p>
      )}
      {items === null && !error && (
        <p role="status">{t('challengesLoading')}</p>
      )}
      {items?.length === 0 && <p>{t('challengesEmpty')}</p>}
      {items?.map((challenge) => {
        const definition = WORDLE_ACHIEVEMENT_CATALOG.find(
          (item) =>
            item.kind === 'drawing' &&
            item.drawing.patternId === challenge.patternId,
        );
        return (
          <article
            key={challenge.id}
            className="mt-3 border border-marquinhos-border p-3"
          >
            <h3 className="font-semibold">
              {definition?.name ?? challenge.patternId}
            </h3>
            <p>
              {t(
                challenge.status === 'open'
                  ? 'challengeOpen'
                  : 'challengeClosed',
              )}{' '}
              · {new Date(challenge.closesAt).toLocaleString('pt-BR')}
            </p>
            <p>
              {t('challengeParticipants', {
                count: challenge.participants.length,
              })}
            </p>
            {challenge.participants.length > 0 && (
              <p>
                {t('albumContributorList', {
                  users: challenge.participants.join(', '),
                })}
              </p>
            )}
            {challenge.status === 'open' && !challenge.joined && (
              <button
                type="button"
                disabled={busy}
                className="border border-marquinhos-border px-2 py-1"
                onClick={() => joinChallenge(challenge.id)}
              >
                {t('challengeJoin')}
              </button>
            )}
            {challenge.joined && <p>{t('challengeJoined')}</p>}
          </article>
        );
      })}
      {owned.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <h3 className="font-semibold">{t('challengeCreateTitle')}</h3>
          <label>
            {t('challengePattern')}{' '}
            <select
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              className="bg-marquinhos-panel"
            >
              <option value="">{t('challengeChoose')}</option>
              {owned.map((item) => (
                <option key={item.id} value={item.patternPreview!.patternId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('challengeDeadline')}{' '}
            <input
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="bg-marquinhos-panel"
            />
          </label>
          <button
            type="button"
            disabled={busy || !pattern || !deadline}
            className="w-fit border border-marquinhos-border px-2 py-1"
            onClick={createChallenge}
          >
            {t('challengeCreate')}
          </button>
        </div>
      )}
    </section>
  );
}
