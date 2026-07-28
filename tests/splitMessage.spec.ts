import { splitMessage } from '@marquinhos/utils/discord';
import { describe, expect, it } from 'bun:test';

describe('splitMessage', () => {
  it('returns short text as a single chunk', () => {
    expect(splitMessage('curto')).toEqual(['curto']);
  });

  it('returns a single empty chunk for empty text', () => {
    expect(splitMessage('')).toEqual(['']);
  });

  it('keeps every chunk within the limit', () => {
    const chunks = splitMessage('palavra '.repeat(1000));

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  it('prefers breaking on a blank line, keeping paragraphs intact', () => {
    const paragraph = `${'a'.repeat(900)}\n\n${'b'.repeat(900)}\n\n${'c'.repeat(900)}`;

    const chunks = splitMessage(paragraph, 1000);

    expect(chunks[0]).toBe('a'.repeat(900));
    expect(chunks[1]).toBe('b'.repeat(900));
  });

  it('falls back to a line break when there is no blank line', () => {
    const chunks = splitMessage(`${'a'.repeat(60)}\n${'b'.repeat(60)}`, 70);

    expect(chunks[0]).toBe('a'.repeat(60));
    expect(chunks[1]).toBe('b'.repeat(60));
  });

  it('falls back to a space so a word is never cut in half', () => {
    const chunks = splitMessage(`${'a'.repeat(60)} ${'b'.repeat(60)}`, 70);

    expect(chunks[0]).toBe('a'.repeat(60));
    expect(chunks[1]).toBe('b'.repeat(60));
  });

  it('hard-cuts a single word longer than the limit rather than looping', () => {
    const chunks = splitMessage('x'.repeat(250), 100);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
  });

  it('loses no content across the split', () => {
    const text = Array.from({ length: 300 }, (_, i) => `linha ${i}`).join('\n');

    const rejoined = splitMessage(text, 500).join('\n');

    expect(rejoined).toBe(text);
  });

  it('honours a custom limit', () => {
    for (const chunk of splitMessage('palavra '.repeat(200), 300)) {
      expect(chunk.length).toBeLessThanOrEqual(300);
    }
  });
});
