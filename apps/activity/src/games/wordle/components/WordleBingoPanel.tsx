import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WordleBingoCard } from '../api/wordleBingoApi';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function WordleBingoPanel({
  load,
}: {
  load: () => Promise<WordleBingoCard[]>;
}) {
  const { t } = useTranslation('wordle');
  const [cards, setCards] = useState<WordleBingoCard[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    load().then(
      (rows) => {
        if (active) setCards(rows);
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
      aria-label={t('bingoTitle')}
    >
      <h2 className="font-semibold">{t('bingoTitle')}</h2>
      {error ? (
        <p role="alert">
          {t('bingoError')}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t('showcaseRetry')}
          </button>
        </p>
      ) : cards === null ? (
        <p role="status">{t('bingoLoading')}</p>
      ) : cards.length === 0 ? (
        <p>{t('bingoEmpty')}</p>
      ) : (
        cards.map((card) => (
          <article
            key={card.id}
            className="mt-3 border border-marquinhos-border p-3"
          >
            <p>{t(`bingoStatus.${card.status}`)}</p>
            <p>
              {t('goalDates', {
                start: dateFormatter.format(card.startsAt),
                end: dateFormatter.format(card.endsAt - 1),
              })}
            </p>
            <p>{t(card.allowMulti ? 'bingoMulti' : 'bingoSingle')}</p>
            <div
              className="mt-2 grid grid-cols-3 gap-1"
              aria-label={t('bingoGrid')}
            >
              {card.cells.map((cell, index) => (
                <div
                  key={cell.id}
                  className={`min-w-0 border p-2 text-xs ${card.progress.filled[index] ? 'border-marquinhos-green bg-marquinhos-green/15' : 'border-marquinhos-border'}`}
                >
                  {cell.condition.kind === 'participation'
                    ? t('bingoParticipation', {
                        count: card.progress.counts[index],
                        target: cell.condition.target,
                      })
                    : t('bingoPattern', {
                        family: t(`bingoFamily.${cell.condition.family}`, {
                          defaultValue: cell.condition.family,
                        }),
                        count: card.progress.counts[index],
                        target: cell.condition.target,
                      })}
                </div>
              ))}
            </div>
            <p className="mt-2">
              {card.progress.complete
                ? t('bingoComplete')
                : t('bingoLines', { count: card.progress.lines.length })}
            </p>
          </article>
        ))
      )}
    </section>
  );
}
