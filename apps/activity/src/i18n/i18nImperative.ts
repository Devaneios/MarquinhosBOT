import i18next from './index';

export function tImperative(
  key: string,
  ns: string,
  options?: Record<string, unknown>,
): string {
  return i18next.t(`${ns}:${key}`, options);
}
