// Deliberately different from Pong's ActivityBroadcaster: card games need
// per-player addressing because each player's state view is masked differently,
// unlike Pong's single public physics broadcast.
//
// There is no `key` parameter. ActivityBroadcaster carries one because a central
// key-routed server once needed to know which room a message belonged to; a
// Colyseus Room *is* the room, so every implementation ignored it and
// CardTableSession kept a private getter solely to supply an ignored argument.
//
// `sendToPlayer` must reach EVERY live socket the user holds, not the first one
// found: a React remount opens a second socket before the first has finished
// closing, and a user with two tabs is two sockets for one userId. Delivering to
// one of them leaves the other rendering a table that never updates.
export interface PerClientBroadcaster {
  sendToPlayer(
    userId: string,
    message: { type: string; payload?: unknown },
  ): void;
  broadcastPublic(message: { type: string; payload?: unknown }): void;
}
