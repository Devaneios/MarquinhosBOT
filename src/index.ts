import { MarquinhosBot } from '@marquinhos/bot/marquinhos-bot';
import { config } from 'dotenv';
import { safeExecute } from './utils/errorHandling';
process.env.ROOT_DIR = __dirname;
config();

const marquinhos = new MarquinhosBot();

safeExecute(marquinhos.start.bind(marquinhos))();
