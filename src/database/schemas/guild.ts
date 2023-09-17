import { Schema, model } from 'mongoose';
import { IGuild } from 'src/types';

const GuildSchema = new Schema<IGuild>({
  guildID: { required: true, type: String },
  options: {
    prefix: { type: String, default: process.env.PREFIX },
    vipRoleId: { type: String },
    baseRoleId: { type: String },
    externalRoleId: { type: String },
    rouletteRoleId: { type: String },
    newcomersChannelId: { type: String },
    mainChannelId: { type: String },
  },
  roulette: {
    isRouletteOn: { type: Boolean, default: false },
    rouletteAdmins: { type: [String], default: [] },
  },
  joinedAt: { type: Date },
});

const GuildModel = model('guild', GuildSchema);

export default GuildModel;
