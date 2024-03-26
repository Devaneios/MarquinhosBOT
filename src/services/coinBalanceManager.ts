import {
  BalanceModel,
  BalanceStatementModel,
} from '@marquinhos/database/schemas/balance';
import {
  BalanceChangeStatus,
  IBalance,
  IBalanceStatement,
} from '@marquinhos/types';
import { coerceNumberProperty } from '@marquinhos/utils/coercion';
import { Document } from 'mongoose';

export async function getCoinBalance(
  userId: string,
  guildId: string
): Promise<Number | null> {
  const userBalance = await BalanceModel.findOne({ userId, guildId }).exec();

  if (!userBalance) {
    return null;
  }

  return coerceNumberProperty(userBalance.amount);
}

export async function getBalanceStatement(
  userId: string,
  guildId: string
): Promise<IBalanceStatement[]> {
  const balanceStatement = await BalanceStatementModel.find({
    userId,
    guildId,
  }).exec();
  return balanceStatement;
}

export async function updateCoinBalance(
  userId: string,
  guildId: string,
  amount: number,
  executorId: string
): Promise<BalanceChangeStatus> {
  const coercedAmount = coerceNumberProperty(amount);
  const validAmount = coercedAmount >= 0;
  let balanceUpdated = false;

  if (validAmount) {
    const userBalance = await BalanceModel.findOne({ userId, guildId }).exec();

    if (!userBalance) {
      balanceUpdated = await createBalance(userId, guildId, coercedAmount);
    } else {
      balanceUpdated = await updateBalance(userBalance, coercedAmount);
    }
  }

  const statementCreated = await createBalanceStatement(
    userId,
    guildId,
    coercedAmount,
    executorId,
    'set'
  );

  return {
    operationSuccess: balanceUpdated,
    statementCreated: statementCreated,
    validAmount: validAmount,
  };
}

export async function addCoins(
  userId: string,
  guildId: string,
  amount: number,
  executorId: string
): Promise<BalanceChangeStatus> {
  const coercedAmount = coerceNumberProperty(amount);
  const validAmount = coercedAmount > 0;
  let balanceUpdated = false;

  if (validAmount) {
    const userBalance = await BalanceModel.findOne({ userId, guildId }).exec();

    if (userBalance) {
      const oldAmount = coerceNumberProperty(userBalance.amount);
      balanceUpdated = await updateBalance(
        userBalance,
        oldAmount + coercedAmount
      );
    } else {
      balanceUpdated = await createBalance(userId, guildId, coercedAmount);
    }
  }

  const statementCreated = await createBalanceStatement(
    userId,
    guildId,
    coercedAmount,
    executorId,
    'add'
  );

  return {
    operationSuccess: balanceUpdated,
    statementCreated: statementCreated,
    validAmount: validAmount,
  };
}

export async function subtractCoins(
  userId: string,
  guildId: string,
  amount: number,
  executorId: string
): Promise<BalanceChangeStatus> {
  const coercedAmount = coerceNumberProperty(amount);
  const validAmount = coercedAmount > 0;
  let balanceUpdated = false;
  let statementCreated = false;

  if (validAmount) {
    const userBalance = await BalanceModel.findOne({ userId, guildId }).exec();

    if (userBalance) {
      const oldAmount = coerceNumberProperty(userBalance.amount);
      const newAmount = oldAmount - coercedAmount;
      if (newAmount >= 0) {
        balanceUpdated = await updateBalance(userBalance, newAmount);
      }
    } else {
      balanceUpdated = await createBalance(userId, guildId, 0);
    }
  }

  if (balanceUpdated) {
    statementCreated = await createBalanceStatement(
      userId,
      guildId,
      coercedAmount,
      executorId,
      'subtract'
    );
  }

  return {
    operationSuccess: balanceUpdated,
    statementCreated: statementCreated,
    validAmount: validAmount,
  };
}

export async function resetCoins(
  userId: string,
  guildId: string,
  executorId: string
): Promise<BalanceChangeStatus> {
  const operationSuccess = !!(await BalanceModel.deleteOne({
    userId,
    guildId,
  }).exec());
  const statementCreated = await createBalanceStatement(
    userId,
    guildId,
    0,
    executorId,
    'reset'
  );
  return {
    operationSuccess,
    statementCreated,
    validAmount: true,
  };
}

async function updateBalance(
  userBalance: Document & IBalance,
  amount: number
): Promise<boolean> {
  userBalance.amount = amount;
  userBalance.lastUpdate = new Date();
  return !!(await userBalance.save());
}

async function createBalance(
  userId: string,
  guildId: string,
  amount: number
): Promise<boolean> {
  return !!(await BalanceModel.create({
    userId,
    guildId,
    amount,
    lastUpdate: new Date(),
  }));
}

async function createBalanceStatement(
  userId: string,
  guildId: string,
  amount: number,
  executedBy: string,
  type: string
): Promise<boolean> {
  return !!(await BalanceStatementModel.create({
    userId,
    guildId,
    amount,
    executedBy,
    type,
    date: new Date(),
  }));
}
