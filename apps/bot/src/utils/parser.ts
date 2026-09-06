export function parseArtistTitle(query: string): {
  artist: string;
  title: string;
} {
  const parts = query.split(' - ');
  if (parts.length > 1) {
    const artist = parts[0].trim() || 'Artista Desconhecido';
    const title = parts.slice(1).join(' - ').trim();
    return { artist, title: title || query.trim() };
  }
  return {
    artist: 'Artista Desconhecido',
    title: query.trim(),
  };
}
