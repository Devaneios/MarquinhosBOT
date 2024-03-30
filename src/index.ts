import { config } from 'dotenv';
import { Bot } from '@marquinhos/bot';
process.env.ROOT_DIR = __dirname;
config();

const marquinhos = new Bot();

marquinhos.start();
