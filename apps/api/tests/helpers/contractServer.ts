import type { Express } from 'express';

process.env.MARQUINHOS_API_KEY = 'contract-test-key';

export async function startContractServer(mount: (app: Express) => void) {
  const { default: express } = await import('express');
  const { runMigrations } = await import('@marquinhos/database/migrate');
  const { HttpClient } = await import('@marquinhos/api-client/bot');
  await runMigrations();

  const app = express();
  app.use(express.json());
  mount(app);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Contract server has no port');
  }

  const http = new HttpClient({
    baseURL: `http://127.0.0.1:${address.port}`,
    headers: { Authorization: 'Bearer contract-test-key' },
    retries: 0,
  });

  return {
    http,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
