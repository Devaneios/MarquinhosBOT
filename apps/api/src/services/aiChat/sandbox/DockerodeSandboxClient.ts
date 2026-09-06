import Docker from 'dockerode';
import type {
  ContainerCreateConfig,
  DockerClient,
  DockerExecResult,
} from 'services/aiChat/sandbox/DockerClient';

const TIMEOUT_EXIT_CODE = 124;

type SpawnOptions = {
  stdout: 'pipe';
  stderr: 'pipe';
  timeout: number;
  killSignal: 'SIGKILL';
};

export type SpawnExec = (
  argv: string[],
  options: SpawnOptions,
) => Bun.Subprocess<'ignore', 'pipe', 'pipe'>;

export class DockerodeSandboxClient implements DockerClient {
  constructor(
    private docker: Docker = new Docker({
      socketPath: '/var/run/docker.sock',
    }),
    private spawnExec: SpawnExec = (argv, options) => Bun.spawn(argv, options),
  ) {}

  async createContainer(config: ContainerCreateConfig): Promise<string> {
    const container = await this.docker.createContainer({
      Image: config.image,
      Cmd: config.cmd,
      Labels: config.labels,
      HostConfig: {
        NetworkMode: config.networkMode,
        Memory: config.memoryBytes,
        NanoCpus: config.nanoCpus,
        PidsLimit: config.pidsLimit,
        ReadonlyRootfs: config.readonlyRootfs,
        Tmpfs: config.tmpfs,
        Binds: config.binds,
      },
    });
    return container.id;
  }

  async startContainer(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).start();
  }

  async isRunning(containerId: string): Promise<boolean> {
    try {
      const info = await this.docker.getContainer(containerId).inspect();
      return info.State.Running;
    } catch {
      return false;
    }
  }

  async exec(
    containerId: string,
    argv: string[],
    timeoutMs: number,
  ): Promise<DockerExecResult> {
    // dockerode's own exec path stream-hijacks the connection to multiplex
    // stdout/stderr, and that protocol upgrade is misread as an error under
    // Bun's HTTP client (confirmed empirically: HTTP 101 responses blow up
    // in docker-modem even though the exec itself completes). The Docker
    // CLI talks to the same socket as a plain subprocess, which sidesteps
    // the incompatibility entirely — so exec goes through the CLI while
    // every other lifecycle call below stays on dockerode's plain REST API.
    const proc = this.spawnExec(['docker', 'exec', containerId, ...argv], {
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    // `proc.killed` is true for any spawn carrying a timeout, even on a clean
    // exit 0 (verified on Bun 1.3.14), so it cannot distinguish a killed
    // process from a finished one. `signalCode` stays null unless a signal
    // actually landed, and SIGKILL is the only one we ever send.
    if (proc.signalCode !== null) {
      return {
        stdout,
        stderr: `${stderr}\n[timeout after ${timeoutMs}ms]`,
        exitCode: TIMEOUT_EXIT_CODE,
      };
    }
    return { stdout, stderr, exitCode };
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).stop();
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).remove();
  }
}
