import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { createHash } from 'node:crypto';

type Api = Pick<
  MarquinhosApiService,
  'claimWordleNotification' | 'settleWordleNotification'
>;
type Message = {
  content: string;
  nonce: string;
  enforceNonce: true;
  allowedMentions: { parse: [] };
};
type Channel = {
  guildId: string;
  send: (message: Message) => Promise<{ id: string }>;
};

export async function deliverWordleNotification(
  guildId: string,
  api: Api,
  resolveChannel: (id: string) => Promise<Channel | null>,
): Promise<boolean> {
  const event = (await api.claimWordleNotification(guildId)).data;
  if (!event) return false;
  let channel: Channel | null;
  try {
    channel = await resolveChannel(event.channelId);
  } catch {
    channel = null;
  }
  if (!channel || channel.guildId !== guildId) {
    await api.settleWordleNotification(guildId, {
      id: event.id,
      leaseId: event.leaseId,
      result: 'not_sent',
    });
    return false;
  }
  const pattern = WORDLE_ACHIEVEMENT_CATALOG.find(
    (item) =>
      item.kind === 'drawing' &&
      item.drawing.patternId === event.payload.patternId &&
      !item.hidden,
  );
  const count = (value: string | undefined) =>
    /^\d{1,8}$/.test(value ?? '') ? Number(value) : 0;
  const pages = count(event.payload.pages);
  const goals = count(event.payload.goals);
  const content =
    event.kind === 'page'
      ? `📖 A comunidade preencheu uma página do álbum${pattern ? `: ${pattern.name}` : '.'}`
      : event.kind === 'goal'
        ? '🎉 A comunidade concluiu uma meta do Terminhos!'
        : `📚 Resumo semanal: ${pages} ${pages === 1 ? 'página' : 'páginas'} do álbum e ${goals} ${goals === 1 ? 'meta concluída' : 'metas concluídas'}.`;
  let sent: { id: string };
  try {
    sent = await channel.send({
      content,
      nonce: createHash('sha256').update(event.id).digest('hex').slice(0, 24),
      enforceNonce: true,
      allowedMentions: { parse: [] },
    });
  } catch {
    await api.settleWordleNotification(guildId, {
      id: event.id,
      leaseId: event.leaseId,
      result: 'ambiguous',
    });
    return false;
  }
  const confirmed = await api.settleWordleNotification(guildId, {
    id: event.id,
    leaseId: event.leaseId,
    result: 'delivered',
    messageId: sent.id,
  });
  if (!confirmed.data.recorded)
    throw new Error('Notification confirmation was not recorded');
  return true;
}
