import type OpenAI from 'openai';
import { ToolDispatcher } from 'services/aiChat/agent/ToolDispatcher';
import { AgentRateLimitService } from 'services/aiChat/AgentRateLimitService';
import { NOOP_TRACE, type TraceContext } from 'services/aiChat/AiTraceRecorder';
import { GuardrailService } from 'services/aiChat/GuardrailService';
import {
  OpenAiClient,
  type OpenAiToolMessage,
} from 'services/aiChat/OpenAiClient';
import { AGENT_TASK_SYSTEM_PROMPT } from 'services/aiChat/prompts';
import { DockerodeSandboxClient } from 'services/aiChat/sandbox/DockerodeSandboxClient';
import {
  SandboxCapacityError,
  SandboxManager,
} from 'services/aiChat/sandbox/SandboxManager';
import { toOpenAiTools } from 'services/aiChat/tools/registry';
import type { AiChatRequest, AiChatResult } from 'services/aiChat/types';
import { logger } from 'utils/logger';

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

export class AgentToolLoopService {
  constructor(
    private agentRateLimitService: AgentRateLimitService = new AgentRateLimitService(),
    private guardrailService: GuardrailService = new GuardrailService(),
    private sandboxManager: SandboxManager = new SandboxManager(
      new DockerodeSandboxClient(),
    ),
    private openAiClient: OpenAiClient = new OpenAiClient(),
    private now: () => number = Date.now,
    private toolDispatcher: ToolDispatcher = new ToolDispatcher(sandboxManager),
  ) {}

  async run(
    request: AiChatRequest,
    trace: TraceContext = NOOP_TRACE,
  ): Promise<AiChatResult> {
    const allowed = this.agentRateLimitService.checkAndIncrement(
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

    const tools = toOpenAiTools();
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
        error: (error as Error).message,
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
