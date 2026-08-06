import { Route, useParams } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { CardModeSelect } from './CardModeSelect';
import { CardTable } from './CardTable';

function CardTableRoute({
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

export function cardsRoutes(
  identity: DiscordIdentity,
  onAuthInvalid: () => void,
) {
  return (
    <>
      <Route path="cards" element={<CardModeSelect />} />
      <Route
        path="cards/:ruleset"
        element={
          <CardTableRoute identity={identity} onAuthInvalid={onAuthInvalid} />
        }
      />
    </>
  );
}
