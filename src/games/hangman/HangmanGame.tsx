import { Navigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';

// This route used to connect directly in 'multi' mode via
// useHangmanSession/useGameSession with no roomId ever supplied — which
// crashes today independent of the Rooms feature (the server's roomKey()
// requires a roomId for mode 'multi', unconditionally). Hangman has no mode
// selector to redirect the way Tasks 9-13's games did, so the fix is
// redirecting this route itself straight into the Rooms lobby, pre-selecting
// this game. Full room-board support is tracked separately — this is only
// the live-bug fix.
export function HangmanGame(_props: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  return <Navigate to="/rooms?create=hangman" replace />;
}
