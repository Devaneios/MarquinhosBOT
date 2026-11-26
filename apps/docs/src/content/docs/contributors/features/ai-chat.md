---
title: AI chat and research
description: How Discord questions get answers and how research keeps running after an interaction expires.
---

`/ia perguntar` sends a question in Discord thread context. The API can compact the stored conversation to preserve context as the thread grows. Requests that exceed chat quotas return `rate_limited` in the response body, which the bot can display without retrying the same question repeatedly. The service seeds a default daily limit of 100 requests per user and 2,000 globally when no configured values exist. [Discord AI command](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/commands/ai/ia.ts) · [Thread context and compaction](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/ai-chat/thread/ai-thread.service.ts) · [Chat quota defaults](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/ai-chat/rate-limit.service.ts)

## Follow a research job

`/ia pesquisar` opens a thread and asks the API to start a job. An accepted job returns `202` with its job ID. A repeated start with the same idempotency key can recover the existing job without consuming another daily slot. A refusal or quota decision arrives with `200` and a structured outcome. Research jobs progress through queued and running states, then finish with a report or an error. The bot polls by job ID and publishes progress events in sequence. The Discord thread can outlive the initial interaction. [Research start operation](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/ai-chat/ai-chat.controller.ts) · [Job creation and quota](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/api/src/modules/ai-chat/research/research-orchestrator.service.ts) · [Discord polling](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/services/aiChat/researchProgress.ts)

## Diagnose a missing reply

For research, use the job ID to distinguish a pending job, a terminal error, and a missing job. A transient polling failure can recover on a later attempt while the bot is still polling. For chat replies, the bot-only trace endpoints expose saved prompts, replies, and execution events. Treat trace content as user conversation data when troubleshooting. [Polling failure handling](https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/services/aiChat/researchProgress.ts) · [Trace and research response schemas](https://github.com/Devaneios/MarquinhosBOT/blob/main/packages/contracts/src/http/routes/aiChat.ts)
