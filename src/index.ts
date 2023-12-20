import { config } from 'dotenv';
import { Bot } from '@marquinhos/bot';
config();

const marquinhos = new Bot();

marquinhos.start();
