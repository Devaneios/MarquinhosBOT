---
title: Daily Wordle
description: How Terminhos shares rounds, accepted guesses, draft revisions, and rollover across Discord and the Activity.
---

The daily answer and each player's accepted rows belong to the global Wordle date. A player can start with `/termo` in Discord and continue the same board in the Activity. Guild presence records where the player joined the round. That context supports community statistics and announcements. [Global game coordinator](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/wordle/gameplay/wordle-global-game-coordinator.ts) · [Discord command](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/commands/games/termo.ts) · [Activity room adapter](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/realtime/adapters/wordleAdapter.ts)

## Submit, retry, and restore

The API normalizes guesses and checks them against the word bank and round rules. Accepted guesses are serialized for each player and stored with their scored feedback. When resending the same action, keep its request ID and guess so the API can replay the receipt. The date identifies the intended round. After a connection drop, reload the current snapshot before submitting new input. The Activity sends `wordle_sync` at join and after reconnect. A dropped Wordle client has a 30-second room reconnection window. [Guess persistence and receipts](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/wordle/gameplay/wordle-global-gameplay.service.ts) · [Activity client sync](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/activity/src/platform/realtime/colyseus/connection.ts) · [Room reconnection](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/realtime/MatchRoom.ts)

An unfinished row is a revisioned draft. A write with an outdated expected revision returns the authoritative draft in a conflict result. A closed round cannot accept edits. After the date closes, the draft finalizer can award a zero-attempt win if the final saved draft matches the answer and the player made no accepted guesses. Discord edits reach the backend only when Discord delivers an autocomplete interaction. [Draft request and result schemas](https://github.com/Devaneios/MarquinhosBOT/blob/main/packages/contracts/src/wordle.ts) · [Draft lifecycle and scheduling](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/wordle-operations.md)

## Rollover

The bot and API must agree on `WORDLE_TIMEZONE`, which defaults to `America/Recife`. The first lookup for a new date creates that round. Repeated rollover requests reuse it. Development can replace the current global round for testing. Outside development, the replacement endpoint returns `409`. Run reset scenarios against an isolated database because a replacement affects every guild sharing that round. [Wordle service](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/wordle/wordle.service.ts) · [Rollover operations](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/wordle-operations.md)
