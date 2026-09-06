const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all|any|previous|prior)\s+(previous\s+|prior\s+)?(instructions?|prompts?)/i,
  /disregard\s+(all|any|previous|prior)\s+(instructions?|prompts?)/i,
  /you\s+are\s+now\b/i,
  /system\s+prompt/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /modo\s+desenvolvedor/i,
  /ignore\s+(tudo|tod[oa]s)\s+((os|as)\s+)?(instru[cç][oõ]es|prompts?|regras)/i,
  /esque[cç][ae]\s+((tudo|tod[oa]s)\s+)?((os|as)\s+)?(instru[cç][oõ]es|prompts?|regras)(\s+anteriores)?/i,
  /finja\s+(que\s+)?(ser|voc[eê]\s+[eé])/i,
];

export class GuardrailService {
  isInjectionAttempt(content: string): boolean {
    return INJECTION_PATTERNS.some((pattern) => pattern.test(content));
  }

  filterSafeMessages<T extends { content: string }>(messages: T[]): T[] {
    return messages.filter(
      (message) => !this.isInjectionAttempt(message.content),
    );
  }
}
