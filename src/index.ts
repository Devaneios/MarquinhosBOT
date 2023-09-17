import { config } from 'dotenv';
import { Bot } from 'src/bot';
config();

const marquinhos = new Bot();

marquinhos.start();
