import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WordleGallery } from '../api/wordleGalleryApi';
import { WordlePatternDisplay } from './WordlePatternDisplay';

export function WordleGalleryPanel({
  load,
}: {
  load: () => Promise<WordleGallery>;
}) {
  const { t } = useTranslation('wordle');
  const [gallery, setGallery] = useState<WordleGallery | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    load().then(
      (value) => {
        if (active) setGallery(value);
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
      aria-label={t('galleryTitle')}
    >
      <h2 className="font-semibold">{t('galleryTitle')}</h2>
      <p className="text-sm text-marquinhos-text-dim">
        {t('galleryDescription')}
      </p>
      {error ? (
        <p role="alert">
          {t('galleryError')}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t('showcaseRetry')}
          </button>
        </p>
      ) : gallery === null ? (
        <p role="status">{t('galleryLoading')}</p>
      ) : gallery.entries.length === 0 ? (
        <p>{t('galleryEmpty')}</p>
      ) : (
        <>
          <p>{t('galleryWeek', { week: gallery.weekKey })}</p>
          {gallery.entries.map((entry) => (
            <article
              key={`${entry.userId}:${entry.patternId}`}
              className="mt-3 border border-marquinhos-border p-3"
            >
              <h3 className="font-semibold">{entry.name}</h3>
              <p>{t('galleryUser', { user: entry.userId })}</p>
              <WordlePatternDisplay evidence={entry.evidence} shared />
            </article>
          ))}
        </>
      )}
    </section>
  );
}
