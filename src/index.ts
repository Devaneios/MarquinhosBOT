import { config } from "dotenv";
import Bot from "./bot";
config();

const marquinhos = new Bot();
marquinhos.loadTextCommands();
marquinhos.loadAudioCommands();
marquinhos.loadSlashCommands();
marquinhos.sendSlashCommands();
marquinhos.loadEvents();
marquinhos.start();
