import { env } from '@marquinhos/config/environment';
import { Command } from '@sapphire/framework';

export abstract class MarquinhosCommand extends Command {
  protected get commandName(): string {
    return env.NODE_ENV === 'development' ? `dev-${this.name}` : this.name;
  }
}
