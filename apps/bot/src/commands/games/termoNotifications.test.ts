import { expect, it, mock } from 'bun:test';
import { deliverWordleNotification } from './termoNotifications';

const event = {
  id: 'id',
  eventKey: 'goal:1',
  kind: 'goal' as const,
  payload: { goalId: '1' },
  status: 'sending' as const,
  leaseId: 'lease',
  channelId: 'channel',
};

it('releases a notification when the destination is absent or belongs to another community', async () => {
  const settle = mock(async () => ({ data: { recorded: true } }));
  const api = {
    claimWordleNotification: async () => ({ data: event }),
    settleWordleNotification: settle,
  };
  await deliverWordleNotification('a', api, async () => ({
    guildId: 'b',
    send: async () => ({ id: 'message' }),
  }));
  expect(settle).toHaveBeenCalledWith('a', {
    id: 'id',
    leaseId: 'lease',
    result: 'not_sent',
  });
});

it('marks an ambiguous send uncertain and confirms a successful delivery', async () => {
  const settle = mock(async () => ({ data: { recorded: true } }));
  const api = {
    claimWordleNotification: async () => ({ data: event }),
    settleWordleNotification: settle,
  };
  await deliverWordleNotification('a', api, async () => ({
    guildId: 'a',
    send: async () => {
      throw new Error('connection lost');
    },
  }));
  expect(settle).toHaveBeenCalledWith('a', {
    id: 'id',
    leaseId: 'lease',
    result: 'ambiguous',
  });
  const send = mock(async (_message: unknown) => ({ id: 'message' }));
  await deliverWordleNotification('a', api, async () => ({
    guildId: 'a',
    send,
  }));
  expect(settle).toHaveBeenCalledWith('a', {
    id: 'id',
    leaseId: 'lease',
    result: 'delivered',
    messageId: 'message',
  });
  expect(send.mock.calls[0]![0]).toMatchObject({
    enforceNonce: true,
    allowedMentions: { parse: [] },
  });
});

it('shows the aggregate counts in the weekly summary', async () => {
  const send = mock(async (_message: unknown) => ({ id: 'message' }));
  const api = {
    claimWordleNotification: async () => ({
      data: {
        ...event,
        kind: 'weekly' as const,
        payload: { pages: '2', goals: '1', week: '2026-10-26' },
      },
    }),
    settleWordleNotification: async () => ({ data: { recorded: true } }),
  };
  await deliverWordleNotification('a', api, async () => ({
    guildId: 'a',
    send,
  }));
  expect(send.mock.calls[0]![0]).toMatchObject({
    content: expect.stringContaining('2 páginas'),
  });
});
