import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { startContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const { health } = await import('@marquinhos/contracts/http/routes/health');
const { privacyPolicy } =
  await import('@marquinhos/contracts/http/routes/privacyPolicy');

let server: Awaited<ReturnType<typeof startContractServer>>;

beforeAll(async () => {
  const { default: healthRouter } =
    await import('../../src/routes/health.route');
  const { default: privacyPolicyRouter } =
    await import('../../src/routes/privacyPolicy.route');
  server = await startContractServer((app) => {
    app.use('/api/health', healthRouter);
    app.use('/api/privacy-policy', privacyPolicyRouter);
  });
});

afterAll(() => server.close());

describe('health and privacy policy contracts', () => {
  it('reports ok', async () => {
    expect(await callContract(server.http, health, {})).toEqual({
      status: 'ok',
    });
  });

  it('serves the privacy policy with its sections', async () => {
    const policy = await callContract(server.http, privacyPolicy, {});

    expect(policy.title).toBe('Política de Privacidade para MarquinhosBOT');
    expect(policy.sections.length).toBeGreaterThan(0);
  });
});
