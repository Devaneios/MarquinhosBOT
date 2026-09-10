import { activityEndpoints } from './activityEndpoints';

function endpoints() {
  return activityEndpoints(
    `${window.location.protocol}//${window.location.host}`,
    import.meta.env.DEV,
    import.meta.env.VITE_API_ORIGIN,
  );
}

export function apiUrl(path: string): string {
  return `${endpoints().api}${path.startsWith('/') ? path : `/${path}`}`;
}

export function colyseusUrl(): string {
  return endpoints().colyseus;
}
