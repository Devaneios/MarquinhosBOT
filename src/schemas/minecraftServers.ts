import { Schema, model } from 'mongoose';
import { IMinecraftServer } from '../types';

const MinecraftServerSchema = new Schema<IMinecraftServer>({
  guildID: { required: true, type: String },
  channelID: { required: true, type: String },
  messageID: { required: true, type: String },
  host: { required: true, type: String },
  port: { required: true, type: Number },
});

const MinecraftServerModel = model('minecraftServer', MinecraftServerSchema);

export default MinecraftServerModel;
