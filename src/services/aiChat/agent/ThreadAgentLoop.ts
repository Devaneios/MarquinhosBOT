import { ToolDispatcher } from 'services/aiChat/agent/ToolDispatcher';
import { NOOP_TRACE, type TraceContext } from 'services/aiChat/AiTraceRecorder';
import {
  ResponsesClient,
  type ConversationItem,
  type FunctionToolSpec,
} from 'services/aiChat/llm/ResponsesClient';
import { AGENT_TOOLS } from 'services/aiChat/tools/registry';
import { logger } from 'utils/logger';

export const THREAD_MAX_ITERATIONS = 12;
export const THREAD_MAX_TOOL_CALLS = 24;
/**
 * The bot gives a thread turn 120s. Stopping the loop before that lets us send
 * back what we found instead of the caller timing out mid-answer.
 */
export const THREAD_DEADLINE_MS = 95_000;
const MAX_OUTPUT_TOKENS = 2000;
const WRAP_UP_MAX_OUTPUT_TOKENS = 1200;

const WRAP_UP_INSTRUCTION = `Seu orçamento de ferramentas acabou, então não chame mais nenhuma ferramenta. Responda agora ao pedido resumindo o que você já descobriu até aqui, incluindo o caminho que percorreu. Se não terminou, diga onde parou e o que faltou.`;
export const WRAP_UP_FALLBACK =
  'Não consegui terminar isso a tempo. Tenta pedir algo mais simples ou dividir em partes menores.';

export function toFunctionToolSpecs(): FunctionToolSpec[] {
  return AGENT_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export interface ThreadAgentLoopRun {
  instructions: string;
  /** Items already in the thread, replayed verbatim — reasoning included. */
  transcript: ConversationItem[];
  userContent: string;
  containerId: string;
  trace?: TraceContext;
}

export interface ThreadAgentLoopResult {
  /**
   * Everything produced this turn, in order: the user message, every output
   * item the model emitted (reasoning items included), and each tool output.
   * The caller appends these to the thread so the next turn can replay them.
   */
  newItems: ConversationItem[];
  text: string;
  iterations: number;
  toolCallsUsed: number;
  reason: 'final_answer' | 'max_iterations' | 'deadline' | 'wrap_up_failed';
}

/**
 * The agentic loop behind a thread turn. Unlike the tag agent, this one carries
 * the whole conversation forward: it takes the prior transcript in, and hands
 * back the raw Responses items so the model's own reasoning survives to the
 * next turn instead of being re-derived from scratch.
 */
export class ThreadAgentLoop {
  constructor(
    private toolDispatcher: ToolDispatcher,
    private responsesClient: ResponsesClient = new ResponsesClient(),
    private now: () => number = Date.now,
    private maxIterations: number = THREAD_MAX_ITERATIONS,
    private maxToolCalls: number = THREAD_MAX_TOOL_CALLS,
    private deadlineMs: number = THREAD_DEADLINE_MS,
  ) {}

  async run(run: ThreadAgentLoopRun): Promise<ThreadAgentLoopResult> {
    const trace = run.trace ?? NOOP_TRACE;
    const tools = toFunctionToolSpecs();
    const userItem: ConversationItem = {
      role: 'user',
      content: run.userContent,
    };

    const input: ConversationItem[] = [...run.transcript, userItem];
    const newItems: ConversationItem[] = [userItem];
    const deadlineAt = this.now() + this.deadlineMs;
    let toolCallsUsed = 0;

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      if (this.now() >= deadlineAt) {
        return this.wrapUp(run, input, newItems, tools, {
          reason: 'deadline',
          iterations: iteration,
          toolCallsUsed,
        });
      }

      const response = await this.responsesClient.create({
        // A copy on purpose: `input` keeps growing as this turn proceeds, and a
        // shared reference would make the trace show items the model never saw
        // on this call.
        input: [...input],
        instructions: run.instructions,
        tools,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        trace,
        phase: `thread_turn[${iteration}]`,
      });

      input.push(...response.items);
      newItems.push(...response.items);

      if (response.functionCalls.length === 0) {
        return this.finish(newItems, response.text, {
          reason: 'final_answer',
          iterations: iteration + 1,
          toolCallsUsed,
        });
      }

      for (const call of response.functionCalls) {
        const output =
          toolCallsUsed >= this.maxToolCalls
            ? this.toolDispatcher.budgetExhausted(
                trace,
                iteration,
                toolCallsUsed,
              )
            : await this.toolDispatcher.dispatch(
                { name: call.name, rawArguments: call.arguments },
                run.containerId,
                trace,
                iteration,
              );
        if (toolCallsUsed < this.maxToolCalls) toolCallsUsed++;

        const outputItem: ConversationItem = {
          type: 'function_call_output',
          call_id: call.callId,
          output,
        };
        input.push(outputItem);
        newItems.push(outputItem);
      }
    }

    return this.wrapUp(run, input, newItems, tools, {
      reason: 'max_iterations',
      iterations: this.maxIterations,
      toolCallsUsed,
    });
  }

  /**
   * Budget ran out mid-task. Instead of a bare apology, spend one last
   * tool-free call asking the model to report what it already found — for a
   * multi-step task that partial trail is usually what the user wanted.
   */
  private async wrapUp(
    run: ThreadAgentLoopRun,
    input: ConversationItem[],
    newItems: ConversationItem[],
    tools: FunctionToolSpec[],
    outcome: {
      reason: 'deadline' | 'max_iterations';
      iterations: number;
      toolCallsUsed: number;
    },
  ): Promise<ThreadAgentLoopResult> {
    const trace = run.trace ?? NOOP_TRACE;
    const nudge: ConversationItem = {
      role: 'user',
      content: WRAP_UP_INSTRUCTION,
    };

    try {
      const response = await this.responsesClient.create({
        instructions: run.instructions,
        input: [...input, nudge],
        tools,
        toolChoice: 'none',
        maxOutputTokens: WRAP_UP_MAX_OUTPUT_TOKENS,
        trace,
        phase: `thread_wrap_up[${outcome.reason}]`,
      });

      const text = response.text.trim();
      if (text) {
        newItems.push(nudge, ...response.items);
        return this.finish(newItems, text, outcome);
      }
    } catch (error) {
      logger.warn('ai.thread.wrap_up_failed', {
        traceId: trace.traceId,
        reason: outcome.reason,
        error: (error as Error).message,
      });
      return this.finish(newItems, WRAP_UP_FALLBACK, {
        ...outcome,
        reason: 'wrap_up_failed',
      });
    }

    return this.finish(newItems, WRAP_UP_FALLBACK, outcome);
  }

  private finish(
    newItems: ConversationItem[],
    text: string,
    outcome: {
      reason: ThreadAgentLoopResult['reason'];
      iterations: number;
      toolCallsUsed: number;
    },
  ): ThreadAgentLoopResult {
    return { newItems, text, ...outcome };
  }
}
