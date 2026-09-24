import { db as defaultDb, type Db } from '@marquinhos/database/client';
import { agentSandboxSessions } from '@marquinhos/database/schema';
import { and, eq } from 'drizzle-orm';
import type { DockerClient } from 'services/aiChat/sandbox/DockerClient';
import { logger } from 'utils/logger';

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? 'marquinhos-sandbox:latest';
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

const bySession = (userId: string, channelId: string) =>
  and(
    eq(agentSandboxSessions.user_id, userId),
    eq(agentSandboxSessions.channel_id, channelId),
  );

export class SandboxManager {
  constructor(
    private docker: DockerClient,
    private db: Db = defaultDb,
  ) {}

  async getOrCreateSession(
    userId: string,
    guildId: string,
    channelId: string,
  ): Promise<string> {
    const [existing] = await this.db
      .select()
      .from(agentSandboxSessions)
      .where(bySession(userId, channelId));

    if (existing) {
      const running = await this.docker.isRunning(existing.container_id);
      if (running) {
        await this.touchSession(userId, channelId);
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
      await this.deleteSession(userId, channelId);
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
    await this.db
      .insert(agentSandboxSessions)
      .values({
        user_id: userId,
        guild_id: guildId,
        channel_id: channelId,
        container_id: containerId,
        status: 'running',
        created_at: now,
        last_used_at: now,
      })
      .onConflictDoUpdate({
        target: [agentSandboxSessions.user_id, agentSandboxSessions.channel_id],
        set: {
          container_id: containerId,
          status: 'running',
          created_at: now,
          last_used_at: now,
        },
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
    const rows = await this.runningSessions();

    for (const row of rows) {
      const running = await this.docker.isRunning(row.container_id);
      if (!running) {
        await this.deleteSession(row.user_id, row.channel_id);
        continue;
      }
      if (row.last_used_at < cutoff) {
        await this.docker.stopContainer(row.container_id);
        await this.docker.removeContainer(row.container_id);
        await this.deleteSession(row.user_id, row.channel_id);
        logger.info('sandbox.session_swept', {
          userId: row.user_id,
          channelId: row.channel_id,
          containerId: row.container_id,
          idleMs: Date.now() - row.last_used_at,
        });
      }
    }
  }

  private runningSessions() {
    return this.db
      .select()
      .from(agentSandboxSessions)
      .where(eq(agentSandboxSessions.status, 'running'));
  }

  private async touchSession(userId: string, channelId: string): Promise<void> {
    await this.db
      .update(agentSandboxSessions)
      .set({ last_used_at: Date.now() })
      .where(bySession(userId, channelId));
  }

  private async deleteSession(
    userId: string,
    channelId: string,
  ): Promise<void> {
    await this.db
      .delete(agentSandboxSessions)
      .where(bySession(userId, channelId));
  }

  private async assertCapacityAvailable(): Promise<void> {
    const rows = await this.runningSessions();

    let liveCount = 0;
    for (const row of rows) {
      const running = await this.docker.isRunning(row.container_id);
      if (running) {
        liveCount++;
      } else {
        await this.deleteSession(row.user_id, row.channel_id);
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
