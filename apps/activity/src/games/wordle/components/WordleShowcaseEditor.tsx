import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Item = {
  id: string;
  name: string;
  icon: string;
  unlockedAt: string | null;
};
export function WordleShowcaseEditor({
  achievements,
  load,
  save,
}: {
  achievements: Item[];
  load: () => Promise<string[]>;
  save: (ids: string[]) => Promise<string[]>;
}) {
  const { t } = useTranslation('wordle');
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'saving' | 'error' | 'save-error'
  >('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    load().then(
      (ids) => {
        if (active) {
          setSelected(ids);
          setStatus('ready');
        }
      },
      () => {
        if (active) setStatus('error');
      },
    );
    return () => {
      active = false;
    };
  }, [load, retry]);
  const items = achievements.filter((item) => item.unlockedAt !== null);
  async function onSave() {
    setStatus('saving');
    try {
      setSelected(await save(selected));
      setStatus('ready');
    } catch {
      setStatus('save-error');
    }
  }
  return (
    <section
      className="notch-4 border border-marquinhos-border bg-white/5 p-4"
      aria-label={t('showcaseTitle')}
    >
      <h2 className="font-semibold text-marquinhos-text">
        {t('showcaseTitle')}
      </h2>
      <p className="text-sm text-marquinhos-text-dim">
        {t('showcaseDescription')}
      </p>
      {status === 'loading' && <p role="status">{t('showcaseLoading')}</p>}
      {status === 'error' && (
        <div role="alert">
          <p>{t('showcaseError')}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            {t('showcaseRetry')}
          </button>
        </div>
      )}
      {(status === 'ready' ||
        status === 'saving' ||
        status === 'save-error') && (
        <>
          {status === 'save-error' && <p role="alert">{t('showcaseError')}</p>}
          <ol className="my-3 flex flex-col gap-2">
            {selected.map((id, index) => {
              const item = items.find((entry) => entry.id === id);
              const name = item?.name || id;
              return (
                <li key={id} className="flex items-center gap-2">
                  <span>
                    {index + 1}. {item?.icon} {name}
                  </span>
                  <button
                    type="button"
                    disabled={index === 0 || status === 'saving'}
                    aria-label={t('showcaseMoveUp', { name })}
                    onClick={() =>
                      setSelected((current) => {
                        const next = [...current];
                        [next[index - 1], next[index]] = [
                          next[index]!,
                          next[index - 1]!,
                        ];
                        return next;
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={status === 'saving'}
                    aria-label={t('showcaseRemove', { name })}
                    onClick={() =>
                      setSelected((current) =>
                        current.filter((value) => value !== id),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            {items
              .filter((item) => !selected.includes(item.id))
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="border border-marquinhos-border px-2 py-1"
                  disabled={selected.length >= 3 || status === 'saving'}
                  aria-label={t('showcaseAdd', { name: item.name })}
                  onClick={() =>
                    setSelected((current) => [...current, item.id])
                  }
                >
                  {item.icon} {item.name} +
                </button>
              ))}
          </div>
          <button
            type="button"
            className="mt-3 border border-marquinhos-accent px-3 py-1"
            disabled={status === 'saving'}
            onClick={onSave}
          >
            {t('showcaseSave')}
          </button>
        </>
      )}
    </section>
  );
}
