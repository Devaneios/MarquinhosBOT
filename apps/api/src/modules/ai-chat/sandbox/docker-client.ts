export interface ContainerCreateConfig {
  image: string;
  cmd: string[];
  networkMode: 'none';
  memoryBytes: number;
  nanoCpus: number;
  pidsLimit: number;
  readonlyRootfs: true;
  tmpfs: Record<string, string>;
  binds: string[];
  labels: Record<string, string>;
}

export interface DockerExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DockerClient {
  createContainer(config: ContainerCreateConfig): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  isRunning(containerId: string): Promise<boolean>;
  exec(
    containerId: string,
    argv: string[],
    timeoutMs: number,
  ): Promise<DockerExecResult>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
}
