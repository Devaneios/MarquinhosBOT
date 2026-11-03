import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WordleGoal } from '../api/wordleGoalsApi';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
export function WordleGoalsPanel({
  load,
  userId,
}: {
  load: () => Promise<WordleGoal[]>;
  userId: string;
}) {
  const { t } = useTranslation('wordle');
  const [goals, setGoals] = useState<WordleGoal[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    load().then(
      (data) => {
        if (active) setGoals(data);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [load, retry]);
  return (
    <section
      className="border border-marquinhos-border p-3"
      aria-label={t('goalsTitle')}
    >
      <h2 className="font-semibold">{t('goalsTitle')}</h2>
      {error ? (
        <p role="alert">
          {t('goalsError')}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t('showcaseRetry')}
          </button>
        </p>
      ) : goals === null ? (
        <p role="status">{t('goalsLoading')}</p>
      ) : goals.length === 0 ? (
        <p>{t('goalsEmpty')}</p>
      ) : (
        goals.map((goal) => (
          <article
            key={goal.id}
            className="mt-3 border border-marquinhos-border p-3"
          >
            <p>{t(`goalStatus.${goal.status}`)}</p>
            <p>
              {t('goalDates', {
                start: dateFormatter.format(goal.startsAt),
                end: dateFormatter.format(goal.endsAt - 1),
              })}
            </p>
            <p>
              {t('goalProgress', {
                current: goal.progress.count,
                target: goal.target,
              })}
            </p>
            {goal.status === 'completed' &&
              goal.progress.contributors.includes(userId) && (
                <p>{t('goalPersonalBadge')}</p>
              )}
          </article>
        ))
      )}
    </section>
  );
}
