---
title: Shared multiplayer match room
description: Why game switching keeps one Colyseus room and swaps the active adapter.
---

**Context.** A Discord Activity instance can host multiple game rooms. Players also open private CPU and local games in the same instance. The instance ID alone cannot distinguish these sessions. [Room key construction](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/activity/room-key.ts)

**Decision.** Use room keys scoped to the Activity instance, game and mode. Multiplayer keys include the room ID and private keys include the player ID. A multiplayer host can switch the game between matches. The room keeps membership and replaces the active adapter and its message handlers. [Room authentication and adapter lifecycle](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/realtime/MatchRoom.ts)

**Consequences.** A multiplayer connection belongs to the room provider. Game boards consume it as the host switches games. Room admission still verifies the signed credential and treats a game change as the same room only when the multiplayer scope matches. [Multiplayer connection provider](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/activity/src/features/rooms/connection/RoomConnectionProvider.tsx) · [Admission rules](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/realtime/MatchRoom.ts)
