import { Schema, model } from 'mongoose';
import { IBalance, IBalanceStatement } from '@marquinhos/types';

const BalanceSchema = new Schema<IBalance>({
  userId: { required: true, type: String },
  guildId: { required: true, type: String },
  amount: { required: true, type: Number },
  lastUpdate: { required: true, type: Date },
});

const BalanceStatementSchema = new Schema<IBalanceStatement>({
  userId: { required: true, type: String },
  guildId: { required: true, type: String },
  amount: { required: true, type: Number },
  executedBy: { required: true, type: String },
  type: {
    required: true,
    type: String,
    enum: ['add', 'subtract', 'set', 'reset'],
  },
  date: { required: true, type: Date },
});

const BalanceModel = model('balance', BalanceSchema);

const BalanceStatementModel = model('balanceStatement', BalanceStatementSchema);

export { BalanceModel, BalanceStatementModel };
