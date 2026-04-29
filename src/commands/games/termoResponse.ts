import type { TermoGuess } from '@marquinhos/ui/compounds/termo';
import {
  buildKeyboardImage,
  normalizeKeyboardBuffer,
} from '@marquinhos/ui/screens/termo';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const TERMO_BUTTON_IDS = {
  text: 'termo_text',
  retry: 'termo_retry',
  link: 'termo_link',
} as const;

export const TERMO_BUTTON_ID_SET = new Set<string>(
  Object.values(TERMO_BUTTON_IDS),
);

type KeyboardImageOptions = Parameters<typeof buildKeyboardImage>[2];

export function buildTermoActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TERMO_BUTTON_IDS.text)
      .setLabel('Ver texto')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(TERMO_BUTTON_IDS.retry)
      .setLabel('Recarregar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(TERMO_BUTTON_IDS.link)
      .setLabel('Link da imagem')
      .setStyle(ButtonStyle.Secondary),
  );
}

export async function buildKeyboardAttachment(
  guesses: TermoGuess[],
  wordLength: number,
  options: KeyboardImageOptions,
): Promise<AttachmentBuilder> {
  const keyboardBuffer = await buildKeyboardImage(guesses, wordLength, options);
  const normalizedBuffer = await normalizeKeyboardBuffer(keyboardBuffer);
  return new AttachmentBuilder(normalizedBuffer, {
    name: `keyboard-${Date.now()}.png`,
  });
}
