import type { DiscordIdentity } from '@/platform/discord/auth';
import { useParams } from 'react-router-dom';
import { CardTable } from './CardTable';

export function CardTableRoute({
  identity,
  onAuthInvalid,
}: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  // Always present: the only route that renders this is `cards/:ruleset`,
  // reached via CardModeSelect's explicit links.
  const { ruleset } = useParams<{ ruleset: string }>();
  return (
    <CardTable
      identity={identity}
      onAuthInvalid={onAuthInvalid}
      ruleset={ruleset!}
    />
  );
}
