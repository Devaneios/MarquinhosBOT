import i18next from './index';

export function tImperative(key: string, ns: string): string {
  return i18next.t(`${ns}:${key}`);
}
