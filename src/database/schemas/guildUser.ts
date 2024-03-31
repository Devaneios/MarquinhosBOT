import { Schema, model } from 'mongoose';
import { IGuildUser } from '@marquinhos/types';

const GuildUserSchema = new Schema<IGuildUser>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  silenced: { type: Boolean, default: false },
  arrested: { type: Boolean, default: false },
  coins: { type: Number, default: 0 },
  lastBonusRedeemed: { type: Date, default: new Date(0) },
  lastBetOnCoinFlip: { type: Date, default: new Date(0) },
  freeCoinFlipCount: { type: Number, default: 0 },
  lastBetOnAnimalLottery: { type: Date, default: new Date(0) },
});

const GuildUserModel = model('guildUsers', GuildUserSchema);

export default GuildUserModel;
