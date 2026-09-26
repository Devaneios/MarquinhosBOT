import { useNavigateForward } from '@/shared/motion/transitions';
import { cn } from '@/shared/utils/cn';
import type { GameId } from '@marquinhos/contracts/activity/gameId';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function PlayGameLink({
  gameId,
  featured = false,
}: {
  gameId: GameId;
  featured?: boolean;
}) {
  const { t } = useTranslation(['common', 'games']);
  const navigateForward = useNavigateForward();
  const to = `/games/${gameId}`;

  return (
    <Link
      to={to}
      onClick={(event) => {
        event.preventDefault();
        navigateForward(to);
      }}
      className={cn(
        'inline-flex min-h-12 w-full scroll-my-4 items-center justify-between gap-4 rounded-sm border px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marquinhos-accent motion-safe:transition-colors',
        featured
          ? 'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg hover:border-marquinhos-accent-hover hover:bg-marquinhos-accent-hover'
          : 'border-marquinhos-border text-marquinhos-text hover:border-marquinhos-accent hover:text-marquinhos-accent',
      )}
    >
      {t('common:hub.playGame', { game: t(`games:${gameId}.name`) })}
      <svg
        aria-hidden="true"
        focusable="false"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M3 10h13m-5-5 5 5-5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="miter"
        />
      </svg>
    </Link>
  );
}
