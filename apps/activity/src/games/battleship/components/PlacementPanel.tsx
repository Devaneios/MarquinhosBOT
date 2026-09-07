import { useTranslation } from 'react-i18next';
import {
  SHIP_ORDER,
  SHIP_SIZES,
  type Orientation,
  type PendingShip,
  type ShipType,
} from '../types';

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
  pendingShips: PendingShip[];
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
  const allPlaced = placedTypes.size === SHIP_ORDER.length;
  const shipLabelKey: Record<ShipType, string> = {
    carrier: 'shipCarrier',
    battleship: 'shipBattleship',
    cruiser: 'shipCruiser',
    submarine: 'shipSubmarine',
    destroyer: 'shipDestroyer',
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-sm uppercase tracking-[0.2em] text-marquinhos-text-dim">
        {t('placeFleet')}
      </div>
      <div className="flex flex-wrap gap-2">
        {SHIP_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            disabled={placedTypes.has(type)}
            onClick={() => onSelectType(type)}
            className={`notch-4 border px-3 py-2 text-xs uppercase tracking-[0.14em] transition disabled:opacity-40 ${
              selectedType === type
                ? 'border-marquinhos-accent bg-marquinhos-accent/20 text-marquinhos-accent'
                : 'border-marquinhos-border bg-marquinhos-panel text-marquinhos-text-dim'
            }`}
          >
            {t(shipLabelKey[type])} ({SHIP_SIZES[type]})
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
