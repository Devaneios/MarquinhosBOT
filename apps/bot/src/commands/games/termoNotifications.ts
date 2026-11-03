import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import type { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { createHash } from 'node:crypto';
import { buildTermoWinActionRow } from './termoResponse';

type Api = Pick<
  MarquinhosApiService,
  'claimWordleNotification' | 'settleWordleNotification'
>;
type Message = {
  content: string;
  nonce: string;
  enforceNonce: true;
  allowedMentions: { parse: [] };
  components?: ReturnType<typeof buildTermoWinActionRow>[];
};
type Channel = {
  guildId: string;
  send: (message: Message) => Promise<{ id: string }>;
};

export async function deliverWordleNotification(
  guildId: string,
  api: Api,
  resolveChannel: (id: string) => Promise<Channel | null>,
  loadGallery?: (week: string) => Promise<{
    weekKey: string;
    entries: { userId: string; name: string; date: string }[];
  }>,
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
  let content =
    event.kind === 'page'
      ? `📖 A comunidade preencheu uma página do álbum${pattern ? `: ${pattern.name}` : '.'}`
      : event.kind === 'goal'
        ? '🎉 A comunidade concluiu uma meta do Terminhos!'
        : `📚 Resumo semanal: ${pages} ${pages === 1 ? 'página' : 'páginas'} do álbum e ${goals} ${goals === 1 ? 'meta concluída' : 'metas concluídas'}.`;
  let components: Message['components'];
  if (event.kind === 'weekly' && event.payload.gallery === '1') {
    let gallery: Awaited<ReturnType<NonNullable<typeof loadGallery>>> | null =
      null;
    try {
      if (loadGallery && event.payload.week)
        gallery = await loadGallery(event.payload.week);
    } catch {
      /* retry when the source is available */
    }
    const entries =
      gallery?.weekKey === event.payload.week
        ? gallery.entries.filter((entry) => /^\d{1,20}$/.test(entry.userId))
        : [];
    if (!entries.length) {
      await api.settleWordleNotification(guildId, {
        id: event.id,
        leaseId: event.leaseId,
        result: 'not_sent',
      });
      return false;
    }
    const lines = entries
      .slice(0, 15)
      .map(
        (entry) =>
          `• <@${entry.userId}> — ${entry.name} (${entry.date.split('-').reverse().join('/')})`,
      );
    content = `🖼️ Galeria da semana iniciada em ${gallery!.weekKey.split('-').reverse().join('/')}\n${lines.join('\n')}${entries.length > lines.length ? `\nE mais ${entries.length - lines.length} participantes.` : ''}`;
    components = [buildTermoWinActionRow()];
  }
  let sent: { id: string };
  try {
    sent = await channel.send({
      content,
      nonce: createHash('sha256').update(event.id).digest('hex').slice(0, 24),
      enforceNonce: true,
      allowedMentions: { parse: [] },
      ...(components ? { components } : {}),
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
