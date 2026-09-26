import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = import.meta.dir;

const files = [...new Bun.Glob('**/*.{ts,tsx,json,css}').scanSync(SRC)];
const fileSet = new Set(files);
const codeFiles = files.filter(
  (file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'),
);

const SPECIFIER =
  /(?:\bfrom\s+|\bimport\s+|\bimport\(\s*|mock\.module\(\s*)['"`]([^'"`?$]+)/g;

function resolveSpecifier(importer: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = specifier.slice(2);
  else if (specifier.startsWith('.'))
    base = path.posix.join(path.posix.dirname(importer), specifier);
  else return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? base;
}

type Layer =
  | { kind: 'app' | 'platform' | 'shared' | 'i18n' | 'styles' | 'root' }
  | { kind: 'games-shared' | 'game-module' | 'registry' }
  | { kind: 'game'; name: string }
  | { kind: 'feature'; name: string }
  | { kind: 'unknown' };

function layerOf(file: string): Layer {
  const [top, second] = file.split('/');
  switch (top) {
    case 'app':
    case 'platform':
    case 'shared':
    case 'i18n':
    case 'styles':
      return { kind: top };
    case 'features':
      return { kind: 'feature', name: second };
    case 'games':
      if (second === 'shared') return { kind: 'games-shared' };
      if (second === 'GameModule.ts') return { kind: 'game-module' };
      if (second === 'registry.ts') return { kind: 'registry' };
      return { kind: 'game', name: second };
    case 'architecture.test.ts':
      return { kind: 'root' };
    default:
      return { kind: 'unknown' };
  }
}

const FOUNDATION = ['platform', 'shared', 'i18n'];

function isGameEntry(file: string): boolean {
  return (
    /^games\/[^/]+\/index\.ts$/.test(file) && !file.startsWith('games/shared/')
  );
}

function allowed(from: Layer, to: Layer, target: string): boolean {
  switch (from.kind) {
    case 'shared':
    case 'i18n':
      return to.kind === 'shared' || to.kind === from.kind;
    case 'platform':
      return FOUNDATION.includes(to.kind);
    case 'games-shared':
      return to.kind === 'games-shared' || FOUNDATION.includes(to.kind);
    case 'game-module':
      return FOUNDATION.includes(to.kind);
    case 'registry':
      return to.kind === 'game-module' || isGameEntry(target);
    case 'game':
      return (
        (to.kind === 'game' && to.name === from.name) ||
        ['games-shared', 'game-module'].includes(to.kind) ||
        FOUNDATION.includes(to.kind)
      );
    case 'feature':
      return (
        (to.kind === 'feature' && to.name === from.name) ||
        ['games-shared', 'game-module', 'registry'].includes(to.kind) ||
        FOUNDATION.includes(to.kind)
      );
    case 'app':
      return to.kind !== 'game' && to.kind !== 'unknown';
    case 'styles':
    case 'root':
    case 'unknown':
      return false;
  }
}

describe('activity architecture', () => {
  it('places every source file in a known layer', () => {
    expect(
      codeFiles.filter((file) => layerOf(file).kind === 'unknown'),
    ).toEqual([]);
  });

  it('only imports across layers in the allowed direction', () => {
    const violations: string[] = [];
    for (const file of codeFiles) {
      const from = layerOf(file);
      if (from.kind === 'root') continue;
      const source = readFileSync(path.join(SRC, file), 'utf8');
      for (const [, specifier] of source.matchAll(SPECIFIER)) {
        const target = resolveSpecifier(file, specifier);
        if (target === null) continue;
        if (!fileSet.has(target)) {
          violations.push(`${file} -> ${specifier} (unresolved)`);
          continue;
        }
        if (!allowed(from, layerOf(target), target))
          violations.push(`${file} -> ${target}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps barrels only at module boundaries', () => {
    const barrels = files.filter((file) => /(^|\/)index\.tsx?$/.test(file));
    expect(
      barrels.filter(
        (file) =>
          !isGameEntry(file) &&
          ![
            'games/shared/shell/index.ts',
            'games/shared/keyboard/index.ts',
            'i18n/index.ts',
          ].includes(file),
      ),
    ).toEqual([]);
  });
});
