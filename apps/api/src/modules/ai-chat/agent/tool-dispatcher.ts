import { Injectable } from '@nestjs/common';
import { getErrorMessage } from 'common/errors/error-handling';
import { logger } from 'common/logging/logger';
import type { SandboxManager } from 'modules/ai-chat/sandbox/sandbox-manager.service';
import { AGENT_TOOLS, findTool } from 'modules/ai-chat/tools/registry';
import type { AgentTool } from 'modules/ai-chat/tools/types';
import {
  NOOP_TRACE,
  type TraceContext,
} from 'modules/ai-chat/trace/ai-trace-recorder.service';
import { z } from 'zod';

const toolArgumentsSchema = z.record(z.string(), z.unknown());

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
@Injectable()
export class ToolDispatcher {
  constructor(
    private readonly sandboxManager: SandboxManager,
    readonly tools: AgentTool[] = AGENT_TOOLS,
  ) {}

  async dispatch(
    call: ToolCallRequest,
    containerId: string,
    trace: TraceContext = NOOP_TRACE,
    iteration = 0,
  ): Promise<string> {
    const tool = findTool(call.name, this.tools);
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
      args = toolArgumentsSchema.parse(JSON.parse(call.rawArguments));
    } catch {
      return this.failure(
        trace,
        iteration,
        tool.name,
        call.rawArguments,
        'Argumentos inválidos (esperado um objeto JSON). Corrija e tente novamente.',
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
      const message = `Erro ao executar ${tool.name}: ${getErrorMessage(error)}`;
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
        stderr: getErrorMessage(error),
        exitCode: -1,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}
