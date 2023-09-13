import { Schema, model } from 'mongoose';
import { IGuild } from '../types';

const GuildSchema = new Schema<IGuild>({
  guildID: { required: true, type: String },
  options: {
    prefix: { type: String, default: process.env.PREFIX },
    vipRoleId: { type: String },
    baseRoleId: { type: String },
    externalRoleId: { type: String },
    rouletteRoleId: { type: String }
  },
  roulette: {
    isRouletteOn: { type: Boolean, default: false},
    rouletteAdmins: { type: Array<String> }
  },
  joinedAt: { type: Date },
});

const GuildModel = model('guild', GuildSchema);

export default GuildModel;
