import { Schema, model } from 'mongoose';
import { IBalanceStatement } from '@marquinhos/types';

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

const BalanceStatementModel = model('balanceStatement', BalanceStatementSchema);

export { BalanceStatementModel };
