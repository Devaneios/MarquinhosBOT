// Informational tracing gated to dev builds — errors that a player might
// actually hit should still use console.error directly so they aren't
// silently swallowed in production.
const isDev = import.meta.env.DEV;

export function devlog(...args: unknown[]) {
  if (isDev) console.log(...args);
}

export function devinfo(...args: unknown[]) {
  if (isDev) console.info(...args);
}

export function devwarn(...args: unknown[]) {
  if (isDev) console.warn(...args);
}
