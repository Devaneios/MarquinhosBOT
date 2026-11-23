import { useState } from 'react';

interface AchievementIconProps {
  icon: string;
  className?: string;
}

export function AchievementIcon({ icon, className }: AchievementIconProps) {
  if (!icon.startsWith('/')) return <>{icon}</>;
  return <AchievementImage icon={icon} className={className} />;
}

function AchievementImage({ icon, className }: AchievementIconProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={className} aria-hidden="true">
        🏅
      </span>
    );
  }
  return (
    <img
      src={icon}
      alt=""
      draggable={false}
      className={className}
      style={{ imageRendering: 'pixelated' }}
      onError={() => setFailed(true)}
    />
  );
}
