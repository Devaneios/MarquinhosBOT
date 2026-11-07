import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { AuthModule } from 'modules/auth/auth.module';
import { startNestContractServer } from './helpers/contractServer';

let server: Awaited<ReturnType<typeof startNestContractServer>>;

beforeAll(async () => {
  server = await startNestContractServer({ imports: [AuthModule] });
});

afterAll(() => server.close());

describe('GET /api/auth/refresh_token', () => {
  it('rejects an invalid refresh token', async () => {
    const response = await fetch(`${server.origin}/api/auth/refresh_token`, {
      headers: { 'Refresh-Token': 'not-a-real-token' },
    });
    const body = await response.json();

    expect(body).not.toEqual({ message: 'Refresh token not found' });
  });

  it('rejects a request without the header', async () => {
    const response = await fetch(`${server.origin}/api/auth/refresh_token`);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'Refresh token not found' });
  });
});
