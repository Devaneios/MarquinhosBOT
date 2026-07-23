export type SentimentBucket = 'positivo' | 'negativo' | 'engracado' | 'neutro';

type ScoredBucket = Exclude<SentimentBucket, 'neutro'>;

const LEXICON: Record<ScoredBucket, string[]> = {
  positivo: [
    'bom',
    'boa',
    'otimo',
    'ótimo',
    'top',
    'incrivel',
    'incrível',
    'maravilhoso',
    'amei',
    'gostei',
    'lindo',
    'perfeito',
    'feliz',
  ],
  negativo: [
    'ruim',
    'pessimo',
    'péssimo',
    'triste',
    'horrivel',
    'horrível',
    'odeio',
    'raiva',
    'chateado',
    'droga',
    'lixo',
  ],
  engracado: [
    'kkk',
    'kkkk',
    'kkkkk',
    'haha',
    'hahaha',
    'rsrs',
    'lol',
    'engracado',
    'engraçado',
    'hilario',
    'hilário',
  ],
};

const EMOJI_POOLS: Record<ScoredBucket, string[]> = {
  positivo: ['😄', '🔥', '👏'],
  negativo: ['😢', '💀', '😬'],
  engracado: ['😂', '🤣', '💀'],
};

export const QUIRKY_LINE_POOLS: Record<SentimentBucket, string[]> = {
  positivo: ['Boa!', 'Isso aí!'],
  negativo: ['Vish...', 'Feio isso.'],
  engracado: ['Não é!', 'E é é?', 'kkkkkk verdade'],
  neutro: ['Não é!', 'E é é?', 'Aham, sei.', 'Sei lá.'],
};

const SCORED_BUCKETS = Object.keys(LEXICON) as ScoredBucket[];

export function classify(content: string): SentimentBucket {
  const normalized = content.toLowerCase();
  for (const bucket of SCORED_BUCKETS) {
    if (LEXICON[bucket].some((word) => normalized.includes(word))) {
      return bucket;
    }
  }
  return 'neutro';
}

function pickFrom(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickEmoji(bucket: ScoredBucket): string {
  return pickFrom(EMOJI_POOLS[bucket]);
}

export function pickQuirkyLine(bucket: SentimentBucket): string {
  return pickFrom(QUIRKY_LINE_POOLS[bucket]);
}
