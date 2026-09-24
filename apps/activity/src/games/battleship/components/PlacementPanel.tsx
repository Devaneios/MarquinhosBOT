import {
  SHIP_TYPES,
  type Orientation,
  type ShipPlacement,
  type ShipType,
} from '@marquinhos/contracts/activity/games/battleship';
import { SHIP_SIZES } from '@marquinhos/domain/games/battleship/BattleshipEngine';
import { useTranslation } from 'react-i18next';

export function PlacementPanel({
  pendingShips,
  selectedType,
  orientation,
  onSelectType,
  onToggleOrientation,
  onSubmit,
  onReset,
  error,
}: {
  pendingShips: ShipPlacement[];
  selectedType: ShipType | null;
  orientation: Orientation;
  onSelectType: (type: ShipType) => void;
  onToggleOrientation: () => void;
  onSubmit: () => void;
  onReset: () => void;
  error: string | null;
}) {
  const { t } = useTranslation('battleship');
  const placedTypes = new Set(pendingShips.map((ship) => ship.type));
  const allPlaced = placedTypes.size === SHIP_TYPES.length;
  const shipLabelKey: Record<ShipType, string> = {
    carrier: 'shipCarrier',
    battleship: 'shipBattleship',
    cruiser: 'shipCruiser',
    submarine: 'shipSubmarine',
    destroyer: 'shipDestroyer',
  };

  return (
    <div className="flex w-full flex-col gap-4 p-4 sm:w-72 sm:shrink-0">
      <div className="flex items-baseline justify-between gap-3 text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
        <span>{t('placeFleet')}</span>
        <span className="tabular-nums text-marquinhos-accent">
          {placedTypes.size}/{SHIP_TYPES.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {SHIP_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            disabled={placedTypes.has(type)}
            onClick={() => onSelectType(type)}
            className={`notch-4 flex items-center justify-between gap-3 border px-3 py-2 text-xs uppercase tracking-[0.14em] transition disabled:opacity-40 ${
              selectedType === type
                ? 'border-marquinhos-accent bg-marquinhos-accent/20 text-marquinhos-accent'
                : 'border-marquinhos-border bg-marquinhos-panel text-marquinhos-text-dim hover:border-marquinhos-border-hover'
            }`}
          >
            <span className={placedTypes.has(type) ? 'line-through' : ''}>
              {t(shipLabelKey[type])}
            </span>
            <span
              className="flex gap-0.5"
              aria-label={String(SHIP_SIZES[type])}
            >
              {Array.from({ length: SHIP_SIZES[type] }, (_, i) => (
                <span key={i} className="h-2.5 w-2.5 bg-current opacity-80" />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleOrientation}
          className="notch-4 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.14em] text-marquinhos-text-dim"
        >
          {t('orientationLabel')}:{' '}
          {t(
            orientation === 'horizontal'
              ? 'orientationHorizontal'
              : 'orientationVertical',
          )}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="notch-4 border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-xs uppercase tracking-[0.14em] text-marquinhos-text-dim"
        >
          {t('reset')}
        </button>
      </div>
      {error && <div className="text-sm text-marquinhos-danger">{error}</div>}
      <button
        type="button"
        disabled={!allPlaced}
        onClick={onSubmit}
        className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-5 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('confirmFleet')}
      </button>
    </div>
  );
}
