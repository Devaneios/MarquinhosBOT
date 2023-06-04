import { config } from 'dotenv';
import Bot from './bot';
config();

const marquinhos = new Bot();

marquinhos.start();
