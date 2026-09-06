import { Database } from 'bun:sqlite';
import { describe, expect, it, mock, spyOn } from 'bun:test';
import type { DockerClient } from 'services/aiChat/sandbox/DockerClient';
import {
  SandboxCapacityError,
  SandboxManager,
} from 'services/aiChat/sandbox/SandboxManager';
import { logger } from 'utils/logger';

function setupDb(): Database {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE agent_sandbox_sessions (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      container_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, channel_id)
    )
  `);
  return db;
}

function insertSession(
  db: Database,
  overrides: Partial<{
    userId: string;
    channelId: string;
    containerId: string;
    lastUsedAt: number;
  }> = {},
): void {
  const userId = overrides.userId ?? 'u1';
  const channelId = overrides.channelId ?? 'c1';
  const containerId = overrides.containerId ?? 'container-old';
  const lastUsedAt = overrides.lastUsedAt ?? 1000;
  db.run(
    `INSERT INTO agent_sandbox_sessions
       (user_id, guild_id, channel_id, container_id, status, created_at, last_used_at)
     VALUES ('${userId}', 'g1', '${channelId}', '${containerId}', 'running', ${lastUsedAt}, ${lastUsedAt})`,
  );
}

function fakeDocker(overrides: Partial<DockerClient> = {}): DockerClient {
  return {
    createContainer: mock(async () => 'container-new'),
    startContainer: mock(async () => undefined),
    isRunning: mock(async () => true),
    exec: mock(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    stopContainer: mock(async () => undefined),
    removeContainer: mock(async () => undefined),
    ...overrides,
  };
}

describe('SandboxManager.getOrCreateSession', () => {
  it('creates a new session when none exists for (userId, channelId)', async () => {
    const db = setupDb();
    const docker = fakeDocker();
    const manager = new SandboxManager(docker, db);

    const containerId = await manager.getOrCreateSession('u1', 'g1', 'c1');

    expect(containerId).toBe('container-new');
    expect(docker.createContainer).toHaveBeenCalledTimes(1);
    expect(docker.startContainer).toHaveBeenCalledWith('container-new');
    const row = db
      .query(
        'SELECT * FROM agent_sandbox_sessions WHERE user_id = ? AND channel_id = ?',
      )
      .get('u1', 'c1');
    expect(row).not.toBeNull();
  });

  it('reuses the existing container when the row exists and it is still running', async () => {
    const db = setupDb();
    insertSession(db);
    const docker = fakeDocker({ isRunning: mock(async () => true) });
    const manager = new SandboxManager(docker, db);

    const containerId = await manager.getOrCreateSession('u1', 'g1', 'c1');

    expect(containerId).toBe('container-old');
    expect(docker.createContainer).not.toHaveBeenCalled();
  });

  it('updates last_used_at when reusing an existing session', async () => {
    const db = setupDb();
    insertSession(db, { lastUsedAt: 1000 });
    const docker = fakeDocker({ isRunning: mock(async () => true) });
    const manager = new SandboxManager(docker, db);

    await manager.getOrCreateSession('u1', 'g1', 'c1');

    const row = db
      .query<{ last_used_at: number }, []>(
        "SELECT last_used_at FROM agent_sandbox_sessions WHERE user_id = 'u1' AND channel_id = 'c1'",
      )
      .get();
    expect(row!.last_used_at).toBeGreaterThan(1000);
  });

  it('self-heals by creating a new container when the row exists but the container is dead', async () => {
    const db = setupDb();
    insertSession(db, { containerId: 'container-dead' });
    const docker = fakeDocker({ isRunning: mock(async () => false) });
    const manager = new SandboxManager(docker, db);

    const containerId = await manager.getOrCreateSession('u1', 'g1', 'c1');

    expect(containerId).toBe('container-new');
    expect(docker.createContainer).toHaveBeenCalledTimes(1);
  });

  it('rejects creating a new session when the concurrency limit (8) is reached', async () => {
    const db = setupDb();
    for (let i = 0; i < 8; i++) {
      insertSession(db, {
        userId: `u${i}`,
        channelId: `c${i}`,
        containerId: `container-${i}`,
      });
    }
    const docker = fakeDocker({ isRunning: mock(async () => true) });
    const manager = new SandboxManager(docker, db);

    expect(
      manager.getOrCreateSession('new-user', 'g1', 'new-channel'),
    ).rejects.toThrow(SandboxCapacityError);
    expect(docker.createContainer).not.toHaveBeenCalled();
  });

  it('does not count dead sessions against the concurrency limit', async () => {
    const db = setupDb();
    for (let i = 0; i < 8; i++) {
      insertSession(db, {
        userId: `u${i}`,
        channelId: `c${i}`,
        containerId: `container-${i}`,
      });
    }
    const docker = fakeDocker({ isRunning: mock(async () => false) });
    const manager = new SandboxManager(docker, db);

    const containerId = await manager.getOrCreateSession(
      'new-user',
      'g1',
      'new-channel',
    );

    expect(containerId).toBe('container-new');
  });

  it('removes the orphaned container and rethrows when startContainer fails after createContainer succeeds', async () => {
    const db = setupDb();
    const startError = new Error('start failed');
    const docker = fakeDocker({
      createContainer: mock(async () => 'container-new'),
      startContainer: mock(async () => {
        throw startError;
      }),
    });
    const manager = new SandboxManager(docker, db);

    expect(manager.getOrCreateSession('u1', 'g1', 'c1')).rejects.toThrow(
      'start failed',
    );

    expect(docker.removeContainer).toHaveBeenCalledWith('container-new');
    const row = db
      .query(
        'SELECT * FROM agent_sandbox_sessions WHERE user_id = ? AND channel_id = ?',
      )
      .get('u1', 'c1');
    expect(row).toBeNull();
  });

  it('never includes the Docker socket bind or elevated privilege flags in the container config', async () => {
    const db = setupDb();
    const docker = fakeDocker();
    const manager = new SandboxManager(docker, db);

    await manager.getOrCreateSession('u1', 'g1', 'c1');

    const config = (docker.createContainer as ReturnType<typeof mock>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(JSON.stringify(config)).not.toContain('docker.sock');
    expect(config).not.toHaveProperty('privileged');
    expect(config).not.toHaveProperty('capAdd');
    expect(config).not.toHaveProperty('securityOpt');
  });

  it('creates the container with network disabled, read-only rootfs, and resource limits', async () => {
    const db = setupDb();
    const docker = fakeDocker();
    const manager = new SandboxManager(docker, db);

    await manager.getOrCreateSession('u1', 'g1', 'c1');

    const config = (docker.createContainer as ReturnType<typeof mock>).mock
      .calls[0]![0] as {
      networkMode: string;
      readonlyRootfs: boolean;
      pidsLimit: number;
      memoryBytes: number;
      nanoCpus: number;
      binds: string[];
    };
    expect(config.networkMode).toBe('none');
    expect(config.readonlyRootfs).toBe(true);
    expect(config.pidsLimit).toBeGreaterThan(0);
    expect(config.memoryBytes).toBeGreaterThan(0);
    expect(config.nanoCpus).toBeGreaterThan(0);
    expect(config.binds.some((b) => b.endsWith(':/repo:ro'))).toBe(true);
  });
});

describe('SandboxManager.exec', () => {
  it('delegates to the docker client with the configured exec timeout', async () => {
    const docker = fakeDocker({
      exec: mock(async () => ({ stdout: 'hi', stderr: '', exitCode: 0 })),
    });
    const manager = new SandboxManager(docker, setupDb());

    const result = await manager.exec('container-1', ['ls', '-la', '/repo']);

    expect(result).toEqual({ stdout: 'hi', stderr: '', exitCode: 0 });
    expect(docker.exec).toHaveBeenCalledWith(
      'container-1',
      ['ls', '-la', '/repo'],
      expect.any(Number),
    );
  });
});

describe('SandboxManager.sweepIdleSessions', () => {
  it('stops and removes containers idle past the TTL and deletes their row', async () => {
    const db = setupDb();
    const oldTimestamp = Date.now() - 60 * 60 * 1000;
    insertSession(db, {
      containerId: 'container-idle',
      lastUsedAt: oldTimestamp,
    });
    const docker = fakeDocker({ isRunning: mock(async () => true) });
    const manager = new SandboxManager(docker, db);

    await manager.sweepIdleSessions();

    expect(docker.stopContainer).toHaveBeenCalledWith('container-idle');
    expect(docker.removeContainer).toHaveBeenCalledWith('container-idle');
    const row = db
      .query('SELECT * FROM agent_sandbox_sessions WHERE user_id = ?')
      .get('u1');
    expect(row).toBeNull();
  });

  it('leaves recently used containers untouched', async () => {
    const db = setupDb();
    insertSession(db, {
      containerId: 'container-fresh',
      lastUsedAt: Date.now(),
    });
    const docker = fakeDocker({ isRunning: mock(async () => true) });
    const manager = new SandboxManager(docker, db);

    await manager.sweepIdleSessions();

    expect(docker.stopContainer).not.toHaveBeenCalled();
    const row = db
      .query('SELECT * FROM agent_sandbox_sessions WHERE user_id = ?')
      .get('u1');
    expect(row).not.toBeNull();
  });

  it('reconciles rows whose container no longer exists, without calling stop/remove', async () => {
    const db = setupDb();
    insertSession(db, {
      containerId: 'container-gone',
      lastUsedAt: Date.now(),
    });
    const docker = fakeDocker({ isRunning: mock(async () => false) });
    const manager = new SandboxManager(docker, db);

    await manager.sweepIdleSessions();

    expect(docker.stopContainer).not.toHaveBeenCalled();
    const row = db
      .query('SELECT * FROM agent_sandbox_sessions WHERE user_id = ?')
      .get('u1');
    expect(row).toBeNull();
  });
});

describe('SandboxManager lifecycle logging', () => {
  function captureLogs() {
    const events: { level: string; event: string }[] = [];
    const spies = (['info', 'warn', 'error'] as const).map((level) =>
      spyOn(logger, level).mockImplementation((event: string) => {
        events.push({ level, event });
      }),
    );
    return { events, restore: () => spies.forEach((s) => s.mockRestore()) };
  }

  it('logs a created session with its container id', async () => {
    const { events, restore } = captureLogs();
    try {
      await new SandboxManager(fakeDocker(), setupDb()).getOrCreateSession(
        'u1',
        'g1',
        'c1',
      );
    } finally {
      restore();
    }
    expect(events.map((e) => e.event)).toContain('sandbox.session_created');
  });

  it('logs a reused session instead of creating a second container', async () => {
    const db = setupDb();
    insertSession(db, { userId: 'u1', channelId: 'c1' });
    const { events, restore } = captureLogs();
    try {
      await new SandboxManager(fakeDocker(), db).getOrCreateSession(
        'u1',
        'g1',
        'c1',
      );
    } finally {
      restore();
    }
    expect(events.map((e) => e.event)).toContain('sandbox.session_reused');
  });

  it('logs the capacity ceiling before rejecting a new session', async () => {
    const db = setupDb();
    for (let i = 0; i < 8; i++) {
      insertSession(db, { userId: `u${i}`, channelId: `c${i}` });
    }
    const { events, restore } = captureLogs();
    try {
      expect(
        new SandboxManager(fakeDocker(), db).getOrCreateSession(
          'new',
          'g1',
          'new',
        ),
      ).rejects.toBeInstanceOf(SandboxCapacityError);
    } finally {
      restore();
    }
    expect(events.map((e) => e.event)).toContain('sandbox.at_capacity');
  });
});
