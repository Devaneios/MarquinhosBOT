import type {
  WordlePatternEvidence,
  WordlePatternPreview,
} from '@marquinhos/contracts/wordle';
import { useTranslation } from 'react-i18next';

const CELL_COLORS = {
  correct: 'bg-[#538d4e]',
  present: 'bg-[#b59f3b]',
  absent: 'bg-[#3a3a3c]',
};

export function WordlePatternDisplay({
  preview,
  evidence,
}: {
  preview?: WordlePatternPreview;
  evidence?: WordlePatternEvidence | null;
}) {
  const { t } = useTranslation('wordle');
  const matched = new Set(
    evidence?.cells.map(([row, column]) => `${row},${column}`),
  );
  return (
    <div className="flex flex-col gap-3">
      {preview && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-marquinhos-text-dim">
            {t('patternSubsetHint')}
          </p>
          <div className="flex flex-wrap gap-5">
            {[preview.mask, ...(preview.variants ?? [])].flatMap(
              (mask, variant) =>
                preview.colors.map((color) => (
                  <figure
                    key={`${variant}-${color}`}
                    className="flex flex-col gap-2"
                  >
                    <figcaption className="text-xs text-marquinhos-text-dim">
                      {t(`patternColor.${color}`)}
                    </figcaption>
                    <div
                      role="img"
                      aria-label={t('patternPreviewLabel', {
                        color: t(`patternColor.${color}`),
                      })}
                      className="grid w-fit gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${mask[0]?.length ?? 1}, 1.25rem)`,
                      }}
                    >
                      {mask.flatMap((row, rowIndex) =>
                        [...row].map((cell, column) => (
                          <span
                            key={`${rowIndex},${column}`}
                            data-required={cell === '#'}
                            aria-hidden="true"
                            className={`h-5 w-5 rounded-sm border ${cell === '#' ? `${CELL_COLORS[color]} border-white/30` : 'border-dashed border-white/20'}`}
                          />
                        )),
                      )}
                    </div>
                  </figure>
                )),
            )}
          </div>
          {preview.rotations.length > 1 && (
            <p className="text-xs text-marquinhos-text-dim">
              {t('patternRotationHint')}
            </p>
          )}
        </div>
      )}
      {evidence && (
        <figure className="flex flex-col gap-2">
          <figcaption className="text-xs text-marquinhos-text-dim">
            {t('patternEvidenceDate', { date: evidence.date })}
          </figcaption>
          <div className="max-h-64 overflow-y-auto p-1">
            <div
              role="img"
              aria-label={t('patternEvidenceLabel', {
                color: t(`patternColor.${evidence.color}`),
              })}
              className="grid w-fit gap-1"
              style={{
                gridTemplateColumns: `repeat(${evidence.feedback[0]?.length ?? 1}, 1.5rem)`,
              }}
            >
              {evidence.feedback.flatMap((row, rowIndex) =>
                row.map((color, column) => {
                  const highlighted = matched.has(`${rowIndex},${column}`);
                  return (
                    <span
                      key={`${rowIndex},${column}`}
                      aria-hidden="true"
                      data-color={color}
                      data-matched={highlighted}
                      className={`h-6 w-6 rounded-sm ${CELL_COLORS[color]} ${highlighted ? 'ring-2 ring-white ring-inset' : 'opacity-35'}`}
                    />
                  );
                }),
              )}
            </div>
          </div>
          <p className="text-xs text-marquinhos-text-dim">
            {t('patternHighlightHint')}
          </p>
        </figure>
      )}
    </div>
  );
}
