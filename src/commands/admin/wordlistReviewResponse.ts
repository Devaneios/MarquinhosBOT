import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const WORDLIST_REVIEW_BUTTON_IDS = {
  keep: 'wordlist_review_keep',
  remove: 'wordlist_review_remove',
} as const;

export const WORDLIST_REVIEW_BUTTON_ID_SET = new Set<string>(
  Object.values(WORDLIST_REVIEW_BUTTON_IDS),
);

export function buildWordlistReviewActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(WORDLIST_REVIEW_BUTTON_IDS.keep)
      .setLabel('Manter')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(WORDLIST_REVIEW_BUTTON_IDS.remove)
      .setLabel('Remover')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildWordlistReviewContent(review: {
  word: string | null;
  index: number;
  total: number;
  done: boolean;
}): string {
  if (review.done || review.word === null) {
    return '✅ Revisão da wordlist concluída — não há mais palavras para revisar.';
  }
  return `Palavra ${review.index + 1}/${review.total}: \`${review.word}\``;
}
