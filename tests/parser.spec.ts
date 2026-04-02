import { describe, expect, it } from 'bun:test';
import { parseArtistTitle } from '../src/utils/parser';

describe('parseArtistTitle', () => {
  it('splits on first " - " into artist and title', () => {
    expect(parseArtistTitle('Artist - Title')).toEqual({
      artist: 'Artist',
      title: 'Title',
    });
  });

  it('uses only the first " - " as the split point, joining the rest as title', () => {
    expect(parseArtistTitle('My Song - Artist - Remix')).toEqual({
      artist: 'My Song',
      title: 'Artist - Remix',
    });
  });

  it('falls back to Artista Desconhecido when there is no separator', () => {
    expect(parseArtistTitle('No separator')).toEqual({
      artist: 'Artista Desconhecido',
      title: 'No separator',
    });
  });

  it('falls back to Artista Desconhecido for an empty string', () => {
    expect(parseArtistTitle('')).toEqual({
      artist: 'Artista Desconhecido',
      title: '',
    });
  });

  it('falls back to Artista Desconhecido when artist part is empty', () => {
    expect(parseArtistTitle(' - Title')).toEqual({
      artist: 'Artista Desconhecido',
      title: 'Title',
    });
  });
});
