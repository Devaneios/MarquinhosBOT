import { describe, expect, it, mock } from 'bun:test';
import { requireGuildMember } from 'middlewares/guildMembership';

function response() {
  return {
    code: 200,
    body: undefined as unknown,
    status(code: number) {
      this.code = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

const request = (guildId?: string) => ({
  params: { guildId },
  headers: { authorization: 'Bearer token' },
});

describe('requireGuildMember', () => {
  it('admits a verified member of the requested community', async () => {
    const isMember = mock(async () => true);
    const next = mock(() => {});
    await requireGuildMember(isMember)(
      request('community') as never,
      response() as never,
      next,
    );
    expect(isMember).toHaveBeenCalledWith('token', 'community');
    expect(next).toHaveBeenCalled();
  });
  it('rejects a nonmember, an unavailable Discord and a missing community', async () => {
    const cases = [
      { guildId: 'community', check: async () => false, code: 403 },
      {
        guildId: 'community',
        check: async () => {
          throw new Error('offline');
        },
        code: 503,
      },
      { guildId: undefined, check: async () => true, code: 400 },
    ];
    for (const { guildId, check, code } of cases) {
      const next = mock(() => {});
      const res = response();
      await requireGuildMember(check)(
        request(guildId) as never,
        res as never,
        next,
      );
      expect(res.code).toBe(code);
      expect(next).not.toHaveBeenCalled();
    }
  });
});
