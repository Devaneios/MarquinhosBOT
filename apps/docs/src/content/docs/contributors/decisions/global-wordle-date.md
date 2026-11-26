---
title: Global date for the daily Wordle round
description: Why Wordle answer and board identity are global while community credit is scoped to a guild.
---

**Context.** Players use the bot and the Activity to play the same daily round. A single Discord user can interact from several guilds before finishing. Guilds still need their own leaderboards, announcements, and collective progress. [Global migration design](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/wordle-global-migration.md)

**Decision.** Key the shared answer by configured Wordle date and player state by user and date. Track community participation and win claims separately. Attribute a guild win when the player was present in that guild before or at the time they solved. [Guess persistence](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/wordle/gameplay/wordle-global-gameplay.service.ts) · [Guild win claims](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/wordle/gameplay/wordle-global-announcement.service.ts)

**Consequences.** API and bot calendar configuration must agree. Community actions use guild context while the same accepted board follows the user. The development-only replacement operation affects the entire current round, so test it against an isolated database. [Calendar runbook](https://github.com/Devaneios/MarquinhosBOT/blob/main/docs/wordle-operations.md) · [Replacement policy](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/wordle/wordle.service.ts)
