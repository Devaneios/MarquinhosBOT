import { Navigate } from 'react-router-dom';
import type { DiscordIdentity } from '../../discordAuth.ts';

// This route used to connect directly in 'multi' mode via
// useTriviaQuizSession (its own inline fetchWsSessionToken call, not the
// shared useGameSession hook — the same broken pattern, duplicated) with no
// roomId ever supplied, which crashes today independent of the Rooms
// feature (the server's roomKey() requires a roomId for mode 'multi',
// unconditionally). Trivia Quiz has no mode selector to redirect the way
// Tasks 9-13's games did (the 'menu' scene here is a "ready to start" gate
// AFTER already connecting, not a mode choice before connecting), so the
// fix is redirecting this route itself straight into the Rooms lobby,
// pre-selecting this game. The standalone flow this route used to render
// (menu/question/leaderboard scenes, message handling) is preserved in this
// file's git history for whoever builds its renderRoomBoard variant later —
// full room support is tracked separately, this is only the live-bug fix.
export function TriviaQuizGame(_props: {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}) {
  return <Navigate to="/rooms?create=trivia-quiz" replace />;
}
