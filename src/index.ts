import { config } from 'dotenv';
import { MarquinhosBot } from '@marquinhos/bot/marquinhos-bot';
import { registerCommands } from './register-slash-commands';
import { safeExecute } from './utils/errorHandling';

process.env.ROOT_DIR = __dirname;
config();

await registerCommands();

const marquinhos = new MarquinhosBot();

safeExecute(marquinhos.start.bind(marquinhos))();
