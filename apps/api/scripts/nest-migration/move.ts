import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';

interface MoveEntry {
  from: string;
  to: string;
}

const API_ROOT = resolve(import.meta.dir, '../..');
const MOVES: MoveEntry[] = [
  { from: 'src/utils/crypto.ts', to: 'src/common/crypto.ts' },
  {
    from: 'src/services/discord.ts',
    to: 'src/integrations/discord/discord.service.ts',
  },
  {
    from: 'src/services/lastfm.ts',
    to: 'src/integrations/lastfm/lastfm.service.ts',
  },
  {
    from: 'src/services/spotify.ts',
    to: 'src/integrations/spotify/spotify.service.ts',
  },
  {
    from: 'src/services/parser.ts',
    to: 'src/modules/scrobble/parser.service.ts',
  },
  {
    from: 'src/services/scrobbler.ts',
    to: 'src/modules/scrobble/scrobbler.service.ts',
  },
  {
    from: 'src/services/user.ts',
    to: 'src/modules/user/user.service.ts',
  },
  {
    from: 'src/controllers/auth.controller.ts',
    to: 'src/modules/auth/auth.controller.ts',
  },
  {
    from: 'src/controllers/user.controller.ts',
    to: 'src/modules/user/user.controller.ts',
  },
  {
    from: 'src/controllers/scrobble.controller.ts',
    to: 'src/modules/scrobble/scrobble.controller.ts',
  },
];

const moveByAbsolutePath = new Map(
  MOVES.flatMap((move) => {
    const source = resolve(API_ROOT, move.from);
    const target = resolve(API_ROOT, move.to);
    return [
      [source, target],
      [source.replace(/\.(?:[cm]?[jt]sx?)$/, ''), target],
    ];
  }),
);
const originalPathByMovedPath = new Map(
  MOVES.map((move) => [
    resolve(API_ROOT, move.to),
    resolve(API_ROOT, move.from),
  ]),
);
const aliasMoves = new Map(
  MOVES.map((move) => [
    move.from.replace(/^src\//, '').replace(/\.ts$/, ''),
    move.to.replace(/^src\//, '').replace(/\.ts$/, ''),
  ]),
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.isDirectory() &&
      ['.turbo', 'dist', 'node_modules'].includes(entry.name)
    ) {
      return [];
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx', '.mts', '.cts'].includes(extname(entry.name))
      ? [path]
      : [];
  });
}

function newSpecifier(
  specifier: string,
  importingFile: string,
): string | undefined {
  const alias = aliasMoves.get(specifier.replace(/\.(?:[cm]?tsx?)$/, ''));
  if (alias) return alias;
  if (!specifier.startsWith('.')) return undefined;

  const oldImportingFile =
    originalPathByMovedPath.get(importingFile) ?? importingFile;
  const currentTarget = resolve(dirname(importingFile), specifier);
  const oldTarget = resolve(dirname(oldImportingFile), specifier);
  const currentTargetExists = [
    currentTarget,
    `${currentTarget}.ts`,
    `${currentTarget}.tsx`,
    resolve(currentTarget, 'index.ts'),
  ].some(existsSync);
  const target = currentTargetExists ? currentTarget : oldTarget;
  const normalizedTarget = target.replace(/\.(?:[cm]?[jt]sx?)$/, '');
  const movedTarget =
    moveByAbsolutePath.get(target) ??
    moveByAbsolutePath.get(normalizedTarget) ??
    target;
  const importingTarget =
    moveByAbsolutePath.get(importingFile) ?? importingFile;
  let nextSpecifier = relative(dirname(importingTarget), movedTarget)
    .split(sep)
    .join('/');
  if (!nextSpecifier.startsWith('.')) nextSpecifier = `./${nextSpecifier}`;
  nextSpecifier = nextSpecifier.replace(/\.(?:[cm]?[jt]sx?)$/, '');
  return nextSpecifier === specifier ? undefined : nextSpecifier;
}

const files = sourceFiles(API_ROOT);
for (const path of files) {
  const original = await Bun.file(path).text();
  const updated = original.replace(
    /((?:from\s*|import\s*\(\s*))(['"])([^'"]+)\2/g,
    (full, prefix: string, quote: string, specifier: string) => {
      const replacement = newSpecifier(specifier, path);
      return replacement ? `${prefix}${quote}${replacement}${quote}` : full;
    },
  );
  if (updated !== original) writeFileSync(path, updated);
}

for (const move of MOVES) {
  const source = resolve(API_ROOT, move.from);
  const target = resolve(API_ROOT, move.to);
  if (!existsSync(source)) continue;
  mkdirSync(dirname(target), { recursive: true });
  renameSync(source, target);
}

console.log(`Moved ${MOVES.length} files and rewrote import specifiers.`);
