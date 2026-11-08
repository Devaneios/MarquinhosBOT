import { TokenCipherService } from 'common/crypto';
import {
  WsSessionTokenService,
  type WsSessionPayload,
} from 'modules/activity/ws-session-token';
import { createTestAppConfig } from './testAppConfig';

export const testWsSessionTokens = new WsSessionTokenService(
  new TokenCipherService(createTestAppConfig()),
);

export const mintWsSessionToken = (payload: WsSessionPayload) =>
  testWsSessionTokens.mint(payload);

export const verifyWsSessionToken = (token: string) =>
  testWsSessionTokens.verify(token);
