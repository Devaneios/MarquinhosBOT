import { Common, Events } from '@discord/embedded-app-sdk';
import { useEffect, useState } from 'react';
import { discordSdk, isMobilePlatform } from '../discordSdk';

// Discord doesn't document a dedicated "minimized" event for mobile. The
// closest signal is ACTIVITY_LAYOUT_MODE_UPDATE reporting PIP — plausible
// for mobile-minimize but unconfirmed, so a viewport-width fallback runs
// alongside it: a minimized/PIP'd activity's iframe shrinks far below a
// normal mobile viewport (always >= ~360px wide).
const MINIMIZED_WIDTH_THRESHOLD = 200;

export function useIsActivityMinimized(): boolean {
  const [isPip, setIsPip] = useState(false);
  const [isNarrow, setIsNarrow] = useState(
    () => isMobilePlatform() && window.innerWidth < MINIMIZED_WIDTH_THRESHOLD,
  );

  useEffect(() => {
    const listener = (event: { layout_mode: number }) => {
      setIsPip(event.layout_mode === Common.LayoutModeTypeObject.PIP);
    };

    let subscribed = true;
    discordSdk
      .subscribe(Events.ACTIVITY_LAYOUT_MODE_UPDATE, listener)
      .catch(() => {
        subscribed = false;
      });

    return () => {
      if (subscribed) {
        discordSdk
          .unsubscribe(Events.ACTIVITY_LAYOUT_MODE_UPDATE, listener)
          .catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobilePlatform()) return;

    const onResize = () => {
      setIsNarrow(window.innerWidth < MINIMIZED_WIDTH_THRESHOLD);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isPip || isNarrow;
}
