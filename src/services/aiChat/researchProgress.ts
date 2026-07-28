import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import type {
  ResearchJobResponse,
  ResearchSource,
  ResearchStats,
} from '@marquinhos/types';
import { logger } from '@marquinhos/utils/logger';
import { sleep } from '@marquinhos/utils/sleep';
import { sendThreadReply, type AiThreadChannel } from './aiThread';
import { ERROR_FALLBACK_POOL } from './cannedPools';

export const POLL_INTERVAL_MS = 5000;
/** Comfortably past the API's own research deadline, so the API decides first. */
export const POLL_TIMEOUT_MS = 25 * 60_000;

const STAGE_LABELS: Record<string, string> = {
  plan: '🗺️ **Plano**',
  search: '🔎 **Busca**',
  triage: '⚖️ **Triagem**',
  read: '📄 **Leitura**',
  extract: '🧪 **Extração**',
  follow: '🧵 **Novas pistas**',
  reflect: '🤔 **Revisão**',
  analyze: '🧠 **Análise**',
  budget: '⏳ **Limite**',
  synthesize: '✍️ **Síntese**',
};

export function formatProgress(stage: string, message: string): string {
  return `${STAGE_LABELS[stage] ?? `**${stage}**`}\n${message}`;
}

export function formatSources(sources: ResearchSource[]): string {
  return [
    '## Fontes',
    ...sources.map((source) => {
      const date = source.publishedDate ? ` — ${source.publishedDate}` : '';
      return `${source.index}. [${source.title}](${source.url})${date}`;
    }),
  ].join('\n');
}

export function formatStats(stats: ResearchStats): string {
  const parts = [
    `${stats.relevantSources} fonte(s) úteis`,
    `${stats.searches} busca(s)`,
    `${stats.fetched} página(s) lidas`,
    `${stats.rounds} rodada(s)`,
    `profundidade ${stats.maxDepth}`,
    `${Math.round(stats.durationMs / 1000)}s`,
  ];
  const note = stats.truncatedByBudget
    ? '\n_A pesquisa parou por limite de tempo ou orçamento antes de esgotar o tema._'
    : '';
  return `-# ${parts.join(' · ')}${note}`;
}

export interface PollDeps {
  apiService?: Pick<MarquinhosApiService, 'getResearchJob'>;
  pollIntervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

/**
 * Follows a research job to completion, posting each new progress event into the
 * thread as it happens and then the report itself.
 *
 * Polling rather than streaming: a research pass runs for minutes, well past the
 * bot's HTTP timeout and Discord's interaction token, so the job has to be
 * detached on the API side and observed from here.
 */
export async function followResearchJob(
  thread: AiThreadChannel,
  jobId: string,
  deps: PollDeps = {},
): Promise<ResearchJobResponse | null> {
  const apiService = deps.apiService ?? MarquinhosApiService.getInstance();
  const pollIntervalMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = deps.timeoutMs ?? POLL_TIMEOUT_MS;
  const now = deps.now ?? Date.now;
  const wait = deps.wait ?? sleep;

  const startedAt = now();
  let lastSeq = 0;

  while (true) {
    if (now() - startedAt > timeoutMs) {
      await thread
        .send(
          'Essa pesquisa passou do tempo que eu aguento esperar. Se o relatório aparecer depois, foi mal a demora.',
        )
        .catch(() => null);
      return null;
    }

    let job: ResearchJobResponse | undefined;
    try {
      job = (await apiService.getResearchJob(jobId)).data;
    } catch (error) {
      // A single failed poll is not fatal — the job keeps running server-side.
      logger.warn(
        `[ai-chat] poll da pesquisa falhou job=${jobId}: ${(error as Error).message}`,
      );
    }

    if (job) {
      for (const event of job.progress.filter((e) => e.seq > lastSeq)) {
        lastSeq = Math.max(lastSeq, event.seq);
        await thread
          .send(formatProgress(event.stage, event.message))
          .catch(() => null);
      }

      if (job.status === 'done') {
        await deliverReport(thread, job);
        return job;
      }
      if (job.status === 'error') {
        await thread
          .send(
            job.error
              ? `Não consegui terminar a pesquisa: ${job.error}`
              : ERROR_FALLBACK_POOL[0]!,
          )
          .catch(() => null);
        return job;
      }
    }

    await wait(pollIntervalMs);
  }
}

async function deliverReport(
  thread: AiThreadChannel,
  job: ResearchJobResponse,
): Promise<void> {
  if (job.report) {
    await sendThreadReply(thread, job.report, { format: 'text' });
  }
  if (job.sources?.length) {
    await sendThreadReply(thread, formatSources(job.sources), {
      format: 'text',
    });
  }
  if (job.stats) {
    await thread.send(formatStats(job.stats)).catch(() => null);
  }
  logger.info(
    `[ai-chat] pesquisa entregue job=${job.jobId} thread=${thread.id} fontes=${job.sources?.length ?? 0}`,
  );
}
