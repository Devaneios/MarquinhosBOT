import { config } from 'dotenv';
import { Bot } from '@marquinhos/bot';
import { safeExecute } from './utils/errorHandling';
process.env.ROOT_DIR = __dirname;
config();

const marquinhos = new Bot();

safeExecute(marquinhos.start.bind(marquinhos))();
