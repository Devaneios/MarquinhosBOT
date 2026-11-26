---
title: Music and Last.fm
description: Where the Discord voice queue lives and how recorded listening follows playback.
---

The bot's discord-player instance owns one voice queue per guild. `/play` resolves a track and sends it to that queue. `/adicionar-a-fila` can insert into an existing queue. Voice preconditions check whether the user has joined voice and whether the bot can connect and speak there. Queue membership and voice permissions are checked in Discord. The API's Last.fm queue is for playback records. [Music command definitions](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/lib/commandDefinitions.ts) · [Voice playback](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/commands/music/utils.ts) · [Scrobble controller](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/scrobble/scrobble.controller.ts)

## Playback lifecycle

The bot posts now-playing and queue updates into the text channel stored in queue metadata. It can leave after the queue ends or when the voice channel becomes empty. The configured delays are 15 seconds after playback ends and 60 seconds after the channel empties. For a failed track, the player emits an error and asks the user to try again. Check the configured extractor when valid inputs return no tracks. The Deezer extractor is registered only when the ARL credential is configured. [Player events and extractor setup](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/lib/player.ts) · [Voice queue options](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/commands/music/utils.ts)

## Listening records

Last.fm linking stores an encrypted session credential and enables scrobbling. When a playback event is submitted, the API resolves a track and queues eligible playback of at least 30 seconds. On dispatch it checks each listener's scrobble setting, removes settled items, and defers transient failures with exponential backoff. Invalid Last.fm sessions are handled by the service. If a user wants to stop new submissions, use the account's scrobble toggle or unlink the session. [Account settings](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/user/user.service.ts) · [Last.fm queue and retries](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/integrations/lastfm/lastfm.service.ts)
