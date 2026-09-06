import { describe, expect, it } from 'bun:test';
import { buildActivityTokenExchangeBody } from 'services/discord';

describe('buildActivityTokenExchangeBody', () => {
  it('includes the authorization code and grant_type', () => {
    const body = buildActivityTokenExchangeBody('auth-code-abc');
    expect(body.get('code')).toBe('auth-code-abc');
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('omits redirect_uri, unlike the web OAuth flow', () => {
    const body = buildActivityTokenExchangeBody('auth-code-abc');
    expect(body.has('redirect_uri')).toBe(false);
  });
});
