import { env } from '@marquinhos/config/environment';
import { Command } from '@sapphire/framework';
import type { CommandDefinition } from './commandDefinitions';

export abstract class MarquinhosCommand extends Command {
  constructor(
    context: Command.LoaderContext,
    private readonly definition: CommandDefinition,
  ) {
    super(context, definition.options);
  }

  override registerApplicationCommands(registry: Command.Registry): void {
    registry.registerChatInputCommand((builder) =>
      this.definition.build(builder, this.commandName),
    );
  }

  protected get commandName(): string {
    return env.NODE_ENV === 'development' ? `dev-${this.name}` : this.name;
  }
}
