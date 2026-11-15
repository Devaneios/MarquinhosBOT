import type { Db } from '@marquinhos/database/client';
import { agentSandboxSessions } from '@marquinhos/database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { logger } from 'common/logging/logger';
import { DB } from 'database/database.tokens';
import { and, eq } from 'drizzle-orm';
import {
  DOCKER_CLIENT,
  SANDBOX_IMAGE,
  SANDBOX_MIRROR_PATH,
} from 'modules/ai-chat/ai-chat.tokens';
import type { DockerClient } from 'modules/ai-chat/sandbox/docker-client';

const DEFAULT_SANDBOX_IMAGE = 'marquinhos-sandbox:latest';
const MEMORY_BYTES = 256 * 1024 * 1024;
const NANO_CPUS = 1_000_000_000;
const PIDS_LIMIT = 128;
const TMPFS_SIZE_BYTES = 128 * 1024 * 1024;
const EXEC_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_SESSIONS = 8;
const IDLE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_REPO_MIRROR_HOST_PATH = '/opt/marquinhos/sandbox-mirror';

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

@Injectable()
export class SandboxManager {
  constructor(
    @Inject(DOCKER_CLIENT) private readonly docker: DockerClient,
    @Inject(DB) private readonly db: Db,
    @Inject(SANDBOX_IMAGE)
    private readonly image: string = DEFAULT_SANDBOX_IMAGE,
    @Inject(SANDBOX_MIRROR_PATH)
    private readonly repoMirrorHostPath: string = DEFAULT_REPO_MIRROR_HOST_PATH,
  ) {}

  private readonly inFlightCreations = new Map<string, Promise<string>>();

  async getOrCreateSession(
    userId: string,
    guildId: string,
    channelId: string,
  ): Promise<string> {
    const key = `${userId}:${channelId}`;
    const inflight = this.inFlightCreations.get(key);
    if (inflight) return inflight;

    const promise = this.getOrCreateSessionInternal(
      userId,
      guildId,
      channelId,
    ).finally(() => {
      if (this.inFlightCreations.get(key) === promise) {
        this.inFlightCreations.delete(key);
      }
    });
    this.inFlightCreations.set(key, promise);
    return promise;
  }

  private async getOrCreateSessionInternal(
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
      await this.docker
        .removeContainer(existing.container_id)
        .catch(() => undefined);
      await this.deleteSession(userId, channelId);
    }

    await this.assertCapacityAvailable();

    const containerId = await this.docker.createContainer({
      image: this.image,
      cmd: ['sleep', 'infinity'],
      networkMode: 'none',
      memoryBytes: MEMORY_BYTES,
      nanoCpus: NANO_CPUS,
      pidsLimit: PIDS_LIMIT,
      readonlyRootfs: true,
      tmpfs: {
        '/tmp': `rw,noexec,nosuid,nodev,mode=1777,size=${TMPFS_SIZE_BYTES}`,
      },
      binds: [`${this.repoMirrorHostPath}:/repo:ro`],
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
      image: this.image,
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
      try {
        const running = await this.docker.isRunning(row.container_id);
        if (!running) {
          await this.docker
            .removeContainer(row.container_id)
            .catch(() => undefined);
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
      } catch (error) {
        logger.warn('sandbox.sweep_session_failed', {
          userId: row.user_id,
          channelId: row.channel_id,
          containerId: row.container_id,
          error,
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
        await this.docker
          .removeContainer(row.container_id)
          .catch(() => undefined);
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
