export function activityEndpoints(
  origin: string,
  development: boolean,
  apiOrigin = 'http://localhost:3000',
): { api: string; colyseus: string } {
  const url = new URL(origin);
  if (url.hostname.endsWith('.discordsays.com')) {
    return {
      api: '/.proxy/api',
      colyseus: `${origin.replace(/^http/, 'ws')}/.proxy/colyseus`,
    };
  }
  const base = development ? origin : apiOrigin.replace(/\/$/, '');
  return {
    api: `${base}/api`,
    colyseus: `${base.replace(/^http/, 'ws')}${development ? '/colyseus' : ''}`,
  };
}
