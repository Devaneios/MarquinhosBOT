import { z } from 'zod';

export function buildWordleConversation(
  date: string,
  latestClosedDate: string,
): string | null {
  if (!z.iso.date().safeParse(date).success || date > latestClosedDate)
    return null;
  const formatted = date.split('-').reverse().join('/');
  return `💬 Sobre o Terminhos de ${formatted}: qual tentativa surpreendeu você?`;
}
