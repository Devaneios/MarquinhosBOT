export function selectShareAchievement(
  items: readonly { id: string; name: string; unlockedAt: string | null }[],
  selection: string,
): string | null {
  const query = selection.trim().toLocaleLowerCase('pt-BR');
  return (
    items.find(
      (item) =>
        item.unlockedAt !== null &&
        (item.id.toLocaleLowerCase('pt-BR') === query ||
          item.name.toLocaleLowerCase('pt-BR') === query),
    )?.id ?? null
  );
}

export function buildShareButtonId(
  userId: string,
  channelId: string,
  achievementId: string,
): string {
  const id = `termo-share:${userId}:${channelId}:${achievementId}`;
  if (id.length > 100) throw new Error('Share confirmation is too long');
  return id;
}

export function parseShareButtonId(
  id: string,
): { userId: string; channelId: string; achievementId: string } | null {
  const match = /^termo-share:(\d{1,20}):(\d{1,20}):([a-z0-9_]{1,60})$/.exec(
    id,
  );
  return match
    ? { userId: match[1]!, channelId: match[2]!, achievementId: match[3]! }
    : null;
}
