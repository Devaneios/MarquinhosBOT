import { Inject, Injectable } from '@nestjs/common';
import { getErrorMessage } from 'common/errors/error-handling';
import { logger } from 'common/logging/logger';
import { ToolDispatcher } from 'modules/ai-chat/agent/tool-dispatcher';
import {
  AI_AGENT_DAILY_QUOTA_SERVICE,
  AI_NOW,
} from 'modules/ai-chat/ai-chat.tokens';
import { DailyQuotaService } from 'modules/ai-chat/daily-quota.service';
import { GuardrailService } from 'modules/ai-chat/guardrail.service';
import {
  OpenAiClient,
  type OpenAiToolMessage,
} from 'modules/ai-chat/openai.client';
import { AGENT_TASK_SYSTEM_PROMPT } from 'modules/ai-chat/prompts';
import {
  SandboxCapacityError,
  SandboxManager,
} from 'modules/ai-chat/sandbox/sandbox-manager.service';
import { toOpenAiTools } from 'modules/ai-chat/tools/registry';
import {
  NOOP_TRACE,
  type TraceContext,
} from 'modules/ai-chat/trace/ai-trace-recorder.service';
import type { AiChatRequest, AiChatResult } from 'modules/ai-chat/types';
import type OpenAI from 'openai';

export const MAX_ITERATIONS = 15;
export const MAX_TOOL_CALLS_TOTAL = 30;
// The bot's HTTP client gives respondToTag 120s. Stopping the loop well before
// that lets us send back what we found instead of the caller timing out.
export const AGENT_DEADLINE_MS = 90_000;
const EMBED_THRESHOLD_CHARS = 1800;
const EMBED_TITLE = '🛠️ Resultado';
const WRAP_UP_INSTRUCTION = `Seu orçamento de ferramentas acabou, então não chame mais nenhuma ferramenta. Responda agora ao pedido original resumindo o que você já descobriu até aqui, incluindo o caminho ou os passos que você percorreu. Se não terminou a tarefa, diga onde parou e o que faltou.`;
const WRAP_UP_FALLBACK =
  'Não consegui terminar essa tarefa a tempo. Tenta pedir algo mais simples ou dividir em partes menores.';

@Injectable()
export class AgentToolLoopService {
  constructor(
    @Inject(AI_AGENT_DAILY_QUOTA_SERVICE)
    private readonly agentRateLimitService: DailyQuotaService,
    private readonly guardrailService: GuardrailService,
    private readonly sandboxManager: SandboxManager,
    private readonly openAiClient: OpenAiClient,
    @Inject(AI_NOW) private readonly now: () => number,
    private readonly toolDispatcher: ToolDispatcher,
  ) {}

  async run(
    request: AiChatRequest,
    trace: TraceContext = NOOP_TRACE,
  ): Promise<AiChatResult> {
    const allowed = await this.agentRateLimitService.checkAndIncrement(
      request.userId,
      request.guildId,
    );
    if (!allowed) {
      trace.finish({ status: 'rate_limited', mainCategory: 'agent_task' });
      return { status: 'rate_limited' };
    }

    let containerId: string;
    const sessionStartedAt = Date.now();
    try {
      containerId = await this.sandboxManager.getOrCreateSession(
        request.userId,
        request.guildId,
        request.channelId,
      );
      trace.sandbox({
        action: 'session_acquired',
        containerId,
        durationMs: Date.now() - sessionStartedAt,
      });
    } catch (error) {
      trace.sandbox({
        action:
          error instanceof SandboxCapacityError
            ? 'session_at_capacity'
            : 'session_failed',
        durationMs: Date.now() - sessionStartedAt,
        error,
      });
      if (error instanceof SandboxCapacityError) {
        return this.finalReply(
          'Muita gente usando o sandbox agora. Tenta de novo em alguns minutos.',
          trace,
        );
      }
      throw error;
    }

    const safeRecentMessages = this.guardrailService.filterSafeMessages(
      request.recentMessages,
    );
    const safeRepliedMessage =
      request.repliedMessage &&
      !this.guardrailService.isInjectionAttempt(request.repliedMessage.content)
        ? request.repliedMessage
        : undefined;

    const messages: OpenAiToolMessage[] = [
      { role: 'system', content: AGENT_TASK_SYSTEM_PROMPT },
      ...this.buildContextMessages(safeRecentMessages, safeRepliedMessage),
      { role: 'user', content: request.content },
    ];

    const tools = toOpenAiTools(this.toolDispatcher.tools);
    const deadlineAt = this.now() + AGENT_DEADLINE_MS;
    let toolCallsUsed = 0;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (this.now() >= deadlineAt) {
        return await this.wrapUp(messages, tools, trace, {
          reason: 'deadline',
          iterations: iteration,
          toolCallsUsed,
        });
      }

      const message = await this.openAiClient.chatWithTools(messages, tools, {
        temperature: 0.3,
        maxTokens: 1000,
        trace,
        phase: `agent_loop[${iteration}]`,
      });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return this.finalReply(message.content ?? '', trace, {
          reason: 'final_answer',
          iterations: iteration + 1,
          toolCallsUsed,
        });
      }

      messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls,
      });

      for (const toolCall of message.tool_calls) {
        if (toolCallsUsed >= MAX_TOOL_CALLS_TOTAL) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: this.toolDispatcher.budgetExhausted(
              trace,
              iteration,
              toolCallsUsed,
            ),
          });
          continue;
        }
        toolCallsUsed++;

        const resultContent = await this.executeToolCall(
          toolCall,
          containerId,
          trace,
          iteration,
        );
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: resultContent,
        });
      }
    }

    return await this.wrapUp(messages, tools, trace, {
      reason: 'max_iterations',
      iterations: MAX_ITERATIONS,
      toolCallsUsed,
    });
  }

  /**
   * Budget ran out mid-task. Instead of a bare apology, spend one last
   * tool-free call asking the model to report what it already found — for a
   * multi-step task that partial trail is usually what the user asked for.
   */
  private async wrapUp(
    messages: OpenAiToolMessage[],
    tools: OpenAI.Chat.Completions.ChatCompletionFunctionTool[],
    trace: TraceContext,
    outcome: { reason: string; iterations: number; toolCallsUsed: number },
  ): Promise<AiChatResult> {
    try {
      const message = await this.openAiClient.chatWithTools(
        [...messages, { role: 'user', content: WRAP_UP_INSTRUCTION }],
        tools,
        {
          temperature: 0.3,
          maxTokens: 800,
          toolChoice: 'none',
          trace,
          phase: `agent_wrap_up[${outcome.reason}]`,
        },
      );
      const reply = message.content?.trim();
      if (reply) return this.finalReply(reply, trace, outcome);
    } catch (error) {
      logger.warn('ai.agent.wrap_up_failed', {
        traceId: trace.traceId,
        reason: outcome.reason,
        error: getErrorMessage(error),
      });
    }

    return this.finalReply(WRAP_UP_FALLBACK, trace, outcome);
  }

  private async executeToolCall(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    containerId: string,
    trace: TraceContext,
    iteration: number,
  ): Promise<string> {
    if (toolCall.type !== 'function') {
      return this.toolDispatcher.failure(
        trace,
        iteration,
        toolCall.type,
        '',
        `Tipo de ferramenta "${toolCall.type}" não suportado.`,
      );
    }

    return this.toolDispatcher.dispatch(
      {
        name: toolCall.function.name,
        rawArguments: toolCall.function.arguments,
      },
      containerId,
      trace,
      iteration,
    );
  }

  private buildContextMessages(
    recentMessages: { author: string; content: string }[],
    repliedMessage?: { author: string; content: string },
  ): OpenAiToolMessage[] {
    const sections: OpenAiToolMessage[] = [];
    if (repliedMessage) {
      sections.push({
        role: 'user',
        content: `<replied_message trust_level="untrusted">\n${repliedMessage.author}: ${repliedMessage.content}\n</replied_message>`,
      });
    }
    if (recentMessages.length > 0) {
      const formatted = recentMessages
        .map((m) => `${m.author}: ${m.content}`)
        .join('\n');
      sections.push({
        role: 'user',
        content: `<chat_history trust_level="untrusted">\n${formatted}\n</chat_history>`,
      });
    }
    return sections;
  }

  private finalReply(
    reply: string,
    trace: TraceContext = NOOP_TRACE,
    outcome: {
      reason: string;
      iterations?: number;
      toolCallsUsed?: number;
    } = { reason: 'sandbox_unavailable' },
  ): AiChatResult {
    const isLong = reply.length > EMBED_THRESHOLD_CHARS;
    const format = isLong ? 'embed' : 'text';
    logger.info('ai.agent.loop_end', {
      traceId: trace.traceId,
      reason: outcome.reason,
      iterations: outcome.iterations,
      toolCallsUsed: outcome.toolCallsUsed,
    });
    trace.finish({
      status: 'ok',
      mainCategory: 'agent_task',
      category: 'agent_task',
      reply,
      format,
      iterations: outcome.iterations,
      toolCallsUsed: outcome.toolCallsUsed,
    });
    return {
      status: 'ok',
      category: 'agent_task',
      reply,
      format,
      embedTitle: isLong ? EMBED_TITLE : undefined,
      traceId: trace.traceId || undefined,
    };
  }
}
