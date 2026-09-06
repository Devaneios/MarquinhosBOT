import { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';
import type { DockerClient } from 'services/aiChat/sandbox/DockerClient';
import { logger } from 'utils/logger';

const SANDBOX_IMAGE = 'marquinhos-sandbox:latest';
const MEMORY_BYTES = 256 * 1024 * 1024;
const NANO_CPUS = 1_000_000_000;
const PIDS_LIMIT = 128;
const TMPFS_SIZE_BYTES = 128 * 1024 * 1024;
const EXEC_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_SESSIONS = 8;
const IDLE_TTL_MS = 30 * 60 * 1000;
const REPO_MIRROR_HOST_PATH =
  process.env.SANDBOX_MIRROR_PATH ?? '/opt/marquinhos/sandbox-mirror';

export class SandboxCapacityError extends Error {
  constructor() {
    super('Sandbox concurrency limit reached');
  }
}

interface SandboxSessionRow {
  user_id: string;
  guild_id: string;
  channel_id: string;
  container_id: string;
  status: string;
  created_at: number;
  last_used_at: number;
}

export class SandboxManager {
  constructor(
    private docker: DockerClient,
    private db: Database = defaultDb,
  ) {}

  async getOrCreateSession(
    userId: string,
    guildId: string,
    channelId: string,
  ): Promise<string> {
    const existing = this.db
      .query<SandboxSessionRow, { $userId: string; $channelId: string }>(
        'SELECT * FROM agent_sandbox_sessions WHERE user_id = $userId AND channel_id = $channelId',
      )
      .get({ $userId: userId, $channelId: channelId });

    if (existing) {
      const running = await this.docker.isRunning(existing.container_id);
      if (running) {
        this.touchSession(userId, channelId);
        logger.info('sandbox.session_reused', {
          userId,
          channelId,
          containerId: existing.container_id,
        });
        return existing.container_id;
      }
      logger.warn('sandbox.session_stale', {
        userId,
        channelId,
        containerId: existing.container_id,
      });
      this.deleteSession(userId, channelId);
    }

    await this.assertCapacityAvailable();

    const containerId = await this.docker.createContainer({
      image: SANDBOX_IMAGE,
      cmd: ['sleep', 'infinity'],
      networkMode: 'none',
      memoryBytes: MEMORY_BYTES,
      nanoCpus: NANO_CPUS,
      pidsLimit: PIDS_LIMIT,
      readonlyRootfs: true,
      tmpfs: { '/tmp': `rw,size=${TMPFS_SIZE_BYTES}` },
      binds: [`${REPO_MIRROR_HOST_PATH}:/repo:ro`],
      labels: {
        'marquinhos.sandbox': 'true',
        'marquinhos.userId': userId,
        'marquinhos.channelId': channelId,
      },
    });
    try {
      await this.docker.startContainer(containerId);
    } catch (error) {
      logger.error('sandbox.start_failed', {
        userId,
        channelId,
        containerId,
        error,
      });
      await this.docker.removeContainer(containerId).catch(() => undefined);
      throw error;
    }

    logger.info('sandbox.session_created', {
      userId,
      guildId,
      channelId,
      containerId,
      image: SANDBOX_IMAGE,
    });

    const now = Date.now();
    this.db
      .query(
        `INSERT INTO agent_sandbox_sessions
         (user_id, guild_id, channel_id, container_id, status, created_at, last_used_at)
       VALUES ($userId, $guildId, $channelId, $containerId, 'running', $now, $now)
       ON CONFLICT(user_id, channel_id) DO UPDATE SET
         container_id = excluded.container_id,
         status = 'running',
         created_at = excluded.created_at,
         last_used_at = excluded.last_used_at`,
      )
      .run({
        $userId: userId,
        $guildId: guildId,
        $channelId: channelId,
        $containerId: containerId,
        $now: now,
      });

    return containerId;
  }

  async exec(
    containerId: string,
    argv: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this.docker.exec(containerId, argv, EXEC_TIMEOUT_MS);
  }

  async sweepIdleSessions(): Promise<void> {
    const cutoff = Date.now() - IDLE_TTL_MS;
    const rows = this.db
      .query<SandboxSessionRow, []>(
        "SELECT * FROM agent_sandbox_sessions WHERE status = 'running'",
      )
      .all();

    for (const row of rows) {
      const running = await this.docker.isRunning(row.container_id);
      if (!running) {
        this.deleteSession(row.user_id, row.channel_id);
        continue;
      }
      if (row.last_used_at < cutoff) {
        await this.docker.stopContainer(row.container_id);
        await this.docker.removeContainer(row.container_id);
        this.deleteSession(row.user_id, row.channel_id);
        logger.info('sandbox.session_swept', {
          userId: row.user_id,
          channelId: row.channel_id,
          containerId: row.container_id,
          idleMs: Date.now() - row.last_used_at,
        });
      }
    }
  }

  private touchSession(userId: string, channelId: string): void {
    this.db
      .query(
        'UPDATE agent_sandbox_sessions SET last_used_at = $now WHERE user_id = $userId AND channel_id = $channelId',
      )
      .run({ $now: Date.now(), $userId: userId, $channelId: channelId });
  }

  private deleteSession(userId: string, channelId: string): void {
    this.db
      .query(
        'DELETE FROM agent_sandbox_sessions WHERE user_id = $userId AND channel_id = $channelId',
      )
      .run({ $userId: userId, $channelId: channelId });
  }

  private async assertCapacityAvailable(): Promise<void> {
    const rows = this.db
      .query<SandboxSessionRow, []>(
        "SELECT * FROM agent_sandbox_sessions WHERE status = 'running'",
      )
      .all();

    let liveCount = 0;
    for (const row of rows) {
      const running = await this.docker.isRunning(row.container_id);
      if (running) {
        liveCount++;
      } else {
        this.deleteSession(row.user_id, row.channel_id);
      }
    }

    if (liveCount >= MAX_CONCURRENT_SESSIONS) {
      logger.warn('sandbox.at_capacity', {
        liveCount,
        maxConcurrentSessions: MAX_CONCURRENT_SESSIONS,
      });
      throw new SandboxCapacityError();
    }
  }
}
