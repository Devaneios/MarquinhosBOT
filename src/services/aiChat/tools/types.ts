export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type SandboxExecFn = (
  containerId: string,
  argv: string[],
) => Promise<SandboxExecResult>;

export interface AgentToolContext {
  containerId: string;
  exec: SandboxExecFn;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    args: Record<string, unknown>,
    ctx: AgentToolContext,
  ): Promise<string>;
}
