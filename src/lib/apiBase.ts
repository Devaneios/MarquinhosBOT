// Discord's Activity proxy serves the app from a *.discordsays.com origin and
// requires every non-Discord network request to go through the /.proxy/
// prefix (mapped to your real origin via URL Mapping in the Developer
// Portal). Outside Discord — plain browser iteration during local dev — we
// talk to marquinhos-api directly.
const isInsideDiscordProxy =
  window.location.hostname.endsWith('discordsays.com');

function apiOrigin(): string {
  return import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3000';
}

function withLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function apiUrl(path: string): string {
  const normalized = withLeadingSlash(path);
  return isInsideDiscordProxy
    ? `/.proxy/api${normalized}`
    : `${apiOrigin()}/api${normalized}`;
}

export function wsUrl(path: string): string {
  const normalized = withLeadingSlash(path);
  if (isInsideDiscordProxy) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/.proxy${normalized}`;
  }
  return `${apiOrigin().replace(/^http/, 'ws')}${normalized}`;
}
