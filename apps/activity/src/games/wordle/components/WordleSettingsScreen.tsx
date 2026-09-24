import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MenuPanel,
  MenuScreen,
  menuButtonPrimary,
} from '../../../components/game-shell/index';
import { WordleToggleTile } from './WordleToggleTile';

const fieldLabel = 'font-pixel text-sm text-marquinhos-text';
const settingRow =
  'notch-6 flex items-center justify-between gap-4 border border-marquinhos-border bg-white/5 px-4 py-3';

export function WordleSettingsScreen({
  config,
  onSave,
  onBack,
}: {
  config: WordleUserConfig;
  onSave: (config: WordleUserConfig) => Promise<void>;
  onBack: () => void;
}) {
  const { t } = useTranslation(['wordle', 'common']);
  const [draft, setDraft] = useState(config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setSaving(false);
      onBack();
    } catch {
      setError(t('wordle:settingsSaveError'));
      setSaving(false);
    }
  }

  function back() {
    if (!saving) onBack();
  }

  return (
    <MenuScreen
      titleKey="wordle.name"
      titleNs="games"
      headingKey="settings"
      headingNs="common"
      onBack={back}
    >
      <p className="text-sm leading-6 text-marquinhos-text-dim">
        {t('wordle:settingsSubtitle')}
      </p>

      <MenuPanel className="p-5 sm:p-6 max-w-md">
        <div className="flex flex-col gap-4">
          {/*<div className={settingRow}>*/}
          {/*  <div className="min-w-0">*/}
          {/*    <label htmlFor="wordle-sounds-toggle" className={fieldLabel}>*/}
          {/*      {t('wordle:keyboardSoundsLabel')}*/}
          {/*    </label>*/}
          {/*    <p className="mt-1 text-sm leading-6 text-marquinhos-text-dim">*/}
          {/*      {t('wordle:keyboardSoundsDescription')}*/}
          {/*    </p>*/}
          {/*  </div>*/}
          {/*  <WordleToggleTile*/}
          {/*    id="wordle-sounds-toggle"*/}
          {/*    checked={draft.enableSounds}*/}
          {/*    disabled={saving}*/}
          {/*    onChange={(enableSounds) =>*/}
          {/*      setDraft((current) => ({ ...current, enableSounds }))*/}
          {/*    }*/}
          {/*  />*/}
          {/*</div>*/}

          <div className={settingRow}>
            <div className="min-w-0">
              <label htmlFor="wordle-invert-toggle" className={fieldLabel}>
                {t('wordle:invertActionKeysLabel')}
              </label>
              <p className="mt-1 text-sm leading-6 text-marquinhos-text-dim">
                {t('wordle:invertActionKeysDescription')}
              </p>
            </div>
            <WordleToggleTile
              id="wordle-invert-toggle"
              checked={draft.invertActionKeys}
              disabled={saving}
              onChange={(invertActionKeys) =>
                setDraft((current) => ({ ...current, invertActionKeys }))
              }
            />
          </div>

          <div className="notch-6 border border-marquinhos-border bg-white/5">
            <div className="flex flex-col px-4 py-3">
              <label htmlFor="wordle-space-toggle" className={fieldLabel}>
                {t('wordle:enableSpaceKeyLabel')}
              </label>
              <div className="flex justify-between gap-4 py-3 min-w-0">
                <p className="mt-1 text-sm leading-6 text-marquinhos-text-dim">
                  {t('wordle:enableSpaceKeyDescription')}
                </p>
                <WordleToggleTile
                  id="wordle-space-toggle"
                  checked={draft.enableSpaceKey}
                  disabled={saving}
                  onChange={(enableSpaceKey) =>
                    setDraft((current) =>
                      enableSpaceKey
                        ? { ...current, enableSpaceKey: true }
                        : {
                            ...current,
                            enableSpaceKey: false,
                            enableArrowKeys: false,
                          },
                    )
                  }
                />
              </div>
            </div>

            <div className="ml-6 flex flex-col px-4 py-3">
              <label htmlFor="wordle-arrows-toggle" className={fieldLabel}>
                {t('wordle:enableArrowKeysLabel')}
              </label>
              <div className="flex justify-between gap-4 py-3 min-w-0">
                <p className="mt-1 text-sm leading-6 text-marquinhos-text-dim">
                  {t('wordle:enableArrowKeysDescription')}
                </p>
                <WordleToggleTile
                  id="wordle-arrows-toggle"
                  checked={draft.enableArrowKeys}
                  disabled={saving || !draft.enableSpaceKey}
                  onChange={(enableArrowKeys) =>
                    setDraft((current) =>
                      current.enableSpaceKey
                        ? { ...current, enableArrowKeys }
                        : current,
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className={menuButtonPrimary}
              disabled={saving}
              onClick={() => void save()}
            >
              {t(saving ? 'wordle:savingSettings' : 'wordle:saveSettings')}
            </button>
          </div>
        </div>
      </MenuPanel>

      {error && (
        <div className="notch-6 border border-marquinhos-danger/40 bg-marquinhos-danger/10 p-3 text-center text-sm text-marquinhos-danger">
          {error}
        </div>
      )}
    </MenuScreen>
  );
}
