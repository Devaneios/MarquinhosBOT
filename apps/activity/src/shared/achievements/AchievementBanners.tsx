import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { animateBannerPixels } from './dissolveBanner';
import {
  ACHIEVEMENT_RARITY_PALETTES,
  type AchievementRarity,
} from './rarityPalette';

interface AchievementBanner {
  title: string;
  name: string;
  reward: string;
  rarity: AchievementRarity;
  dismissLabel: string;
  icon: ReactNode;
}

type Banner = AchievementBanner & { id: number };

const VISIBLE_BANNERS = 3;
const DISPLAY_MS = 4500;
const EXIT_MS = 1100;
const STAGGER_MS = EXIT_MS + 40;

const PublishAchievements = createContext<
  (banners: AchievementBanner[]) => void
>(() => {});

export function useAchievementBanners() {
  return useContext(PublishAchievements);
}

export function AchievementBanners({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const publish = useCallback((achievements: AchievementBanner[]) => {
    const added = achievements.map((achievement) => ({
      ...achievement,
      id: nextId.current++,
    }));
    setBanners((current) => [...current, ...added]);
  }, []);
  const remove = useCallback((id: number) => {
    setBanners((current) => current.filter((banner) => banner.id !== id));
  }, []);

  return (
    <PublishAchievements.Provider value={publish}>
      {children}
      <div className="achievement-banners">
        {banners
          .slice(0, VISIBLE_BANNERS)
          .map((banner, index) => (
            <AchievementBannerCard
              key={banner.id}
              banner={banner}
              delay={index * STAGGER_MS}
              onRemove={remove}
            />
          ))
          .reverse()}
      </div>
    </PublishAchievements.Provider>
  );
}

function AchievementBannerCard({
  banner,
  delay,
  onRemove,
}: {
  banner: Banner;
  delay: number;
  onRemove: (id: number) => void;
}) {
  const palette = ACHIEVEMENT_RARITY_PALETTES[banner.rarity];
  const [displayMs] = useState(() => DISPLAY_MS + delay);
  const [leaving, setLeaving] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const trail = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const bannerElement = card.current;
    const canvas = trail.current;
    if (!bannerElement || !canvas) return;

    if (leaving)
      return animateBannerPixels(bannerElement, canvas, EXIT_MS, banner.rarity);

    let stop = animateBannerPixels(bannerElement, canvas, null, banner.rarity);
    const observer = new ResizeObserver(() => {
      stop?.();
      stop = animateBannerPixels(bannerElement, canvas, null, banner.rarity);
    });
    observer.observe(bannerElement);
    return () => {
      observer.disconnect();
      stop?.();
    };
  }, [banner.rarity, leaving]);

  useEffect(() => {
    if (leaving) {
      const timer = window.setTimeout(() => onRemove(banner.id), EXIT_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setLeaving(true), displayMs);
    return () => window.clearTimeout(timer);
  }, [banner.id, displayMs, leaving, onRemove]);

  return (
    <div
      className="achievement-banner-row"
      data-leaving={leaving}
      style={{ '--banner-exit-time': `${EXIT_MS}ms` }}
    >
      <div className="achievement-banner-slot">
        <div
          className="achievement-banner-motion"
          inert={leaving}
          aria-hidden={leaving}
        >
          <div className="achievement-banner-surface">
            <canvas
              ref={trail}
              className="achievement-banner-trail"
              aria-hidden="true"
            />
            <div
              ref={card}
              className="achievement-banner"
              style={
                {
                  '--banner-rarity-color': palette.base,
                  '--banner-rarity-highlight': palette.highlight,
                  '--banner-rarity-shadow': palette.shadow,
                  '--banner-rarity-deep': palette.deep,
                } as CSSProperties
              }
            >
              <div
                aria-hidden="true"
                className="achievement-banner-icon notch-4"
              >
                {banner.icon}
              </div>
              <div role="status" className="min-w-0">
                <p className="achievement-banner-title font-pixel text-[9px] uppercase tracking-[0.06em]">
                  {banner.title}
                </p>
                <p
                  className="truncate text-sm font-semibold text-marquinhos-text"
                  title={banner.name}
                >
                  {banner.name}
                </p>
                <p className="achievement-banner-xp font-pixel text-[9px]">
                  {banner.reward}
                </p>
              </div>
              <button
                type="button"
                aria-label={banner.dismissLabel}
                className="notch-4 h-6 w-6 self-start text-[10px] text-marquinhos-text-dim hover:bg-white/10 hover:text-marquinhos-text"
                onClick={() => setLeaving(true)}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
