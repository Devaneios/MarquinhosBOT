import { NOOP_TRACE, type TraceContext } from 'services/aiChat/AiTraceRecorder';
import type { SandboxManager } from 'services/aiChat/sandbox/SandboxManager';
import { findTool } from 'services/aiChat/tools/registry';
import { logger } from 'utils/logger';

export const TOOL_RESULT_MAX_CHARS = 4000;

export interface ToolCallRequest {
  name: string;
  /** Raw JSON string as the model emitted it, kept verbatim for tracing. */
  rawArguments: string;
}

/**
 * Executes the tool calls a model asks for, in whatever shape the caller's LLM
 * API happens to use. Owns everything that is identical between the tag agent
 * (Chat Completions) and the thread agent (Responses): resolving the tool,
 * parsing arguments, capping the result the model gets back, and recording both
 * the tool call and the container exec on the trace.
 *
 * Every failure comes back as a structured result string rather than a throw —
 * a model that mistyped a tool name should get a correctable error, not a dead
 * request.
 */
export class ToolDispatcher {
  constructor(private sandboxManager: SandboxManager) {}

  async dispatch(
    call: ToolCallRequest,
    containerId: string,
    trace: TraceContext = NOOP_TRACE,
    iteration = 0,
  ): Promise<string> {
    const tool = findTool(call.name);
    if (!tool) {
      return this.failure(
        trace,
        iteration,
        call.name,
        call.rawArguments,
        `Ferramenta "${call.name}" não encontrada.`,
      );
    }

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.rawArguments) as Record<string, unknown>;
    } catch {
      return this.failure(
        trace,
        iteration,
        tool.name,
        call.rawArguments,
        'Argumentos inválidos (JSON malformado). Corrija e tente novamente.',
      );
    }

    const startedAt = Date.now();
    try {
      const result = await tool.execute(args, {
        containerId,
        exec: (id, argv) => this.tracedExec(trace, id, argv),
      });
      trace.tool({
        name: tool.name,
        iteration,
        rawArguments: call.rawArguments,
        args,
        result,
        status: 'success',
        durationMs: Date.now() - startedAt,
      });
      return JSON.stringify({
        status: 'success',
        result: result.slice(0, TOOL_RESULT_MAX_CHARS),
      });
    } catch (error) {
      const message = `Erro ao executar ${tool.name}: ${(error as Error).message}`;
      trace.tool({
        name: tool.name,
        iteration,
        rawArguments: call.rawArguments,
        args,
        status: 'error',
        error: message,
        durationMs: Date.now() - startedAt,
      });
      return JSON.stringify({
        status: 'error',
        message: message.slice(0, TOOL_RESULT_MAX_CHARS),
      });
    }
  }

  /** The result fed back once the caller's tool-call budget is spent. */
  budgetExhausted(
    trace: TraceContext,
    iteration: number,
    used: number,
  ): string {
    logger.warn('ai.tool.budget_exhausted', {
      traceId: trace.traceId,
      iteration,
      toolCallsUsed: used,
    });
    return JSON.stringify({
      status: 'error',
      message: 'Orçamento de chamadas de ferramentas esgotado.',
    });
  }

  failure(
    trace: TraceContext,
    iteration: number,
    name: string,
    rawArguments: string,
    message: string,
  ): string {
    trace.tool({
      name,
      iteration,
      rawArguments,
      status: 'error',
      error: message,
      durationMs: 0,
    });
    return JSON.stringify({ status: 'error', message });
  }

  private async tracedExec(
    trace: TraceContext,
    containerId: string,
    argv: string[],
  ) {
    const startedAt = Date.now();
    try {
      const result = await this.sandboxManager.exec(containerId, argv);
      trace.exec({
        containerId,
        argv,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      trace.exec({
        containerId,
        argv,
        stdout: '',
        stderr: (error as Error).message,
        exitCode: -1,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}
