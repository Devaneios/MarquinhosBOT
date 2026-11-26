import {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionsBitField,
  SlashCommandBuilder,
  type APIApplicationCommandOption,
} from 'discord.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import {
  commandDefinitions,
  type CommandDefinition,
} from '../src/lib/commandDefinitions';

const repo = resolve(import.meta.dir, '../../..');
const sourceRoot = resolve(repo, 'apps/bot/src');
const registryPath = resolve(sourceRoot, 'lib/registerSapphirePieces.ts');
const sourceUrl =
  'https://github.com/Devaneios/MarquinhosBOT/blob/main/apps/bot/src/';

async function registeredDefinitions() {
  const source = ts.createSourceFile(
    registryPath,
    await readFile(registryPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = new Map<string, string>();
  let commands: ts.ArrayLiteralExpression | undefined;

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements)
          imports.set(item.name.text, statement.moduleSpecifier.text);
      }
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== 'commands'
      )
        continue;
      const expression = declaration.initializer;
      const entries =
        expression && ts.isAsExpression(expression)
          ? expression.expression
          : expression;
      if (!entries || !ts.isArrayLiteralExpression(entries))
        throw new Error(
          'Sapphire commands must be a statically extractable array',
        );
      commands = entries;
    }
  }

  if (!commands) throw new Error('Sapphire command list is missing');
  const definitions: Record<string, CommandDefinition> = commandDefinitions;
  const seen = new Set<string>();
  return commands.elements.map((entry) => {
    if (!ts.isArrayLiteralExpression(entry) || entry.elements.length !== 2)
      throw new Error('Unexpected entry in Sapphire command list');
    const [name, piece] = entry.elements;
    if (!name || !ts.isStringLiteral(name) || !piece || !ts.isIdentifier(piece))
      throw new Error(
        'Sapphire command entries require a literal name and command class',
      );

    const definition = definitions[name.text];
    if (!definition || definition.options.name !== name.text)
      throw new Error(`No definition for registered command ${name.text}`);
    if (
      imports.get(piece.text) !==
      `@marquinhos/${definition.source.slice(0, -3)}`
    )
      throw new Error(
        `Registered handler and definition source differ for ${name.text}`,
      );
    if (seen.has(name.text))
      throw new Error(`Duplicate registered command ${name.text}`);
    seen.add(name.text);
    return definition;
  });
}

const inline = (value: string | number) => `\`${String(value)}\``;

function renderOptions(
  options: readonly APIApplicationCommandOption[],
  depth: number,
): string[] {
  const indent = '  '.repeat(depth);
  return options.flatMap((option) => {
    const label = ApplicationCommandOptionType[option.type];
    if (
      option.type === ApplicationCommandOptionType.Subcommand ||
      option.type === ApplicationCommandOptionType.SubcommandGroup
    ) {
      return [
        `${indent}- ${inline(option.name)} (${label}) — ${option.description}`,
        ...renderOptions(option.options ?? [], depth + 1),
      ];
    }

    const limits = [
      'min_value' in option &&
        option.min_value !== undefined &&
        `min ${option.min_value}`,
      'max_value' in option &&
        option.max_value !== undefined &&
        `max ${option.max_value}`,
      'min_length' in option &&
        option.min_length !== undefined &&
        `min length ${option.min_length}`,
      'max_length' in option &&
        option.max_length !== undefined &&
        `max length ${option.max_length}`,
      'autocomplete' in option && option.autocomplete && 'autocomplete',
      'channel_types' in option &&
        option.channel_types?.length &&
        option.channel_types.map((type) => ChannelType[type]).join(', '),
    ].filter(Boolean);
    const detail = [
      label,
      option.required ? 'required' : 'optional',
      ...limits,
    ].join(', ');
    const choices = 'choices' in option ? (option.choices ?? []) : [];
    return [
      `${indent}- ${inline(option.name)} (${detail}) — ${option.description}`,
      ...choices.map(
        (choice) => `${indent}  - ${choice.name} (${inline(choice.value)})`,
      ),
    ];
  });
}

export async function generateCommandReference() {
  const definitions = (await registeredDefinitions()).sort((a, b) =>
    a.options.name < b.options.name
      ? -1
      : a.options.name > b.options.name
        ? 1
        : 0,
  );
  const lines = [
    '---',
    'title: Discord slash commands',
    'description: Registered MarquinhosBOT commands, options, permissions, and cooldowns.',
    '---',
    '',
    '<!-- Generated by pnpm gen:commands. Update the source definitions. -->',
    '',
    'Names below are for the normal bot. The development bot adds a `dev-` prefix. Command cooldowns shown here are Sapphire registration settings. Some features also apply limits while a command is running.',
  ];

  for (const definition of definitions) {
    const {
      name,
      cooldownDelay = 0,
      cooldownLimit = 1,
      preconditions,
    } = definition.options;
    const builder = new SlashCommandBuilder();
    definition.build(builder, name, resolve(sourceRoot, 'resources/sounds'));
    const command = builder.toJSON();
    const permissionBits = command.default_member_permissions;
    const permissions =
      permissionBits === '0'
        ? 'Disabled by default for members. Administrators can use it.'
        : permissionBits
          ? new PermissionsBitField(BigInt(permissionBits))
              .toArray()
              .map(inline)
              .join(', ')
          : 'No explicit member permission flag.';
    const cooldown =
      cooldownDelay && cooldownLimit
        ? `${cooldownLimit} use per ${cooldownDelay / 1000} seconds`
        : 'No Sapphire cooldown configured.';
    const options = command.options ?? [];
    if (name === 'audio') {
      for (const option of options) {
        if ('choices' in option)
          option.choices?.sort((a, b) =>
            a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
          );
      }
    }

    lines.push(
      '',
      `## /${command.name}`,
      '',
      command.description,
      '',
      `- **Discord permissions** ${permissions}`,
      `- **Cooldown** ${cooldown}`,
      ...(preconditions?.length
        ? [
            `- **Runtime preconditions** ${preconditions
              .map((condition) => {
                if (typeof condition !== 'string')
                  throw new Error(`Unsupported precondition for /${name}`);
                return inline(condition);
              })
              .join(', ')}`,
          ]
        : []),
      ...renderOptions(options, 0),
      '',
      `[Command implementation](${sourceUrl}${definition.source})`,
    );
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.main) {
  const destination = resolve(
    process.argv[2] ??
      resolve(repo, 'apps/docs/src/content/docs/reference/commands.md'),
  );
  const markdown = await generateCommandReference();
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, markdown);
}
