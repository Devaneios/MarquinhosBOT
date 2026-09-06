import { describe, expect, test } from 'bun:test';
import { buildNowPlayingEmbed, buildTrackAddedEmbed } from '@marquinhos/formatters/music';

const mockClient = { user: { displayAvatarURL: () => 'https://avatar.url' } } as any;
const mockTrack = {
  title: 'Test Track',
  url: 'https://track.url',
  author: 'Test Artist',
  duration: '3:30',
  durationMS: 210000,
  thumbnail: 'https://thumb.url',
} as any;

describe('buildNowPlayingEmbed', () => {
  test('sets title to Tocando agora', () => {
    const embed = buildNowPlayingEmbed(mockClient, mockTrack, 'user-id-123');
    const data = embed.toJSON();
    expect(data.title).toBe('Tocando agora');
  });

  test('includes track title and url in description', () => {
    const embed = buildNowPlayingEmbed(mockClient, mockTrack, 'user-id-123');
    const data = embed.toJSON();
    expect(data.description).toContain('Test Track');
    expect(data.description).toContain('https://track.url');
  });
});

describe('buildTrackAddedEmbed', () => {
  test('sets title to Adicionada a fila', () => {
    const embed = buildTrackAddedEmbed(mockClient, mockTrack, 'user-id-123');
    const data = embed.toJSON();
    expect(data.title).toBe('Adicionada a fila');
  });
});
