// §6.3 mandates that a rejected action come back to the Session's caller
// instead of being broadcast (AP-1), but never pinned down the shape of
// that return value — five sessions each invented their own:
// {valid, error?} (word-chain), {ok, error?} (checkers), {success, error?}
// (tic-tac-toe, tower), {error?} (wordle-race). One shared shape, and one
// client-facing message name (`action_rejected`) so no client needs a
// per-game vocabulary just to render "that move didn't work."
export type ActionResult = { ok: true } | { ok: false; error: string };

export const ACTION_REJECTED = 'action_rejected';
