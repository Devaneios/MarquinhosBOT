import type { Client } from 'colyseus';
import type { WsSessionPayload } from 'services/activity/wsSessionToken';

export type AuthedClient = Client<{ auth: WsSessionPayload }>;

export function requireAuth(client: AuthedClient): WsSessionPayload {
  if (!client.auth) {
    throw new Error('Client has no authenticated session');
  }
  return client.auth;
}
