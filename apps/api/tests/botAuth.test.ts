import { Controller, Get } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { BotAuth } from 'common/decorators/auth.decorators';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { HttpInfrastructureModule } from 'common/http/http-infrastructure.module';
import { AppConfig } from 'config/app.config';
import { encryptToken } from 'utils/crypto';
import {
  createNestHttpTestApp,
  type NestHttpTestApp,
} from './helpers/createNestHttpTestApp';

@Controller('bot-auth-probe')
class BotAuthProbeController {
  @Get()
  @BotAuth()
  check() {
    return { authorized: true };
  }
}

describe('BotAuthGuard', () => {
  const VALID_KEY = 'test-api-key-abc123';
  let api: NestHttpTestApp;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MARQUINHOS_API_KEY = VALID_KEY;
    api = await createNestHttpTestApp(
      {
        imports: [HttpInfrastructureModule],
        controllers: [BotAuthProbeController],
        providers: [BotAuthGuard],
      },
      (builder) =>
        builder
          .overrideProvider(AppConfig)
          .useValue({ marquinhosApiKey: VALID_KEY }),
    );
  });

  afterEach(async () => {
    await api?.close();
    delete process.env.MARQUINHOS_API_KEY;
  });

  it('accepts a valid Bearer token', async () => {
    const response = await fetch(`${api.origin}/api/bot-auth-probe`, {
      headers: { authorization: `Bearer ${VALID_KEY}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authorized: true });
  });

  it('returns 401 when token does not match', async () => {
    const response = await fetch(`${api.origin}/api/bot-auth-probe`, {
      headers: { authorization: 'Bearer wrong-key' },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Token not authorized' });
  });

  it('ignores the old web-agent header and still requires the API key', async () => {
    const userToken = encryptToken('discord-access', Date.now() + 60_000);
    const response = await fetch(`${api.origin}/api/bot-auth-probe`, {
      headers: {
        authorization: `Bearer ${userToken}`,
        'marquinhos-agent': 'web',
      },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Token not authorized' });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await fetch(`${api.origin}/api/bot-auth-probe`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Token not provided' });
  });
});
