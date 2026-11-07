import cors from 'cors';
import type { Express, NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import type { Server } from 'http';
import morgan from 'morgan';

export async function getLegacyRouteMounts() {
  const [
    health,
    activity,
    auth,
    user,
    scrobble,
    privacyPolicy,
    aiChat,
    emojiReaction,
    gamification,
    evolutiveAchievements,
    maze,
    wordle,
  ] = await Promise.all([
    import('routes/health.route'),
    import('routes/activity.route'),
    import('routes/auth.route'),
    import('routes/user.route'),
    import('routes/scrobble.route'),
    import('routes/privacyPolicy.route'),
    import('routes/aiChat.route'),
    import('routes/emojiReaction.route'),
    import('routes/gamification.route'),
    import('routes/evolutiveAchievements.route'),
    import('routes/maze.route'),
    import('routes/wordle.route'),
  ]);

  return [
    { mount: '/api/health', router: health.default, contractModule: 'health' },
    {
      mount: '/api/activities',
      router: activity.default,
      contractModule: 'activity',
    },
    { mount: '/api/auth', router: auth.default, contractModule: 'auth' },
    { mount: '/api/user', router: user.default, contractModule: 'user' },
    {
      mount: '/api/scrobble',
      router: scrobble.default,
      contractModule: 'scrobble',
    },
    {
      mount: '/api/privacy-policy',
      router: privacyPolicy.default,
      contractModule: 'privacyPolicy',
    },
    { mount: '/api/ai-chat', router: aiChat.default, contractModule: 'aiChat' },
    {
      mount: '/api/emoji-reaction',
      router: emojiReaction.default,
      contractModule: 'emojiReaction',
    },
    {
      mount: '/api/gamification',
      router: gamification.default,
      contractModule: 'gamification',
    },
    {
      mount: '/api/evolutive-achievements',
      router: evolutiveAchievements.default,
      contractModule: 'evolutiveAchievements',
    },
    { mount: '/api/games/maze', router: maze.default, contractModule: 'maze' },
    { mount: '/api/wordle', router: wordle.default, contractModule: 'wordle' },
  ] satisfies {
    mount: string;
    router: Router;
    contractModule: string;
  }[];
}

export interface StartApiOptions {
  corsOrigins?: string[];
  silent?: boolean;
}

export interface StartedApi {
  app: Express;
  http: Server;
  origin: string;
  close: () => Promise<void>;
}

export async function startApi(
  options: StartApiOptions = {},
): Promise<StartedApi> {
  const legacyRouteMounts = await getLegacyRouteMounts();
  const app = express();
  app.set('trust proxy', 1);

  const allowlist = options.corsOrigins ?? [];
  const corsOptionsDelegate = function (
    req: Request,
    callback: (error: Error | null, options: cors.CorsOptions) => void,
  ) {
    callback(null, {
      origin: allowlist.includes(req.header('Origin') ?? ''),
      credentials: true,
    });
  };

  const accessLogFormat =
    ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms';
  app.use(
    options.silent
      ? morgan(accessLogFormat, { stream: { write: () => undefined } })
      : morgan(accessLogFormat),
  );
  app.use(express.json());
  app.use(cors(corsOptionsDelegate));
  app.use(express.urlencoded({ extended: true }));

  for (const { mount, router } of legacyRouteMounts) app.use(mount, router);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Route not found' });
  });
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : err.message,
    });
  });

  const http = await new Promise<Server>((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
  const address = http.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => http.close(() => resolve()));
    throw new Error('Test API did not bind to a TCP port');
  }

  return {
    app,
    http,
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        http.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
