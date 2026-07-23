const GREETING_REGEX =
  /^\s*(oi+|ol[aá]|e[ae]+|bom\s*dia|boa\s*tarde|boa\s*noite|salve|fala\s*a[ií]|eae)\b/i;

export const GREETING_POOL = [
  'Oi! 👋',
  'E aí, bora?',
  'Salve salve!',
  'Fala aí!',
];

function stripMention(content: string): string {
  return content.replace(/<@!?\d+>/g, '').trim();
}

export function isGreeting(content: string): boolean {
  return GREETING_REGEX.test(stripMention(content));
}

export function pickGreeting(): string {
  return GREETING_POOL[Math.floor(Math.random() * GREETING_POOL.length)];
}
