import { BalanceStatementModel } from '@marquinhos/database/schemas/balance';
import GuildUserModel from '@marquinhos/database/schemas/guildUser';
import {
  BalanceChangeStatus,
  IBalanceStatement,
  IGuildUser,
} from '@marquinhos/types';
import { coerceNumberProperty } from '@marquinhos/utils/coercion';
import { Document } from 'mongoose';

export async function getCoinBalance(
  userId: string,
  guildId: string
): Promise<Number | null> {
  const userBalance = await GuildUserModel.findOne({ userId, guildId }).exec();

  if (!userBalance) {
    return null;
  }

  return coerceNumberProperty(userBalance.coins);
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
    const userBalance = await GuildUserModel.findOne({
      userId,
      guildId,
    }).exec();

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
    const userBalance = await GuildUserModel.findOne({
      userId,
      guildId,
    }).exec();

    if (userBalance) {
      const oldAmount = coerceNumberProperty(userBalance.coins);
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
    const userBalance = await GuildUserModel.findOne({
      userId,
      guildId,
    }).exec();

    if (userBalance) {
      const oldAmount = coerceNumberProperty(userBalance.coins);
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
  const operationSuccess = !!(await GuildUserModel.deleteOne({
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
  userBalance: Document & IGuildUser,
  amount: number
): Promise<boolean> {
  userBalance.coins = amount;
  userBalance.lastBalanceUpdate = new Date();
  return !!(await userBalance.save());
}

async function createBalance(
  userId: string,
  guildId: string,
  amount: number
): Promise<boolean> {
  return !!(await GuildUserModel.create({
    userId,
    guildId,
    amount,
    lastBalanceUpdate: new Date(),
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
